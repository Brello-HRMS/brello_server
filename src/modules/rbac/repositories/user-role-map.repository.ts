import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleMap } from '../entities/user-role-map.entity';

@Injectable()
export class UserRoleMapRepository {
  constructor(
    @InjectRepository(UserRoleMap)
    private readonly repository: Repository<UserRoleMap>,
  ) {}

  create(data: Partial<UserRoleMap>): UserRoleMap {
    return this.repository.create(data);
  }

  async save(map: UserRoleMap): Promise<UserRoleMap> {
    return this.repository.save(map);
  }

  async findAll(): Promise<UserRoleMap[]> {
    return this.repository.find({
      relations: ['role'],
      order: { created_at: 'DESC' },
    });
  }

  async findByUserId(userId: string): Promise<UserRoleMap[]> {
    return this.repository.find({
      where: { user_id: userId },
      relations: ['role'],
      order: { created_at: 'DESC' },
    });
  }

  async findOneById(id: string): Promise<UserRoleMap> {
    const map = await this.repository.findOne({
      where: { id },
      relations: ['role'],
    });

    if (!map) {
      throw new NotFoundException(`UserRoleMap with ID "${id}" not found`);
    }

    return map;
  }

  async delete(id: string): Promise<boolean> {
    // UserRoleMap does not inherit from BaseEntity, so it uses hard delete
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async checkExists(
    userId: string,
    roleId: string,
    orgId: string,
  ): Promise<boolean> {
    const count = await this.repository.count({
      where: { user_id: userId, role_id: roleId, organization_id: orgId },
    });
    return count > 0;
  }
}
