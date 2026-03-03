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

  async bulkCreate(
    enterpriseId: string,
    appIds: string[],
  ): Promise<EnterpriseApp[]> {
    const mappings = appIds.map((appId) =>
      this.repository.create({
        enterprise_id: enterpriseId,
        app_id: appId,
      }),
    );
    return this.repository.save(mappings);
  }

  async getAppsForEnterprise(enterpriseId: string): Promise<EnterpriseApp[]> {
    return this.repository.find({
      where: {
        enterprise_id: enterpriseId,
        base_status: Status.ACTIVE,
      },
    });
  }

  async getAppsForEnterpriseIds(
    enterpriseIds: string[],
  ): Promise<EnterpriseApp[]> {
    if (!enterpriseIds.length) return [];

    return this.repository.find({
      where: {
        enterprise_id: In(enterpriseIds),
        base_status: Status.ACTIVE,
      },
    });
  }

  async softDeleteByEnterpriseId(enterpriseId: string): Promise<boolean> {
    const result = await this.repository.update(
      { enterprise_id: enterpriseId, base_status: Status.ACTIVE },
      { base_status: Status.DELETED, deleted_at: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }
}
