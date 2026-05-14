import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RemoteApproval } from '../entities/remote-approval.entity';
import { ApprovalStatus } from '../enums/approval-status.enum';

export interface PendingApprovalRow {
  approval: RemoteApproval;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  emp_code: string | null;
  date: string;
  first_check_in_at: Date | null;
}

@Injectable()
export class RemoteApprovalRepository {
  constructor(
    @InjectRepository(RemoteApproval)
    private readonly repo: Repository<RemoteApproval>,
  ) {}

  async create(data: Partial<RemoteApproval>): Promise<RemoteApproval> {
    return this.repo.save(this.repo.create(data));
  }

  async findByRecord(
    recordId: string,
    organizationId: string,
  ): Promise<RemoteApproval | null> {
    return this.repo.findOne({
      where: {
        attendance_record_id: recordId,
        organization_id: organizationId,
        is_deleted: false,
      },
    });
  }

  async update(id: string, data: Partial<RemoteApproval>): Promise<void> {
    await this.repo.update(id, data);
  }

  async listPending(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<{ rows: PendingApprovalRow[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('a')
      .innerJoin('attendance_records', 'r', 'r.id = a.attendance_record_id')
      .leftJoin('users', 'u', 'u.id = a.employee_id')
      .where('a.organization_id = :orgId', { orgId: organizationId })
      .andWhere('a.approval_status = :pending', {
        pending: ApprovalStatus.PENDING,
      })
      .andWhere('a.is_deleted = false')
      .addSelect('u.first_name', 'u_first_name')
      .addSelect('u.middle_name', 'u_middle_name')
      .addSelect('u.last_name', 'u_last_name')
      .addSelect('u.code', 'u_emp_code')
      .addSelect('r.date', 'r_date')
      .addSelect('r.first_check_in_at', 'r_first_check_in_at')
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    interface RawJoin {
      u_first_name?: string | null;
      u_middle_name?: string | null;
      u_last_name?: string | null;
      u_emp_code?: string | null;
      r_date?: string;
      r_first_check_in_at?: Date | null;
    }

    const result = await qb.getRawAndEntities<RawJoin>();
    const total = await qb.getCount();

    const rows: PendingApprovalRow[] = result.entities.map((approval, idx) => {
      const raw = result.raw[idx] ?? ({} as RawJoin);
      return {
        approval,
        first_name: raw.u_first_name ?? null,
        middle_name: raw.u_middle_name ?? null,
        last_name: raw.u_last_name ?? null,
        emp_code: raw.u_emp_code ?? null,
        date: raw.r_date ?? '',
        first_check_in_at: raw.r_first_check_in_at ?? null,
      };
    });

    return { rows, total };
  }
}
