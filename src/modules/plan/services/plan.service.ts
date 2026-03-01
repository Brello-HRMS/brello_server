import { Injectable, ConflictException } from '@nestjs/common';
import { Plan } from '../entities/plan.entity';
import { PlanRepository } from '../repositories/plan.repository';
import { CreatePlanDto, UpdatePlanDto } from '../dto/plan.dto';

@Injectable()
export class PlanService {
  constructor(private readonly planRepository: PlanRepository) {}

  async create(dto: CreatePlanDto): Promise<Plan> {
    const plan = this.planRepository.create(dto);
    try {
      return await this.planRepository.save(plan);
    } catch (error) {
      throw new ConflictException(
        `Plan with name "${dto.name}" already exists.`,
      );
    }
  }

  async findAll(): Promise<Plan[]> {
    return this.planRepository.findAll();
  }

  async findOne(id: string): Promise<Plan> {
    return this.planRepository.findOneById(id);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findOne(id);
    Object.assign(plan, dto);

    try {
      return await this.planRepository.save(plan);
    } catch (error) {
      throw new ConflictException(
        `Plan with name "${dto.name}" already exists.`,
      );
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.planRepository.softDelete(id);
  }
}
