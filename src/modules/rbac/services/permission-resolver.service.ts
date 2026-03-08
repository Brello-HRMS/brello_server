import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserRoleMap } from '../entities/user-role-map.entity';
import { ModuleAccess } from '../../app-module/entities/module-access.entity';
import { AppModule } from '../../app-module/entities/app-module.entity';
import {
  OrganizationSubscription,
  SubscriptionStatus,
} from '../../plan/entities/organization-subscription.entity';
import { PlanModule } from '../../plan/entities/plan-module.entity';
import { PlanModuleAction } from '../../plan/entities/plan-module-action.entity';
import { Status } from '../../../common/enums';

/** Map of moduleId → { actionName → granted } */
export type PermissionMap = Map<string, Map<string, boolean>>;

/** Extended permission map with module metadata for menu building */
export interface ResolvedModule {
  id: string;
  name: string;
  /** Stable code used for permission lookups (e.g. LEAVE_MGMT) */
  code: string;
  /** WBS code — used only for hierarchy/ordering */
  wbs_code: string;
  parent_id: string | null;
  app_id: string;
  actions: Set<string>;
}

export interface PermissionResult {
  /** Flat map: moduleId → Set<actionName> (only accessible) */
  permissions: Map<string, Set<string>>;
  /** All resolved modules with their accessible actions */
  modules: ResolvedModule[];
  /** The planId used for restriction (null if no subscription found) */
  planId: string | null;
}

/**
 * PermissionResolverService
 *
 * Core engine for resolving a user's effective permissions within an app.
 *
 * Resolution flow:
 * 1. Fetch roles for userId × organizationId × appId
 * 2. OR-aggregate role-based module_access entries
 * 3. Fetch active plan for the organization
 * 4. AND-restrict against plan_module + plan_module_action
 * 5. WBS hierarchy propagation (child access ⟹ parent view)
 * 6. Strip modules with no effective actions
 * 7. Return PermissionResult
 */
@Injectable()
export class PermissionResolverService {
  private readonly logger = new Logger(PermissionResolverService.name);

  constructor(
    @InjectRepository(UserRoleMap)
    private readonly userRoleMapRepo: Repository<UserRoleMap>,

    @InjectRepository(ModuleAccess)
    private readonly moduleAccessRepo: Repository<ModuleAccess>,

    @InjectRepository(AppModule)
    private readonly appModuleRepo: Repository<AppModule>,

    @InjectRepository(OrganizationSubscription)
    private readonly subscriptionRepo: Repository<OrganizationSubscription>,

    @InjectRepository(PlanModule)
    private readonly planModuleRepo: Repository<PlanModule>,

    @InjectRepository(PlanModuleAction)
    private readonly planModuleActionRepo: Repository<PlanModuleAction>,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Resolve effective permissions for a user within a specific app.
   */
  async resolve(
    userId: string,
    organizationId: string,
    appId: string,
  ): Promise<PermissionResult> {
    const planId = await this.getActivePlanId(organizationId);

    // Step 1: Get role IDs for this user in this app
    const roleIds = await this.getRoleIdsForUser(userId, organizationId, appId);
    if (!roleIds.length) {
      return this.emptyResult(planId);
    }

    // Step 2: OR-aggregate role-based permissions
    const rolePermissions = await this.aggregateRolePermissions(roleIds);

    // Step 3 & 4: Apply plan restrictions (AND logic)
    const planRestricted = await this.applyPlanRestrictions(
      rolePermissions,
      planId,
    );

    // Step 5 & 6: WBS propagation and load module metadata
    const allModules = await this.appModuleRepo.find({
      where: { app_id: appId, status: Status.ACTIVE },
      order: { wbs_code: 'ASC' },
    });

    return this.buildModuleResult(allModules, planRestricted);
  }

  /**
   * Check if a user has a specific action on a module (by module code).
   */
  async hasPermission(
    userId: string,
    organizationId: string,
    appId: string,
    moduleCode: string,
    actionName: string,
  ): Promise<boolean> {
    const resolved = await this.resolve(userId, organizationId, appId);
    for (const mod of resolved.modules) {
      if (mod.code === moduleCode) {
        return mod.actions.has(actionName);
      }
    }
    return false;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private emptyResult(planId: string | null): PermissionResult {
    return { permissions: new Map(), modules: [], planId };
  }

  /** Step 1 — get active role IDs for user within this org + app */
  private async getRoleIdsForUser(
    userId: string,
    organizationId: string,
    appId: string,
  ): Promise<string[]> {
    const rows = await this.userRoleMapRepo
      .createQueryBuilder('urm')
      .innerJoin('urm.role', 'role')
      .select('urm.role_id', 'roleId')
      .where('urm.user_id = :userId', { userId })
      .andWhere('urm.organization_id = :organizationId', { organizationId })
      .andWhere('role.app_id = :appId', { appId })
      .andWhere('role.status = :status', {
        status: Status.ACTIVE,
      })
      .getRawMany<{ roleId: string }>();

    return rows.map((r) => r.roleId);
  }

  /** Step 2 — OR-aggregate: moduleId → actionId → true if ANY role grants it */
  private async aggregateRolePermissions(
    roleIds: string[],
  ): Promise<Map<string, Set<string>>> {
    const accesses = await this.moduleAccessRepo
      .createQueryBuilder('ma')
      .innerJoinAndSelect('ma.action', 'action')
      .where('ma.role_id IN (:...roleIds)', { roleIds })
      .andWhere('ma.access_flag = true')
      .getMany();

    const map = new Map<string, Set<string>>();
    for (const access of accesses) {
      if (!map.has(access.module_id)) {
        map.set(access.module_id, new Set());
      }
      map.get(access.module_id)!.add(access.action.name);
    }
    return map;
  }

  /** Get the active plan ID for an organization */
  private async getActivePlanId(
    organizationId: string,
  ): Promise<string | null> {
    const now = new Date();
    const sub = await this.subscriptionRepo.findOne({
      where: {
        organization_id: organizationId,
        sub_status: SubscriptionStatus.ACTIVE,
      },
      order: { start_date: 'DESC' },
    });
    if (!sub || sub.end_date < now) return null;
    return sub.plan_id;
  }

  /**
   * Step 3 & 4 — Apply plan restrictions:
   * - Only include modules that are plan-enabled
   * - AND restrict actions with plan_module_action
   */
  private async applyPlanRestrictions(
    rolePermissions: Map<string, Set<string>>,
    planId: string | null,
  ): Promise<Map<string, Set<string>>> {
    if (!planId) {
      // No plan found → no plan restrictions applied (pass everything through)
      return rolePermissions;
    }

    const moduleIds = [...rolePermissions.keys()];
    if (!moduleIds.length) return new Map();

    // Fetch which modules are enabled under this plan
    const enabledPlanModules = await this.planModuleRepo.find({
      where: { plan_id: planId, module_id: In(moduleIds), enabled: true },
    });
    const enabledModuleIds = new Set(
      enabledPlanModules.map((pm) => pm.module_id),
    );

    // Fetch allowed actions per module for this plan
    const planActions = await this.planModuleActionRepo.find({
      where: { plan_id: planId, module_id: In(moduleIds), enabled: true },
    });

    // Build plan-allowed action map: moduleId → Set<actionId>
    // (action_id here; we need to join to get name — handled below via moduleAccess.action entity)
    const planActionMap = new Map<string, Set<string>>();
    for (const pa of planActions) {
      if (!planActionMap.has(pa.module_id)) {
        planActionMap.set(pa.module_id, new Set());
      }
      // Note: plan_module_action stores action_id; we need action names.
      // So we load them via action entity.
    }

    // Efficiently get action names for plan actions
    const planActionIds = [...new Set(planActions.map((a) => a.action_id))];
    const actionNameMap = await this.getActionNames(planActionIds);

    // Rebuild planActionMap with action names
    planActionMap.clear();
    for (const pa of planActions) {
      if (!planActionMap.has(pa.module_id)) {
        planActionMap.set(pa.module_id, new Set());
      }
      const actionName = actionNameMap.get(pa.action_id);
      if (actionName) {
        planActionMap.get(pa.module_id)!.add(actionName);
      }
    }

    // Intersect role permissions WITH plan restrictions
    const result = new Map<string, Set<string>>();
    for (const [moduleId, roleActions] of rolePermissions.entries()) {
      // Module must be enabled in plan
      if (!enabledModuleIds.has(moduleId)) continue;

      const planAllowed = planActionMap.get(moduleId);
      let effectiveActions: Set<string>;

      if (!planAllowed || planAllowed.size === 0) {
        // Plan has no action restrictions for this module → allow all role actions
        effectiveActions = new Set(roleActions);
      } else {
        // Intersect role actions AND plan-allowed actions
        effectiveActions = new Set(
          [...roleActions].filter((a) => planAllowed.has(a)),
        );
      }

      if (effectiveActions.size > 0) {
        result.set(moduleId, effectiveActions);
      }
    }

    return result;
  }

  /** Fetch action names for given action IDs */
  private async getActionNames(
    actionIds: string[],
  ): Promise<Map<string, string>> {
    if (!actionIds.length) return new Map();
    const rows = await this.moduleAccessRepo.manager
      .createQueryBuilder()
      .select(['a.id as id', 'a.name as name'])
      .from('actions', 'a')
      .where('a.id IN (:...actionIds)', { actionIds })
      .getRawMany<{ id: string; name: string }>();
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /**
   * Step 5 & 6 — WBS hierarchy propagation:
   * If a child module has access, ensure its parent has at minimum 'view'.
   * Remove modules with no effective actions.
   */
  private buildModuleResult(
    allModules: AppModule[],
    effectivePermissions: Map<string, Set<string>>,
  ): PermissionResult {
    const moduleById = new Map(allModules.map((m) => [m.id, m]));

    // Propagate child access → parent must have 'view'
    for (const [moduleId] of effectivePermissions.entries()) {
      const mod = moduleById.get(moduleId);
      if (mod?.parent_id) {
        if (!effectivePermissions.has(mod.parent_id)) {
          effectivePermissions.set(mod.parent_id, new Set(['view']));
        } else {
          effectivePermissions.get(mod.parent_id)!.add('view');
        }
      }
    }

    // Build output
    const resolvedModules: ResolvedModule[] = [];
    for (const mod of allModules) {
      const actions = effectivePermissions.get(mod.id);
      if (actions && actions.size > 0) {
        resolvedModules.push({
          id: mod.id,
          name: mod.name,
          code: mod.code,
          wbs_code: mod.wbs_code,
          parent_id: mod.parent_id ?? null,
          app_id: mod.app_id,
          actions,
        });
      }
    }

    return {
      permissions: effectivePermissions,
      modules: resolvedModules,
      planId: null, // filled by caller when needed
    };
  }
}
