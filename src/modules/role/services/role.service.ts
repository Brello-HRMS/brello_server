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
import { SearchIndexingService } from '../../global-search/services/search-indexing.service';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly searchIndexingService: SearchIndexingService,
  ) {}

  async create(
    createRoleDto: CreateRoleDto,
    user: LoggedInUser,
  ): Promise<Role> {
    this.logger.log(`Creating role: ${createRoleDto.name}`);

    // Automatically attach user's context IDs
    createRoleDto.enterprise_id = user.enterpriseId;
    createRoleDto.organization_id = user.organizationId;

    this.validateSystemRoleAccess(
      user,
      createRoleDto.is_system_defined,
      user.organizationId,
    );

    const existingRole = await this.roleRepository.findByName(
      createRoleDto.name,
    );
    if (existingRole) {
      throw new ConflictException(
        `Role with name '${createRoleDto.name}' already exists`,
      );
    }

    const { is_system_defined, ...roleData } = createRoleDto;
    const role = await this.roleRepository.create({
      ...roleData,
      is_system_role: is_system_defined || false,
    });
    this.logger.log(`Role created successfully: ${role.id}`);
    this.searchIndexingService.indexRole(role, user.enterpriseId, user.organizationId);

    return role;
  }

  async findAll(
    user: LoggedInUser,
    query: ListRolesDto,
  ): Promise<PaginatedResponse<Role>> {
    this.logger.log('Fetching all active roles');

    const qb = this.roleRepository.getListingQueryBuilder('role');

    // Filter by user context
    qb.andWhere('role.enterprise_id = :enterpriseId', {
      enterpriseId: user.enterpriseId,
    });
    qb.andWhere('role.organization_id = :organizationId', {
      organizationId: user.organizationId,
    });

    if (query.app_id) {
      qb.andWhere('role.app_id = :appId', { appId: query.app_id });
    }

    if (query.is_system_role !== undefined) {
      qb.andWhere('role.is_system_role = :isSystem', {
        isSystem: query.is_system_role,
      });
    }

    qb.andWhere('role.status != :deleted', { deleted: Status.DELETED });

    // Handle sort parameter from frontend (e.g., createdAt_DESC)
    if (query.sort) {
      const [sortBy, sortOrder] = query.sort.split('_');

      // Map frontend camelCase to backend snake_case
      const fieldMapping: Record<string, string> = {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      };

      query.sort_by = fieldMapping[sortBy] || sortBy;
      query.sort_order = sortOrder as 'ASC' | 'DESC';
    }

    return ListingHelper.apply(qb, query, user, {
      searchFields: ['name', 'context'],
      filterFields: ['is_system_role', 'app_id'],
      alias: 'role',
    });
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

    // Security check: ensure user only accesses roles within their context
    if (
      role.enterprise_id !== user.enterpriseId ||
      role.organization_id !== user.organizationId
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this role',
      );
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
      this.validateSystemRoleAccess(user, true, existingRole.organization_id);
    }

    this.validateSystemRoleAccess(
      user,
      updateRoleDto.is_system_defined,
      existingRole.organization_id,
    );

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

    const { is_system_defined, ...roleData } = updateRoleDto;
    const updatedRole = await this.roleRepository.update(id, {
      ...roleData,
      ...(is_system_defined !== undefined
        ? { is_system_role: is_system_defined }
        : {}),
    });
    if (!updatedRole) {
      throw new NotFoundException(
        `Role with ID '${id}' not found after update`,
      );
    }

    this.logger.log(`Role updated successfully: ${id}`);
    this.searchIndexingService.indexRole(updatedRole, user.enterpriseId, user.organizationId);
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

    this.searchIndexingService.removeRole(id, user.enterpriseId);
    this.logger.log(`Role soft deleted successfully: ${id}`);
  }

  private validateSystemRoleAccess(
    user: LoggedInUser,
    isSystemRole?: boolean,
    roleOrganizationId?: string,
  ): void {
    // Only block if it's a system role and user is not a platform admin
    if (isSystemRole && !user.isPlatformAdmin) {
      // However, if the role belongs to the user's own organization, allow it
      // This handles cases where roles were mistakenly created as system roles
      if (roleOrganizationId && roleOrganizationId === user.organizationId) {
        return;
      }

      throw new ForbiddenException(
        'Only platform administrators can manage global system-defined roles',
      );
    }
  }
}
