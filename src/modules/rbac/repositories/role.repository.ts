import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectRepository(Role)
    private readonly repository: Repository<Role>,
  ) {}

  create(data: Partial<Role>): Role {
    return this.repository.create(data);
  }

  async save(role: Role): Promise<Role> {
    return this.repository.save(role);
  }

  async findByAppId(appId: string): Promise<Role[]> {
    return this.repository.find({
      where: { app_id: appId, base_status: 'ACTIVE' as any },
      relations: ['app'],
      order: { name: 'ASC' },
    });
  }

  async findOneById(id: string): Promise<Role> {
    const role = await this.repository.findOne({
      where: { id, base_status: 'ACTIVE' as any },
      relations: ['app'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID "${id}" not found`);
    }

    return role;
  }

  async findAll(): Promise<Role[]> {
    return this.repository.find({
      where: { base_status: 'ACTIVE' as any },
      relations: ['app'],
      order: { created_at: 'DESC' },
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      base_status: 'DELETED' as any,
    });
    return (result.affected ?? 0) > 0;
  }
}
