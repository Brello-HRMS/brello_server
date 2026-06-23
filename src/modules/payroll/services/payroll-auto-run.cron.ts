import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SYSTEM_USER_ID } from '../../../common/constants/system.constants';
import { PayrollSetting } from '../entities/payroll-setting.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { FinancialMonth } from '../enums/payroll.enum';

const MONTH_BY_INDEX: FinancialMonth[] = [
  FinancialMonth.JAN,
  FinancialMonth.FEB,
  FinancialMonth.MAR,
  FinancialMonth.APR,
  FinancialMonth.MAY,
  FinancialMonth.JUN,
  FinancialMonth.JUL,
  FinancialMonth.AUG,
  FinancialMonth.SEP,
  FinancialMonth.OCT,
  FinancialMonth.NOV,
  FinancialMonth.DEC,
];

/**
 * Creates the monthly DRAFT payroll run for every configured organization on the
 * 1st, for the month that just ended. HR then prepares/processes it. Idempotent —
 * skips any (org, month, year) that already has a run. Closes the "no auto monthly
 * run creation" gap.
 */
@Injectable()
export class PayrollAutoRunCron {
  private readonly logger = new Logger(PayrollAutoRunCron.name);

  constructor(
    @InjectRepository(PayrollSetting)
    private readonly settingRepo: Repository<PayrollSetting>,
    private readonly runRepo: PayrollRunRepository,
  ) {}

  @Cron('0 3 1 * *', { name: 'payroll-monthly-auto-run' })
  async run(): Promise<void> {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prev.getUTCFullYear();
    const monthIdx = prev.getUTCMonth();
    const month = MONTH_BY_INDEX[monthIdx];
    const periodFrom = new Date(Date.UTC(year, monthIdx, 1));
    const periodTo = new Date(Date.UTC(year, monthIdx + 1, 0));
    const daysInMonth = periodTo.getUTCDate();

    const settings = await this.settingRepo.find();
    let created = 0;
    let skipped = 0;

    for (const setting of settings) {
      if (!setting.organization_id) continue;
      try {
        const existing = await this.runRepo.findByPeriod(
          setting.organization_id,
          year,
          month,
        );
        if (existing) {
          skipped++;
          continue;
        }
        await this.runRepo.create({
          enterprise_id: setting.enterprise_id,
          organization_id: setting.organization_id,
          month,
          year,
          pay_period_from: periodFrom,
          pay_period_to: periodTo,
          // Placeholder; refined during prepare to exclude weekly-offs/holidays.
          total_working_days: daysInMonth,
          modified_by: SYSTEM_USER_ID,
        });
        created++;
      } catch (err) {
        this.logger.error(
          `Auto-run creation failed for org ${setting.organization_id} (${month} ${year}): ${
            (err as Error).message
          }`,
        );
      }
    }

    this.logger.log(
      `Monthly payroll auto-run for ${month} ${year}: created=${created}, skipped=${skipped}`,
    );
  }
}
