import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NotificationService } from '../../notification/services/notification.service';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { SYSTEM_USER_ID } from '../../../common/constants/system.constants';
import { AttendanceSession } from '../entities/attendance-session.entity';
import { AttendanceRecordRepository } from '../repositories/attendance-record.repository';
import { ShiftRepository } from '../repositories/shift.repository';
import { AttendanceRuleRepository } from '../repositories/attendance-rule.repository';
import { AttendanceAuditLogRepository } from '../repositories/attendance-audit-log.repository';
import { AttendanceService } from './attendance.service';
import { AuditEventType } from '../enums/audit-event-type.enum';
import { resolveAutoCheckoutAt, formatTime12 } from './attendance-calc.util';

export interface AutoCheckoutSummary {
  processed: number;
  skipped: number;
  errors: number;
}

const BATCH_LIMIT = 500;

/**
 * Closes attendance sessions employees forgot to check out of. Every 15 minutes
 * it scans open sessions, computes each one's auto-checkout cutoff
 * (min(shift end + grace + sync buffer, check-in + max session hours)), and if
 * the cutoff has passed closes the session AT THE CUTOFF (not now) via the shared
 * AttendanceService.applyCheckout — preserving valid overtime. See auto-checkout.md.
 */
@Injectable()
export class AutoCheckoutService {
  private readonly logger = new Logger(AutoCheckoutService.name);

  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessionRepo: Repository<AttendanceSession>,
    private readonly recordRepo: AttendanceRecordRepository,
    private readonly shiftRepo: ShiftRepository,
    private readonly ruleRepo: AttendanceRuleRepository,
    private readonly auditRepo: AttendanceAuditLogRepository,
    private readonly attendanceService: AttendanceService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0,15,30,45 * * * *', { name: 'auto-checkout' })
  async run(): Promise<void> {
    try {
      const summary = await this.processOpenSessions();
      if (summary.processed > 0 || summary.errors > 0) {
        this.logger.log(
          `Auto-checkout: processed=${summary.processed}, skipped=${summary.skipped}, errors=${summary.errors}`,
        );
      }
    } catch (err) {
      this.logger.error(`Auto-checkout run failed: ${(err as Error).message}`);
    }
  }

  async processOpenSessions(limit = BATCH_LIMIT): Promise<AutoCheckoutSummary> {
    const summary: AutoCheckoutSummary = { processed: 0, skipped: 0, errors: 0 };
    const now = new Date();

    const openSessions = await this.sessionRepo.find({
      where: { check_out_at: IsNull() },
      order: { check_in_at: 'ASC' },
      take: limit,
    });

    for (const session of openSessions) {
      try {
        const orgId = session.organization_id;
        const record = await this.recordRepo.findById(
          session.attendance_record_id,
          orgId,
        );
        if (!record || !record.shift_id || !record.rule_id) {
          summary.skipped++;
          continue;
        }

        const shift = await this.shiftRepo.findOneByOrg(record.shift_id, orgId);
        if (!shift || !shift.auto_checkout_enabled) {
          summary.skipped++;
          continue;
        }

        const rule = await this.ruleRepo.findOneByOrg(record.rule_id, orgId);
        if (!rule) {
          summary.skipped++;
          continue;
        }

        const autoCheckoutAt = resolveAutoCheckoutAt(session.check_in_at, shift);
        if (now < autoCheckoutAt) {
          summary.skipped++;
          continue;
        }

        const before = {
          worked_minutes: record.worked_minutes,
          attendance_status: record.attendance_status,
        };

        const computed = await this.attendanceService.applyCheckout({
          session,
          record,
          rule,
          shift,
          checkOutAt: autoCheckoutAt,
          performedBy: SYSTEM_USER_ID,
          isAutoCheckout: true,
        });

        await this.auditRepo.create({
          enterprise_id: session.enterprise_id,
          organization_id: orgId,
          attendance_record_id: record.id,
          attendance_session_id: session.id,
          employee_id: session.employee_id,
          performed_by: SYSTEM_USER_ID,
          event_type: AuditEventType.AUTO_CHECKOUT,
          old_value: before,
          new_value: {
            check_out_at: autoCheckoutAt.toISOString(),
            worked_minutes: computed.worked_minutes,
            attendance_status: computed.attendance_status,
          },
        });

        await this.notifyEmployee(session, record.date, autoCheckoutAt);
        summary.processed++;
      } catch (err) {
        summary.errors++;
        this.logger.error(
          `Auto-checkout failed for session ${session.id}: ${(err as Error).message}`,
        );
      }
    }

    return summary;
  }

  /**
   * Warns employees ~30 min before their open session is auto-closed, so they can
   * check out with the real time or note they'll need a correction. Deduped via
   * AttendanceSession.reminder_sent. Driven by AttendanceCronService every 30 min.
   */
  async sendPreCheckoutReminders(limit = BATCH_LIMIT): Promise<number> {
    const now = new Date();
    const openSessions = await this.sessionRepo.find({
      where: { check_out_at: IsNull(), reminder_sent: false },
      order: { check_in_at: 'ASC' },
      take: limit,
    });

    let sent = 0;
    for (const session of openSessions) {
      try {
        const orgId = session.organization_id;
        const record = await this.recordRepo.findById(
          session.attendance_record_id,
          orgId,
        );
        if (!record || !record.shift_id) continue;
        const shift = await this.shiftRepo.findOneByOrg(record.shift_id, orgId);
        if (!shift || !shift.auto_checkout_enabled) continue;

        const autoCheckoutAt = resolveAutoCheckoutAt(session.check_in_at, shift);
        const warningAt = new Date(autoCheckoutAt.getTime() - 30 * 60_000);
        if (now < warningAt || now >= autoCheckoutAt) continue;

        await this.notificationService
          .send({
            user_id: session.employee_id,
            type: NotificationType.IN_APP,
            title: 'Checkout reminder',
            message:
              `Your attendance will be auto-closed at ${formatTime12(autoCheckoutAt)} ` +
              `if you don't check out. If you've already left, check out now or submit a correction after.`,
            metadata: { attendance_session_id: session.id },
          })
          .catch(() => undefined);

        await this.sessionRepo.update(session.id, { reminder_sent: true });
        sent++;
      } catch (err) {
        this.logger.warn(
          `Pre-checkout reminder failed for session ${session.id}: ${
            (err as Error).message
          }`,
        );
      }
    }
    return sent;
  }

  /** Best-effort notification — never block the auto-checkout on a delivery failure. */
  private async notifyEmployee(
    session: AttendanceSession,
    date: string,
    autoCheckoutAt: Date,
  ): Promise<void> {
    try {
      await this.notificationService.send({
        user_id: session.employee_id,
        type: NotificationType.IN_APP,
        title: 'Your attendance was auto-closed',
        message:
          `Your attendance for ${date} was auto-closed at ${formatTime12(autoCheckoutAt)} ` +
          `because no check-out was recorded. If this is incorrect, submit a correction request.`,
        metadata: {
          attendance_record_id: session.attendance_record_id,
          attendance_session_id: session.id,
          auto_checkout_at: autoCheckoutAt.toISOString(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Auto-checkout notification failed for employee ${session.employee_id}: ${
          (err as Error).message
        }`,
      );
    }
  }
}
