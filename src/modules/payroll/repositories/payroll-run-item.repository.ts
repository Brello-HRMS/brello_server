import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollRunItem } from '../entities/payroll-run-item.entity';
import { PayrollItemStatus, PayrollRunStatus } from '../enums/payroll.enum';

@Injectable()
export class PayrollRunItemRepository {
  constructor(
    @InjectRepository(PayrollRunItem)
    private readonly itemRepo: Repository<PayrollRunItem>,
  ) {}

  async findByRunAndUser(
    runId: string,
    userId: string,
  ): Promise<PayrollRunItem | null> {
    return this.itemRepo.findOne({
      where: { payroll_run_id: runId, user_id: userId },
    });
  }

  async findById(
    organizationId: string,
    runId: string,
    itemId: string,
  ): Promise<PayrollRunItem | null> {
    return this.itemRepo.findOne({
      where: {
        id: itemId,
        payroll_run_id: runId,
        organization_id: organizationId,
      },
      relations: ['user'],
    });
  }

  async list(
    runId: string,
    filters: { status?: PayrollItemStatus; page: number; limit: number },
  ): Promise<{ data: PayrollRunItem[]; total: number }> {
    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.user', 'user')
      .where('item.payroll_run_id = :runId', { runId });

    if (filters.status) {
      qb.andWhere('item.item_status = :status', { status: filters.status });
    }

    qb.orderBy('user.first_name', 'ASC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findAllByRun(runId: string): Promise<PayrollRunItem[]> {
    return this.itemRepo.find({ where: { payroll_run_id: runId } });
  }

  /** A user's own items across locked runs (employee self-service payslips). */
  async findLockedForUser(
    organizationId: string,
    userId: string,
  ): Promise<PayrollRunItem[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.payroll_run', 'run')
      .where('item.organization_id = :organizationId', { organizationId })
      .andWhere('item.user_id = :userId', { userId })
      .andWhere('item.item_status = :status', {
        status: PayrollItemStatus.PROCESSED,
      })
      .andWhere('run.run_status = :runStatus', {
        runStatus: PayrollRunStatus.LOCKED,
      })
      .orderBy('run.year', 'DESC')
      .addOrderBy('run.month', 'DESC')
      .getMany();
  }

  async countByStatus(
    runId: string,
  ): Promise<Record<PayrollItemStatus, number>> {
    const rows = await this.itemRepo
      .createQueryBuilder('item')
      .select('item.item_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('item.payroll_run_id = :runId', { runId })
      .groupBy('item.item_status')
      .getRawMany<{ status: PayrollItemStatus; count: string }>();

    const result = {
      [PayrollItemStatus.PENDING]: 0,
      [PayrollItemStatus.PROCESSED]: 0,
      [PayrollItemStatus.ERROR]: 0,
    };
    for (const row of rows) {
      result[row.status] = Number(row.count);
    }
    return result;
  }

  async save(item: PayrollRunItem): Promise<PayrollRunItem> {
    return this.itemRepo.save(item);
  }

  create(data: Partial<PayrollRunItem>): PayrollRunItem {
    return this.itemRepo.create(data);
  }
}
