import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, SelectQueryBuilder } from 'typeorm';
import { User } from '../entities/user.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  getListingQueryBuilder(alias: string = 'user'): SelectQueryBuilder<User> {
    return this.repository.createQueryBuilder(alias)
      .leftJoinAndSelect(`${alias}.user_profile`, 'profile')
      .leftJoinAndSelect('profile.photo', 'photo');
  }

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.repository.create(user);
    return this.repository.save(newUser);
  }

  async findAll(): Promise<User[]> {
    return this.repository.find({
      where: { status: Not(Status.DELETED) },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id, status: Not(Status.DELETED) },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email, status: Not(Status.DELETED) },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repository.findOne({
      where: { phone, status: Not(Status.DELETED) },
    });
  }

  async findByEnterpriseId(enterpriseId: string): Promise<User[]> {
    return this.repository.find({
      where: { enterprise_id: enterpriseId, status: Not(Status.DELETED) },
      order: { created_at: 'DESC' },
    });
  }

  async findByOrganizationId(organizationId: string): Promise<User[]> {
    return this.repository.find({
      where: {
        organization_id: organizationId,
        status: Not(Status.DELETED),
      },
      order: { created_at: 'DESC' },
    });
  }

  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<User | null> {
    await this.repository.update(id, { status: Status.DELETED });
    return this.findById(id);
  }
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { id, status: Not(Status.DELETED) },
    });
    return count > 0;
  }

  async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const where: any = { email, status: Not(Status.DELETED) };
    if (excludeUserId) {
      where.id = Not(excludeUserId);
    }
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async phoneExists(phone: string, excludeUserId?: string): Promise<boolean> {
    const where: any = { phone, status: Not(Status.DELETED) };
    if (excludeUserId) {
      where.id = Not(excludeUserId);
    }
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async findAvatarsByDepartmentIds(departmentIds: string[]): Promise<Record<string, string[]>> {
    if (departmentIds.length === 0) return {};

    const users = await this.repository.createQueryBuilder('user')
      .leftJoinAndSelect('user.user_profile', 'profile')
      .leftJoinAndSelect('profile.photo', 'photo')
      .where('user.department_id IN (:...departmentIds)', { departmentIds })
      .andWhere('user.status != :deleted', { deleted: Status.DELETED })
      .orderBy('user.created_at', 'DESC')
      .getMany();

    const result: Record<string, string[]> = {};
    departmentIds.forEach(id => (result[id] = []));

    users.forEach(user => {
      // Basic URL logic - in a real app this would come from DocumentService
      const photo = user.user_profile?.photo;
      if (result[user.department_id].length < 3 && photo) {
        const region = 'us-east-1'; // fallback
        const url = `https://${photo.bucket}.s3.${region}.amazonaws.com/${photo.object_key}`;
        result[user.department_id].push(url);
      }
    });

    return result;
  }
}
