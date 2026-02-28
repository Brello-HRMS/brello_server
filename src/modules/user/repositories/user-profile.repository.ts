import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { UserProfile } from '../entities/user-profile.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserProfileRepository {
  constructor(
    @InjectRepository(UserProfile)
    private readonly repository: Repository<UserProfile>,
  ) {}

  async create(profile: Partial<UserProfile>): Promise<UserProfile> {
    const newProfile = this.repository.create(profile);
    return this.repository.save(newProfile);
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.repository.findOne({
      where: { user: { id: userId }, base_status: Not(Status.DELETED) },
      relations: [
        'educations',
        'experiences',
        'assets',
        'documents',
        'emergency_contacts',
        'gov_info',
        'bank_info',
        'photo',
      ],
    });
  }

  async findByEmployeeId(
    employeeId: string,
    enterpriseId: string,
  ): Promise<UserProfile | null> {
    return this.repository.findOne({
      where: {
        employee_id: employeeId,
        enterprise_id: enterpriseId,
        base_status: Not(Status.DELETED),
      },
    });
  }

  async update(
    id: string,
    updateData: Partial<UserProfile>,
  ): Promise<UserProfile | null> {
    await this.repository.update(id, updateData);
    return this.repository.findOne({ where: { id } });
  }
}
