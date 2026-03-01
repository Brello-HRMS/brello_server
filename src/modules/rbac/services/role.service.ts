import { Injectable } from '@nestjs/common';
import { Role } from '../entities/role.entity';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleRepository } from '../repositories/role.repository';

@Injectable()
export class RoleService {
  constructor(private readonly roleRepository: RoleRepository) {}

  async create(dto: CreateRoleDto): Promise<Role> {
    const role = this.roleRepository.create(dto);
    return this.roleRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepository.findAll();
  }

  async findOne(id: string): Promise<Role> {
    return this.roleRepository.findOneById(id);
  }

  async findByAppId(appId: string): Promise<Role[]> {
    return this.roleRepository.findByAppId(appId);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    Object.assign(role, dto);
    return this.roleRepository.save(role);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Ensure it exists
    await this.roleRepository.softDelete(id);
  }
}
