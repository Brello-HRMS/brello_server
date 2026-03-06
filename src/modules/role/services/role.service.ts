import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { RoleRepository } from '../repositories/role.repository';
import { Role } from '../entities/role.entity';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(private readonly roleRepository: RoleRepository) {}

  async create(
    createRoleDto: CreateRoleDto,
    currentUser: JwtPayload,
  ): Promise<Role> {
    this.logger.log(`Creating role: ${createRoleDto.name}`);

    this.validateSystemRoleAccess(currentUser, createRoleDto.is_system_defined);

    const existingRole = await this.roleRepository.findByName(
      createRoleDto.name,
    );
    if (existingRole) {
      throw new ConflictException(
        `Role with name '${createRoleDto.name}' already exists`,
      );
    }

    const role = await this.roleRepository.create(createRoleDto);
    this.logger.log(`Role created successfully: ${role.id}`);

    return role;
  }

  async findAll(): Promise<Role[]> {
    this.logger.log('Fetching all active roles');
    return this.roleRepository.findAll();
  }

  async findByFilter(
    organizationId: string,
    enterpriseId: string,
  ): Promise<Role[]> {
    this.logger.log(
      `Fetching roles for org: ${organizationId}, enterprise: ${enterpriseId}`,
    );
    return this.roleRepository.findByFilter(organizationId, enterpriseId);
  }

  async findOne(id: string): Promise<Role> {
    this.logger.log(`Fetching role: ${id}`);

    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new NotFoundException(`Role with ID '${id}' not found`);
    }

    return role;
  }

  async update(
    id: string,
    updateRoleDto: UpdateRoleDto,
    currentUser: JwtPayload,
  ): Promise<Role> {
    this.logger.log(`Updating role: ${id}`);

    const existingRole = await this.findOne(id);

    if (existingRole.is_system_role) {
      this.validateSystemRoleAccess(currentUser, true);
    }

    this.validateSystemRoleAccess(currentUser, updateRoleDto.is_system_defined);

    if (updateRoleDto.name) {
      const duplicateRole = await this.roleRepository.findByName(
        updateRoleDto.name,
      );
      if (duplicateRole && duplicateRole.id !== id) {
        throw new ConflictException(
          `Role with name '${updateRoleDto.name}' already exists`,
        );
      }
    }

    const updatedRole = await this.roleRepository.update(id, updateRoleDto);
    if (!updatedRole) {
      throw new NotFoundException(
        `Role with ID '${id}' not found after update`,
      );
    }

    this.logger.log(`Role updated successfully: ${id}`);
    return updatedRole;
  }

  async remove(id: string, currentUser: JwtPayload): Promise<void> {
    this.logger.log(`Soft deleting role: ${id}`);

    const role = await this.findOne(id);

    if (role.is_system_role) {
      this.validateSystemRoleAccess(currentUser, true);
    }

    const deleted = await this.roleRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Failed to delete role with ID '${id}'`);
    }

    this.logger.log(`Role soft deleted successfully: ${id}`);
  }

  private validateSystemRoleAccess(
    currentUser: JwtPayload,
    isSystemRole?: boolean,
  ): void {
    if (isSystemRole && !currentUser.isPlatformAdmin) {
      throw new ForbiddenException(
        'Only platform administrators can manage system-defined roles',
      );
    }
  }
}
