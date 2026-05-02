import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollSetting } from '../entities/payroll-setting.entity';

@Injectable()
export class PayrollReminderCron {
  private readonly logger = new Logger(PayrollReminderCron.name);

  constructor(
    @InjectRepository(PayrollSetting)
    private readonly payrollSettingRepository: Repository<PayrollSetting>,
    // we would also inject Attendance/Leave services to check conditions here
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.debug('Running daily payroll reminder check...');

    // Find all payroll settings
    const settings = await this.payrollSettingRepository.find();
    const today = new Date().getDate();

    for (const setting of settings) {
      // Trigger 4 days before payout date (only relevant for custom payout type)
      let triggerDate = (setting.payout_date ?? 28) - 4;
      if (triggerDate <= 0) {
        // e.g. payout_day is 2, trigger date is month end - 2 roughly.
        // Simplified fallback for now
        triggerDate = 28;
      }

      if (today === triggerDate) {
        // Run condition check: attendance_not_locked OR pending_leaves > 0
        // Currently we mock this logic
        const attendanceNotLocked = true; // wait for attendance module
        const pendingLeaves = 2; // wait for leave module

        if (attendanceNotLocked || pendingLeaves > 0) {
          this.logger.warn(
            `Reminder for enterprise: ${setting.enterprise_id}. Please lock attendance / resolve leaves.`,
          );
          // Send notification via NotificationService implementation
        }
      }
    }
  }
}
