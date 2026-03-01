import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanModuleAction } from '../entities/plan-module-action.entity';

@Injectable()
export class PlanModuleActionRepository {
  constructor(
    @InjectRepository(PlanModuleAction)
    private readonly repository: Repository<PlanModuleAction>,
  ) {}

  create(data: Partial<PlanModuleAction>): PlanModuleAction {
    return this.repository.create(data);
  }

  async save(planModuleAction: PlanModuleAction): Promise<PlanModuleAction> {
    return this.repository.save(planModuleAction);
  }

  async findAll(): Promise<PlanModuleAction[]> {
    return this.repository.find({
      order: { created_at: 'DESC' },
      where: { base_status: 'ACTIVE' as any },
    });
  }

  async findOneById(id: string): Promise<PlanModuleAction> {
    const planModuleAction = await this.repository.findOne({
      where: { id, base_status: 'ACTIVE' as any },
    });
    if (!planModuleAction) {
      throw new NotFoundException(`PlanModuleAction with ID "${id}" not found`);
    }
    return planModuleAction;
  }

  async findByPlanAndModule(
    planId: string,
    moduleId: string,
  ): Promise<PlanModuleAction[]> {
    return this.repository.find({
      where: {
        plan_id: planId,
        module_id: moduleId,
        base_status: 'ACTIVE' as any,
      },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      base_status: 'DELETED' as any,
    });
    return (result.affected ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
