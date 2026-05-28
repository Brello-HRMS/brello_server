import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class PlanRepository {
  constructor(
    @InjectRepository(Plan)
    private readonly repository: Repository<Plan>,
  ) {}

  create(data: Partial<Plan>): Plan {
    return this.repository.create(data);
  }

  async save(plan: Plan): Promise<Plan> {
    return this.repository.save(plan);
  }

  async findAll(isPlatformAdmin = false): Promise<Plan[]> {
    return this.repository.find({
      order: { price: 'ASC' },
      where: isPlatformAdmin
        ? { status: Not(Status.DELETED) }
        : { status: Status.ACTIVE },
    });
  }

  async findOneById(id: string): Promise<Plan> {
    const plan = await this.repository.findOne({
      where: { id, status: 'ACTIVE' as any },
    });
    if (!plan) {
      throw new NotFoundException(`Plan with ID "${id}" not found`);
    }
    return plan;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: 'DELETED' as any,
    });
    return (result.affected ?? 0) > 0;
  }
}
