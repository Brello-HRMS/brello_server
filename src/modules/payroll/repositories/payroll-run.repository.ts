import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { PayrollRun } from '../entities/payroll-run.entity';
import { FinancialMonth, PayrollRunStatus } from '../enums/payroll.enum';

export interface CreatePayrollRunPayload {
  enterprise_id: string;
  organization_id: string;
  month: FinancialMonth;
  year: number;
  pay_period_from: Date;
  pay_period_to: Date;
  total_working_days: number;
  modified_by: string;
}

@Injectable()
export class PayrollRunRepository {
  constructor(
    @InjectRepository(PayrollRun)
    private readonly runRepo: Repository<PayrollRun>,
  ) {}

  async findByPeriod(
    organizationId: string,
    year: number,
    month: FinancialMonth,
  ): Promise<PayrollRun | null> {
    return this.runRepo.findOne({
      where: { organization_id: organizationId, year, month },
    });
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<PayrollRun | null> {
    return this.runRepo.findOne({
      where: { id, organization_id: organizationId },
    });
  }

  async list(
    enterpriseId: string,
    organizationId: string,
    filters: { status?: PayrollRunStatus; year?: number },
  ): Promise<PayrollRun[]> {
    const where: FindOptionsWhere<PayrollRun> = {
      enterprise_id: enterpriseId,
      organization_id: organizationId,
    };
    if (filters.status) where.run_status = filters.status;
    if (filters.year) where.year = filters.year;

    return this.runRepo.find({
      where,
      order: { year: 'DESC', created_at: 'DESC' },
    });
  }

  async create(payload: CreatePayrollRunPayload): Promise<PayrollRun> {
    const run = this.runRepo.create({
      ...payload,
      run_status: PayrollRunStatus.DRAFT,
    });
    return this.runRepo.save(run);
  }

  async save(run: PayrollRun): Promise<PayrollRun> {
    return this.runRepo.save(run);
  }

  async remove(run: PayrollRun): Promise<void> {
    await this.runRepo.remove(run);
  }
}
