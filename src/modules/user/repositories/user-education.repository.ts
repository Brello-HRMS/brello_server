import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserEducation } from '../entities/user-education.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserEducationRepository {
  constructor(
    @InjectRepository(UserEducation)
    private readonly repository: Repository<UserEducation>,
  ) {}

  async create(education: Partial<UserEducation>): Promise<UserEducation> {
    const newEducation = this.repository.create(education);
    return this.repository.save(newEducation);
  }

  async findById(id: string): Promise<UserEducation | null> {
    return this.repository.findOne({
      where: { id, base_status: Not(Status.DELETED) },
    });
  }

  async update(
    id: string,
    updateData: Partial<UserEducation>,
  ): Promise<UserEducation | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      base_status: Status.DELETED,
    });
    return (result.affected ?? 0) > 0;
  }
}
