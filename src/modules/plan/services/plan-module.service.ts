import { Injectable, ConflictException } from '@nestjs/common';
import { PlanModule } from '../entities/plan-module.entity';
import { PlanModuleRepository } from '../repositories/plan-module.repository';
import {
  CreatePlanModuleDto,
  UpdatePlanModuleDto,
} from '../dto/plan-module.dto';

@Injectable()
export class PlanModuleService {
  constructor(private readonly planModuleRepository: PlanModuleRepository) {}

  async create(dto: CreatePlanModuleDto): Promise<PlanModule> {
    const planModule = this.planModuleRepository.create(dto);
    try {
      return await this.planModuleRepository.save(planModule);
    } catch (error) {
      throw new ConflictException(
        'This module is already mapped to the specified plan.',
      );
    }
  }

  async findAll(): Promise<PlanModule[]> {
    return this.planModuleRepository.findAll();
  }

  async findOne(id: string): Promise<PlanModule> {
    return this.planModuleRepository.findOneById(id);
  }

  async findByPlan(planId: string): Promise<PlanModule[]> {
    return this.planModuleRepository.findByPlanId(planId);
  }

  async update(id: string, dto: UpdatePlanModuleDto): Promise<PlanModule> {
    const planModule = await this.findOne(id);
    Object.assign(planModule, dto);
    return this.planModuleRepository.save(planModule);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.planModuleRepository.delete(id);
  }
}
