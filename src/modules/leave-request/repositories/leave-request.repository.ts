import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { LeaveRequest } from '../entities/leave-request.entity';
import { LeaveRequestStatus } from '../enums';

export interface ListRequestFilters {
  organizationId: string;
  statuses?: LeaveRequestStatus[];
  employeeId?: string;
  search?: string;
  departmentId?: string;
  leaveTypeId?: string;
  fromDate?: string;
  toDate?: string;
  submittedFrom?: string;
  submittedTo?: string;
  page?: number;
  limit?: number;
  sortBy?: 'submitted_at' | 'from_date';
  sortOrder?: 'ASC' | 'DESC';
}

export interface RequestListRow {
  request: LeaveRequest;
  employee_first_name: string | null;
  employee_middle_name: string | null;
  employee_last_name: string | null;
  employee_code: string | null;
  department_name: string | null;
}

@Injectable()
export class LeaveRequestRepository {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly repo: Repository<LeaveRequest>,
  ) {}

  async create(data: Partial<LeaveRequest>): Promise<LeaveRequest> {
    return this.repo.save(this.repo.create(data));
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<LeaveRequest | null> {
    return this.repo.findOne({
      where: { id, organization_id: organizationId },
      relations: ['leave_type'],
    });
  }

  async update(id: string, data: Partial<LeaveRequest>): Promise<void> {
    await this.repo.update(id, data);
  }

  async hardDelete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async findOverlapping(
    employeeId: string,
    organizationId: string,
    fromDate: string,
    toDate: string,
    excludeRequestId?: string,
  ): Promise<LeaveRequest[]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.organization_id = :organizationId', { organizationId })
      .andWhere('r.request_status IN (:...statuses)', {
        statuses: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED],
      })
      .andWhere('r.from_date <= :toDate', { toDate })
      .andWhere('r.to_date >= :fromDate', { fromDate });

    if (excludeRequestId) {
      qb.andWhere('r.id != :excludeRequestId', { excludeRequestId });
    }
    return qb.getMany();
  }

  async sumDaysInMonth(
    employeeId: string,
    organizationId: string,
    leaveTypeId: string,
    yearMonthStart: string,
    yearMonthEnd: string,
    excludeRequestId?: string,
  ): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.total_days),0)', 'sum')
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.organization_id = :organizationId', { organizationId })
      .andWhere('r.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('r.request_status IN (:...statuses)', {
        statuses: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED],
      })
      .andWhere('r.from_date <= :end', { end: yearMonthEnd })
      .andWhere('r.to_date >= :start', { start: yearMonthStart });

    if (excludeRequestId) {
      qb.andWhere('r.id != :excludeRequestId', { excludeRequestId });
    }

    const raw = await qb.getRawOne<{ sum: string }>();
    return Number(raw?.sum ?? 0);
  }

  async aggregateForRecompute(
    employeeId: string,
    leaveTypeId: string,
    leaveYear: number,
    organizationId: string,
  ): Promise<{ pending: number; used: number }> {
    const raw = await this.repo
      .createQueryBuilder('r')
      .select(
        `SUM(CASE WHEN r.request_status = :pending THEN r.total_days ELSE 0 END)`,
        'pending',
      )
      .addSelect(
        `SUM(CASE WHEN r.request_status = :approved THEN r.total_days ELSE 0 END)`,
        'used',
      )
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('r.leave_year = :leaveYear', { leaveYear })
      .andWhere('r.organization_id = :organizationId', { organizationId })
      .setParameter('pending', LeaveRequestStatus.PENDING)
      .setParameter('approved', LeaveRequestStatus.APPROVED)
      .getRawOne<{ pending: string; used: string }>();

    return {
      pending: Number(raw?.pending ?? 0),
      used: Number(raw?.used ?? 0),
    };
  }

  async list(
    filters: ListRequestFilters,
  ): Promise<{ rows: RequestListRow[]; total: number }> {
    const { page = 1, limit = 20 } = filters;
    const sortBy = filters.sortBy ?? 'submitted_at';
    const sortOrder = filters.sortOrder ?? 'DESC';

    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.leave_type', 'lt')
      .leftJoin('users', 'u', 'u.id = r.employee_id')
      .leftJoin('departments', 'd', 'd.id = u.department_id')
      .where('r.organization_id = :orgId', { orgId: filters.organizationId });

    if (filters.statuses && filters.statuses.length > 0) {
      qb.andWhere('r.request_status IN (:...statuses)', {
        statuses: filters.statuses,
      });
    }
    if (filters.employeeId) {
      qb.andWhere('r.employee_id = :empId', { empId: filters.employeeId });
    }
    if (filters.departmentId) {
      qb.andWhere('u.department_id = :deptId', {
        deptId: filters.departmentId,
      });
    }
    if (filters.leaveTypeId) {
      qb.andWhere('r.leave_type_id = :ltId', { ltId: filters.leaveTypeId });
    }
    if (filters.fromDate && filters.toDate) {
      qb.andWhere('r.from_date <= :to', { to: filters.toDate }).andWhere(
        'r.to_date >= :from',
        { from: filters.fromDate },
      );
    }
    if (filters.submittedFrom) {
      qb.andWhere('r.submitted_at >= :sf', { sf: filters.submittedFrom });
    }
    if (filters.submittedTo) {
      qb.andWhere('r.submitted_at <= :st', { st: filters.submittedTo });
    }
    if (filters.search && filters.search.length >= 2) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where(
              `LOWER(u.first_name || ' ' || COALESCE(u.middle_name,'') || ' ' || u.last_name) LIKE :s`,
              { s: `%${filters.search!.toLowerCase()}%` },
            )
            .orWhere('LOWER(u.code) LIKE :s', {
              s: `%${filters.search!.toLowerCase()}%`,
            });
        }),
      );
    }

    qb.addSelect('u.first_name', 'u_first_name')
      .addSelect('u.middle_name', 'u_middle_name')
      .addSelect('u.last_name', 'u_last_name')
      .addSelect('u.code', 'u_code')
      .addSelect('d.name', 'd_name')
      .orderBy(`r.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    interface RawJoin {
      u_first_name?: string | null;
      u_middle_name?: string | null;
      u_last_name?: string | null;
      u_code?: string | null;
      d_name?: string | null;
    }

    const result = await qb.getRawAndEntities<RawJoin>();
    const total = await qb.getCount();

    const rows: RequestListRow[] = result.entities.map((request, idx) => {
      const raw: RawJoin = result.raw[idx] ?? {};
      return {
        request,
        employee_first_name: raw.u_first_name ?? null,
        employee_middle_name: raw.u_middle_name ?? null,
        employee_last_name: raw.u_last_name ?? null,
        employee_code: raw.u_code ?? null,
        department_name: raw.d_name ?? null,
      };
    });

    return { rows, total };
  }

  async listMine(
    filters: ListRequestFilters,
  ): Promise<{ data: LeaveRequest[]; total: number }> {
    const { page = 1, limit = 20 } = filters;
    const sortBy = filters.sortBy ?? 'submitted_at';
    const sortOrder = filters.sortOrder ?? 'DESC';

    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.leave_type', 'lt')
      .where('r.organization_id = :orgId', { orgId: filters.organizationId })
      .andWhere('r.employee_id = :empId', { empId: filters.employeeId });

    if (filters.statuses && filters.statuses.length > 0) {
      qb.andWhere('r.request_status IN (:...statuses)', {
        statuses: filters.statuses,
      });
    }
    if (filters.leaveTypeId) {
      qb.andWhere('r.leave_type_id = :ltId', { ltId: filters.leaveTypeId });
    }
    if (filters.fromDate && filters.toDate) {
      qb.andWhere('r.from_date <= :to', { to: filters.toDate }).andWhere(
        'r.to_date >= :from',
        { from: filters.fromDate },
      );
    }

    qb.orderBy(`r.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async lockById(
    id: string,
    manager: EntityManager,
  ): Promise<LeaveRequest | null> {
    return manager
      .createQueryBuilder(LeaveRequest, 'r')
      .leftJoinAndSelect('r.leave_type', 'lt')
      .setLock('pessimistic_write', undefined, ['r'])
      .where('r.id = :id', { id })
      .getOne();
  }
}
