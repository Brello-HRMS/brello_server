import { Injectable, ConflictException, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ModuleAccess } from '../entities/module-access.entity';
import { ModuleAccessRepository } from '../repositories/module-access.repository';
import {
  CreateModuleAccessDto,
  UpdateModuleAccessDto,
  AssignModuleAccessByCodeDto,
} from '../dto/module-access.dto';
import { LoggedInUser } from '../../auth/interfaces/logged-in-user.interface';
import { AppModuleRepository } from '../repositories/app-module.repository';
import { ActionRepository } from '../repositories/action.repository';
import { UserRoleMapRepository } from '../../rbac/repositories/user-role-map.repository';
import { Status } from '../../../common/enums';

@Injectable()
export class ModuleAccessService implements OnModuleInit {
  private readonly logger = new Logger(ModuleAccessService.name);
 
  constructor(
    private readonly moduleAccessRepository: ModuleAccessRepository,
    private readonly appModuleRepository: AppModuleRepository,
    private readonly actionRepository: ActionRepository,
    private readonly userRoleMapRepository: UserRoleMapRepository,
  ) {}

  async onModuleInit() {
    await this.actionRepository.syncActionsCodeAndName();
  }

  async create(dto: CreateModuleAccessDto, user?: LoggedInUser): Promise<ModuleAccess> {
    this.logger.log(`Creating module access configuration`);
    const moduleAccess = this.moduleAccessRepository.create(dto);
    try {
      return await this.moduleAccessRepository.save(moduleAccess);
    } catch (error) {
      throw new ConflictException(
        'This role already has a configuration for this action on this module.',
      );
    }
  }

  async findAll(user?: LoggedInUser): Promise<ModuleAccess[]> {
    return this.moduleAccessRepository.findAll();
  }

  async assignByCode(dto: AssignModuleAccessByCodeDto, user: LoggedInUser): Promise<ModuleAccess> {
    const appModule = await this.appModuleRepository.findByCodeAndApp(dto.module_code, user.appId);
    if (!appModule) {
      throw new NotFoundException(`Module with code ${dto.module_code} not found or active in this app.`);
    }

    const action = await this.actionRepository.findByCode(dto.action_code);
    if (!action) {
      throw new NotFoundException(`Action with code ${dto.action_code} not found or active.`);
    }

    const userRoles = await this.userRoleMapRepository.findByUserId(user.userId);
    const activeRoleMap = userRoles.find(
      (urm) => urm.role && urm.role.app_id === user.appId && urm.organization_id === user.organizationId,
    );

    if (!activeRoleMap) {
      throw new NotFoundException(`No active role found for user in the current app and organization.`);
    }

    this.logger.log(`Resolved Role: ${activeRoleMap.role.name} (ID: ${activeRoleMap.role_id})`);

    // UPSERT: Check if configuration already exists
    let moduleAccess = await this.moduleAccessRepository.findOne({
      where: {
        role_id: activeRoleMap.role_id,
        module_id: appModule.id,
        action_id: action.id,
      },
    });

    if (moduleAccess) {
      this.logger.log(`Updating existing module access for Action: ${action.name}`);
      moduleAccess.access_flag = dto.access_flag ?? true;
    } else {
      this.logger.log(`Creating new module access for Action: ${action.name}`);
      moduleAccess = this.moduleAccessRepository.create({
        role_id: activeRoleMap.role_id,
        module_id: appModule.id,
        action_id: action.id,
        access_flag: dto.access_flag ?? true,
      });
    }

    try {
      return await this.moduleAccessRepository.save(moduleAccess);
    } catch (error) {
      this.logger.error(`Failed to save module access: ${error.message}`);
      throw new ConflictException(
        'This role already has a configuration for this action on this module.',
      );
    }
  }

  async findOne(id: string, user?: LoggedInUser): Promise<ModuleAccess> {
    const access = await this.moduleAccessRepository.findOneById(id);
    if (!access) {
      throw new NotFoundException(`ModuleAccess with ID "${id}" not found`);
    }
    return access;
  }

  async findByRole(roleId: string, user?: LoggedInUser): Promise<ModuleAccess[]> {
    return this.moduleAccessRepository.findByRole(roleId);
  }

  async update(id: string, dto: UpdateModuleAccessDto, user?: LoggedInUser): Promise<ModuleAccess> {
    const moduleAccess = await this.findOne(id, user);
    Object.assign(moduleAccess, dto);
    return this.moduleAccessRepository.save(moduleAccess);
  }

  async remove(id: string, user?: LoggedInUser): Promise<void> {
    await this.findOne(id, user);
    await this.moduleAccessRepository.delete(id);
  }
}
