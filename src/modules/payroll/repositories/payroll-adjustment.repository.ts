import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollRunAdjustment } from '../entities/payroll-run-adjustment.entity';
import { AdjustmentType } from '../enums/payroll.enum';

export interface AdjustmentTotals {
  bonus: number;
  deduction: number;
}

@Injectable()
export class PayrollAdjustmentRepository {
  constructor(
    @InjectRepository(PayrollRunAdjustment)
    private readonly repo: Repository<PayrollRunAdjustment>,
  ) {}

  /** Sums BONUS and DEDUCTION adjustments for one employee in a run. */
  async sumForUser(runId: string, userId: string): Promise<AdjustmentTotals> {
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('a.adjustment_type', 'type')
      .addSelect('COALESCE(SUM(a.amount), 0)', 'total')
      .where('a.payroll_run_id = :runId', { runId })
      .andWhere('a.user_id = :userId', { userId })
      .groupBy('a.adjustment_type')
      .getRawMany<{ type: AdjustmentType; total: string }>();

    const totals: AdjustmentTotals = { bonus: 0, deduction: 0 };
    for (const row of rows) {
      if (row.type === AdjustmentType.BONUS) totals.bonus = Number(row.total);
      if (row.type === AdjustmentType.DEDUCTION)
        totals.deduction = Number(row.total);
    }
    return totals;
  }

  create(data: Partial<PayrollRunAdjustment>): PayrollRunAdjustment {
    return this.repo.create(data);
  }

  async save(
    adjustment: PayrollRunAdjustment,
  ): Promise<PayrollRunAdjustment> {
    return this.repo.save(adjustment);
  }

  async listForUser(
    runId: string,
    userId: string,
  ): Promise<PayrollRunAdjustment[]> {
    return this.repo.find({
      where: { payroll_run_id: runId, user_id: userId },
      order: { created_at: 'ASC' },
    });
  }

  async listAllByRun(runId: string): Promise<PayrollRunAdjustment[]> {
    return this.repo.find({ where: { payroll_run_id: runId } });
  }

  async findById(
    organizationId: string,
    runId: string,
    adjustmentId: string,
  ): Promise<PayrollRunAdjustment | null> {
    return this.repo.findOne({
      where: {
        id: adjustmentId,
        payroll_run_id: runId,
        organization_id: organizationId,
      },
    });
  }

  async remove(adjustment: PayrollRunAdjustment): Promise<void> {
    await this.repo.remove(adjustment);
  }
}
