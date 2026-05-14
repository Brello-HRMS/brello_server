import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AttendanceRecord } from '../entities/attendance-record.entity';
import { AttendanceMode } from '../enums/attendance-mode.enum';
import { AttendanceStatus } from '../enums/attendance-status.enum';

export interface DailyPreviewFilters {
  organizationId: string;
  date: string;
  departmentId?: string;
  shiftId?: string;
  attendanceStatus?: AttendanceStatus;
  attendanceMode?: AttendanceMode;
  search?: string;
  page: number;
  limit: number;
}

export interface DailyPreviewRow {
  record: AttendanceRecord;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  emp_code: string | null;
  department_name: string | null;
  shift_name: string | null;
}

export interface DailySummary {
  present: number;
  absent: number;
  late: number;
  half_day: number;
  on_leave: number;
  missed_checkout: number;
  office_in: number;
  remote_in: number;
  geo_violations: number;
}

@Injectable()
export class AttendanceRecordRepository {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly repo: Repository<AttendanceRecord>,
  ) {}

  async create(data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    return this.repo.save(this.repo.create(data));
  }

  async findById(
    id: string,
    organizationId: string,
  ): Promise<AttendanceRecord | null> {
    return this.repo.findOne({
      where: { id, organization_id: organizationId, is_deleted: false },
    });
  }

  async findForEmployeeOnDate(
    organizationId: string,
    employeeId: string,
    date: string,
  ): Promise<AttendanceRecord | null> {
    return this.repo.findOne({
      where: {
        organization_id: organizationId,
        employee_id: employeeId,
        date,
        is_deleted: false,
      },
    });
  }

  async update(id: string, data: Partial<AttendanceRecord>): Promise<void> {
    await this.repo.update(id, data);
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.repo.update(id, {
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: deletedBy,
    });
  }

  async listForEmployee(
    organizationId: string,
    employeeId: string,
    filters: {
      month?: number;
      year?: number;
      attendanceMode?: AttendanceMode;
      attendanceStatus?: AttendanceStatus;
      page: number;
      limit: number;
    },
  ): Promise<{ data: AttendanceRecord[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.organization_id = :orgId', { orgId: organizationId })
      .andWhere('r.employee_id = :empId', { empId: employeeId })
      .andWhere('r.is_deleted = false');

    if (filters.year) {
      qb.andWhere('EXTRACT(YEAR FROM r.date) = :year', { year: filters.year });
    }
    if (filters.month) {
      qb.andWhere('EXTRACT(MONTH FROM r.date) = :month', {
        month: filters.month,
      });
    }
    if (filters.attendanceMode) {
      qb.andWhere('r.attendance_mode = :mode', {
        mode: filters.attendanceMode,
      });
    }
    if (filters.attendanceStatus) {
      qb.andWhere('r.attendance_status = :status', {
        status: filters.attendanceStatus,
      });
    }

    qb.orderBy('r.date', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async dailyPreview(
    filters: DailyPreviewFilters,
  ): Promise<{ rows: DailyPreviewRow[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoin('users', 'u', 'u.id = r.employee_id')
      .leftJoin('departments', 'd', 'd.id = u.department_id')
      .leftJoin('shifts', 's', 's.id = r.shift_id')
      .where('r.organization_id = :orgId', { orgId: filters.organizationId })
      .andWhere('r.date = :date', { date: filters.date })
      .andWhere('r.is_deleted = false');

    if (filters.departmentId) {
      qb.andWhere('u.department_id = :deptId', {
        deptId: filters.departmentId,
      });
    }
    if (filters.shiftId) {
      qb.andWhere('r.shift_id = :shiftId', { shiftId: filters.shiftId });
    }
    if (filters.attendanceStatus) {
      qb.andWhere('r.attendance_status = :status', {
        status: filters.attendanceStatus,
      });
    }
    if (filters.attendanceMode) {
      qb.andWhere('r.attendance_mode = :mode', {
        mode: filters.attendanceMode,
      });
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
      .addSelect('u.code', 'u_emp_code')
      .addSelect('d.name', 'd_name')
      .addSelect('s.name', 's_name')
      .orderBy('u.first_name', 'ASC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    interface RawJoin {
      u_first_name?: string | null;
      u_middle_name?: string | null;
      u_last_name?: string | null;
      u_emp_code?: string | null;
      d_name?: string | null;
      s_name?: string | null;
    }

    const result = await qb.getRawAndEntities<RawJoin>();
    const total = await qb.getCount();

    const rows: DailyPreviewRow[] = result.entities.map((record, idx) => {
      const raw: RawJoin = result.raw[idx] ?? {};
      return {
        record,
        first_name: raw.u_first_name ?? null,
        middle_name: raw.u_middle_name ?? null,
        last_name: raw.u_last_name ?? null,
        emp_code: raw.u_emp_code ?? null,
        department_name: raw.d_name ?? null,
        shift_name: raw.s_name ?? null,
      };
    });

    return { rows, total };
  }

  async dailySummary(
    organizationId: string,
    date: string,
  ): Promise<DailySummary> {
    const raw = await this.repo
      .createQueryBuilder('r')
      .select(
        `SUM(CASE WHEN r.attendance_status = :present THEN 1 ELSE 0 END)`,
        'present',
      )
      .addSelect(
        `SUM(CASE WHEN r.attendance_status = :absent THEN 1 ELSE 0 END)`,
        'absent',
      )
      .addSelect(`SUM(CASE WHEN r.is_late = true THEN 1 ELSE 0 END)`, 'late')
      .addSelect(
        `SUM(CASE WHEN r.attendance_status = :halfDay THEN 1 ELSE 0 END)`,
        'half_day',
      )
      .addSelect(
        `SUM(CASE WHEN r.attendance_status = :onLeave THEN 1 ELSE 0 END)`,
        'on_leave',
      )
      .addSelect(
        `SUM(CASE WHEN r.attendance_status = :missed THEN 1 ELSE 0 END)`,
        'missed_checkout',
      )
      .addSelect(
        `SUM(CASE WHEN r.attendance_mode = :officeIn THEN 1 ELSE 0 END)`,
        'office_in',
      )
      .addSelect(
        `SUM(CASE WHEN r.attendance_mode = :remoteIn THEN 1 ELSE 0 END)`,
        'remote_in',
      )
      .where('r.organization_id = :orgId', { orgId: organizationId })
      .andWhere('r.date = :date', { date })
      .andWhere('r.is_deleted = false')
      .setParameter('present', AttendanceStatus.PRESENT)
      .setParameter('absent', AttendanceStatus.ABSENT)
      .setParameter('halfDay', AttendanceStatus.HALF_DAY)
      .setParameter('onLeave', AttendanceStatus.ON_LEAVE)
      .setParameter('missed', AttendanceStatus.MISSED_CHECKOUT)
      .setParameter('officeIn', AttendanceMode.OFFICE_IN)
      .setParameter('remoteIn', AttendanceMode.REMOTE_IN)
      .getRawOne<{
        present: string;
        absent: string;
        late: string;
        half_day: string;
        on_leave: string;
        missed_checkout: string;
        office_in: string;
        remote_in: string;
      }>();

    return {
      present: Number(raw?.present ?? 0),
      absent: Number(raw?.absent ?? 0),
      late: Number(raw?.late ?? 0),
      half_day: Number(raw?.half_day ?? 0),
      on_leave: Number(raw?.on_leave ?? 0),
      missed_checkout: Number(raw?.missed_checkout ?? 0),
      office_in: Number(raw?.office_in ?? 0),
      remote_in: Number(raw?.remote_in ?? 0),
      geo_violations: 0,
    };
  }
}
