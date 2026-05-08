import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LeaveBalance } from '../entities/leave-balance.entity';
import { Status } from '../../../common/enums';

export interface ListBalanceFilters {
  organizationId: string;
  leaveYear?: number;
  departmentId?: string;
  leaveTypeId?: string;
  employeeId?: string;
  search?: string;
  status?: Status;
  lowBalance?: boolean;
  page?: number;
  limit?: number;
}

export interface BalanceListRow {
  balance: LeaveBalance;
  employee_first_name: string | null;
  employee_middle_name: string | null;
  employee_last_name: string | null;
  employee_code: string | null;
  department_name: string | null;
}

@Injectable()
export class LeaveBalanceRepository {
  constructor(
    @InjectRepository(LeaveBalance)
    private readonly repo: Repository<LeaveBalance>,
  ) {}

  async create(data: Partial<LeaveBalance>): Promise<LeaveBalance> {
    return this.repo.save(this.repo.create(data));
  }

  async createMany(rows: Partial<LeaveBalance>[]): Promise<LeaveBalance[]> {
    if (rows.length === 0) return [];
    return this.repo.save(this.repo.create(rows));
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<LeaveBalance | null> {
    return this.repo.findOne({
      where: { id, organization_id: organizationId },
      relations: ['leave_type'],
    });
  }

  async findForEmployee(
    employeeId: string,
    organizationId: string,
    leaveYear: number,
  ): Promise<LeaveBalance[]> {
    return this.repo.find({
      where: {
        employee_id: employeeId,
        organization_id: organizationId,
        leave_year: leaveYear,
        status: Status.ACTIVE,
      },
      relations: ['leave_type'],
      order: { created_at: 'ASC' },
    });
  }

  async findOneFor(
    employeeId: string,
    leaveTypeId: string,
    leaveYear: number,
    organizationId: string,
  ): Promise<LeaveBalance | null> {
    return this.repo.findOne({
      where: {
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        leave_year: leaveYear,
        organization_id: organizationId,
      },
      relations: ['leave_type'],
    });
  }

  async existsForEmployeeYear(
    employeeId: string,
    leaveYear: number,
    organizationId: string,
  ): Promise<boolean> {
    const count = await this.repo.count({
      where: {
        employee_id: employeeId,
        leave_year: leaveYear,
        organization_id: organizationId,
      },
    });
    return count > 0;
  }

  async update(id: string, data: Partial<LeaveBalance>): Promise<void> {
    await this.repo.update(id, data);
  }

  async lockOneByCompositeKey(
    employeeId: string,
    leaveTypeId: string,
    leaveYear: number,
    organizationId: string,
    manager: EntityManager,
  ): Promise<LeaveBalance | null> {
    return manager
      .createQueryBuilder(LeaveBalance, 'b')
      .setLock('pessimistic_write')
      .where('b.employee_id = :employeeId', { employeeId })
      .andWhere('b.leave_type_id = :leaveTypeId', { leaveTypeId })
      .andWhere('b.leave_year = :leaveYear', { leaveYear })
      .andWhere('b.organization_id = :organizationId', { organizationId })
      .andWhere('b.status = :status', { status: Status.ACTIVE })
      .getOne();
  }

  async list(
    filters: ListBalanceFilters,
  ): Promise<{ rows: BalanceListRow[]; total: number }> {
    const { page = 1, limit = 20 } = filters;
    const qb = this.repo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.leave_type', 'lt')
      .leftJoin('users', 'u', 'u.id = b.employee_id')
      .leftJoin('departments', 'd', 'd.id = u.department_id')
      .where('b.organization_id = :orgId', { orgId: filters.organizationId });

    if (filters.leaveYear) {
      qb.andWhere('b.leave_year = :year', { year: filters.leaveYear });
    }
    if (filters.departmentId) {
      qb.andWhere('u.department_id = :deptId', {
        deptId: filters.departmentId,
      });
    }
    if (filters.leaveTypeId) {
      qb.andWhere('b.leave_type_id = :ltId', { ltId: filters.leaveTypeId });
    }
    if (filters.employeeId) {
      qb.andWhere('b.employee_id = :empId', { empId: filters.employeeId });
    }
    if (filters.status) {
      qb.andWhere('b.status = :status', { status: filters.status });
    }
    if (filters.lowBalance) {
      qb.andWhere('b.is_unlimited = false').andWhere(
        '(COALESCE(b.accrued_days,0) + COALESCE(b.carry_forward,0) + b.adjustment - b.used_days - b.pending_days) <= 2',
      );
    }
    if (filters.search && filters.search.length >= 2) {
      qb.andWhere(
        `(LOWER(u.first_name || ' ' || COALESCE(u.middle_name,'') || ' ' || u.last_name) LIKE :s OR LOWER(u.code) LIKE :s)`,
        { s: `%${filters.search.toLowerCase()}%` },
      );
    }

    qb.addSelect('u.first_name', 'u_first_name')
      .addSelect('u.middle_name', 'u_middle_name')
      .addSelect('u.last_name', 'u_last_name')
      .addSelect('u.code', 'u_code')
      .addSelect('d.name', 'd_name')
      .orderBy('b.created_at', 'DESC')
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

    const rows: BalanceListRow[] = result.entities.map((balance, idx) => {
      const raw: RawJoin = result.raw[idx] ?? {};
      return {
        balance,
        employee_first_name: raw.u_first_name ?? null,
        employee_middle_name: raw.u_middle_name ?? null,
        employee_last_name: raw.u_last_name ?? null,
        employee_code: raw.u_code ?? null,
        department_name: raw.d_name ?? null,
      };
    });

    return { rows, total };
  }
}
