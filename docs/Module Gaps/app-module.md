# Module: App-Module (RBAC module tree)

## 1. Purpose & Current Usage

`src/modules/app-module/` is confirmed (by code, not just naming) to be the core of Brello's RBAC "module tree": it defines *what* can be permissioned (modules/sub-modules and actions) and *who has what* (role → module → action grants).

- **Entities**
  - `entities/app-module.entity.ts` — `AppModule` (table `modules`): a tree node (`parent_id`/`children`, `wbs_code` for ordering, `type: mod|submod`) scoped to an `App` via `app_id`, with a stable `code` used for permission lookups, plus `icon`/`path` for building the sidebar menu.
  - `entities/action.entity.ts` — `Action` (table `actions`): a global, app-agnostic permission verb (view/create/update/delete/approve...).
  - `entities/module-access.entity.ts` — `ModuleAccess` (table `module_access`): the join of `role_id` × `module_id` × `action_id` → `access_flag` (grant/deny), with `onDelete: 'CASCADE'` on all three FKs.
- **Services**: `AppModuleService`, `ActionService` (plain CRUD + soft delete), `ModuleAccessService` (CRUD plus two higher-value operations: `assignByCode` — resolve a user's role and grant a module/action by code, and `getPermissionsList`/`updatePermissionsList` — the bulk permission-matrix used by the role-editing UI, with one-way propagation of platform-role grants to cloned org roles).
- **Controllers**: `app-module.controller.ts` (`/app-modules`), `action.controller.ts` (`/actions`), `module-access.controller.ts` (`/module-access`).
- **Repositories**: thin TypeORM wrappers per entity.

**Who actually calls into it:**
- Frontend `brello_webapp/src/features/platform/appModules/api.ts` and `brello_webapp/src/features/platform/actions/api.ts` call `/app-modules` and `/actions` CRUD directly (platform-admin setup screens, per `brello_webapp/src/pages/platform/PlatformActionsPage.tsx`).
- Frontend `brello_webapp/src/api/moduleAccess.ts:8-18` calls `GET/PUT /module-access/role/:roleId/permissions-list` (the role-permission-matrix editor) — this is the only `module-access` route the webapp uses.
- `src/modules/rbac/services/permission-resolver.service.ts:1-30` (the actual authorization engine used by every `@RequirePermission`-guarded route via `AccessGuard`, `src/core/guards/access.guard.ts:60-77`) does **not** go through `AppModuleRepository`/`ModuleAccessRepository`/`ActionRepository` at all — it re-injects `Repository<AppModule>` and `Repository<ModuleAccess>` directly (`permission-resolver.service.ts:63-76`) and even queries the `actions` table by raw string name (`permission-resolver.service.ts:243-251`, `.from('actions', 'a')`) instead of using `ActionRepository`.
- `src/modules/organization/services/organization.service.ts:170-183` clones `ModuleAccess` rows from platform roles to a newly-created org's roles using the raw `EntityManager` (`manager.find(ModuleAccess, ...)`, `manager.create(ModuleAccess, ...)`), again bypassing this module's own service/repository layer.
- `src/seeds/seed-payroll-permissions.ts` (a manually-run ops script) inserts directly into `modules`/`module_access`/`plan_module`/`plan_module_action` via raw SQL, explicitly because the normal HTTP surface can't do this for an existing, already-seeded database (see its doc-comment).

**Dead/unused parts:**
- `ModuleAccessController.assignByCode` (`POST /module-access/by-code`, `module-access.controller.ts:43-51`) and the underlying `ModuleAccessService.assignByCode` (`module-access.service.ts:65-177`, ~110 lines including a role-selection heuristic and plan-sync logic) are not called from the webapp and not called from any other backend module — confirmed via repo-wide grep. It is real, non-trivial logic that appears to be dead code (or only exercised manually via Postman/curl).
- The plain CRUD routes on `ModuleAccessController` (`POST/GET/GET:id/PATCH/DELETE /module-access`, lines 33-41, 53-58, 91-120) are also unused by the frontend, which only calls the `permissions-list` routes.

## 2. Intended / Ideal Usage

Doc comments in the code lay out the intended design clearly:
- `permission-resolver.service.ts:41-56` documents the resolution algorithm: role grants OR-aggregated, then AND-restricted by the org's active plan (`plan_module`/`plan_module_action`), then WBS-hierarchy propagated (child access ⇒ parent gets `view`).
- `access.guard.ts:16-30` documents the intended guard usage: `@UseGuards(JwtAuthGuard, AccessGuard)` + `@RequirePermission(moduleCode, actionName)` on every protected route.
- `entities/action.entity.ts:4-9` documents Actions as "system-level and shared across all apps" — i.e., a small, largely static lookup table.
- The codebase has an established, already-wired audit pattern (`@AuditLog(AuditLogModule.X, AuditAction.Y, ...)`, used e.g. in `src/modules/role/controllers/role.controller.ts:33,75,87`) and `src/modules/audit/enums/audit-log-module.enum.ts:14` already defines `AuditLogModule.PERMISSION` specifically for this domain — but it is never referenced anywhere in the codebase (`grep -rn "AuditLogModule.PERMISSION" src` returns nothing). This is documented intent (an enum value exists solely to be used) that was never realized in `app-module`.
- The pattern used by every other protected controller in the codebase (`AccessGuard` + `@RequirePermission`) implies `AppModuleController`/`ActionController` — which mutate the permission tree itself — should be equally or more strictly guarded than the resources they protect. That pattern is not followed here (see Gaps).

## 3. Cross-Module Connections

**Depends on** (imports/injects, per `app-module.module.ts:8,14,26-28`):
- `../rbac/entities/user-role-map.entity`, `../rbac/repositories/user-role-map.repository` (RbacModule) — used in `assignByCode` to resolve the caller's role.
- `PlanModule` (`../plan/plan.module`) — `OrganizationSubscriptionRepository`, `PlanModuleRepository`, `PlanModuleActionRepository`, injected into `ModuleAccessService` to keep plan gating in sync when a permission is assigned.
- `RoleModule` (`../role/role.module`) — `RoleService`, `RoleRepository`, `RoleAppRepository`, used for role lookup and platform→org role permission propagation.
- `RbacModule` (whole module import) — for `UserRoleMapRepository`.
- `../app/entities/app.entity` (App) — `AppModule.app` relation.
- `../role/entities/role.entity` (Role) — `ModuleAccess.role` relation.

**Depends on this module** (import its entities/DTOs/services):
- `src/modules/rbac/rbac.module.ts:4-6,32-43` — re-registers `AppModule`, `Action`, `ModuleAccess` via its own `TypeOrmModule.forFeature(...)` rather than importing `AppModuleModule` and consuming its exports.
- `src/modules/rbac/services/permission-resolver.service.ts` — the core authorization engine (see §1).
- `src/modules/organization/services/organization.service.ts:27-28,170-183` — org-onboarding role/permission cloning.
- `app.module.ts:14` — the only place that actually imports `AppModuleModule` as a Nest module.
- Every controller in the codebase that uses `@RequirePermission` transitively depends on this module's entities via `AccessGuard` → `PermissionResolverService`.

**Missing or expected connections:**
- `AppModuleService`/`ActionService`/`ModuleAccessService` (this module's own service layer) are injected nowhere outside their own controllers (confirmed via grep) — every real cross-module consumer reaches around them straight to the entities/raw SQL. The service layer exists but isn't the module's actual integration surface.
- No connection to the Audit module (`AuditContextService`/`@AuditLog`) despite the enum existing for exactly this purpose (§2).
- `PlanModule`/`PlanModuleAction` (`src/modules/plan/entities/plan-module.entity.ts`, `plan-module-action.entity.ts`) store `module_id`/`action_id` as bare `uuid` columns with **no** `@ManyToOne` relation back to `AppModule`/`Action` (contrast with `ModuleAccess`, which does have proper relations + `onDelete: 'CASCADE'`), so there is no FK-level connection between the plan-gating tables and this module's entities at all.

## 4. Gaps

### Structural
- **Duplicate repository/query layer for the same tables.** `RbacModule` (`rbac.module.ts:32-43`) re-declares `TypeOrmModule.forFeature([AppEntity, Action, ModuleAccess, ...])` instead of importing `AppModuleModule`, and `PermissionResolverService` re-implements querying against `AppModule`/`ModuleAccess`/`actions` with hand-rolled query builders (`permission-resolver.service.ts:63-76`, `243-251`) rather than reusing `AppModuleRepository`/`ActionRepository`/`ModuleAccessRepository`. Two independent code paths query the same tables, so a fix or filter added in one (e.g., a `status = ACTIVE` filter) can silently diverge from the other. Evidence: `permission-resolver.service.ts:243-251` queries the `actions` table with **no** status filter, while `action.repository.ts:21-26`'s `findAll()` filters `status: 'ACTIVE'`.
- **No FK/relation between plan-gating tables and this module's entities.** `plan-module.entity.ts` and `plan-module-action.entity.ts` store `module_id`/`action_id` as unconstrained UUID columns (no `@ManyToOne`, no `onDelete`), unlike `ModuleAccess` which cascades. Soft-deleting an `AppModule`/`Action` (via this module's own `softDelete`, which only flips `status`) leaves orphaned `plan_module`/`plan_module_action` rows with no DB-level signal.
- **Three independent implementations of "clone/propagate role permissions.”** (1) `ModuleAccessService.propagateToOrgRoles` (`module-access.service.ts:361-398`, event-driven, add-only), (2) `OrganizationService`'s raw-manager clone at org creation (`organization.service.ts:170-183`, one-shot full clone), (3) the manual `seed-payroll-permissions.ts` script (raw SQL, for already-provisioned orgs). None share code; a fix to one (e.g., a dedupe rule) won't propagate to the others.

### Coding
- **`Action.code` is only synced at process boot, not on create/update.** `CreateActionDto` (`action.dto.ts:3-8`) has no `code` field, so `ActionService.create` (`action.service.ts:13-23`) persists an action with `code = null`. `code` is only ever backfilled by `ActionRepository.syncActionsCodeAndName()` (`action.repository.ts:58-89`), which runs solely from `ModuleAccessService.onModuleInit()` (`module-access.service.ts:45-47`) at app bootstrap. Any action created through `POST /actions` after boot has `code = null` until the next restart, which breaks `ActionRepository.findByCode` (`action.repository.ts:45-49`) and therefore `ModuleAccessService.assignByCode` (`module-access.service.ts:71-74`) for that action. This matters because it's a silent, restart-dependent data-integrity bug in the exact lookup path the by-code assignment API relies on.
- **`PermissionResult.planId` is always discarded.** `PermissionResolverService.resolve()` computes `planId` up front (`permission-resolver.service.ts:87-88`) and uses it for restriction logic, but the final return value comes from `buildModuleResult(...)` which hard-codes `planId: null` (`permission-resolver.service.ts:305,335` — the `PermissionResult` object literal ends with `planId: null, // filled by caller when needed`). No caller currently reads `.planId` (confirmed via grep), so it's latent, but the comment shows it was intended to be populated and isn't.
- **Redundant unique constraint.** `Action` entity declares uniqueness twice: `@Column({ ..., unique: true })` on `name` (`action.entity.ts:14-15`) *and* a class-level `@Index(['name'], { unique: true })` (`action.entity.ts:11`) — two separate unique indexes on the same column.
- **Inconsistent update-DTO semantics.** `UpdateActionDto` (`action.dto.ts:10-15`) makes `name` `@IsNotEmpty()` (required) on what is supposed to be a partial update, while the sibling `UpdateAppModuleDto` (`app-module.dto.ts:50-79`) correctly makes every field `@IsOptional()`. A `PATCH /actions/:id` call must always resend `name`.
- **Non-idiomatic logging.** `ActionRepository.syncActionsCodeAndName()` uses raw `console.log`/`console.error` (`action.repository.ts:59,84,86-87`) instead of the `Logger` used everywhere else in this module's services (e.g. `action.service.ts:9`), so these bootstrap-time sync logs bypass normal log levels/formatting.
- **Fragile role-selection heuristic.** `ModuleAccessService.assignByCode` picks a role for the caller by string-matching the role name for "admin"/"owner" or `is_system_role` (`module-access.service.ts:89-94`) rather than an explicit role parameter — a renamed role ("Administrator" → "Manager Lead", say) silently changes which role gets the grant.

### Technical
- **No authorization on the module-tree/action CRUD itself.** `AppModuleController` (`app-module.controller.ts:21-22`) and `ActionController` (`action.controller.ts:20-21`) are guarded only by `JwtAuthGuard` — no `AccessGuard`/`@RequirePermission`, unlike `ModuleAccessController` which correctly requires `RequirePermission('ACCESS_PERMISSIONS', ...)` on every route (`module-access.controller.ts:29,35,45,55,62,72,82,93,103,114`). Any authenticated user in any organization can `POST/PATCH/DELETE /app-modules` and `/actions` — i.e. restructure or delete nodes in the platform-wide permission tree, or rename/delete permission verbs — with no permission check and no global guard fallback (confirmed no `APP_GUARD`/global guard exists in `app.module.ts`/`main.ts`). This is the module's most severe gap: it's the one part of the RBAC subsystem that itself has no RBAC protection.
- **No audit trail for permission changes.** None of `AppModuleService`/`ActionService`/`ModuleAccessService`/their controllers use `@AuditLog` or `AuditContextService` (confirmed via grep — zero "Audit" hits under `src/modules/app-module`), even though `updatePermissionsList` can grant/revoke delete/approve access for a role and the codebase has a ready-made `AuditLogModule.PERMISSION` enum value (`audit-log-module.enum.ts:14`) sitting unused for exactly this. Security/compliance-relevant changes to who-can-do-what leave no record.
- **No automated tests.** No `.spec.ts` files exist anywhere under `src/modules/app-module` (confirmed via `find`), so the permission-matrix bulk update (`updatePermissionsList`, `module-access.service.ts:278-359`, which does per-item diff, delete, update, and insert plus async propagation) and the by-code assignment/plan-sync logic have zero regression coverage.
- **Sequential per-row writes in hot paths.** `updatePermissionsList` issues one `save`/`delete` call per changed permission in a loop (`module-access.service.ts:330-347`) and `OrganizationService`'s role-permission clone likewise awaits `manager.save` once per permission inside a nested loop (`organization.service.ts:175-183`) — for a role/org with a large permission matrix this is O(n) sequential round-trips inside a request/transaction instead of a single bulk insert.

## 5. Top 3 Priorities

1. **Add `AccessGuard` + `@RequirePermission` to `AppModuleController` and `ActionController`.** Today any authenticated user, regardless of role or organization, can create/edit/delete the platform's module tree and permission actions — the highest-severity finding because it undermines the RBAC system from inside the one place meant to define it.
2. **Wire `ModuleAccessService` (and ideally `AppModuleService`/`ActionService`) into the existing `@AuditLog`/`AuditLogModule.PERMISSION` pattern.** The audit infrastructure already exists and is used elsewhere for `ROLE`; leaving permission grants/revokes unaudited is a compliance gap that's cheap to close by following the established pattern.
3. **Fix `Action.code` to be set at creation time (not only via boot-time sync).** This is a concrete, demonstrable bug: any action created after the server has booted has a `null` code and will fail `assignByCode` lookups until the next restart, directly undermining the by-code assignment feature this module ships.
