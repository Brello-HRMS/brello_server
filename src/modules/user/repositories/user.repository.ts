import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { User } from '../entities/user.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async create(user: Partial<User>): Promise<User> {
    const newUser = this.repository.create(user);
    return this.repository.save(newUser);
  }

  async findAll(): Promise<User[]> {
    return this.repository.find({
      where: { base_status: Not(Status.DELETED) },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id, base_status: Not(Status.DELETED) },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email, base_status: Not(Status.DELETED) },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.repository.findOne({
      where: { phone, base_status: Not(Status.DELETED) },
    });
  }

  async findByEnterpriseId(enterpriseId: string): Promise<User[]> {
    return this.repository.find({
      where: { enterprise_id: enterpriseId, base_status: Not(Status.DELETED) },
      order: { created_at: 'DESC' },
    });
  }

  async findByOrganizationId(organizationId: string): Promise<User[]> {
    return this.repository.find({
      where: {
        organization_id: organizationId,
        base_status: Not(Status.DELETED),
      },
      order: { created_at: 'DESC' },
    });
  }

  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<User | null> {
    await this.repository.update(id, { base_status: Status.DELETED });
    return this.findById(id);
  }
  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { id, base_status: Not(Status.DELETED) },
    });
    return count > 0;
  }

  async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const where: any = { email, base_status: Not(Status.DELETED) };
    if (excludeUserId) {
      where.id = Not(excludeUserId);
    }
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async phoneExists(phone: string, excludeUserId?: string): Promise<boolean> {
    const where: any = { phone, base_status: Not(Status.DELETED) };
    if (excludeUserId) {
      where.id = Not(excludeUserId);
    }
    const count = await this.repository.count({ where });
    return count > 0;
  }
}
