import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { EmployeeStatus } from '../../user/enums/user.enum';
import { Holiday } from '../../holiday/entities/holiday.entity';
import { LeaveRequest } from '../../leave-request/entities/leave-request.entity';
import { LeaveRequestStatus } from '../../leave-request/enums';
import { Status } from '../../../common/enums';
import { SYSTEM_USER_ID } from '../../../common/constants/system.constants';
import { AttendanceRecord } from '../entities/attendance-record.entity';
import { AttendanceRule } from '../entities/attendance-rule.entity';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { AttendanceRuleRepository } from '../repositories/attendance-rule.repository';
import { RuleAssignmentRepository } from '../repositories/rule-assignment.repository';
import { AuditService } from '../../audit/services/audit.service';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditLogModule } from '../../audit/enums/audit-log-module.enum';
import { AttendanceStatus } from '../enums/attendance-status.enum';
import { AttendanceSource } from '../enums/attendance-source.enum';
import { CorrectionStatus } from '../enums/correction-status.enum';
import { isWeeklyOffDay } from './attendance-calc.util';

export enum AuditEventType {
  AUTO_HOLIDAY_SYNC = 'AUTO_HOLIDAY_SYNC',
  AUTO_LEAVE_SYNC = 'AUTO_LEAVE_SYNC',
  AUTO_WEEKLY_OFF_MARK = 'AUTO_WEEKLY_OFF_MARK',
  AUTO_ABSENT_MARK = 'AUTO_ABSENT_MARK',
  MISSED_CHECK_OUT = 'MISSED_CHECK_OUT',
  MISSED_CHECK_IN = 'MISSED_CHECK_IN',
}

export interface MaterializationSummary {
  target_date: string;
  skipped: number;
  weekly_off_created: number;
  holiday_created: number;
  on_leave_created: number;
  absent_created: number;
  upgraded: number;
  errors: number;
}

const ACTIVE_EMPLOYEE_STATUSES = [
  EmployeeStatus.ACTIVE,
  EmployeeStatus.OFFBOARDING,
];

// Statuses that represent real work / pending review — never overwritten by sync.
const PROTECTED_STATUSES = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.HALF_DAY,
  AttendanceStatus.OVERTIME,
  AttendanceStatus.MISSED_CHECKOUT,
  AttendanceStatus.PENDING_APPROVAL,
];

/**
 * Materializes one explicit attendance_record per (employee, day) for past
 * working days, so payroll never silently under-counts an employee who simply
 * never checked in. Also exposes event-driven sync (leave/holiday) and the
 * correction-window finalization job. All writes are tagged source=AUTO and
 * attributed to SYSTEM_USER_ID. See attendance-daily-cron.md.
 */
@Injectable()
export class AttendanceMaterializationService {
  private readonly logger = new Logger(AttendanceMaterializationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(AttendanceRecord)
    private readonly recordEntityRepo: Repository<AttendanceRecord>,
    private readonly recordRepo: AttendanceRecordRepository,
    private readonly ruleRepo: AttendanceRuleRepository,
    private readonly assignmentRepo: RuleAssignmentRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Daily 1 AM job. Ensures every active employee has a record for `targetDate`.
   * Idempotent — safe to re-run; existing records are only upgraded ABSENT→leave/holiday.
   */
  async runDailyAbsentMarking(
    targetDate: string,
  ): Promise<MaterializationSummary> {
    const summary: MaterializationSummary = {
      target_date: targetDate,
      skipped: 0,
      weekly_off_created: 0,
      holiday_created: 0,
      on_leave_created: 0,
      absent_created: 0,
      upgraded: 0,
      errors: 0,
    };

    const employees = await this.userRepo.find({
      where: {
        user_profile: { employee_status: In(ACTIVE_EMPLOYEE_STATUSES) },
      },
      relations: ['user_profile'],
    });

    // Group employees per org so holiday/leave lookups are done once per org.
    const byOrg = new Map<string, User[]>();
    for (const emp of employees) {
      if (!emp.organization_id) continue;
      const list = byOrg.get(emp.organization_id) ?? [];
      list.push(emp);
      byOrg.set(emp.organization_id, list);
    }

    for (const [orgId, roster] of byOrg) {
      const isHoliday = await this.isHolidayForOrg(orgId, targetDate);
      const onLeaveSet = await this.onLeaveEmployeeIds(orgId, targetDate);
      const ruleCache = new Map<string, AttendanceRule | null>();

      for (const emp of roster) {
        try {
          const profile = emp.user_profile;
          const joining = toDateStr(profile?.joining_date);
          const lastWorking = toDateStr(profile?.last_working_day);
          if (joining && targetDate < joining) {
            summary.skipped++;
            continue;
          }
          if (lastWorking && targetDate > lastWorking) {
            summary.skipped++;
            continue;
          }

          const rule = await this.resolveRule(
            orgId,
            emp.id,
            emp.department_id ?? undefined,
            ruleCache,
          );
          if (!rule) {
            summary.skipped++;
            continue;
          }

          const isWeeklyOff = rule.weekly_off
            ? isWeeklyOffDay(targetDate, rule.weekly_off)
            : false;
          const isOnLeave = onLeaveSet.has(emp.id);

          const existing = await this.recordRepo.findForEmployeeOnDate(
            orgId,
            emp.id,
            targetDate,
          );

          if (existing) {
            // Only upgrade an auto/absent placeholder to a more specific status.
            if (
              existing.attendance_status === AttendanceStatus.ABSENT &&
              (isOnLeave || isHoliday)
            ) {
              const upgraded = isHoliday
                ? AttendanceStatus.HOLIDAY
                : AttendanceStatus.ON_LEAVE;
              await this.recordRepo.update(existing.id, {
                attendance_status: upgraded,
                source: AttendanceSource.AUTO,
                modified_by: SYSTEM_USER_ID,
              });
              await this.writeAudit(
                emp,
                existing.id,
                isHoliday
                  ? AuditEventType.AUTO_HOLIDAY_SYNC
                  : AuditEventType.AUTO_LEAVE_SYNC,
                { from: existing.attendance_status, to: upgraded },
              );
              summary.upgraded++;
            } else {
              summary.skipped++;
            }
            continue;
          }

          // No record yet — create one by priority: weekly-off > holiday > leave > absent.
          let status: AttendanceStatus;
          let event: AuditEventType;
          if (isWeeklyOff) {
            status = AttendanceStatus.WEEKLY_OFF;
            event = AuditEventType.AUTO_WEEKLY_OFF_MARK;
          } else if (isHoliday) {
            status = AttendanceStatus.HOLIDAY;
            event = AuditEventType.AUTO_HOLIDAY_SYNC;
          } else if (isOnLeave) {
            status = AttendanceStatus.ON_LEAVE;
            event = AuditEventType.AUTO_LEAVE_SYNC;
          } else {
            status = AttendanceStatus.ABSENT;
            event = AuditEventType.AUTO_ABSENT_MARK;
          }

          const created = await this.createAutoRecord(
            emp,
            targetDate,
            rule,
            status,
          );
          await this.writeAudit(emp, created.id, event, {
            attendance_status: status,
            date: targetDate,
            reason: 'daily-materialization-job',
          });

          if (status === AttendanceStatus.WEEKLY_OFF) summary.weekly_off_created++;
          else if (status === AttendanceStatus.HOLIDAY) summary.holiday_created++;
          else if (status === AttendanceStatus.ON_LEAVE) summary.on_leave_created++;
          else summary.absent_created++;
        } catch (err) {
          summary.errors++;
          this.logger.error(
            `Materialization failed for employee ${emp.id} on ${targetDate}: ${
              (err as Error).message
            }`,
          );
        }
      }
    }

    this.logger.log(
      `Materialized ${targetDate}: absent=${summary.absent_created}, weekly_off=${summary.weekly_off_created}, ` +
        `holiday=${summary.holiday_created}, on_leave=${summary.on_leave_created}, upgraded=${summary.upgraded}, ` +
        `skipped=${summary.skipped}, errors=${summary.errors}`,
    );
    return summary;
  }

  /**
   * Closes the correction window for auto-checkout records older than the cutoff
   * with no correction action, so payroll can process them without blocking.
   */
  async finalizeExpiredCorrectionWindows(cutoffDate: string): Promise<number> {
    const result = await this.recordEntityRepo
      .createQueryBuilder()
      .update(AttendanceRecord)
      .set({ correction_status: CorrectionStatus.CLOSED, modified_by: SYSTEM_USER_ID })
      .where('has_auto_checkout = true')
      .andWhere('correction_status IS NULL')
      .andWhere('is_deleted = false')
      .andWhere('date <= :cutoff', { cutoff: cutoffDate })
      .execute();

    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.log(
        `Finalized ${affected} expired auto-checkout correction window(s) (<= ${cutoffDate}).`,
      );
    }
    return affected;
  }

  // ─── Event-driven sync (attendance-daily-cron.md §6–7) ────────────────────────

  /** On leave approval: stamp ON_LEAVE across the leave's working days. */
  async syncLeaveToAttendance(leaveRequestId: string): Promise<void> {
    const leave = await this.leaveRepo.findOne({ where: { id: leaveRequestId } });
    if (!leave || leave.request_status !== LeaveRequestStatus.APPROVED) return;

    const emp = await this.userRepo.findOne({
      where: { id: leave.employee_id },
      relations: ['user_profile'],
    });
    if (!emp || !emp.organization_id) return;

    const orgId = emp.organization_id;
    const ruleCache = new Map<string, AttendanceRule | null>();

    for (const date of eachDate(leave.from_date, leave.to_date)) {
      try {
        const rule = await this.resolveRule(
          orgId,
          emp.id,
          emp.department_id ?? undefined,
          ruleCache,
        );
        if (!rule) continue;
        // Weekly-off and holiday outrank leave — no ON_LEAVE on those days.
        if (rule.weekly_off && isWeeklyOffDay(date, rule.weekly_off)) continue;
        if (await this.isHolidayForOrg(orgId, date)) continue;

        const existing = await this.recordRepo.findForEmployeeOnDate(
          orgId,
          emp.id,
          date,
        );
        if (existing) {
          // Never override real work / pending review; only upgrade ABSENT.
          if (existing.attendance_status !== AttendanceStatus.ABSENT) continue;
          await this.recordRepo.update(existing.id, {
            attendance_status: AttendanceStatus.ON_LEAVE,
            source: AttendanceSource.AUTO,
            modified_by: SYSTEM_USER_ID,
          });
          await this.writeAudit(emp, existing.id, AuditEventType.AUTO_LEAVE_SYNC, {
            from: AttendanceStatus.ABSENT,
            to: AttendanceStatus.ON_LEAVE,
          });
        } else {
          const created = await this.createAutoRecord(
            emp,
            date,
            rule,
            AttendanceStatus.ON_LEAVE,
          );
          await this.writeAudit(emp, created.id, AuditEventType.AUTO_LEAVE_SYNC, {
            attendance_status: AttendanceStatus.ON_LEAVE,
            date,
          });
        }
      } catch (err) {
        this.logger.error(
          `Leave sync failed for ${emp.id} on ${date}: ${(err as Error).message}`,
        );
      }
    }
  }

  /** On leave cancellation: revert AUTO ON_LEAVE days back to their natural status. */
  async reverseLeaveSync(leaveRequestId: string): Promise<void> {
    const leave = await this.leaveRepo.findOne({ where: { id: leaveRequestId } });
    if (!leave) return;
    const emp = await this.userRepo.findOne({
      where: { id: leave.employee_id },
      relations: ['user_profile'],
    });
    if (!emp || !emp.organization_id) return;

    const orgId = emp.organization_id;
    const ruleCache = new Map<string, AttendanceRule | null>();

    for (const date of eachDate(leave.from_date, leave.to_date)) {
      const existing = await this.recordRepo.findForEmployeeOnDate(
        orgId,
        emp.id,
        date,
      );
      if (
        !existing ||
        existing.attendance_status !== AttendanceStatus.ON_LEAVE ||
        existing.source !== AttendanceSource.AUTO
      ) {
        continue;
      }
      const rule = await this.resolveRule(
        orgId,
        emp.id,
        emp.department_id ?? undefined,
        ruleCache,
      );
      let status = AttendanceStatus.ABSENT;
      if (rule?.weekly_off && isWeeklyOffDay(date, rule.weekly_off)) {
        status = AttendanceStatus.WEEKLY_OFF;
      } else if (await this.isHolidayForOrg(orgId, date)) {
        status = AttendanceStatus.HOLIDAY;
      }
      await this.recordRepo.update(existing.id, {
        attendance_status: status,
        modified_by: SYSTEM_USER_ID,
      });
      await this.writeAudit(emp, existing.id, AuditEventType.AUTO_LEAVE_SYNC, {
        from: AttendanceStatus.ON_LEAVE,
        to: status,
        reason: 'leave-cancelled-reverse',
      });
    }
  }

  /** On holiday creation: stamp HOLIDAY for everyone in the org on that date. */
  async syncHolidayToAttendance(holidayId: string): Promise<void> {
    const holiday = await this.holidayRepo.findOne({
      where: { id: holidayId },
      relations: ['calendar'],
    });
    const orgId = holiday?.calendar?.organization_id;
    if (!holiday || !orgId) return;
    const date = toDateStr(holiday.date);
    if (!date) return;

    const employees = await this.userRepo.find({
      where: {
        organization_id: orgId,
        user_profile: { employee_status: In(ACTIVE_EMPLOYEE_STATUSES) },
      },
      relations: ['user_profile'],
    });
    const ruleCache = new Map<string, AttendanceRule | null>();

    for (const emp of employees) {
      try {
        const rule = await this.resolveRule(
          orgId,
          emp.id,
          emp.department_id ?? undefined,
          ruleCache,
        );
        if (!rule) continue;
        if (rule.weekly_off && isWeeklyOffDay(date, rule.weekly_off)) continue;

        const existing = await this.recordRepo.findForEmployeeOnDate(
          orgId,
          emp.id,
          date,
        );
        if (existing) {
          if (existing.attendance_status !== AttendanceStatus.ABSENT) continue;
          await this.recordRepo.update(existing.id, {
            attendance_status: AttendanceStatus.HOLIDAY,
            source: AttendanceSource.AUTO,
            modified_by: SYSTEM_USER_ID,
          });
          await this.writeAudit(
            emp,
            existing.id,
            AuditEventType.AUTO_HOLIDAY_SYNC,
            { from: AttendanceStatus.ABSENT, to: AttendanceStatus.HOLIDAY },
          );
        } else {
          const created = await this.createAutoRecord(
            emp,
            date,
            rule,
            AttendanceStatus.HOLIDAY,
          );
          await this.writeAudit(emp, created.id, AuditEventType.AUTO_HOLIDAY_SYNC, {
            attendance_status: AttendanceStatus.HOLIDAY,
            date,
          });
        }
      } catch (err) {
        this.logger.error(
          `Holiday sync failed for ${emp.id} on ${date}: ${(err as Error).message}`,
        );
      }
    }
  }

  /** On holiday deletion: revert AUTO HOLIDAY records on that date to natural status. */
  async reverseHolidaySync(holidayId: string): Promise<void> {
    const holiday = await this.holidayRepo.findOne({
      where: { id: holidayId },
      relations: ['calendar'],
    });
    const orgId = holiday?.calendar?.organization_id;
    if (!holiday || !orgId) return;
    const date = toDateStr(holiday.date);
    if (!date) return;

    const records = await this.recordEntityRepo.find({
      where: {
        organization_id: orgId,
        date,
        attendance_status: AttendanceStatus.HOLIDAY,
        source: AttendanceSource.AUTO,
        is_deleted: false,
      },
    });
    const ruleCache = new Map<string, AttendanceRule | null>();

    for (const rec of records) {
      const emp = await this.userRepo.findOne({ where: { id: rec.employee_id } });
      const rule = await this.resolveRule(
        orgId,
        rec.employee_id,
        emp?.department_id ?? undefined,
        ruleCache,
      );
      const status =
        rule?.weekly_off && isWeeklyOffDay(date, rule.weekly_off)
          ? AttendanceStatus.WEEKLY_OFF
          : AttendanceStatus.ABSENT;
      await this.recordRepo.update(rec.id, {
        attendance_status: status,
        modified_by: SYSTEM_USER_ID,
      });
      if (emp) {
        await this.writeAudit(emp, rec.id, AuditEventType.AUTO_HOLIDAY_SYNC, {
          from: AttendanceStatus.HOLIDAY,
          to: status,
          reason: 'holiday-deleted-reverse',
        });
      }
    }
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async isHolidayForOrg(
    orgId: string,
    date: string,
  ): Promise<boolean> {
    const count = await this.holidayRepo
      .createQueryBuilder('h')
      .innerJoin('h.calendar', 'c')
      .where('c.organization_id = :orgId', { orgId })
      .andWhere('c.status = :active', { active: Status.ACTIVE })
      .andWhere('c.is_deleted = false')
      .andWhere('h.is_deleted = false')
      .andWhere('h.date = :date', { date })
      .getCount();
    return count > 0;
  }

  private async onLeaveEmployeeIds(
    orgId: string,
    date: string,
  ): Promise<Set<string>> {
    const leaves = await this.leaveRepo.find({
      where: {
        organization_id: orgId,
        request_status: LeaveRequestStatus.APPROVED,
        from_date: LessThanOrEqual(date),
        to_date: MoreThanOrEqual(date),
      },
      select: ['employee_id'],
    });
    return new Set(leaves.map((l) => l.employee_id));
  }

  private async resolveRule(
    orgId: string,
    employeeId: string,
    departmentId: string | undefined,
    cache: Map<string, AttendanceRule | null>,
  ): Promise<AttendanceRule | null> {
    const assignment = await this.assignmentRepo.findEffectiveRuleForEmployee(
      orgId,
      employeeId,
      departmentId,
    );
    if (!assignment) return null;
    if (cache.has(assignment.rule_id)) return cache.get(assignment.rule_id) ?? null;
    const rule = await this.ruleRepo.findOneByOrg(assignment.rule_id, orgId);
    cache.set(assignment.rule_id, rule);
    return rule;
  }

  private async createAutoRecord(
    emp: User,
    date: string,
    rule: AttendanceRule,
    status: AttendanceStatus,
  ): Promise<AttendanceRecord> {
    return this.recordRepo.create({
      enterprise_id: emp.enterprise_id,
      organization_id: emp.organization_id,
      employee_id: emp.id,
      date,
      shift_id: rule.shift_id ?? null,
      rule_id: rule.id,
      attendance_status: status,
      source: AttendanceSource.AUTO,
      worked_minutes: 0,
      overtime_minutes: 0,
      is_late: false,
      modified_by: SYSTEM_USER_ID,
    });
  }

  private async writeAudit(
    emp: User,
    recordId: string,
    eventType: string,
    newValue: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      actor_id: SYSTEM_USER_ID,
      is_platform_admin: false,
      module: AuditLogModule.ATTENDANCE,
      entity_type: 'attendance_record',
      entity_id: recordId,
      action: AuditAction.UPDATE,
      organization_id: emp.organization_id,
      enterprise_id: emp.enterprise_id,
      ip_address: '127.0.0.1',
      user_agent: 'BrelloCron',
      new_value: newValue,
      description: `Event type: ${eventType}`,
    });
  }

  // Exposed so PROTECTED_STATUSES can be reused by the event-sync methods (Phase 5).
  protected isProtected(status: AttendanceStatus): boolean {
    return PROTECTED_STATUSES.includes(status);
  }
}

/** TypeORM `date` columns come back as strings; normalize Date|string → YYYY-MM-DD. */
function toDateStr(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Inclusive list of YYYY-MM-DD dates between two date values (UTC-stable). */
function eachDate(
  from: Date | string,
  to: Date | string,
): string[] {
  const fromStr = toDateStr(from);
  const toStr = toDateStr(to);
  const out: string[] = [];
  if (!fromStr || !toStr) return out;
  const cursor = new Date(`${fromStr}T00:00:00Z`);
  const end = new Date(`${toStr}T00:00:00Z`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
