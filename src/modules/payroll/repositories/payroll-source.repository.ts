import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { AttendanceRecord } from '../../attendance/entities/attendance-record.entity';
import { AttendanceStatus } from '../../attendance/enums/attendance-status.enum';
import { LeaveRequest } from '../../leave-request/entities/leave-request.entity';
import { LeaveRequestStatus } from '../../leave-request/enums';

export interface EligibleEmployee {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department_id: string | null;
}

export interface AttendanceSummary {
  /** Days the org/employee was expected to work (excludes weekly-offs & holidays). */
  working_days: number;
  /** Present-equivalent days (half-days counted as 0.5). */
  present_days: number;
  absent_days: number;
  /** True when no attendance rows exist for the period (data-quality flag). */
  no_data: boolean;
}

export interface LeaveSummary {
  paid_leave_days: number;
  unpaid_leave_days: number;
}

const PRESENT_STATUSES = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.OVERTIME,
  AttendanceStatus.MISSED_CHECKOUT,
];
const NON_WORKING_STATUSES = [
  AttendanceStatus.WEEKLY_OFF,
  AttendanceStatus.HOLIDAY,
];

/**
 * Read-only access to the upstream data payroll depends on: the employee roster,
 * attendance records, and approved leave. Kept separate from the payroll write
 * model so processing never mutates source data.
 */
@Injectable()
export class PayrollSourceRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
  ) {}

  /** Active employees of an organization (profile type EMPLOYEE). */
  async findEligibleEmployees(
    enterpriseId: string,
    organizationId: string,
  ): Promise<EligibleEmployee[]> {
    const rows = await this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.user_profile', 'profile')
      .select([
        'user.id AS user_id',
        'user.first_name AS first_name',
        'user.last_name AS last_name',
        'user.email AS email',
        'user.department_id AS department_id',
      ])
      .where('user.enterprise_id = :enterpriseId', { enterpriseId })
      .andWhere('user.organization_id = :organizationId', { organizationId })
      .andWhere('profile.type = :type', { type: 'EMPLOYEE' })
      .getRawMany<EligibleEmployee>();

    return rows;
  }

  /** Aggregates attendance for one employee over an inclusive date range. */
  /**
   * Distinct employees with unfinalized (pending-approval) attendance in the
   * period. Used to gate processing — attendance should be finalized first.
   */
  async findEmployeesWithPendingAttendance(
    organizationId: string,
    fromDate: string,
    toDate: string,
  ): Promise<string[]> {
    const rows = await this.attendanceRepo
      .createQueryBuilder('r')
      .select('DISTINCT r.employee_id', 'employee_id')
      .where('r.organization_id = :organizationId', { organizationId })
      .andWhere('r.is_deleted = false')
      .andWhere('r.attendance_status = :status', {
        status: AttendanceStatus.PENDING_APPROVAL,
      })
      .andWhere('r.date BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .getRawMany<{ employee_id: string }>();
    return rows.map((r) => r.employee_id);
  }

  async getAttendanceSummary(
    organizationId: string,
    employeeId: string,
    fromDate: string,
    toDate: string,
  ): Promise<AttendanceSummary> {
    const rows = await this.attendanceRepo
      .createQueryBuilder('r')
      .select('r.attendance_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.organization_id = :organizationId', { organizationId })
      .andWhere('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.is_deleted = false')
      .andWhere('r.date BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .groupBy('r.attendance_status')
      .getRawMany<{ status: AttendanceStatus; count: string }>();

    let total = 0;
    let nonWorking = 0;
    let present = 0;
    let absent = 0;
    let halfDays = 0;

    for (const row of rows) {
      const count = Number(row.count);
      total += count;
      if (NON_WORKING_STATUSES.includes(row.status)) nonWorking += count;
      if (PRESENT_STATUSES.includes(row.status)) present += count;
      if (row.status === AttendanceStatus.ABSENT) absent += count;
      if (row.status === AttendanceStatus.HALF_DAY) halfDays += count;
    }

    return {
      working_days: total - nonWorking,
      present_days: present + halfDays * 0.5,
      absent_days: absent,
      no_data: total === 0,
    };
  }

  /**
   * Approved leave overlapping the period, split into paid vs unpaid by the
   * leave type's is_paid flag. Days are computed as the calendar-day overlap of
   * the request with the period (half-day requests count as 0.5).
   */
  async getLeaveSummary(
    organizationId: string,
    employeeId: string,
    fromDate: string,
    toDate: string,
  ): Promise<LeaveSummary> {
    const leaves = await this.leaveRepo
      .createQueryBuilder('lr')
      .innerJoinAndSelect('lr.leave_type', 'lt')
      .where('lr.organization_id = :organizationId', { organizationId })
      .andWhere('lr.employee_id = :employeeId', { employeeId })
      .andWhere('lr.request_status = :status', {
        status: LeaveRequestStatus.APPROVED,
      })
      .andWhere('lr.from_date <= :toDate', { toDate })
      .andWhere('lr.to_date >= :fromDate', { fromDate })
      .getMany();

    let paid = 0;
    let unpaid = 0;

    for (const leave of leaves) {
      const days = this.overlapDays(
        leave.from_date,
        leave.to_date,
        fromDate,
        toDate,
        leave.is_half_day,
      );
      if (leave.leave_type?.is_paid) paid += days;
      else unpaid += days;
    }

    return { paid_leave_days: paid, unpaid_leave_days: unpaid };
  }

  /** Inclusive calendar-day overlap between a leave request and the pay period. */
  private overlapDays(
    leaveFrom: string,
    leaveTo: string,
    periodFrom: string,
    periodTo: string,
    isHalfDay: boolean,
  ): number {
    const start = leaveFrom > periodFrom ? leaveFrom : periodFrom;
    const end = leaveTo < periodTo ? leaveTo : periodTo;
    const startMs = Date.parse(`${start}T00:00:00Z`);
    const endMs = Date.parse(`${end}T00:00:00Z`);
    if (endMs < startMs) return 0;

    const dayCount = Math.floor((endMs - startMs) / 86_400_000) + 1;
    if (isHalfDay) return 0.5;
    return dayCount;
  }
}
