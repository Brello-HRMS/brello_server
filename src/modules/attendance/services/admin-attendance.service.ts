import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { AdminDailyPreviewQueryDto } from '../dto/admin-daily-preview-query.dto';
import { AuditLogsQueryDto } from '../dto/audit-logs-query.dto';
import { ManualEntryDto } from '../dto/manual-entry.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { AttendanceAuditLog } from '../entities/attendance-audit-log.entity';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { AttendanceSessionRepository } from '../repositories/attendance-session.repository';
import { AttendanceAuditLogRepository } from '../repositories/attendance-audit-log.repository';
import { AttendanceRuleResolverService } from './attendance-rule-resolver.service';
import { AttendanceMode } from '../enums/attendance-mode.enum';
import { AttendanceSource } from '../enums/attendance-source.enum';
import { GeoStatus } from '../enums/geo-status.enum';
import { AuditEventType } from '../enums/audit-event-type.enum';
import {
  computeAttendanceStatus,
  formatHmm,
  formatTime12,
  isCheckInLate,
  todayLocalDate,
} from './attendance-calc.util';

@Injectable()
export class AdminAttendanceService {
  private readonly logger = new Logger(AdminAttendanceService.name);

  constructor(
    private readonly recordRepo: AttendanceRecordRepository,
    private readonly sessionRepo: AttendanceSessionRepository,
    private readonly auditRepo: AttendanceAuditLogRepository,
    private readonly ruleResolver: AttendanceRuleResolverService,
  ) {}

  async dailyPreview(user: LoggedInUser, query: AdminDailyPreviewQueryDto) {
    const date = query.date ?? todayLocalDate();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [{ rows, total }, summary] = await Promise.all([
      this.recordRepo.dailyPreview({
        organizationId: user.organizationId,
        date,
        departmentId: query.department_id,
        shiftId: query.shift_id,
        attendanceStatus: query.attendance_status,
        attendanceMode: query.attendance_mode,
        search: query.search,
        page,
        limit,
      }),
      this.recordRepo.dailySummary(user.organizationId, date),
    ]);

    const items = rows.map(({ record, ...meta }) => ({
      attendance_id: record.id,
      employee: {
        employee_id: record.employee_id,
        name: [meta.first_name, meta.middle_name, meta.last_name]
          .filter(Boolean)
          .join(' '),
        emp_code: meta.emp_code,
        department: meta.department_name,
      },
      date: record.date,
      shift: meta.shift_name ? { shift_name: meta.shift_name } : null,
      check_in: formatTime12(record.first_check_in_at),
      check_out: formatTime12(record.last_check_out_at),
      worked_hours: formatHmm(record.worked_minutes),
      attendance_mode: record.attendance_mode,
      attendance_status: record.attendance_status,
      geo_status: null as GeoStatus | null,
      distance_from_office_meters: null as number | null,
      source: record.source,
      remote_reason: record.remote_reason,
      notes: record.notes,
    }));

    return {
      summary,
      items,
      pagination: { page, limit, total },
    };
  }

  async createManual(user: LoggedInUser, dto: ManualEntryDto) {
    const existing = await this.recordRepo.findForEmployeeOnDate(
      user.organizationId,
      dto.employee_id,
      dto.date,
    );
    if (existing) {
      throw new ConflictException(
        'Attendance record already exists for this employee on this date. Use update instead.',
      );
    }

    const { rule, shift } = await this.ruleResolver.resolveForEmployee(
      user.organizationId,
      dto.employee_id,
    );

    const checkInAt = this.combineDateTime(dto.date, dto.check_in);
    const checkOutAt = dto.check_out
      ? this.combineDateTime(dto.date, dto.check_out)
      : null;

    if (checkOutAt && checkOutAt < checkInAt) {
      throw new BadRequestException('check_out must be after check_in');
    }

    const workedMinutes = checkOutAt
      ? Math.max(
          0,
          Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000),
        )
      : 0;

    const { isLate, lateMinutes } = isCheckInLate(checkInAt, shift);
    const computed = computeAttendanceStatus(workedMinutes, rule, isLate);
    const finalStatus =
      dto.attendance_status_override ?? computed.attendance_status;

    const record = await this.recordRepo.create({
      employee_id: dto.employee_id,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      date: dto.date,
      shift_id: shift.id,
      rule_id: rule.id,
      first_check_in_at: checkInAt,
      last_check_out_at: checkOutAt,
      worked_minutes: workedMinutes,
      overtime_minutes: computed.overtime_minutes,
      is_late: isLate,
      late_minutes: lateMinutes || null,
      is_half_day: computed.is_half_day,
      is_overtime: computed.is_overtime,
      attendance_status: finalStatus,
      attendance_mode: dto.attendance_mode ?? AttendanceMode.OFFICE_IN,
      source: AttendanceSource.MANUAL,
      remote_reason: dto.remote_reason ?? null,
      notes: dto.notes ?? null,
      modified_by: user.userId,
    });

    if (checkOutAt) {
      await this.sessionRepo.create({
        attendance_record_id: record.id,
        employee_id: dto.employee_id,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
        check_in_at: checkInAt,
        check_out_at: checkOutAt,
        worked_minutes: workedMinutes,
        attendance_mode: dto.attendance_mode ?? AttendanceMode.OFFICE_IN,
        source: AttendanceSource.MANUAL,
        remote_reason: dto.remote_reason ?? null,
        notes: dto.notes ?? null,
        modified_by: user.userId,
      });
    }

    await this.auditRepo.create({
      attendance_record_id: record.id,
      employee_id: dto.employee_id,
      performed_by: user.userId,
      event_type: AuditEventType.MANUAL_CREATE,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
      new_value: {
        attendance_status: finalStatus,
        attendance_mode: dto.attendance_mode ?? AttendanceMode.OFFICE_IN,
        worked_minutes: workedMinutes,
      },
    });

    return {
      attendance_id: record.id,
      attendance_mode: record.attendance_mode,
      attendance_status: record.attendance_status,
      worked_hours: formatHmm(record.worked_minutes),
      source: record.source,
    };
  }

  async updateRecord(
    user: LoggedInUser,
    attendanceId: string,
    dto: UpdateAttendanceDto,
  ) {
    const record = await this.recordRepo.findById(
      attendanceId,
      user.organizationId,
    );
    if (!record) throw new NotFoundException('Attendance record not found');

    const { rule, shift } = await this.ruleResolver.resolveForEmployee(
      user.organizationId,
      record.employee_id,
    );

    const newCheckIn = dto.check_in
      ? this.combineDateTime(record.date, dto.check_in)
      : record.first_check_in_at;
    const newCheckOut = dto.check_out
      ? this.combineDateTime(record.date, dto.check_out)
      : record.last_check_out_at;

    if (newCheckIn && newCheckOut && newCheckOut < newCheckIn) {
      throw new BadRequestException('check_out must be after check_in');
    }

    const workedMinutes =
      newCheckIn && newCheckOut
        ? Math.max(
            0,
            Math.round((newCheckOut.getTime() - newCheckIn.getTime()) / 60000),
          )
        : 0;

    const isLate = newCheckIn
      ? isCheckInLate(newCheckIn, shift).isLate
      : record.is_late;
    const lateMinutes = newCheckIn
      ? isCheckInLate(newCheckIn, shift).lateMinutes
      : (record.late_minutes ?? 0);

    const computed = computeAttendanceStatus(workedMinutes, rule, isLate);
    const finalStatus =
      dto.attendance_status_override ?? computed.attendance_status;
    const oldSnapshot = {
      check_in: record.first_check_in_at,
      check_out: record.last_check_out_at,
      attendance_status: record.attendance_status,
      attendance_mode: record.attendance_mode,
      worked_minutes: record.worked_minutes,
    };

    await this.recordRepo.update(record.id, {
      first_check_in_at: newCheckIn,
      last_check_out_at: newCheckOut,
      worked_minutes: workedMinutes,
      overtime_minutes: computed.overtime_minutes,
      is_late: isLate,
      late_minutes: lateMinutes || null,
      is_half_day: computed.is_half_day,
      is_overtime: computed.is_overtime,
      attendance_status: finalStatus,
      attendance_mode: dto.attendance_mode ?? record.attendance_mode,
      remote_reason: dto.remote_reason ?? record.remote_reason,
      notes: dto.notes ?? record.notes,
      source: AttendanceSource.MANUAL,
      modified_by: user.userId,
    });

    await this.auditRepo.create({
      attendance_record_id: record.id,
      employee_id: record.employee_id,
      performed_by: user.userId,
      event_type: dto.attendance_status_override
        ? AuditEventType.STATUS_OVERRIDE
        : AuditEventType.MANUAL_UPDATE,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
      old_value: oldSnapshot,
      new_value: {
        check_in: newCheckIn,
        check_out: newCheckOut,
        attendance_status: finalStatus,
        attendance_mode: dto.attendance_mode ?? record.attendance_mode,
        worked_minutes: workedMinutes,
      },
    });

    return { success: true };
  }

  async deleteRecord(user: LoggedInUser, attendanceId: string) {
    const record = await this.recordRepo.findById(
      attendanceId,
      user.organizationId,
    );
    if (!record) throw new NotFoundException('Attendance record not found');

    await this.sessionRepo.deleteByRecord(record.id);
    await this.recordRepo.softDelete(record.id, user.userId);

    await this.auditRepo.create({
      attendance_record_id: record.id,
      employee_id: record.employee_id,
      performed_by: user.userId,
      event_type: AuditEventType.MANUAL_DELETE,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      modified_by: user.userId,
      old_value: {
        attendance_status: record.attendance_status,
        worked_minutes: record.worked_minutes,
      },
    });

    return { success: true };
  }

  async listAuditLogs(user: LoggedInUser, query: AuditLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { data, total } = await this.auditRepo.list({
      organizationId: user.organizationId,
      employeeId: query.employee_id,
      date: query.date,
      eventType: query.event_type,
      page,
      limit,
    });

    return {
      items: data.map((log) => this.toAuditLogItem(log)),
      pagination: { page, limit, total },
    };
  }

  private toAuditLogItem(log: AttendanceAuditLog) {
    return {
      audit_id: log.id,
      event_type: log.event_type,
      attendance_id: log.attendance_record_id,
      employee_id: log.employee_id,
      performed_by: log.performed_by,
      timestamp: log.created_at,
      device: log.device,
      ip_address: log.ip_address,
      old_value: log.old_value,
      new_value: log.new_value,
    };
  }

  private combineDateTime(date: string, time: string): Date {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, (m ?? 1) - 1, d, hh ?? 0, mm ?? 0, 0, 0);
  }
}
