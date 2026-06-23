import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PfConfig } from '../entities/pf-config.entity';
import { UpsertPfConfigDto } from '../dto/pf-config.dto';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class PfConfigService {
  constructor(
    @InjectRepository(PfConfig)
    private readonly pfConfigRepository: Repository<PfConfig>,
    private readonly auditContext: AuditContextService,
  ) {}

  async upsertConfig(
    enterpriseId: string,
    organizationId: string,
    dto: UpsertPfConfigDto,
  ): Promise<PfConfig> {
    const newEffectiveFrom = new Date(dto.effective_from);

    const current = await this.pfConfigRepository.findOne({
      where: {
        enterprise_id: enterpriseId,
        organization_id: organizationId,
        effective_to: IsNull(),
      },
    });

    if (current) {
      this.auditContext.setPreValue(current as unknown as Record<string, unknown>);
      const currentFrom = new Date(current.effective_from);
      if (newEffectiveFrom <= currentFrom) {
        throw new BadRequestException(
          'effective_from must be after the current active config date.',
        );
      }
      const effectiveTo = new Date(newEffectiveFrom);
      effectiveTo.setDate(effectiveTo.getDate() - 1);
      current.effective_to = effectiveTo;
      await this.pfConfigRepository.save(current);
    }

    const newConfig = this.pfConfigRepository.create({
      employee_contribution: dto.employee_contribution,
      employer_contribution: dto.employer_contribution,
      minimum_salary_threshold: dto.minimum_salary_threshold,
      restrict_to_ceiling: dto.restrict_to_ceiling ?? true,
      is_enabled: dto.is_enabled ?? true,
      effective_from: newEffectiveFrom,
      enterprise_id: enterpriseId,
      organization_id: organizationId,
    });

    return this.pfConfigRepository.save(newConfig);
  }

  async getConfig(
    enterpriseId: string,
    organizationId: string,
  ): Promise<PfConfig | null> {
    return this.pfConfigRepository.findOne({
      where: {
        enterprise_id: enterpriseId,
        organization_id: organizationId,
        effective_to: IsNull(),
      },
    });
  }

  async getHistory(
    enterpriseId: string,
    organizationId: string,
  ): Promise<PfConfig[]> {
    return this.pfConfigRepository.find({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
      order: { effective_from: 'DESC' },
    });
  }
}
