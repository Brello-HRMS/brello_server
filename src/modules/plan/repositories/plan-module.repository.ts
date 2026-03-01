import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanModule } from '../entities/plan-module.entity';

@Injectable()
export class PlanModuleRepository {
  constructor(
    @InjectRepository(PlanModule)
    private readonly repository: Repository<PlanModule>,
  ) {}

  create(data: Partial<PlanModule>): PlanModule {
    return this.repository.create(data);
  }

  async save(planModule: PlanModule): Promise<PlanModule> {
    return this.repository.save(planModule);
  }

  async findAll(): Promise<PlanModule[]> {
    return this.repository.find({
      order: { created_at: 'DESC' },
      where: { base_status: 'ACTIVE' as any },
    });
  }

  async findOneById(id: string): Promise<PlanModule> {
    const planModule = await this.repository.findOne({
      where: { id, base_status: 'ACTIVE' as any },
    });
    if (!planModule) {
      throw new NotFoundException(`PlanModule with ID "${id}" not found`);
    }
    return planModule;
  }

  async findByPlanId(planId: string): Promise<PlanModule[]> {
    return this.repository.find({
      where: { plan_id: planId, base_status: 'ACTIVE' as any },
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
