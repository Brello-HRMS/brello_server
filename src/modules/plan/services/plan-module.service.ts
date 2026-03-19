import { Injectable, ConflictException } from '@nestjs/common';
import { PlanModule } from '../entities/plan-module.entity';
import { PlanModuleRepository } from '../repositories/plan-module.repository';
import {
  CreatePlanModuleDto,
  UpdatePlanModuleDto,
} from '../dto/plan-module.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class PlanModuleService {
  constructor(private readonly planModuleRepository: PlanModuleRepository) {}

  async create(dto: CreatePlanModuleDto, user?: LoggedInUser): Promise<PlanModule> {
    const planModule = this.planModuleRepository.create(dto);
    try {
      return await this.planModuleRepository.save(planModule);
    } catch (error) {
      throw new ConflictException(
        'This module is already mapped to the specified plan.',
      );
    }
  }

  async findAll(user?: LoggedInUser): Promise<PlanModule[]> {
    return this.planModuleRepository.findAll();
  }

  async findOne(id: string, user?: LoggedInUser): Promise<PlanModule> {
    return this.planModuleRepository.findOneById(id);
  }

  async findByPlan(planId: string, user?: LoggedInUser): Promise<PlanModule[]> {
    return this.planModuleRepository.findByPlanId(planId);
  }

  async update(id: string, dto: UpdatePlanModuleDto, user?: LoggedInUser): Promise<PlanModule> {
    const planModule = await this.findOne(id, user);
    Object.assign(planModule, dto);
    return this.planModuleRepository.save(planModule);
  }

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    await this.findOne(id, user);
    await this.planModuleRepository.delete(id);
  }
}
