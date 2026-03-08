import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserExperience } from '../entities/user-experience.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserExperienceRepository {
  constructor(
    @InjectRepository(UserExperience)
    private readonly repository: Repository<UserExperience>,
  ) {}

  async create(experience: Partial<UserExperience>): Promise<UserExperience> {
    const newExperience = this.repository.create(experience);
    return this.repository.save(newExperience);
  }

  async findById(id: string): Promise<UserExperience | null> {
    return this.repository.findOne({
      where: { id, status: Not(Status.DELETED) },
    });
  }

  async update(
    id: string,
    updateData: Partial<UserExperience>,
  ): Promise<UserExperience | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: Status.DELETED,
    });
    return (result.affected ?? 0) > 0;
  }
}
