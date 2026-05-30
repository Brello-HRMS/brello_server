import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanApp } from '../entities/plan-app.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class PlanAppRepository {
  constructor(
    @InjectRepository(PlanApp)
    private readonly repository: Repository<PlanApp>,
  ) {}

  async syncAppsForPlan(planId: string, appIds: string[]): Promise<void> {
    const all = await this.repository.find({ where: { plan_id: planId } });
    const newSet = new Set(appIds);
    const existingMap = new Map(all.map((e) => [e.app_id, e]));

    for (const existing of all) {
      if (!newSet.has(existing.app_id) && existing.is_active) {
        await this.repository.update(existing.id, { is_active: false });
      }
    }

    for (const appId of appIds) {
      const existing = existingMap.get(appId);
      if (existing) {
        if (!existing.is_active) {
          await this.repository.update(existing.id, { is_active: true });
        }
      } else {
        await this.repository.save(
          this.repository.create({ plan_id: planId, app_id: appId, is_active: true }),
        );
      }
    }
  }

  async getAppsForPlan(planId: string): Promise<PlanApp[]> {
    return this.repository.find({
      where: { plan_id: planId, is_active: true, status: Status.ACTIVE },
    });
  }
}
