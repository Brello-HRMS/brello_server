import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollSetting } from '../entities/payroll-setting.entity';
import { PayrollSourceRepository } from '../repositories/payroll-source.repository';
import { LeaveRequest } from '../../leave-request/entities/leave-request.entity';
import { LeaveRequestStatus } from '../../leave-request/enums';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A few days before each org's payout date, warns when payroll inputs aren't ready
 * — unfinalized (pending-approval) attendance, pending auto-checkout corrections,
 * or undecided leave requests in the current month. Replaces the previously mocked
 * checks with real queries.
 *
 * TODO(notification): dispatch these warnings to each org's payroll admins via
 * NotificationService once recipient resolution (RBAC role lookup) is wired.
 */
@Injectable()
export class PayrollReminderCron {
  private readonly logger = new Logger(PayrollReminderCron.name);

  constructor(
    @InjectRepository(PayrollSetting)
    private readonly payrollSettingRepository: Repository<PayrollSetting>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
    private readonly sourceRepo: PayrollSourceRepository,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    const settings = await this.payrollSettingRepository.find();

    const today = new Date();
    const dayOfMonth = today.getUTCDate();
    const year = today.getUTCFullYear();
    const monthIdx = today.getUTCMonth();
    const fromDate = `${year}-${pad(monthIdx + 1)}-01`;
    const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
    const toDate = `${year}-${pad(monthIdx + 1)}-${pad(lastDay)}`;

    for (const setting of settings) {
      if (!setting.organization_id) continue;

      // Fire ~4 days before the payout date (fallback to the 28th).
      let triggerDate = (setting.payout_date ?? 28) - 4;
      if (triggerDate <= 0) triggerDate = 28;
      if (dayOfMonth !== triggerDate) continue;

      try {
        const pendingAttendance =
          await this.sourceRepo.findEmployeesWithPendingAttendance(
            setting.organization_id,
            fromDate,
            toDate,
          );
        const pendingCorrections =
          await this.sourceRepo.findEmployeesWithPendingCorrections(
            setting.organization_id,
            fromDate,
            toDate,
          );
        const pendingLeaves = await this.leaveRepo.count({
          where: {
            organization_id: setting.organization_id,
            request_status: LeaveRequestStatus.PENDING,
          },
        });

        if (
          pendingAttendance.length > 0 ||
          pendingCorrections.length > 0 ||
          pendingLeaves > 0
        ) {
          this.logger.warn(
            `Payroll prep reminder for org ${setting.organization_id}: ` +
              `${pendingAttendance.length} attendance pending-approval, ` +
              `${pendingCorrections.length} auto-checkout correction(s) pending, ` +
              `${pendingLeaves} leave request(s) pending. Resolve before processing payroll.`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Payroll reminder check failed for org ${setting.organization_id}: ${
            (err as Error).message
          }`,
        );
      }
    }
  }
}
