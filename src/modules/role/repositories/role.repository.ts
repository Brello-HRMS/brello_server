import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, SelectQueryBuilder } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Status } from '../../../common/enums';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectRepository(Role)
    private readonly repository: Repository<Role>,
  ) {}

  getListingQueryBuilder(alias: string = 'role'): SelectQueryBuilder<Role> {
    return this.repository.createQueryBuilder(alias);
  }

  async create(roleData: Partial<Role>): Promise<Role> {
    const newRole = this.repository.create(roleData);
    return this.repository.save(newRole);
  }

  async findAll(): Promise<Role[]> {
    return this.repository.find({
      where: { status: Not(Status.DELETED) },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Role | null> {
    return this.repository.findOne({
      where: { id, status: Not(Status.DELETED) },
    });
  }

  async findByName(name: string): Promise<Role | null> {
    return this.repository.findOne({
      where: { name, status: Not(Status.DELETED) },
    });
  }

  async findByFilter(
    organizationId: string,
    enterpriseId: string,
  ): Promise<Role[]> {
    return this.repository.find({
      where: [
        {
          organization_id: organizationId,
          enterprise_id: enterpriseId,
          status: Not(Status.DELETED),
          is_system_role: true,
        },
      ],
      order: { is_system_role: 'DESC', name: 'ASC' },
    });
  }

  async findPlatformSystemRoles(): Promise<Role[]> {
    return this.repository.find({
      where: {
        is_system_role: true,
        organization_id: IsNull(),
        status: Not(Status.DELETED),
      },
      relations: ['app'],
      order: { name: 'ASC' },
    });
  }

  async findPlatformRoleById(id: string): Promise<Role | null> {
    return this.repository.findOne({
      where: {
        id,
        is_system_role: true,
        organization_id: IsNull(),
        status: Not(Status.DELETED),
      },
      relations: ['app'],
    });
  }

  async update(id: string, updateData: Partial<Role>): Promise<Role | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, {
      status: Status.DELETED,
    });
    return (result.affected ?? 0) > 0;
  }

  async findOrgRolesByAppId(appId: string): Promise<Role[]> {
    return this.repository.find({
      where: {
        app_id: appId,
        is_system_role: false,
        organization_id: Not(IsNull()),
        status: Not(Status.DELETED),
      },
    });
  }
}
