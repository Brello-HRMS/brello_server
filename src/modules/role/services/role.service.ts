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
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { ListRolesDto } from '../dto/list-roles.dto';
import { ListingHelper } from '../../../common/utils/listing.helper';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Status } from '../../../common/enums';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(private readonly roleRepository: RoleRepository) {}

  async create(
    createRoleDto: CreateRoleDto,
    user: LoggedInUser,
  ): Promise<Role> {
    this.logger.log(`Creating role: ${createRoleDto.name}`);
 
    this.validateSystemRoleAccess(user, createRoleDto.is_system_defined);

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

  async findAll(
    user: LoggedInUser,
    query: ListRolesDto,
  ): Promise<PaginatedResponse<Role>> {
    this.logger.log('Fetching all active roles');

    const qb = this.roleRepository.getListingQueryBuilder('role');

    if (query.is_system_role !== undefined) {
      qb.andWhere('role.is_system_role = :isSystem', {
        isSystem: query.is_system_role,
      });
    }

    qb.andWhere('role.status != :deleted', { deleted: Status.DELETED });

        return ListingHelper.apply(
            qb,
            query,
            user,
            {
                searchFields: ['name', 'context'],
                filterFields: ['is_system_role'],
                alias: 'role',
            },
        );
  }

  async findByFilter(
    organizationId: string,
    enterpriseId: string,
    user: LoggedInUser,
  ): Promise<Role[]> {
    this.logger.log(
      `Fetching roles for org: ${organizationId}, enterprise: ${enterpriseId}`,
    );
    return this.roleRepository.findByFilter(organizationId, enterpriseId);
  }

  async findOne(id: string, user: LoggedInUser): Promise<Role> {
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
    user: LoggedInUser,
  ): Promise<Role> {
    this.logger.log(`Updating role: ${id}`);
 
    const existingRole = await this.findOne(id, user);
 
    if (existingRole.is_system_role) {
      this.validateSystemRoleAccess(user, true);
    }
 
    this.validateSystemRoleAccess(user, updateRoleDto.is_system_defined);

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

  async remove(id: string, user: LoggedInUser): Promise<void> {
    this.logger.log(`Soft deleting role: ${id}`);
 
    const role = await this.findOne(id, user);
 
    if (role.is_system_role) {
      this.validateSystemRoleAccess(user, true);
    }

    const deleted = await this.roleRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Failed to delete role with ID '${id}'`);
    }

    this.logger.log(`Role soft deleted successfully: ${id}`);
  }

  private validateSystemRoleAccess(
    user: LoggedInUser,
    isSystemRole?: boolean,
  ): void {
    if (isSystemRole && !user.isPlatformAdmin) {
      throw new ForbiddenException(
        'Only platform administrators can manage system-defined roles',
      );
    }
  }
}
