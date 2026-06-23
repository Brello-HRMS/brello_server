import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AttendanceMaterializationService } from './attendance-materialization.service';
import { AutoCheckoutService } from './auto-checkout.service';
import { getYesterdayLocalDate, todayLocalDate } from './attendance-calc.util';

/**
 * Owns all attendance @Cron schedules (attendance-daily-cron.md §14). Thin
 * wrappers — the work lives in AttendanceMaterializationService so it stays
 * unit-testable and reusable by event-driven callers.
 */
@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(
    private readonly materialization: AttendanceMaterializationService,
    private readonly autoCheckout: AutoCheckoutService,
  ) {}

  /** Daily 01:00 — materialize yesterday's records (absent/weekly-off/holiday/leave). */
  @Cron('0 1 * * *', { name: 'daily-absent-marking' })
  async runDailyAbsentMarking(): Promise<void> {
    const yesterday = getYesterdayLocalDate();
    this.logger.log(`Running daily absent marking for ${yesterday}...`);
    try {
      await this.materialization.runDailyAbsentMarking(yesterday);
    } catch (err) {
      this.logger.error(
        `Daily absent marking failed for ${yesterday}: ${(err as Error).message}`,
      );
    }
  }

  /** Daily 02:00 — close correction windows older than 7 days. */
  @Cron('0 2 * * *', { name: 'attendance-finalization' })
  async runAttendanceFinalization(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffDate = todayLocalDate(cutoff);
    try {
      await this.materialization.finalizeExpiredCorrectionWindows(cutoffDate);
    } catch (err) {
      this.logger.error(
        `Attendance finalization failed (cutoff ${cutoffDate}): ${(err as Error).message}`,
      );
    }
  }

  /** Every 30 min — warn employees before their open session is auto-closed. */
  @Cron('0,30 * * * *', { name: 'pre-checkout-reminder' })
  async runPreCheckoutReminder(): Promise<void> {
    try {
      await this.autoCheckout.sendPreCheckoutReminders();
    } catch (err) {
      this.logger.error(
        `Pre-checkout reminder run failed: ${(err as Error).message}`,
      );
    }
  }
}
