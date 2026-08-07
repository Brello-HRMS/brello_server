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
import { RemoteApprovalRepository } from '../repositories/remote-approval.repository';
import { AttendanceRuleResolverService } from './attendance-rule-resolver.service';
import { AuditContextService } from '../../audit/services/audit-context.service';
import { RedisService } from '../../../common/redis/redis.service';
import { AttendanceRecord } from '../entities/attendance-record.entity';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { AttendanceRule } from '../entities/attendance-rule.entity';
import { Shift } from '../entities/shift.entity';
import { AttendanceMode } from '../enums/attendance-mode.enum';
import { AttendanceSource } from '../enums/attendance-source.enum';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { GeoStatus } from '../enums/geo-status.enum';
import { ApprovalStatus } from '../enums/approval-status.enum';
import {
  computeAttendanceStatus,
  ComputedAttendance,
  diffMinutes,
  formatHmm,
  formatTime12,
  haversineDistance,
  isCheckInLate,
  isWeeklyOffDay,
  todayLocalDate,
} from './attendance-calc.util';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly recordRepo: AttendanceRecordRepository,
    private readonly sessionRepo: AttendanceSessionRepository,
    private readonly approvalRepo: RemoteApprovalRepository,
    private readonly ruleResolver: AttendanceRuleResolverService,
    private readonly auditContext: AuditContextService,
    private readonly redisService: RedisService,
  ) {}

  private async publishAttendanceUpdatedEvent(user: LoggedInUser) {
    try {
      const today = await this.getToday(user);
      const channel = `notifications:user:${user.userId}`;
      const payload = JSON.stringify({
        event: 'ATTENDANCE_UPDATED',
        type: 'ATTENDANCE_UPDATED',
        user_id: user.userId,
        today,
      });
      await this.redisService.publish(channel, payload);
      this.logger.log(`Published ATTENDANCE_UPDATED to channel ${channel}`);
    } catch (err) {
      this.logger.error(
        `Failed to publish ATTENDANCE_UPDATED event: ${err.message}`,
      );
    }
  }

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
    const allowMultiple =
      rule.allow_multiple_checkins || shift.allow_multiple_checkins;
    if (existing && !allowMultiple) {
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
    const { isLate, lateMinutes } = isCheckInLate(
      existing?.first_check_in_at ?? checkInAt,
      shift,
    );

    const requiresApproval =
      attendanceMode === AttendanceMode.REMOTE_IN &&
      rule.remote_approval_required;
    const initialStatus: AttendanceStatus = requiresApproval
      ? AttendanceStatus.PENDING_APPROVAL
      : existing
        ? existing.attendance_status === AttendanceStatus.PENDING_APPROVAL
          ? AttendanceStatus.PENDING_APPROVAL
          : existing.is_late
            ? AttendanceStatus.LATE
            : AttendanceStatus.PRESENT
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

    await this.publishAttendanceUpdatedEvent(user);

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

  async preCheckCheckIn(user: LoggedInUser, lat?: number, lng?: number) {
    let rule, shift, geoFence;
    try {
      const resolved = await this.ruleResolver.resolveForEmployee(
        user.organizationId,
        user.userId,
      );
      rule = resolved.rule;
      shift = resolved.shift;
      geoFence = resolved.geoFence;
    } catch {
      // If no rule is assigned, we can't determine if they are late or remote
      return {
        is_late: false,
        late_minutes: 0,
        is_remote: false,
        require_remote_reason: false,
        distance_meters: null,
        office_name: null,
        office_latitude: null,
        office_longitude: null,
        radius_meters: null,
        shift_start: null,
        current_time: new Date().toISOString(),
      };
    }

    const checkInAt = new Date();
    const { isLate, lateMinutes } = isCheckInLate(checkInAt, shift);

    let isRemote = false;
    let distanceMeters: number | null = null;

    if (rule.require_geo_fencing) {
      if (lat != null && lng != null && geoFence) {
        distanceMeters = Math.round(
          haversineDistance(
            lat,
            lng,
            Number(geoFence.latitude),
            Number(geoFence.longitude),
          ),
        );
        if (distanceMeters > geoFence.radius_meters) {
          isRemote = true;
        }
      } else {
        // Missing GPS or geoFence, can't verify distance
        isRemote = true;
      }
    }

    return {
      is_late: isLate,
      late_minutes: lateMinutes || 0,
      is_remote: isRemote,
      require_remote_reason: rule.require_remote_reason,
      distance_meters: distanceMeters,
      office_name: geoFence?.office_name ?? null,
      office_latitude: geoFence?.latitude ? Number(geoFence.latitude) : null,
      office_longitude: geoFence?.longitude ? Number(geoFence.longitude) : null,
      radius_meters: geoFence?.radius_meters ?? null,
      shift_start: shift.start_time,
      current_time: checkInAt.toISOString(),
      allow_multiple_checkins:
        rule.allow_multiple_checkins || shift.allow_multiple_checkins || false,
    };
  }

  async checkOut(user: LoggedInUser, dto: CheckOutDto, ipAddress?: string) {
    const session = await this.sessionRepo.findOpenSession(
      user.organizationId,
      user.userId,
    );
    if (!session) {
      const date = todayLocalDate();
      const existingRecord = await this.recordRepo.findForEmployeeOnDate(
        user.organizationId,
        user.userId,
        date,
      );
      if (existingRecord && existingRecord.last_check_out_at) {
        return {
          attendance_id: existingRecord.id,
          attendance_session_id: null,
          attendance_mode: existingRecord.attendance_mode,
          check_out_time: existingRecord.last_check_out_at.toISOString(),
          worked_hours: formatHmm(existingRecord.worked_minutes),
          worked_minutes: existingRecord.worked_minutes,
          attendance_status: existingRecord.attendance_status,
          is_half_day: existingRecord.is_half_day,
          is_overtime: existingRecord.is_overtime,
          overtime_minutes: existingRecord.overtime_minutes,
        };
      }
      throw new NotFoundException('No active check-in found');
    }

    const record = await this.recordRepo.findById(
      session.attendance_record_id,
      user.organizationId,
    );
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }
    this.auditContext.setPreValue(record as unknown as Record<string, unknown>);

    const { rule, shift } = await this.ruleResolver.resolveForEmployee(
      user.organizationId,
      user.userId,
    );

    const checkOutAt = new Date();
    const computed = await this.applyCheckout({
      session,
      record,
      rule,
      shift,
      checkOutAt,
      performedBy: user.userId,
      checkOutLat: dto.latitude ?? null,
      checkOutLng: dto.longitude ?? null,
      checkOutIp: ipAddress ?? null,
      notes: dto.notes ?? null,
    });

    await this.publishAttendanceUpdatedEvent(user);

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

  /**
   * Shared checkout core used by the employee-triggered checkOut() and the
   * AutoCheckoutService. Closes the session at `checkOutAt`, re-aggregates the
   * day's worked minutes across sessions, recomputes status (preserving
   * PENDING_APPROVAL), and writes the result onto the record. Does NOT write an
   * audit log or notify — the caller owns those, since the event/source differ.
   */
  async applyCheckout(params: {
    session: AttendanceSession;
    record: AttendanceRecord;
    rule: AttendanceRule;
    shift: Shift;
    checkOutAt: Date;
    performedBy: string;
    isAutoCheckout?: boolean;
    checkOutLat?: number | null;
    checkOutLng?: number | null;
    checkOutIp?: string | null;
    notes?: string | null;
  }): Promise<ComputedAttendance> {
    const {
      session,
      record,
      rule,
      shift,
      checkOutAt,
      performedBy,
      isAutoCheckout,
    } = params;

    const sessionMinutes = diffMinutes(session.check_in_at, checkOutAt);

    const sessionUpdate: Partial<AttendanceSession> = {
      check_out_at: checkOutAt,
      worked_minutes: sessionMinutes,
      check_out_latitude: params.checkOutLat ?? null,
      check_out_longitude: params.checkOutLng ?? null,
      check_out_ip: params.checkOutIp ?? null,
      notes: params.notes ?? session.notes,
      modified_by: performedBy,
    };
    if (isAutoCheckout) {
      sessionUpdate.source = AttendanceSource.AUTO;
      sessionUpdate.is_auto_checkout = true;
    }
    await this.sessionRepo.update(session.id, sessionUpdate);

    const allSessions = await this.sessionRepo.findByRecord(record.id);
    const totalWorkedMinutes = allSessions.reduce((sum, s) => {
      if (s.id === session.id) {
        return sum + sessionMinutes;
      }
      if (s.check_out_at) {
        const mins = diffMinutes(s.check_in_at, s.check_out_at);
        return sum + Math.max(s.worked_minutes || 0, mins);
      }
      return sum;
    }, 0);

    const { isLate } = isCheckInLate(
      record.first_check_in_at ?? session.check_in_at,
      shift,
    );

    // If remote approval is pending, don't override the PENDING_APPROVAL status.
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

    const recordUpdate: Partial<AttendanceRecord> = {
      last_check_out_at: checkOutAt,
      worked_minutes: computed.worked_minutes,
      overtime_minutes: computed.overtime_minutes,
      is_half_day: computed.is_half_day,
      is_overtime: computed.is_overtime,
      is_late: isLate,
      attendance_status: computed.attendance_status,
      modified_by: performedBy,
    };
    if (isAutoCheckout) recordUpdate.has_auto_checkout = true;
    await this.recordRepo.update(record.id, recordUpdate);

    return computed;
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

    let allowMultipleCheckins = false;
    try {
      const { rule, shift, geoFence } =
        await this.ruleResolver.resolveForEmployee(
          user.organizationId,
          user.userId,
        );
      allowMultipleCheckins =
        rule.allow_multiple_checkins || shift.allow_multiple_checkins || false;
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
        worked_seconds: 0,
        live_session: false,
        allow_multiple_checkins: allowMultipleCheckins,
        shift: shiftBlock,
        office: officeBlock,
      };
    }

    const openSession = await this.sessionRepo.findOpenSession(
      user.organizationId,
      user.userId,
    );

    const allSessions = record
      ? await this.sessionRepo.findByRecord(record.id)
      : [];
    let closedWorkedMinutes = allSessions.reduce((sum, s) => {
      if (s.check_out_at && s.id !== openSession?.id) {
        const mins = diffMinutes(s.check_in_at, s.check_out_at);
        return sum + Math.max(s.worked_minutes || 0, mins);
      }
      return sum;
    }, 0);

    if (
      closedWorkedMinutes === 0 &&
      !openSession &&
      record.first_check_in_at &&
      record.last_check_out_at
    ) {
      closedWorkedMinutes = diffMinutes(
        record.first_check_in_at,
        record.last_check_out_at,
      );
    }

    const totalWorkedMinutes = Math.max(
      record.worked_minutes || 0,
      closedWorkedMinutes,
    );

    let totalWorkedSeconds = totalWorkedMinutes * 60;
    let liveDurationStr = formatHmm(totalWorkedMinutes) + ':00';

    if (openSession) {
      const openSessionStart = new Date(openSession.check_in_at);
      const sessionSeconds = isNaN(openSessionStart.getTime())
        ? 0
        : Math.max(0, Math.floor((Date.now() - openSessionStart.getTime()) / 1000));
      totalWorkedSeconds = closedWorkedMinutes * 60 + sessionSeconds;

      const liveMinutes = Math.floor(totalWorkedSeconds / 60);
      const seconds = totalWorkedSeconds % 60;
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
      worked_seconds: totalWorkedSeconds,
      live_session: !!openSession,
      allow_multiple_checkins: allowMultipleCheckins,
      shift: shiftBlock,
      office: officeBlock,
    };
  }

  async getPeersToday(user: LoggedInUser) {
    const date = todayLocalDate();

    const filters = {
      organizationId: user.organizationId,
      date,
      page: 1,
      limit: 50,
    };

    const { rows } = await this.recordRepo.dailyPreview(filters);

    const activeStatuses = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.PENDING_APPROVAL,
    ];

    const peers = rows
      .filter((r) =>
        activeStatuses.includes(r.record.attendance_status as AttendanceStatus),
      )
      .filter((r) => r.record.employee_id !== user.userId)
      .map((r) => {
        const nameParts = [r.first_name, r.middle_name, r.last_name].filter(
          Boolean,
        );
        return {
          id: r.record.employee_id,
          name: nameParts.join(' '),
          department: r.department_name,
          time: formatTime12(r.record.first_check_in_at),
        };
      });

    return peers;
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
      multiple_sessions_allowed:
        rule.allow_multiple_checkins || shift.allow_multiple_checkins || false,
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

  /**
   * Returns Mon–Sun of the current calendar week with per-day attendance status.
   * Resolves the employee's weekly-off config to correctly label weekend days.
   * Days after today are marked as 'UPCOMING'; today without a record is 'ABSENT'.
   */
  async getMyWeekSummary(user: LoggedInUser) {
    const now = new Date();
    const todayStr = todayLocalDate(now);

    // Compute Mon–Sun of the current week (ISO: Monday = 1)
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon … 6 = Sat
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    // Build array of the 7 days Mon–Sun as YYYY-MM-DD strings
    const weekDates: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return todayLocalDate(d);
    });

    // Fetch all attendance records for this week in one date-range query
    const weekRecords = await this.recordRepo.findWeekRecords(
      user.organizationId,
      user.userId,
      weekDates[0],
      weekDates[6],
    );

    // Build a fast lookup map: date → record
    const recordMap = new Map<string, (typeof weekRecords)[0]>();
    for (const r of weekRecords) {
      recordMap.set(r.date, r);
    }

    // Resolve the employee's weekly-off config
    const weeklyOffDays = new Set<string>();
    try {
      const { rule } = await this.ruleResolver.resolveForEmployee(
        user.organizationId,
        user.userId,
      );

      // AttendanceRule has a weekly_off_id FK column
      const weeklyOffId = (rule as any).weekly_off_id as string | null;
      if (weeklyOffId) {
        const weeklyOff = await this.recordRepo.findWeeklyOff(weeklyOffId);
        if (weeklyOff) {
          for (const dateStr of weekDates) {
            if (isWeeklyOffDay(dateStr, weeklyOff)) {
              weeklyOffDays.add(dateStr);
            }
          }
        }
      }
    } catch {
      // No rule assigned — default Sunday as the only off-day
      weeklyOffDays.add(weekDates[6]);
    }

    const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    const days = weekDates.map((dateStr, i) => {
      const isWeekend = weeklyOffDays.has(dateStr);
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;
      const record = recordMap.get(dateStr);

      let status: string;
      let workedHours: string | null = null;
      let checkIn: string | null = null;
      let checkOut: string | null = null;

      if (isWeekend) {
        status = 'WEEKLY_OFF';
      } else if (isFuture) {
        status = 'UPCOMING';
      } else if (!record) {
        status = isToday ? 'NOT_CHECKED_IN' : AttendanceStatus.ABSENT;
      } else {
        status = record.attendance_status;
        workedHours = formatHmm(record.worked_minutes);
        checkIn = formatTime12(record.first_check_in_at);
        checkOut = formatTime12(record.last_check_out_at);
      }

      return {
        date: dateStr,
        day_label: DAY_LABELS[i],
        status,
        worked_hours: workedHours,
        check_in: checkIn,
        check_out: checkOut,
        is_today: isToday,
        is_weekend: isWeekend,
      };
    });

    const presentStatuses = new Set([
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.OVERTIME,
    ]);

    const workedDays = days.filter(
      (d) => !d.is_weekend && d.status !== 'UPCOMING',
    );
    const presentCount = workedDays.filter((d) =>
      presentStatuses.has(d.status as AttendanceStatus),
    ).length;
    const workdayCount = workedDays.length;

    return {
      days,
      present_count: presentCount,
      workday_count: workdayCount,
    };
  }
}
