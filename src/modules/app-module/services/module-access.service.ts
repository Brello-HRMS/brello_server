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
}
