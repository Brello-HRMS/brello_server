import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../entities/user.entity';
import { ListEmployeesDto } from '../dto/list-employees.dto';
import { Status } from '../../../common/enums';

// Handles all department-related user database queries
@Injectable()
export class UserDepartmentRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) { }

  // Returns a QueryBuilder for fully mapped users filtered by department context
  getEmployeeListingQueryBuilder(query: ListEmployeesDto): SelectQueryBuilder<User> {
    const qb = this.repository.createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndSelect('profile.photo', 'photo')
      .andWhere('user.department_id IS NOT NULL')
      .andWhere('user.designation_id IS NOT NULL');

    if (query.departmentId) {
      qb.andWhere('user.department_id = :deptId', { deptId: query.departmentId });
    }

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    } else {
      qb.andWhere('user.status != :deleted', { deleted: Status.DELETED });
    }

    return qb;
  }

  // Returns a QueryBuilder for users who have no department assigned
  getGeneralListingQueryBuilder(query: ListEmployeesDto): SelectQueryBuilder<User> {
    const qb = this.repository.createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndSelect('profile.photo', 'photo')
      .andWhere('user.department_id IS NULL');

    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    } else {
      qb.andWhere('user.status != :deleted', { deleted: Status.DELETED });
    }

    return qb;
  }

  // Map a department to a user (only updates if currently unset)
  async mapDepartment(userId: string, departmentId: string): Promise<void> {
    await this.repository.update(userId, { department_id: departmentId });
  }

  // Unmap (clear) the department from a user
  async unmapDepartment(userId: string): Promise<void> {
    await this.repository.update(userId, { department_id: null as any });
  }

  // Fetch up to 3 avatar URLs per department for summary display
  // async findAvatarsByDepartmentIds(departmentIds: string[]): Promise<Record<string, string[]>> {
  //   if (departmentIds.length === 0) return {};

  //   const users = await this.repository.createQueryBuilder('user')
  //     .leftJoinAndSelect('user.user_profile', 'profile')
  //     .leftJoinAndSelect('profile.photo', 'photo')
  //     .where('user.department_id IN (:...departmentIds)', { departmentIds })
  //     .andWhere('user.status != :deleted', { deleted: Status.DELETED })
  //     .orderBy('user.created_at', 'DESC')
  //     .getMany();

  //   const result: Record<string, string[]> = {};
  //   departmentIds.forEach(id => (result[id] = []));

  //   users.forEach(user => {
  //     const photo = user.user_profile?.photo;
  //     if (result[user.department_id]?.length < 3 && photo) {
  //       const region = 'us-east-1';
  //       const url = `https://${photo.bucket}.s3.${region}.amazonaws.com/${photo.object_key}`;
  //       result[user.department_id].push(url);
  //     }
  //   });

  //   return result;
  // }
}
