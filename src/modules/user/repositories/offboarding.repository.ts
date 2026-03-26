import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeOffboarding } from '../entities/offboarding.entity';

@Injectable()
export class EmployeeOffboardingRepository {
  constructor(
    @InjectRepository(EmployeeOffboarding)
    private readonly repository: Repository<EmployeeOffboarding>,
  ) {}

  async save(data: Partial<EmployeeOffboarding>): Promise<EmployeeOffboarding> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: string, data: Partial<EmployeeOffboarding>): Promise<void> {
    await this.repository.update(id, data);
  }

  async find(options: any): Promise<EmployeeOffboarding[]> {
    return this.repository.find(options);
  }

  async findByUserId(userId: string): Promise<EmployeeOffboarding | null> {
    return this.repository.findOne({
      where: { user_id: userId, is_cancelled: false },
    });
  }
}
