import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OtpRepository } from '../repositories/otp.repository';
import { SessionRepository } from '../repositories/session.repository';

/**
 * OTP Cleanup Task
 *
 * Scheduled task to clean up expired OTPs and sessions.
 * Runs periodically to maintain database hygiene.
 *
 * Design Pattern: Scheduled Task Pattern
 * - Automated cleanup of expired data
 * - Prevents database bloat
 * - Improves query performance
 *
 * Schedule:
 * - Runs every hour to clean up expired OTPs
 * - Runs daily to clean up expired sessions
 */
@Injectable()
export class OtpCleanupTask {
  private readonly logger = new Logger(OtpCleanupTask.name);

  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly sessionRepository: SessionRepository,
  ) {}

  /**
   * Clean up expired OTPs
   *
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOtps() {
    this.logger.log('Running OTP cleanup task');

    try {
      const deletedCount = await this.otpRepository.deleteExpiredOtps();
      this.logger.log(`Deleted ${deletedCount} expired OTPs`);
    } catch (error) {
      this.logger.error('Error cleaning up expired OTPs', error);
    }
  }

  /**
   * Clean up expired sessions
   *
   * Runs every day at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredSessions() {
    this.logger.log('Running session cleanup task');

    try {
      const deletedCount = await this.sessionRepository.deleteExpiredSessions();
      this.logger.log(`Deleted ${deletedCount} expired sessions`);
    } catch (error) {
      this.logger.error('Error cleaning up expired sessions', error);
    }
  }
}
