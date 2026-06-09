import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { PayrollAdjustmentRepository } from '../repositories/payroll-adjustment.repository';
import { PayrollRunItemRepository } from '../repositories/payroll-run-item.repository';
import { PayrollRunService } from './payroll-run.service';
import { PayrollAuditService } from './payroll-audit.service';
import { CreateAdjustmentDto } from '../dto/payroll-adjustment.dto';
import { PayrollRunAdjustment } from '../entities/payroll-run-adjustment.entity';
import { AuditAction, PayrollRunStatus } from '../enums/payroll.enum';

/**
 * Manual bonus/deduction lines on a run's employees. Mutations are blocked once
 * the run is locked. Adding or removing an adjustment does not auto-recalculate —
 * callers run the per-item reprocess endpoint to fold the change into pay.
 */
@Injectable()
export class PayrollAdjustmentService {
  constructor(
    private readonly adjustmentRepo: PayrollAdjustmentRepository,
    private readonly itemRepo: PayrollRunItemRepository,
    private readonly runService: PayrollRunService,
    private readonly audit: PayrollAuditService,
  ) {}

  async addAdjustment(
    user: LoggedInUser,
    runId: string,
    itemId: string,
    dto: CreateAdjustmentDto,
  ): Promise<PayrollRunAdjustment> {
    const run = await this.runService.getRun(user, runId);
    this.assertUnlocked(run.run_status);

    const item = await this.itemRepo.findById(user.organizationId, runId, itemId);
    if (!item) {
      throw new NotFoundException('Payroll item not found.');
    }

    const adjustment = this.adjustmentRepo.create({
      enterprise_id: user.enterpriseId,
      organization_id: user.organizationId,
      payroll_run_id: runId,
      user_id: item.user_id,
      adjustment_type: dto.adjustment_type,
      amount: dto.amount,
      reason: dto.reason ?? null,
      created_by: user.userId,
      modified_by: user.userId,
    });
    const saved = await this.adjustmentRepo.save(adjustment);

    await this.audit.record(
      user,
      'payroll_run_adjustment',
      saved.id,
      AuditAction.CREATE,
      null,
      {
        payroll_run_id: runId,
        user_id: item.user_id,
        adjustment_type: dto.adjustment_type,
        amount: dto.amount,
      },
    );

    return saved;
  }

  async listAdjustments(
    user: LoggedInUser,
    runId: string,
    itemId: string,
  ): Promise<PayrollRunAdjustment[]> {
    const item = await this.itemRepo.findById(user.organizationId, runId, itemId);
    if (!item) {
      throw new NotFoundException('Payroll item not found.');
    }
    return this.adjustmentRepo.listForUser(runId, item.user_id);
  }

  async removeAdjustment(
    user: LoggedInUser,
    runId: string,
    adjustmentId: string,
  ): Promise<void> {
    const run = await this.runService.getRun(user, runId);
    this.assertUnlocked(run.run_status);

    const adjustment = await this.adjustmentRepo.findById(
      user.organizationId,
      runId,
      adjustmentId,
    );
    if (!adjustment) {
      throw new NotFoundException('Adjustment not found.');
    }

    await this.audit.record(
      user,
      'payroll_run_adjustment',
      adjustment.id,
      AuditAction.DELETE,
      {
        user_id: adjustment.user_id,
        adjustment_type: adjustment.adjustment_type,
        amount: adjustment.amount,
      },
      null,
    );

    await this.adjustmentRepo.remove(adjustment);
  }

  private assertUnlocked(status: PayrollRunStatus): void {
    if (status === PayrollRunStatus.LOCKED) {
      throw new ConflictException(
        'Payroll run is locked. Adjustments can no longer be changed.',
      );
    }
  }
}
