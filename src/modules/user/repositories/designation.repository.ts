import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../entities/user.entity';
import { ListEmployeesDto } from '../dto/list-employees.dto';
import { Status } from '../../../common/enums';

// Handles all designation-related user database queries
@Injectable()
export class UserDesignationRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  // Returns a QueryBuilder for fully mapped users filtered by designation context
  getEmployeeListingQueryBuilder(query: ListEmployeesDto): SelectQueryBuilder<User> {
    const qb = this.repository.createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndSelect('profile.photo', 'photo')
      .andWhere('user.department_id IS NOT NULL')
      .andWhere('user.designation_id IS NOT NULL');

    if (query.designationId) {
      qb.andWhere('user.designation_id = :desigId', { desigId: query.designationId });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    } else {
      qb.andWhere('user.status != :deleted', { deleted: Status.DELETED });
    }

    return qb;
  }

  // Returns a QueryBuilder for users who have no designation assigned
  getGeneralListingQueryBuilder(query: ListEmployeesDto): SelectQueryBuilder<User> {
    const qb = this.repository.createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndSelect('profile.photo', 'photo')
      .andWhere('user.designation_id IS NULL');

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    } else {
      qb.andWhere('user.status != :deleted', { deleted: Status.DELETED });
    }

    return qb;
  }

  // Map a designation to a user (only updates if currently unset)
  async mapDesignation(userId: string, designationId: string): Promise<void> {
    await this.repository.update(userId, { designation_id: designationId });
  }

  // Unmap (clear) the designation from a user
  async unmapDesignation(userId: string): Promise<void> {
    await this.repository.update(userId, { designation_id: null as any });
  }
}
