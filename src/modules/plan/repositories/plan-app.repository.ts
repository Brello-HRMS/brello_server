import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PlanApp } from '../entities/plan-app.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class PlanAppRepository {
  constructor(
    @InjectRepository(PlanApp)
    private readonly repository: Repository<PlanApp>,
  ) {}

  async assignAppsToPlan(planId: string, appIds: string[]): Promise<void> {
    if (!appIds || appIds.length === 0) return;

    const existing = await this.repository.find({
      where: {
        plan_id: planId,
        app_id: In(appIds),
      },
    });

    const existingAppIds = new Set(existing.map((e) => e.app_id));
    const toCreate = appIds
      .filter((id) => !existingAppIds.has(id))
      .map((appId) =>
        this.repository.create({
          plan_id: planId,
          app_id: appId,
          is_active: true,
        }),
      );

    if (toCreate.length > 0) {
      await this.repository.save(toCreate);
    }
  }

  async getAppsForPlan(planId: string): Promise<PlanApp[]> {
    return this.repository.find({
      where: {
        plan_id: planId,
        is_active: true,
        base_status: Status.ACTIVE,
      },
    });
  }
}
