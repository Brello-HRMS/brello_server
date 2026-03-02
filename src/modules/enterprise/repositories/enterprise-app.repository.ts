import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EnterpriseApp } from '../entities/enterprise-app.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class EnterpriseAppRepository {
  constructor(
    @InjectRepository(EnterpriseApp)
    private readonly repository: Repository<EnterpriseApp>,
  ) {}

  async assignApps(enterpriseId: string, appIds: string[]): Promise<void> {
    if (!appIds || appIds.length === 0) return;

    const existing = await this.repository.find({
      where: {
        enterprise_id: enterpriseId,
        app_id: In(appIds),
      },
    });

    const existingAppIds = new Set(existing.map((e) => e.app_id));
    const toCreate = appIds
      .filter((id) => !existingAppIds.has(id))
      .map((appId) =>
        this.repository.create({
          enterprise_id: enterpriseId,
          app_id: appId,
          is_active: true,
        }),
      );

    if (toCreate.length > 0) {
      await this.repository.save(toCreate);
    }
  }

  async getAppsForEnterprise(enterpriseId: string): Promise<EnterpriseApp[]> {
    return this.repository.find({
      where: {
        enterprise_id: enterpriseId,
        is_active: true,
        base_status: Status.ACTIVE,
      },
    });
  }
}
