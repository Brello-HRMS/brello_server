# Module: App

## 1. Purpose & Current Usage

`modules/app/` is a small platform-admin CRUD module for the `app` table — the top of the RBAC tree (confirmed via seed data: `src/seeds/seed-brello-v2-base.ts:38-39` seeds exactly two rows, `ADMIN` and `EMPLOYEE`). It contains:

- **Entity**: `entities/app.entity.ts` — `App extends BaseEntity`, columns `name` (unique varchar(100)), `description`, `icon`, `priority` (default 999). Inherits `id`, `enterprise_id`, `organization_id`, `status`, `code`, `created_at/updated_at`, `modified_by/modified_at`, `deleted_by/deleted_at` from `common/entities/base.entity.ts` — none of the tenant-scoping fields (`enterprise_id`, `organization_id`) are ever populated for `App` rows since apps are global, not tenant records.
- **DTOs**: `dto/create-app.dto.ts` (name/description required 2-100 chars, optional icon, optional priority ≥1), `dto/update-app.dto.ts` (`PartialType` of create).
- **Repository**: `repositories/app.repository.ts` — plain CRUD wrapper: `create`, `save`, `findAll`, `findByIds`, `findOneById`, `findByName`, `delete` (soft delete via `status: Status.DELETED`, `app.repository.ts:49-54`).
- **Service**: `services/app.service.ts` — `create` (name-uniqueness check), `findAll`, `findAllForEnterprise`/`findOneForEnterprise` (via `EnterpriseAppRepository`), `findAllForUser`/`findOneForUser` (branches on `user.isPlatformAdmin`), `update`, `remove`.
- **Controller**: `controllers/app.controller.ts` — `POST/GET/GET:id/PATCH:id/DELETE:id /apps`, guarded by `@UseGuards(JwtAuthGuard, PlatformAdminGuard)` (`app.controller.ts:23`) — every route requires `isPlatformAdmin === true`.
- **Module**: `app-management.module.ts` — imports `EnterpriseModule` via `forwardRef`, exports `AppService`, `AppRepository`, `TypeOrmModule`. Registered globally in `app.module.ts:13,68`.

**Who actually calls into it:**
- `EnterpriseService` injects `AppRepository` (via `forwardRef`) to look up all/some apps when creating an enterprise and listing enterprises with their apps — `modules/enterprise/services/enterprise.service.ts:17,26-27,44,78,113`.
- `Role` entity has a `ManyToOne(() => App, { onDelete: 'CASCADE' })` FK — `modules/role/entities/role.entity.ts:3,15-17`.
- Frontend webapp calls full CRUD: `brello_webapp/src/features/platform/apps/api.ts:6` (`GET/POST/PATCH/DELETE /apps`), consumed by `PlatformAppsPage.tsx` (create/list/delete UI) and by `useAppsList` in `RoleFormModal.tsx`, `PlatformModulesPage.tsx`, `PlatformAccessPermissionsPage.tsx`, `PlatformPlanPermissionsPage.tsx` (all just populate app-selector dropdowns).
- `src/seeds/seed-brello-v2-base.ts:188-200` (`upsertApp`) inserts the two base `App` rows via **raw SQL against the `app` table**, entirely bypassing `AppService`/`AppRepository`.

**Dead/unused parts:**
- `AppService.findAllForEnterprise` / `findOneForEnterprise` are only reachable through `findAllForUser`/`findOneForUser` (`app.service.ts:64-76`), which are only called from the controller (`app.controller.ts:39,48`) — but that controller is gated by `PlatformAdminGuard`, which throws unless `isPlatformAdmin === true` (`core/guards/platform-admin.guard.ts:15-16`). The `else` branch that calls `findAllForEnterprise`/`findOneForEnterprise` can never execute in practice.
- `modules/organization/services/organization.service.ts:31` imports the `App` entity but never references it anywhere else in the file (only `PlanApp`, `RoleApp`, and `Role` are actually used) — dead import.

## 2. Intended / Ideal Usage

Based on the DTOs, the `priority`/`icon` fields, and the seed comment (`seed-brello-v2-base.ts:1-13`, "Inserts the minimum baseline required before an enterprise can be created: Apps..."), the module is meant to be the single canonical registry of top-level applications (`ADMIN`, `EMPLOYEE`) that:
1. Platform admins manage via CRUD (name/description/icon/priority for UI ordering).
2. Other modules reference by FK (`Role.app_id`, `EnterpriseApp.app_id`, `PlanApp.app_id`, `RoleApp.app_id`) to scope roles/plans/enterprises to an app.
3. Is the one source of truth consumed whenever code needs to answer "what apps exist" or "what apps does X have access to."

No PRD exists under `brello_server/docs/prd/` for this module specifically. The enterprise-scoped methods (`findAllForEnterprise`, `findOneForEnterprise`) suggest an intended future where non-platform-admin users could also query apps scoped to their own enterprise, but that endpoint path is not currently exposed (the whole controller requires platform-admin).

## 3. Cross-Module Connections

**Depends on / imports:**
- `EnterpriseModule` (`forwardRef`) — `app-management.module.ts:6,13` — used only so `EnterpriseAppRepository` can be injected into `AppService` (`app.service.ts:10,17,33-43`).
- `auth` module — `JwtAuthGuard` and the `LoggedInUser` type (`app.controller.ts:17,20`).
- `core/guards/platform-admin.guard.ts` — sole authorization mechanism.

**Depends on this module:**
- `EnterpriseService` — injects `AppRepository` via `forwardRef` (`modules/enterprise/services/enterprise.service.ts:17,26-27`) to (a) assign **every** `App` row to a newly created enterprise (`enterprise.service.ts:44-51`), and (b) hydrate `App` objects for `findAll`/`findOneById` (`enterprise.service.ts:64-114`).
- `Role` entity — `ManyToOne(() => App, { onDelete: 'CASCADE' })` (`modules/role/entities/role.entity.ts:15-17`).
- `app.module.ts:13,68` — registers `AppManagementModule` at the root.
- Frontend webapp — `brello_webapp/src/features/platform/apps/` (full CRUD + list consumers, see §1).

**Missing / expected connections:**
- The login/app-switch flow (`modules/auth/services/auth.service.ts:318-329`, `modules/auth/utils/app.util.ts:20-107`) computes "apps available to this user" via three raw `UserRoleMap`→`Role`→`App`/`RoleApp` query-builder joins, **entirely bypassing `AppService`, `AppRepository`, and `EnterpriseAppRepository`**. This is a second, independent implementation of "which apps can X see" that never touches this module's code, so the two can diverge (e.g., `EnterpriseService.create()` attaches literally all `App` rows to a brand-new enterprise regardless of plan — `enterprise.service.ts:44-51` — while `getUserAvailableApps` filters purely by role/role_apps, and `OrganizationService`'s role-cloning filters apps by the org's `PlanApp` entries — `modules/organization/services/organization.service.ts:137-139` — a third, again different, scoping rule).
- `PlanAppRepository` (`modules/plan/repositories/plan-app.repository.ts`) maintains yet another app-scoping relation (per-plan `is_active` apps) that `AppService` has no awareness of at all — the App module itself has zero concept of plans/subscriptions.

## 4. Gaps

### Structural
- **Soft-delete is a no-op everywhere it's read.** `AppRepository.delete()` only sets `status: Status.DELETED` (`app.repository.ts:49-54`), but `findAll`, `findByIds`, `findOneById`, and `findByName` never filter on `status` (`app.repository.ts:22-47`) — unlike sibling repositories in the same domain, e.g. `EnterpriseAppRepository.getAppsForEnterprise` which explicitly filters `status: Status.ACTIVE` (`modules/enterprise/repositories/enterprise-app.repository.ts:26-32`). Matters because: `GET /apps` keeps showing "deleted" apps, `EnterpriseService.create()` re-attaches deleted apps to every new enterprise (`enterprise.service.ts:44`), and `AppService.create()`'s `findByName` check (`app.service.ts:21-24`) will forever throw `ConflictException` for a deleted app's name — combined with the DB-level unique constraint on `name` (`app.entity.ts:5,7`) and no restore endpoint, a deleted app's name is permanently unusable.
- **Dead access-control branch.** `AppService.findAllForEnterprise`/`findOneForEnterprise` (`app.service.ts:33-62`) are unreachable in practice because the only callers, `findAllForUser`/`findOneForUser` (`app.service.ts:64-76`), are only invoked from a controller gated by `PlatformAdminGuard` (`app.controller.ts:23`), which requires `isPlatformAdmin === true` (`platform-admin.guard.ts:15-16`) — so the `isPlatformAdmin` branch is always taken. Matters because: it's dead code that reads as a half-built "apps scoped per enterprise" feature nothing exercises, adding maintenance confusion.
- **Three divergent definitions of "apps available to X"** (App/EnterpriseApp-based in this module, role-based raw SQL in `auth/utils/app.util.ts`, plan-based in `PlanAppRepository`) with no shared abstraction. Matters because: any one of these can be updated without the others noticing, and a user could see an app in the login/switch-app list that platform admins never assigned to their enterprise, or vice versa.

### Coding
- **Dead import** of the `App` entity in `modules/organization/services/organization.service.ts:31` — never referenced elsewhere in that file. Low severity but signals code drift and adds an unnecessary coupling edge.
- **Inconsistent uniqueness UX**: `create()` pre-checks `findByName` and throws a descriptive `ConflictException` (`app.service.ts:20-24`), but `update()` does no such check (`app.service.ts:78-82`) and instead relies on the DB unique-violation being caught by the global `HttpExceptionFilter` (`common/filters/http-exception.filter.ts:56-61`), which returns a generic "A record with this value already exists" message with no field/app context.
- **No audit trail on mutation.** `BaseEntity` carries `modified_by`/`modified_at`/`deleted_by`/`deleted_at` (`common/entities/base.entity.ts`), but `AppService.update`/`remove` never populate them (`app.service.ts:78-87`) and never call `AuditContextService`, unlike `EnterpriseService` which explicitly does (`modules/enterprise/services/enterprise.service.ts:19,118`). Platform-wide app changes are invisible to the audit log.
- **Zero test coverage** — no `*.spec.ts` exists anywhere under `modules/app` (confirmed via repo-wide search), while comparable modules (e.g. payroll services) have dedicated unit tests.

### Technical
- **Unbounded list endpoint.** `findAll` has no pagination (`app.repository.ts:22-26`); low risk given only ~2 rows today, but combined with the soft-delete bug above it will accumulate every "deleted" app forever with no way to hide them from the UI.
- **No logging/observability** anywhere in `AppController`/`AppService`/`AppRepository` — contrast with `ModuleAccessService`, which logs every create/update/assign operation (`modules/app-module/services/module-access.service.ts`, throughout). Makes it hard to trace who created/renamed/deleted a platform-wide `App` in production.
- **No dependent-record check on delete.** `remove()` (`app.service.ts:84-87`) soft-deletes without checking for live `Role.app_id`, `EnterpriseApp`, or `PlanApp` references. Currently masked by the soft-delete-filtering bug (nothing actually disappears), but if that bug is fixed naively, existing FK references (the `Role→App` relation is declared `onDelete: 'CASCADE'` at the DB level but never fires since the row is never hard-deleted) would suddenly point at a hidden/invisible app.

## 5. Top 3 Priorities

1. **Fix soft-delete filtering** in `AppRepository` (`findAll`, `findByIds`, `findOneById`, `findByName` should exclude `Status.DELETED`, matching the pattern already used in `EnterpriseAppRepository`/`PlanAppRepository`) — this is the root cause behind stale apps leaking into new enterprises and permanently blocking name reuse.
2. **Reconcile the divergent "apps available to X" logic** — pick one source of truth (this module + `EnterpriseApp`/`PlanApp`) instead of having `auth/utils/app.util.ts` independently re-derive app access via raw role joins; today the login/switch-app flow and the platform-admin CRUD view of "apps per enterprise" can silently disagree.
3. **Remove the dead enterprise-scoped branch** in `AppService` (or actually expose a non-platform-admin endpoint that uses it), and bring the module's mutation methods up to the same bar as `EnterpriseService`/`ModuleAccessService` (audit-context calls, logging, and at least basic unit tests).
