import { Injectable, ConflictException } from '@nestjs/common';
import { Plan } from '../entities/plan.entity';
import { PlanRepository } from '../repositories/plan.repository';
import { PlanAppRepository } from '../repositories/plan-app.repository';
import { CreatePlanDto, UpdatePlanDto } from '../dto/plan.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';

@Injectable()
export class PlanService {
  constructor(
    private readonly planRepository: PlanRepository,
    private readonly planAppRepository: PlanAppRepository,
  ) {}

  async create(dto: CreatePlanDto, user?: LoggedInUser): Promise<Plan> {
    const plan = this.planRepository.create(dto);
    try {
      return await this.planRepository.save(plan);
    } catch (error) {
      throw new ConflictException(
        `Plan with name "${dto.name}" already exists.`,
      );
    }
  }

  async findAll(user?: LoggedInUser): Promise<Plan[]> {
    return this.planRepository.findAll(user?.isPlatformAdmin ?? false);
  }

  async findOne(id: string, user?: LoggedInUser): Promise<Plan> {
    return this.planRepository.findOneById(id);
  }

  async update(id: string, dto: UpdatePlanDto, user?: LoggedInUser): Promise<Plan> {
    const plan = await this.findOne(id, user);
    Object.assign(plan, dto);

    try {
      return await this.planRepository.save(plan);
    } catch (error) {
      throw new ConflictException(
        `Plan with name "${dto.name}" already exists.`,
      );
    }
  }

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    await this.findOne(id, user);
    await this.planRepository.softDelete(id);
  }

  async assignAppsToPlan(planId: string, appIds: string[], user?: LoggedInUser): Promise<void> {
    await this.findOne(planId, user);
    await this.planAppRepository.assignAppsToPlan(planId, appIds);
  }
}
