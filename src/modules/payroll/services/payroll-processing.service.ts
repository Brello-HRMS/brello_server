import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayrollRunItemRepository } from '../repositories/payroll-run-item.repository';
import { PayrollAdjustmentRepository } from '../repositories/payroll-adjustment.repository';
import { PayrollReimbursementRepository } from '../repositories/payroll-reimbursement.repository';
import { EmployeeSalaryRepository } from '../repositories/employee-salary.repository';
import { PayrollCalculationEngine } from './payroll-calculation.service';
import { PayrollRunService } from './payroll-run.service';
import { PayrollAuditService } from './payroll-audit.service';
import { PayslipPdfService } from './payslip-pdf.service';
import { AuditContextService } from '../../audit/services/audit-context.service';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunItem } from '../entities/payroll-run-item.entity';
import {
  AuditAction,
  ComponentType,
  PayrollItemStatus,
  PayrollRunStatus,
  PayoutStatus,
} from '../enums/payroll.enum';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Runs the calculation engine across a prepared run. For each employee it
 * resolves the active salary structure, applies LOP from the attendance
 * snapshot, folds in manual adjustments and approved reimbursements, then freezes
 * the result on the item. Run totals are rolled up and the run is marked
 * Completed. Idempotent — a run can be re-processed until it is Locked.
 */
@Injectable()
export class PayrollProcessingService {
  private readonly logger = new Logger(PayrollProcessingService.name);

  constructor(
    private readonly runRepo: PayrollRunRepository,
    private readonly itemRepo: PayrollRunItemRepository,
    private readonly adjustmentRepo: PayrollAdjustmentRepository,
    private readonly reimbursementRepo: PayrollReimbursementRepository,
    private readonly salaryRepo: EmployeeSalaryRepository,
    private readonly calcEngine: PayrollCalculationEngine,
    private readonly runService: PayrollRunService,
    private readonly audit: PayrollAuditService,
    private readonly payslipPdf: PayslipPdfService,
    private readonly auditContext: AuditContextService,
  ) {}

  async process(user: LoggedInUser, runId: string) {
    const run = await this.runService.getRun(user, runId);
    this.assertMutable(run);

    // Guard against a concurrent/double-submitted process of the same run.
    if (run.run_status === PayrollRunStatus.PROCESSING) {
      throw new ConflictException(
        'Payroll run is already being processed. Please wait for it to finish.',
      );
    }

    const items = await this.itemRepo.findAllByRun(runId);
    if (!items.length) {
      throw new BadRequestException(
        'No employees to process. Prepare the payroll run first.',
      );
    }

    run.run_status = PayrollRunStatus.PROCESSING;
    await this.runRepo.save(run);

    let processed = 0;
    let errors = 0;
    for (const item of items) {
      await this.computeItem(user, run, item);
      if (item.item_status === PayrollItemStatus.PROCESSED) processed++;
      else errors++;
    }

    this.applyRollup(run, items);
    run.run_status = PayrollRunStatus.COMPLETED;
    run.processed_at = nowOrNull();
    run.processed_by = user.userId;
    await this.runRepo.save(run);

    await this.audit.record(user, 'payroll_run', run.id, AuditAction.PROCESS, null, {
      processed,
      errors,
      total_net: run.total_net,
    });

    this.logger.log(
      `Processed run ${runId}: ${processed} processed, ${errors} errors, net ${run.total_net}`,
    );
    return { run_id: runId, processed, errors, totals: this.totals(run) };
  }

  /** Recalculates a single employee (e.g. after an adjustment or attendance fix). */
  async reprocessItem(user: LoggedInUser, runId: string, itemId: string) {
    const run = await this.runService.getRun(user, runId);
    this.assertMutable(run);

    const item = await this.itemRepo.findById(user.organizationId, runId, itemId);
    if (!item) {
      throw new BadRequestException('Payroll item not found.');
    }

    this.auditContext.setPreValue(item as unknown as Record<string, unknown>);

    await this.computeItem(user, run, item);

    const items = await this.itemRepo.findAllByRun(runId);
    this.applyRollup(run, items);
    await this.runRepo.save(run);

    await this.audit.record(user, 'payroll_run_item', item.id, AuditAction.PROCESS, null, {
      net: item.net,
      status: item.item_status,
    });

    return item;
  }

  /**
   * Finalizes a run. Permitted only when every employee is PROCESSED. Marks the
   * consumed reimbursements as paid and freezes the run — no further edits.
   */
  async lock(user: LoggedInUser, runId: string) {
    const run = await this.runService.getRun(user, runId);

    if (run.run_status === PayrollRunStatus.LOCKED) {
      throw new ConflictException('Payroll run is already locked.');
    }
    if (run.run_status !== PayrollRunStatus.COMPLETED) {
      throw new BadRequestException(
        'Payroll must be processed before it can be locked.',
      );
    }

    const counts = await this.itemRepo.countByStatus(runId);
    if (
      counts[PayrollItemStatus.PENDING] > 0 ||
      counts[PayrollItemStatus.ERROR] > 0
    ) {
      throw new BadRequestException(
        'All employees must be processed successfully before locking. ' +
          `${counts[PayrollItemStatus.ERROR]} error(s), ` +
          `${counts[PayrollItemStatus.PENDING]} pending.`,
      );
    }

    const lockedAt = nowOrNull();
    await this.reimbursementRepo.markPaidForRun(runId, lockedAt);

    run.run_status = PayrollRunStatus.LOCKED;
    run.locked_at = lockedAt;
    run.locked_by = user.userId;
    await this.runRepo.save(run);

    // Render & store payslip PDFs. Per-item failures are swallowed inside the
    // service so a storage hiccup never leaves the run half-locked.
    await this.payslipPdf.generateForRun(user, run);

    await this.audit.record(user, 'payroll_run', run.id, AuditAction.LOCK, null, {
      locked_at: lockedAt,
      total_net: run.total_net,
      total_employees: run.total_employees,
    });

    this.logger.log(`Payroll run ${runId} locked by ${user.userId}`);
    return run;
  }

  /**
   * Records payout/disbursement of a locked run. Marks the targeted processed
   * items PAID (all of them, or a subset via item_ids) and stamps the run with a
   * payout reference. The run flips to fully disbursed once every processed item
   * is paid.
   */
  async disburse(
    user: LoggedInUser,
    runId: string,
    dto: { reference?: string; item_ids?: string[] },
  ) {
    const run = await this.runService.getRun(user, runId);
    if (run.run_status !== PayrollRunStatus.LOCKED) {
      throw new BadRequestException(
        'Payroll must be locked before it can be marked as disbursed.',
      );
    }

    const items = await this.itemRepo.findAllByRun(runId);
    const processed = items.filter(
      (i) => i.item_status === PayrollItemStatus.PROCESSED,
    );

    let target = processed;
    if (dto.item_ids?.length) {
      const wanted = new Set(dto.item_ids);
      target = processed.filter((i) => wanted.has(i.id));
      if (!target.length) {
        throw new BadRequestException(
          'None of the provided items are processed in this run.',
        );
      }
    }

    const paidAt = nowOrNull();
    let markedPaid = 0;
    for (const item of target) {
      if (item.payout_status === PayoutStatus.PAID) continue;
      item.payout_status = PayoutStatus.PAID;
      item.paid_at = paidAt;
      item.modified_by = user.userId;
      await this.itemRepo.save(item);
      markedPaid++;
    }

    run.is_disbursed = processed.every(
      (i) => i.payout_status === PayoutStatus.PAID,
    );
    run.disbursed_at = paidAt;
    run.disbursed_by = user.userId;
    if (dto.reference) run.disbursement_reference = dto.reference;
    await this.runRepo.save(run);

    await this.audit.record(
      user,
      'payroll_run',
      run.id,
      AuditAction.DISBURSE,
      null,
      {
        marked_paid: markedPaid,
        is_disbursed: run.is_disbursed,
        reference: dto.reference ?? null,
      },
    );

    this.logger.log(
      `Payroll run ${runId} disbursement recorded by ${user.userId} (${markedPaid} paid)`,
    );
    return {
      run_id: runId,
      marked_paid: markedPaid,
      total_processed: processed.length,
      is_disbursed: run.is_disbursed,
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────────

  private assertMutable(run: PayrollRun): void {
    if (run.run_status === PayrollRunStatus.LOCKED) {
      throw new ConflictException('Payroll run is locked and cannot be changed.');
    }
  }

  /**
   * Resolves salary + adjustments + reimbursements for one item and writes the
   * frozen result back onto it. Marks ERROR (and releases any reimbursements)
   * when no active salary structure exists.
   */
  private async computeItem(
    user: LoggedInUser,
    run: PayrollRun,
    item: PayrollRunItem,
  ): Promise<void> {
    const salary = await this.salaryRepo.findActiveSalary(item.user_id);
    if (!salary) {
      await this.reimbursementRepo.releaseForUser(
        user.organizationId,
        item.user_id,
        run.id,
      );
      this.markError(item, user.userId, 'No active salary structure assigned.');
      await this.itemRepo.save(item);
      return;
    }

    const withComponents = await this.salaryRepo.findSalaryWithComponents(
      salary.id,
    );
    const components = withComponents?.components ?? [];
    const earnings = components
      .filter((c) => c.component_type === ComponentType.EARNING)
      .map((c) => ({
        name: c.component_name,
        type: c.component_type,
        value: Number(c.value),
      }));
    const deductions = components
      .filter((c) => c.component_type === ComponentType.DEDUCTION)
      .map((c) => ({
        name: c.component_name,
        type: c.component_type,
        value: Number(c.value),
      }));

    const adjustments = await this.adjustmentRepo.sumForUser(run.id, item.user_id);

    // Per-employee statutory override (PF applicability / override base), as of
    // the pay-period end.
    const statutoryOverride = await this.salaryRepo.findActiveStatutoryOverride(
      item.user_id,
      run.pay_period_to,
    );

    const result = await this.calcEngine.calculate(
      user.enterpriseId,
      user.organizationId,
      { earnings, deductions },
      {
        bonus: adjustments.bonus || undefined,
        lwp_days: item.lop_days || undefined,
        total_working_days: item.total_working_days || undefined,
      },
      statutoryOverride
        ? {
            pf_applicable: statutoryOverride.pf_applicable,
            pf_override_salary: statutoryOverride.pf_override_salary ?? null,
          }
        : undefined,
    );

    // Manual deduction adjustments (applied after the engine, like dry-run).
    if (adjustments.deduction) {
      result.deductions_total += adjustments.deduction;
      result.net -= adjustments.deduction;
      result.deductions.push({
        name: 'Adjustments (Deduction)',
        type: 'dynamic',
        value: adjustments.deduction,
        calculated_value: adjustments.deduction,
      });
    }

    // Approved reimbursements are added on top of net pay (decision: add to net).
    const reimbursements = await this.reimbursementRepo.findIncludable(
      user.organizationId,
      item.user_id,
      run.id,
    );
    const reimbTotal = round2(
      reimbursements.reduce((sum, r) => sum + Number(r.amount), 0),
    );
    if (reimbTotal > 0) {
      result.net += reimbTotal;
      result.earnings.push({
        name: 'Reimbursements',
        type: 'reimbursement',
        value: reimbTotal,
        calculated_value: reimbTotal,
      });
      await this.reimbursementRepo.stampProcessed(
        reimbursements.map((r) => r.id),
        run.id,
      );
    }

    item.gross = round2(result.gross);
    item.deductions_total = round2(result.deductions_total);
    item.net = round2(result.net);
    item.employer_contribution = round2(result.employer_contribution);
    item.reimbursement_total = reimbTotal;
    item.bonus_total = round2(adjustments.bonus);
    item.calc_breakdown = {
      earnings: result.earnings,
      deductions: result.deductions,
      warnings: result.warnings,
    };
    item.item_status = PayrollItemStatus.PROCESSED;
    item.error_message = null;
    item.modified_by = user.userId;
    await this.itemRepo.save(item);
  }

  private markError(
    item: PayrollRunItem,
    userId: string,
    message: string,
  ): void {
    item.item_status = PayrollItemStatus.ERROR;
    item.error_message = message;
    item.gross = 0;
    item.deductions_total = 0;
    item.net = 0;
    item.employer_contribution = 0;
    item.reimbursement_total = 0;
    item.bonus_total = 0;
    item.calc_breakdown = null;
    item.modified_by = userId;
  }

  /** Recomputes run-level totals from its processed items. */
  private applyRollup(run: PayrollRun, items: PayrollRunItem[]): void {
    const processed = items.filter(
      (i) => i.item_status === PayrollItemStatus.PROCESSED,
    );
    run.total_employees = items.length;
    run.total_gross = round2(sum(processed, (i) => Number(i.gross)));
    run.total_deductions = round2(sum(processed, (i) => Number(i.deductions_total)));
    run.total_net = round2(sum(processed, (i) => Number(i.net)));
    run.total_employer_contribution = round2(
      sum(processed, (i) => Number(i.employer_contribution)),
    );
    run.total_reimbursement = round2(
      sum(processed, (i) => Number(i.reimbursement_total)),
    );
  }

  private totals(run: PayrollRun) {
    return {
      total_employees: run.total_employees,
      total_gross: run.total_gross,
      total_deductions: run.total_deductions,
      total_net: run.total_net,
      total_employer_contribution: run.total_employer_contribution,
      total_reimbursement: run.total_reimbursement,
    };
  }
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + pick(row), 0);
}

/** Current timestamp; isolated so it is easy to stub in tests. */
function nowOrNull(): Date {
  return new Date();
}
