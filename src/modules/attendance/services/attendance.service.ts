import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { CheckInDto } from '../dto/check-in.dto';
import { CheckOutDto } from '../dto/check-out.dto';
import { MeHistoryQueryDto } from '../dto/me-history-query.dto';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { AttendanceSessionRepository } from '../repositories/attendance-session.repository';
import { AttendanceAuditLogRepository } from '../repositories/attendance-audit-log.repository';
import { RemoteApprovalRepository } from '../repositories/remote-approval.repository';
import { AttendanceRuleResolverService } from './attendance-rule-resolver.service';
import { AttendanceMode } from '../enums/attendance-mode.enum';
import { AttendanceSource } from '../enums/attendance-source.enum';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { GeoStatus } from '../enums/geo-status.enum';
import { AuditEventType } from '../enums/audit-event-type.enum';
import { ApprovalStatus } from '../enums/approval-status.enum';
import {
  computeAttendanceStatus,
  ComputedAttendance,
  diffMinutes,
  formatHmm,
  formatTime12,
  haversineDistance,
  isCheckInLate,
  todayLocalDate,
} from './attendance-calc.util';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly recordRepo: AttendanceRecordRepository,
    private readonly sessionRepo: AttendanceSessionRepository,
    private readonly auditRepo: AttendanceAuditLogRepository,
    private readonly approvalRepo: RemoteApprovalRepository,
    private readonly ruleResolver: AttendanceRuleResolverService,
  ) {}

  async checkIn(user: LoggedInUser, dto: CheckInDto, ipAddress?: string) {
    const { rule, shift, geoFence } =
      await this.ruleResolver.resolveForEmployee(
        user.organizationId,
        user.userId,
      );

    // Block duplicate open session
    const openSession = await this.sessionRepo.findOpenSession(
      user.organizationId,
      user.userId,
    );
    if (openSession) {
      throw new ConflictException('Employee already checked in');
    }

    const date = todayLocalDate();
    const existing = await this.recordRepo.findForEmployeeOnDate(
      user.organizationId,
      user.userId,
      date,
    );
    if (existing && !rule.allow_multiple_checkins) {
      throw new ConflictException(
        'Already checked in once today. Multiple check-ins are not allowed for your shift.',
      );
    }

    let geoStatus: GeoStatus = GeoStatus.NOT_APPLICABLE;
    let attendanceMode: AttendanceMode = AttendanceMode.OFFICE_IN;
    let distanceMeters: number | null = null;

    if (rule.require_geo_fencing) {
      if (dto.latitude == null || dto.longitude == null) {
        throw new BadRequestException({
          message: 'Location permission required for attendance',
          error_code: 'GPS_REQUIRED',
        });
      }
      if (!geoFence) {
        throw new NotFoundException(
          'Geo-fence configuration not found for this rule',
        );
      }

      distanceMeters = Math.round(
        haversineDistance(
          dto.latitude,
          dto.longitude,
          Number(geoFence.latitude),
          Number(geoFence.longitude),
        ),
      );

      if (distanceMeters <= geoFence.radius_meters) {
        attendanceMode = AttendanceMode.OFFICE_IN;
        geoStatus = GeoStatus.VALID;
      } else {
        if (!rule.allow_remote_in) {
          await this.audit(user, {
            employee_id: user.userId,
            event_type: AuditEventType.GEO_REJECTION,
            ip_address: ipAddress,
            new_value: {
              distance_meters: distanceMeters,
              radius: geoFence.radius_meters,
            },
          });
          throw new BadRequestException({
            message:
              'You are outside the allowed office location. Remote attendance is disabled.',
            error_code: 'REMOTE_ATTENDANCE_DISABLED',
          });
        }

        attendanceMode = AttendanceMode.REMOTE_IN;
        geoStatus = GeoStatus.OUTSIDE_RADIUS;
      }
    }

    const checkInAt = new Date();
    const { isLate, lateMinutes } = isCheckInLate(checkInAt, shift);

    const requiresApproval =
      attendanceMode === AttendanceMode.REMOTE_IN &&
      rule.remote_approval_required;
    const initialStatus: AttendanceStatus = requiresApproval
      ? AttendanceStatus.PENDING_APPROVAL
      : isLate
        ? AttendanceStatus.LATE
        : AttendanceStatus.PRESENT;

    let record = existing;
    if (!record) {
      record = await this.recordRepo.create({
        employee_id: user.userId,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
        date,
        shift_id: shift.id,
        rule_id: rule.id,
        first_check_in_at: checkInAt,
        attendance_status: initialStatus,
        attendance_mode: attendanceMode,
        source: dto.device ?? AttendanceSource.WEB,
        is_late: isLate,
        late_minutes: lateMinutes || null,
        remote_reason: dto.remote_reason ?? null,
        notes: dto.notes ?? null,
        office_id: geoFence?.id ?? null,
        office_name: geoFence?.office_name ?? null,
        modified_by: user.userId,
      });
    } else {
      // Multi-session: keep first record, just append a new session
      await this.recordRepo.update(record.id, {
        last_check_out_at: null,
        attendance_status: initialStatus,
        modified_by: user.userId,
      });
    }

    const session = await this.sessionRepo.create({
      attendance_record_id: record.id,
      employee_id: user.userId,
      organization_id: user.organizationId,
      enterprise_id: user.enterpriseId,
      check_in_at: checkInAt,
      attendance_mode: attendanceMode,
      source: dto.device ?? AttendanceSource.WEB,
      geo_status: geoStatus,
      check_in_latitude: dto.latitude ?? null,
      check_in_longitude: dto.longitude ?? null,
      distance_from_office_meters: distanceMeters,
      remote_reason: dto.remote_reason ?? null,
      notes: dto.notes ?? null,
      check_in_ip: ipAddress ?? null,
      modified_by: user.userId,
    });

    await this.audit(user, {
      attendance_record_id: record.id,
      attendance_session_id: session.id,
      employee_id: user.userId,
      event_type:
        attendanceMode === AttendanceMode.OFFICE_IN
          ? AuditEventType.OFFICE_IN
          : AuditEventType.REMOTE_IN,
      device: dto.device,
      ip_address: ipAddress,
      new_value: {
        attendance_mode: attendanceMode,
        attendance_status: initialStatus,
        distance_meters: distanceMeters,
      },
    });

    if (requiresApproval) {
      await this.approvalRepo.create({
        attendance_record_id: record.id,
        employee_id: user.userId,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
        remote_reason: dto.remote_reason!,
        distance_from_office_meters: distanceMeters,
        approval_status: ApprovalStatus.PENDING,
        modified_by: user.userId,
      });
    }

    if (attendanceMode === AttendanceMode.OFFICE_IN) {
      return {
        attendance_id: record.id,
        attendance_session_id: session.id,
        attendance_mode: attendanceMode,
        attendance_status: initialStatus,
        geo_status: geoStatus,
        distance_from_office_meters: distanceMeters,
        office: geoFence
          ? { office_id: geoFence.id, office_name: geoFence.office_name }
          : null,
        check_in_time: checkInAt.toISOString(),
        shift: {
          shift_id: shift.id,
          shift_name: shift.name,
          start_time: shift.start_time,
          end_time: shift.end_time,
        },
        is_late: isLate,
      };
    }

    return {
      attendance_id: record.id,
      attendance_session_id: session.id,
      attendance_mode: attendanceMode,
      attendance_status: initialStatus,
      geo_status: geoStatus,
      distance_from_office_meters: distanceMeters,
      remote_reason: dto.remote_reason,
      check_in_time: checkInAt.toISOString(),
      requires_approval: requiresApproval,
      approval_status: requiresApproval ? ApprovalStatus.PENDING : null,
    };
  }

  async checkOut(user: LoggedInUser, dto: CheckOutDto, ipAddress?: string) {
    const session = await this.sessionRepo.findOpenSession(
      user.organizationId,
      user.userId,
    );
    if (!session) {
      throw new NotFoundException('No active check-in found');
    }

    const record = await this.recordRepo.findById(
      session.attendance_record_id,
      user.organizationId,
    );
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    const { rule, shift } = await this.ruleResolver.resolveForEmployee(
      user.organizationId,
      user.userId,
    );

    const checkOutAt = new Date();
    const sessionMinutes = diffMinutes(session.check_in_at, checkOutAt);

    await this.sessionRepo.update(session.id, {
      check_out_at: checkOutAt,
      worked_minutes: sessionMinutes,
      check_out_latitude: dto.latitude ?? null,
      check_out_longitude: dto.longitude ?? null,
      check_out_ip: ipAddress ?? null,
      notes: dto.notes ?? session.notes,
      modified_by: user.userId,
    });

    const allSessions = await this.sessionRepo.findByRecord(record.id);
    const totalWorkedMinutes = allSessions.reduce(
      (sum, s) =>
        sum +
        (s.id === session.id
          ? sessionMinutes
          : s.check_out_at
            ? s.worked_minutes
            : 0),
      0,
    );

    const { isLate } = isCheckInLate(
      record.first_check_in_at ?? session.check_in_at,
      shift,
    );

    // If approval is pending, don't override status
    const computed: ComputedAttendance =
      record.attendance_status === AttendanceStatus.PENDING_APPROVAL
        ? {
            worked_minutes: totalWorkedMinutes,
            overtime_minutes: 0,
            is_half_day: false,
            is_overtime: false,
            attendance_status: AttendanceStatus.PENDING_APPROVAL,
          }
        : computeAttendanceStatus(totalWorkedMinutes, rule, isLate);

    await this.recordRepo.update(record.id, {
      last_check_out_at: checkOutAt,
      worked_minutes: computed.worked_minutes,
      overtime_minutes: computed.overtime_minutes,
      is_half_day: computed.is_half_day,
      is_overtime: computed.is_overtime,
      is_late: isLate,
      attendance_status: computed.attendance_status,
      modified_by: user.userId,
    });

    await this.audit(user, {
      attendance_record_id: record.id,
      attendance_session_id: session.id,
      employee_id: user.userId,
      event_type: AuditEventType.CHECK_OUT,
      ip_address: ipAddress,
      new_value: {
        worked_minutes: computed.worked_minutes,
        attendance_status: computed.attendance_status,
      },
    });

    return {
      attendance_id: record.id,
      attendance_session_id: session.id,
      attendance_mode: record.attendance_mode,
      check_out_time: checkOutAt.toISOString(),
      worked_hours: formatHmm(computed.worked_minutes),
      worked_minutes: computed.worked_minutes,
      attendance_status: computed.attendance_status,
      is_half_day: computed.is_half_day,
      is_overtime: computed.is_overtime,
      overtime_minutes: computed.overtime_minutes,
    };
  }

  async getToday(user: LoggedInUser) {
    const date = todayLocalDate();
    const record = await this.recordRepo.findForEmployeeOnDate(
      user.organizationId,
      user.userId,
      date,
    );

    let shiftBlock: {
      shift_name: string;
      start_time: string;
      end_time: string;
    } | null = null;
    let officeBlock: { office_name: string } | null = null;

    try {
      const { shift, geoFence } = await this.ruleResolver.resolveForEmployee(
        user.organizationId,
        user.userId,
      );
      shiftBlock = {
        shift_name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
      };
      if (geoFence) {
        officeBlock = { office_name: geoFence.office_name };
      }
    } catch {
      // No rule assigned: still return null today payload below
    }

    if (!record) {
      return {
        attendance_id: null,
        attendance_session_id: null,
        date,
        attendance_mode: null,
        attendance_status: null,
        check_in_time: null,
        check_out_time: null,
        worked_duration_live: '00:00:00',
        live_session: false,
        shift: shiftBlock,
        office: officeBlock,
      };
    }

    const openSession = await this.sessionRepo.findOpenSession(
      user.organizationId,
      user.userId,
    );

    let liveDurationStr = formatHmm(record.worked_minutes) + ':00';
    if (openSession) {
      const liveMinutes =
        record.worked_minutes +
        diffMinutes(openSession.check_in_at, new Date());
      const seconds =
        Math.floor((Date.now() - openSession.check_in_at.getTime()) / 1000) %
        60;
      liveDurationStr = `${formatHmm(liveMinutes)}:${String(seconds).padStart(2, '0')}`;
    }

    return {
      attendance_id: record.id,
      attendance_session_id: openSession?.id ?? null,
      date,
      attendance_mode: record.attendance_mode,
      attendance_status: record.attendance_status,
      check_in_time: formatTime12(record.first_check_in_at),
      check_out_time: openSession
        ? null
        : formatTime12(record.last_check_out_at),
      worked_duration_live: liveDurationStr,
      live_session: !!openSession,
      shift: shiftBlock,
      office: officeBlock,
    };
  }

  async getEffectiveRules(user: LoggedInUser) {
    const { rule, shift, geoFence } =
      await this.ruleResolver.resolveForEmployee(
        user.organizationId,
        user.userId,
      );

    return {
      full_day_hours: Number(rule.full_day_hours),
      half_day_hours: Number(rule.half_day_hours),
      late_after: shift.start_time,
      grace_minutes: shift.late_grace_minutes,
      overtime_after_hours: rule.overtime_after_hours
        ? Number(rule.overtime_after_hours)
        : null,
      multiple_sessions_allowed: rule.allow_multiple_checkins,
      geo_fencing_enabled: rule.require_geo_fencing,
      office_radius_meters: geoFence?.radius_meters ?? null,
      allow_remote_in: rule.allow_remote_in,
      require_remote_reason: rule.require_remote_reason,
      remote_approval_required: rule.remote_approval_required,
    };
  }

  async getMyHistory(user: LoggedInUser, query: MeHistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const { data, total } = await this.recordRepo.listForEmployee(
      user.organizationId,
      user.userId,
      {
        month: query.month,
        year: query.year,
        attendanceMode: query.attendance_mode,
        attendanceStatus: query.attendance_status,
        page,
        limit,
      },
    );

    let shiftName: string | null = null;
    try {
      const { shift } = await this.ruleResolver.resolveForEmployee(
        user.organizationId,
        user.userId,
      );
      shiftName = shift.name;
    } catch {
      shiftName = null;
    }

    return {
      items: data.map((r) => ({
        attendance_id: r.id,
        date: r.date,
        check_in: formatTime12(r.first_check_in_at),
        check_out: formatTime12(r.last_check_out_at),
        worked_hours: formatHmm(r.worked_minutes),
        attendance_mode: r.attendance_mode,
        attendance_status: r.attendance_status,
        shift: shiftName,
        remote_reason: r.remote_reason,
      })),
      pagination: { page, limit, total },
    };
  }

  private async audit(
    user: LoggedInUser,
    payload: {
      attendance_record_id?: string;
      attendance_session_id?: string;
      employee_id: string;
      event_type: AuditEventType;
      device?: string;
      ip_address?: string;
      old_value?: Record<string, unknown>;
      new_value?: Record<string, unknown>;
    },
  ) {
    try {
      await this.auditRepo.create({
        attendance_record_id: payload.attendance_record_id ?? null,
        attendance_session_id: payload.attendance_session_id ?? null,
        employee_id: payload.employee_id,
        performed_by: user.userId,
        event_type: payload.event_type,
        device: payload.device ?? null,
        ip_address: payload.ip_address ?? null,
        old_value: payload.old_value ?? null,
        new_value: payload.new_value ?? null,
        organization_id: user.organizationId,
        enterprise_id: user.enterpriseId,
        modified_by: user.userId,
      });
    } catch (err) {
      this.logger.warn(`Audit log failed: ${(err as Error).message}`);
    }
  }
}
