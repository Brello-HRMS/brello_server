import { Injectable, ConflictException } from '@nestjs/common';
import { PlanModuleAction } from '../entities/plan-module-action.entity';
import { PlanModuleActionRepository } from '../repositories/plan-module-action.repository';
import {
  CreatePlanModuleActionDto,
  UpdatePlanModuleActionDto,
} from '../dto/plan-module-action.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class PlanModuleActionService {
  constructor(
    private readonly planModuleActionRepository: PlanModuleActionRepository,
  ) {}

  async create(dto: CreatePlanModuleActionDto, user?: LoggedInUser): Promise<PlanModuleAction> {
    const planModuleAction = this.planModuleActionRepository.create(dto);
    try {
      return await this.planModuleActionRepository.save(planModuleAction);
    } catch (error) {
      throw new ConflictException(
        'This action is already mapped to the specified module on this plan.',
      );
    }
  }

  async findAll(user?: LoggedInUser): Promise<PlanModuleAction[]> {
    return this.planModuleActionRepository.findAll();
  }

  async findOne(id: string, user?: LoggedInUser): Promise<PlanModuleAction> {
    return this.planModuleActionRepository.findOneById(id);
  }

  async findByPlanAndModule(
    planId: string,
    moduleId: string,
    user?: LoggedInUser,
  ): Promise<PlanModuleAction[]> {
    return this.planModuleActionRepository.findByPlanAndModule(
      planId,
      moduleId,
    );
  }

  async update(
    id: string,
    dto: UpdatePlanModuleActionDto,
    user?: LoggedInUser,
  ): Promise<PlanModuleAction> {
    const planModuleAction = await this.findOne(id, user);
    Object.assign(planModuleAction, dto);
    return this.planModuleActionRepository.save(planModuleAction);
  }

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    await this.findOne(id, user);
    await this.planModuleActionRepository.delete(id);
  }
}
