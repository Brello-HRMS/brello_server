import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, Repository } from 'typeorm';
import { LeaveBalanceLedger } from '../entities/leave-balance-ledger.entity';

export interface LedgerListFilters {
  balanceId: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class LeaveBalanceLedgerRepository {
  constructor(
    @InjectRepository(LeaveBalanceLedger)
    private readonly repo: Repository<LeaveBalanceLedger>,
  ) {}

  async append(
    data: Partial<LeaveBalanceLedger>,
    manager?: EntityManager,
  ): Promise<LeaveBalanceLedger> {
    if (manager) {
      const entity = manager.create(LeaveBalanceLedger, data);
      return manager.save(entity);
    }
    return this.repo.save(this.repo.create(data));
  }

  async list(
    filters: LedgerListFilters,
  ): Promise<{ data: LeaveBalanceLedger[]; total: number }> {
    const { page = 1, limit = 50 } = filters;
    const where: Record<string, unknown> = { balance_id: filters.balanceId };
    if (filters.fromDate && filters.toDate) {
      where['created_at'] = Between(
        new Date(filters.fromDate),
        new Date(filters.toDate),
      );
    }
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
