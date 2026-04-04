import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayrollSetting } from '../entities/payroll-setting.entity';
import { CreatePayrollSettingDto } from '../dto/payroll-setting.dto';

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(PayrollSetting)
    private readonly payrollSettingRepository: Repository<PayrollSetting>,
  ) {}

  async createOrUpdateSetting(
    enterpriseId: string,
    organizationId: string,
    dto: CreatePayrollSettingDto,
  ): Promise<PayrollSetting> {
    let setting = await this.payrollSettingRepository.findOne({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
    });

    if (setting) {
      setting = this.payrollSettingRepository.merge(setting, dto as any);
    } else {
      setting = this.payrollSettingRepository.create({
        ...dto,
        enterprise_id: enterpriseId,
        organization_id: organizationId,
      });
    }

    return this.payrollSettingRepository.save(setting);
  }

  async getSetting(
    enterpriseId: string,
    organizationId: string,
  ): Promise<PayrollSetting> {
    const setting = await this.payrollSettingRepository.findOne({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
    });

    if (!setting) {
      throw new NotFoundException(
        'Payroll setting not found for this organization',
      );
    }

    return setting;
  }
}
