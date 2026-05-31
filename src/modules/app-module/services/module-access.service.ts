import {
  Logger,
  NotFoundException,
  ConflictException,
  Injectable,
  OnModuleInit
} from '@nestjs/common';
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
import { OrganizationSubscriptionRepository } from '../../plan/repositories/organization-subscription.repository';
import { PlanModuleRepository } from '../../plan/repositories/plan-module.repository';
import { PlanModuleActionRepository } from '../../plan/repositories/plan-module-action.repository';
import { RoleService } from '../../role/services/role.service';
import { RoleRepository } from '../../role/repositories/role.repository';
import { UpdateRolePermissionsListDto } from '../dto/module-access.dto';

@Injectable()
export class ModuleAccessService implements OnModuleInit {
  private readonly logger = new Logger(ModuleAccessService.name);
 
  constructor(
    private readonly moduleAccessRepository: ModuleAccessRepository,
    private readonly appModuleRepository: AppModuleRepository,
    private readonly actionRepository: ActionRepository,
    private readonly userRoleMapRepository: UserRoleMapRepository,
    private readonly organizationSubscriptionRepository: OrganizationSubscriptionRepository,
    private readonly planModuleRepository: PlanModuleRepository,
    private readonly planModuleActionRepository: PlanModuleActionRepository,
    private readonly roleService: RoleService,
    private readonly roleRepository: RoleRepository,
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

    this.logger.log(`Resolving role for User: ${user.userId} in App: ${user.appId}, Org: ${user.organizationId}`);
    const userRoles = await this.userRoleMapRepository.findByUserId(user.userId);
    
    // Filter roles matching the current app and organization
    const activeRoles = userRoles.filter(
      (urm) => urm.role && urm.role.app_id === user.appId && urm.organization_id === user.organizationId,
    );

    if (activeRoles.length === 0) {
      this.logger.warn(`User ${user.userId} has no roles mapped to App ${user.appId} and Org ${user.organizationId}. Available roles: ${userRoles.map(r => `${r.role?.name} (App: ${r.role?.app_id}, Org: ${r.organization_id})`).join(', ')}`);
      throw new NotFoundException(`No active role found for user in app ${user.appId} and organization ${user.organizationId}.`);
    }

    // Heuristic: If multiple roles exist, prefer one that looks like an Admin/System role, otherwise take the first
    const selectedRoleMap = activeRoles.find(urm => 
      urm.role.name.toLowerCase().includes('admin') || 
      urm.role.name.toLowerCase().includes('owner') ||
      urm.role.is_system_role
    ) || activeRoles[0];

    this.logger.log(`Selected Role: ${selectedRoleMap.role.name} (ID: ${selectedRoleMap.role_id})`);

    // Check if configuration already exists
    let moduleAccess = await this.moduleAccessRepository.findOne({
      where: {
        role_id: selectedRoleMap.role_id,
        module_id: appModule.id,
        action_id: action.id,
      },
    });

    if (moduleAccess) {
      this.logger.log(`Updating existing module access configuration for Action: ${action.name}`);
      moduleAccess.access_flag = dto.access_flag ?? true;
    } else {
      this.logger.log(`Creating new module access configuration for Action: ${action.name}`);
      moduleAccess = this.moduleAccessRepository.create({
        role_id: selectedRoleMap.role_id,
        module_id: appModule.id,
        action_id: action.id,
        access_flag: dto.access_flag ?? true,
      });
    }

    try {
      const savedModuleAccess = await this.moduleAccessRepository.save(moduleAccess);

      // Ensure it's active in the organization's plan
      const activeSubscription = await this.organizationSubscriptionRepository.findActiveByOrganization(user.organizationId);
      if (activeSubscription) {
        const planId = activeSubscription.plan_id;
        this.logger.log(`Ensuring Module and Action are available in Plan: ${planId}`);

        // Ensure PlanModule exists
        const planModules = await this.planModuleRepository.findByPlanId(planId);
        let planModule = planModules.find(pm => pm.module_id === appModule.id);
        if (!planModule) {
          this.logger.log(`Creating PlanModule entry for Plan: ${planId}, Module: ${appModule.id}`);
          planModule = this.planModuleRepository.create({
            plan_id: planId,
            module_id: appModule.id,
            enabled: true,
          });
          await this.planModuleRepository.save(planModule);
        } else if (!planModule.enabled) {
          this.logger.log(`Enabling PlanModule entry for Plan: ${planId}, Module: ${appModule.id}`);
          planModule.enabled = true;
          await this.planModuleRepository.save(planModule);
        }

        // Ensure PlanModuleAction exists
        const planModuleActions = await this.planModuleActionRepository.findByPlanAndModule(
          planId,
          appModule.id,
        );
        let planModuleAction = planModuleActions.find((pma) => pma.action_id === action.id);
        if (!planModuleAction) {
          this.logger.log(
            `Creating PlanModuleAction entry for Plan: ${planId}, Module: ${appModule.id}, Action: ${action.id}`,
          );
          planModuleAction = this.planModuleActionRepository.create({
            plan_id: planId,
            module_id: appModule.id,
            action_id: action.id,
            enabled: true,
          });
          await this.planModuleActionRepository.save(planModuleAction);
        } else if (!planModuleAction.enabled) {
          this.logger.log(
            `Enabling PlanModuleAction entry for Plan: ${planId}, Module: ${appModule.id}, Action: ${action.id}`,
          );
          planModuleAction.enabled = true;
          await this.planModuleActionRepository.save(planModuleAction);
        }
      }

      return savedModuleAccess;
    } catch (error) {
      this.logger.error(`Failed to save module access or update plan: ${error.message}`);
      throw new ConflictException('Failed to process module access assignment.');
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

  async getPermissionsList(roleId: string, user: LoggedInUser) {
    this.logger.log(`Fetching permissions list for role ${roleId}`);
    const role = await this.roleService.findOne(roleId, user);
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const activeSubscription = await this.organizationSubscriptionRepository.findActiveByOrganization(role.organization_id);
    const planId = activeSubscription?.plan_id;

    // Fetch all active modules for the app
    const allModules = await this.appModuleRepository.findByAppId(role.app_id);
    const moduleIds = allModules.map((m) => m.id);

    // Fetch all active actions
    const allActions = await this.actionRepository.findAll();

    let enabledModuleIds = new Set(moduleIds);
    const planActionMap = new Map<string, Set<string>>();

    if (planId) {
      const planModules = await this.planModuleRepository.findByPlanId(planId);
      enabledModuleIds = new Set(
        planModules.filter((pm) => pm.enabled).map((pm) => pm.module_id)
      );

      const planModuleActions = await this.planModuleActionRepository.findByPlanId(planId);
      for (const pma of planModuleActions) {
        if (!pma.enabled) continue;
        if (!planActionMap.has(pma.module_id)) {
          planActionMap.set(pma.module_id, new Set());
        }
        planActionMap.get(pma.module_id)!.add(pma.action_id);
      }
    }

    const existingAccessList = await this.moduleAccessRepository.findByRole(role.id);
    const accessMap = new Map<string, boolean>();
    for (const access of existingAccessList) {
      accessMap.set(`${access.module_id}_${access.action_id}`, access.access_flag);
    }

    const result: any[] = [];
    for (const mod of allModules) {
      if (planId && !enabledModuleIds.has(mod.id)) continue;

      const allowedActionIds = planActionMap.get(mod.id);

      for (const action of allActions) {
        if (planId && (!allowedActionIds || !allowedActionIds.has(action.id))) {
          continue;
        }

        const accessKey = `${mod.id}_${action.id}`;
        const isChecked = accessMap.get(accessKey) ?? false;

        result.push({
          id: accessKey,
          name: `${mod.name} - ${action.name.toUpperCase()}`,
          category: mod.name,
          checked: isChecked,
          appId: mod.app_id,
          moduleId: mod.id,
          actionId: action.id,
        });
      }
    }

    return result;
  }

  async updatePermissionsList(
    roleId: string,
    dto: UpdateRolePermissionsListDto,
    user: LoggedInUser,
  ) {
    this.logger.log(`Bulk updating permissions list for role ${roleId}`);
    const role = await this.roleService.findOne(roleId, user);
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const existingAccessList = await this.moduleAccessRepository.findByRole(role.id);
    const accessMap = new Map<string, ModuleAccess>();
    for (const access of existingAccessList) {
      accessMap.set(`${access.module_id}_${access.action_id}`, access);
    }

    const updates: ModuleAccess[] = [];
    const inserts: Partial<ModuleAccess>[] = [];

    for (const item of dto.permissions) {
      const key = `${item.module_id}_${item.action_id}`;
      const existing = accessMap.get(key);

      if (existing) {
        if (existing.access_flag !== item.checked) {
          existing.access_flag = item.checked;
          updates.push(existing);
        }
      } else if (item.checked) {
        inserts.push({
          role_id: role.id,
          module_id: item.module_id,
          action_id: item.action_id,
          access_flag: true,
        });
      }
    }

    // Unchecked items that exist in DB can be updated to access_flag = false or deleted.
    // Deleting them is cleaner.
    const toDeleteIds: string[] = [];

    for (const existing of existingAccessList) {
      const key = `${existing.module_id}_${existing.action_id}`;
      // If it's not in the request payload or explicitly checked=false in the request
      const payloadItem = dto.permissions.find(p => `${p.module_id}_${p.action_id}` === key);
      if (!payloadItem || !payloadItem.checked) {
         toDeleteIds.push(existing.id);
      }
    }

    if (toDeleteIds.length > 0) {
      this.logger.log(`Deleting ${toDeleteIds.length} unchecked module access records.`);
      await Promise.all(toDeleteIds.map(id => this.moduleAccessRepository.delete(id)));
    }

    if (updates.length > 0) {
      this.logger.log(`Updating ${updates.length} module access records.`);
      for (const update of updates) {
        await this.moduleAccessRepository.save(update);
      }
    }

    if (inserts.length > 0) {
      this.logger.log(`Inserting ${inserts.length} module access records.`);
      for (const insert of inserts) {
        const newRecord = this.moduleAccessRepository.create(insert);
        await this.moduleAccessRepository.save(newRecord);
      }
    }

    // When a platform role's permissions change, propagate new grants to all cloned org roles.
    // We only ADD new entries — we never remove from org roles, preserving any custom config.
    if (!role.organization_id && role.is_system_role) {
      this.propagateToOrgRoles(role.id, role.app_id, dto.permissions).catch((err) =>
        this.logger.error(`Failed to propagate platform role permissions: ${err.message}`),
      );
    }

    return { success: true };
  }

  private async propagateToOrgRoles(
    platformRoleId: string,
    appId: string,
    permissions: Array<{ module_id: string; action_id: string; checked: boolean }>,
  ): Promise<void> {
    const checkedPerms = permissions.filter((p) => p.checked);
    if (!checkedPerms.length) return;

    const orgRoles = await this.roleRepository.findOrgRolesByAppId(appId);
    if (!orgRoles.length) return;

    this.logger.log(
      `Propagating ${checkedPerms.length} permissions from platform role ${platformRoleId} to ${orgRoles.length} org roles`,
    );

    for (const orgRole of orgRoles) {
      const existing = await this.moduleAccessRepository.findByRole(orgRole.id);
      const existingKeys = new Set(existing.map((e) => `${e.module_id}_${e.action_id}`));

      const toInsert = checkedPerms.filter(
        (p) => !existingKeys.has(`${p.module_id}_${p.action_id}`),
      );

      for (const perm of toInsert) {
        const record = this.moduleAccessRepository.create({
          role_id: orgRole.id,
          module_id: perm.module_id,
          action_id: perm.action_id,
          access_flag: true,
        });
        await this.moduleAccessRepository.save(record);
      }

      if (toInsert.length) {
        this.logger.log(`Added ${toInsert.length} new permissions to org role ${orgRole.id}`);
      }
    }
  }
}
