import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollSetting } from '../entities/payroll-setting.entity';
import { CreatePayrollSettingDto } from '../dto/payroll-setting.dto';
import { FinancialMonth } from '../enums/payroll.enum';
import { AuditContextService } from '../../audit/services/audit-context.service';

const MONTH_ORDER: FinancialMonth[] = [
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

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(PayrollSetting)
    private readonly payrollSettingRepository: Repository<PayrollSetting>,
    private readonly auditContext: AuditContextService,
  ) {}

  async createOrUpdateSetting(
    enterpriseId: string,
    organizationId: string,
    dto: CreatePayrollSettingDto,
  ): Promise<PayrollSetting> {
    const financial_end_month = this.deriveEndMonth(dto.financial_start_month);
    const financial_year_label = this.deriveYearLabel(dto.financial_start_month);

    let setting = await this.payrollSettingRepository.findOne({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
    });

    if (setting) {
      this.auditContext.setPreValue(setting as unknown as Record<string, unknown>);
    }

    const payload = {
      ...dto,
      financial_end_month,
      financial_year_label,
      consider_holidays: dto.consider_holidays ?? true,
    };

    if (setting) {
      setting = this.payrollSettingRepository.merge(setting, payload as any);
    } else {
      setting = this.payrollSettingRepository.create({
        ...payload,
        enterprise_id: enterpriseId,
        organization_id: organizationId,
      });
    }

    return this.payrollSettingRepository.save(setting);
  }

  async getSetting(
    enterpriseId: string,
    organizationId: string,
  ): Promise<PayrollSetting | null> {
    return this.payrollSettingRepository.findOne({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
    });
  }

  private deriveEndMonth(startMonth: FinancialMonth): FinancialMonth {
    const idx = MONTH_ORDER.indexOf(startMonth);
    const endIdx = (idx + 11) % 12;
    return MONTH_ORDER[endIdx];
  }

  private deriveYearLabel(startMonth: FinancialMonth): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth(); // 0-based
    const startIdx = MONTH_ORDER.indexOf(startMonth);

    // Financial year starts at startIdx. If current month is before start, we are
    // still in the previous FY.
    const fyStartYear =
      currentMonthIdx >= startIdx ? currentYear : currentYear - 1;

    if (startMonth === FinancialMonth.JAN) {
      return `${fyStartYear}`;
    }
    return `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;
  }
}
