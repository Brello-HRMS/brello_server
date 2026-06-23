import { Injectable, ConflictException } from '@nestjs/common';
import { Plan } from '../entities/plan.entity';
import { PlanApp } from '../entities/plan-app.entity';
import { PlanRepository } from '../repositories/plan.repository';
import { PlanAppRepository } from '../repositories/plan-app.repository';
import { CreatePlanDto, UpdatePlanDto } from '../dto/plan.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { AuditContextService } from '../../audit/services/audit-context.service';

@Injectable()
export class PlanService {
  constructor(
    private readonly planRepository: PlanRepository,
    private readonly planAppRepository: PlanAppRepository,
    private readonly auditContext: AuditContextService,
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

  async findAll(
    user?: LoggedInUser,
    filters?: { enterprise_id?: string },
  ): Promise<Plan[]> {
    return this.planRepository.findAll(user?.isPlatformAdmin ?? false, filters);
  }

  async findOne(id: string, user?: LoggedInUser): Promise<Plan> {
    return this.planRepository.findOneById(id);
  }

  async update(
    id: string,
    dto: UpdatePlanDto,
    user?: LoggedInUser,
  ): Promise<Plan> {
    const plan = await this.findOne(id, user);
    this.auditContext.setPreValue(plan as unknown as Record<string, unknown>);
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
    const plan = await this.findOne(id, user);
    this.auditContext.setPreValue(plan as unknown as Record<string, unknown>);
    await this.planRepository.softDelete(id);
  }

  async getAppsForPlan(planId: string, _user?: LoggedInUser): Promise<PlanApp[]> {
    return this.planAppRepository.getAppsForPlan(planId);
  }

  async assignAppsToPlan(
    planId: string,
    appIds: string[],
    user?: LoggedInUser,
  ): Promise<void> {
    await this.findOne(planId, user);
    await this.planAppRepository.syncAppsForPlan(planId, appIds);
  }
}
