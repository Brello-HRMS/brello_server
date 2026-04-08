import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PfConfig } from '../entities/pf-config.entity';
import { UpsertPfConfigDto } from '../dto/pf-config.dto';

@Injectable()
export class PfConfigService {
  constructor(
    @InjectRepository(PfConfig)
    private readonly pfConfigRepository: Repository<PfConfig>,
  ) {}

  async upsertConfig(
    enterpriseId: string,
    organizationId: string,
    dto: UpsertPfConfigDto,
  ): Promise<PfConfig> {
    let config = await this.pfConfigRepository.findOne({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
    });

    if (config) {
      config = this.pfConfigRepository.merge(config, dto as any);
    } else {
      config = this.pfConfigRepository.create({
        ...dto,
        enterprise_id: enterpriseId,
        organization_id: organizationId,
      });
    }

    return this.pfConfigRepository.save(config);
  }

  async getConfig(
    enterpriseId: string,
    organizationId: string,
  ): Promise<PfConfig | null> {
    const config = await this.pfConfigRepository.findOne({
      where: { enterprise_id: enterpriseId, organization_id: organizationId },
    });

    return config || null;
  }
}
