import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayrollRunItemRepository } from '../repositories/payroll-run-item.repository';
import { PayrollSourceRepository } from '../repositories/payroll-source.repository';
import { EmployeeSalaryRepository } from '../repositories/employee-salary.repository';
import { PayrollRunService } from './payroll-run.service';
import { PayrollAuditService } from './payroll-audit.service';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunItem } from '../entities/payroll-run-item.entity';
import { PayrollSetting } from '../entities/payroll-setting.entity';
import {
  AttendanceCutoffType,
  AuditAction,
  PayrollItemStatus,
  PayrollRunStatus,
} from '../enums/payroll.enum';

export interface PrepareSummary {
  run_id: string;
  total_employees: number;
  pending: number;
  errors: number;
  warnings: { user_id: string; message: string }[];
}

/**
 * Builds the per-employee item set for a Draft run by pulling the roster and
 * snapshotting attendance + leave for the pay period. Surfaces blocking errors
 * (missing salary structure) as ERROR items so they can be fixed before
 * processing. Idempotent — re-running refreshes every item in place.
 */
@Injectable()
export class PayrollPreparationService {
  private readonly logger = new Logger(PayrollPreparationService.name);

  constructor(
    private readonly runRepo: PayrollRunRepository,
    private readonly itemRepo: PayrollRunItemRepository,
    private readonly sourceRepo: PayrollSourceRepository,
    private readonly salaryRepo: EmployeeSalaryRepository,
    private readonly runService: PayrollRunService,
    private readonly audit: PayrollAuditService,
    @InjectRepository(PayrollSetting)
    private readonly settingRepo: Repository<PayrollSetting>,
  ) {}

  async prepare(user: LoggedInUser, runId: string): Promise<PrepareSummary> {
    const run = await this.runService.getRun(user, runId);

    if (run.run_status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException(
        `Payroll can only be prepared while in Draft. This run is ${run.run_status}.`,
      );
    }

    const fromDate = toDateStr(run.pay_period_from);
    // Attendance/leave are counted only up to the configured cutoff; days after it
    // roll into the next cycle (PayrollSetting.attendance_cutoff_*).
    const setting = await this.settingRepo.findOne({
      where: {
        enterprise_id: user.enterpriseId,
        organization_id: user.organizationId,
      },
    });
    const toDate = this.resolveAttendanceWindowEnd(run, setting);

    const employees = await this.sourceRepo.findEligibleEmployees(
      user.enterpriseId,
      user.organizationId,
    );

    const warnings: { user_id: string; message: string }[] = [];
    let pending = 0;
    let errors = 0;

    for (const emp of employees) {
      const item =
        (await this.itemRepo.findByRunAndUser(runId, emp.user_id)) ??
        this.itemRepo.create({
          enterprise_id: user.enterpriseId,
          organization_id: user.organizationId,
          payroll_run_id: runId,
          user_id: emp.user_id,
        });

      // Reset any prior calc result — a fresh prepare re-snapshots inputs only.
      item.gross = 0;
      item.deductions_total = 0;
      item.net = 0;
      item.employer_contribution = 0;
      item.reimbursement_total = 0;
      item.bonus_total = 0;
      item.calc_breakdown = null;
      item.modified_by = user.userId;

      const attendance = await this.sourceRepo.getAttendanceSummary(
        user.organizationId,
        emp.user_id,
        fromDate,
        toDate,
      );
      const leave = await this.sourceRepo.getLeaveSummary(
        user.organizationId,
        emp.user_id,
        fromDate,
        toDate,
      );

      const workingDays = attendance.no_data
        ? run.total_working_days
        : attendance.working_days;

      item.total_working_days = workingDays;
      item.present_days = attendance.present_days;
      item.paid_leave_days = leave.paid_leave_days;
      item.lop_days = attendance.absent_days + leave.unpaid_leave_days;

      const salary = await this.salaryRepo.findActiveSalary(emp.user_id);
      if (!salary) {
        item.item_status = PayrollItemStatus.ERROR;
        item.error_message = 'No active salary structure assigned.';
        item.salary_snapshot = null;
        errors++;
      } else {
        item.item_status = PayrollItemStatus.PENDING;
        item.error_message = null;
        item.salary_snapshot = {
          salary_id: salary.id,
          version_number: salary.version_number,
          ctc: salary.ctc,
        };
        pending++;
        if (attendance.no_data) {
          warnings.push({
            user_id: emp.user_id,
            message: 'No attendance records found for this period.',
          });
        }
      }

      await this.itemRepo.save(item);
    }

    run.total_employees = employees.length;
    await this.runRepo.save(run);

    await this.audit.record(
      user,
      'payroll_run',
      run.id,
      AuditAction.UPDATE,
      null,
      { event: 'prepare', total_employees: employees.length, pending, errors },
    );

    this.logger.log(
      `Prepared run ${runId}: ${employees.length} employees (${pending} pending, ${errors} errors)`,
    );

    return {
      run_id: runId,
      total_employees: employees.length,
      pending,
      errors,
      warnings,
    };
  }

  /**
   * The last calendar day of the pay period that attendance/leave is counted for,
   * honoring PayrollSetting.attendance_cutoff_*. Defaults to the period end when
   * no setting/cutoff is configured.
   */
  private resolveAttendanceWindowEnd(
    run: PayrollRun,
    setting: PayrollSetting | null,
  ): string {
    const periodTo = toDateStr(run.pay_period_to);
    if (!setting || setting.attendance_cutoff_value == null) return periodTo;

    const [year, month] = periodTo.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    let day = lastDay;
    if (setting.attendance_cutoff_type === AttendanceCutoffType.FIXED_DATE) {
      day = Math.min(setting.attendance_cutoff_value || lastDay, lastDay);
    } else if (
      setting.attendance_cutoff_type ===
      AttendanceCutoffType.DAYS_BEFORE_MONTH_END
    ) {
      day = Math.max(1, lastDay - (setting.attendance_cutoff_value || 0));
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Pre-process validation: lists items that would block a clean run (ERROR
   * status). Returned alongside counts so the UI can gate the Process action.
   */
  async validate(user: LoggedInUser, runId: string) {
    const run = await this.runService.getRun(user, runId);
    const counts = await this.itemRepo.countByStatus(runId);
    const items = await this.itemRepo.findAllByRun(runId);

    const blocking = items
      .filter((i) => i.item_status === PayrollItemStatus.ERROR)
      .map((i) => ({
        item_id: i.id,
        user_id: i.user_id,
        error_message: i.error_message,
      }));

    // Business rule: attendance should be finalized before processing. We surface
    // employees with pending-approval attendance as a warning (advisory — it does
    // not hard-block, so orgs that don't use the approval flow aren't stuck).
    const pendingAttendanceEmployees =
      await this.sourceRepo.findEmployeesWithPendingAttendance(
        user.organizationId,
        toDateStr(run.pay_period_from),
        toDateStr(run.pay_period_to),
      );

    // Auto-checkout correction requests still pending HR review block the run —
    // the corrected hours could change pay (auto-checkout.md §12.4).
    const pendingCorrectionEmployees =
      await this.sourceRepo.findEmployeesWithPendingCorrections(
        user.organizationId,
        toDateStr(run.pay_period_from),
        toDateStr(run.pay_period_to),
      );

    return {
      run_id: runId,
      can_process:
        counts[PayrollItemStatus.PENDING] > 0 &&
        blocking.length === 0 &&
        pendingCorrectionEmployees.length === 0,
      counts,
      blocking,
      attendance: {
        finalized: pendingAttendanceEmployees.length === 0,
        pending_approval_count: pendingAttendanceEmployees.length,
        pending_approval_employee_ids: pendingAttendanceEmployees,
      },
      corrections: {
        pending_count: pendingCorrectionEmployees.length,
        pending_employee_ids: pendingCorrectionEmployees,
      },
    };
  }
}

/** Normalizes a TypeORM `date` column (string or Date) to `YYYY-MM-DD`. */
function toDateStr(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}
