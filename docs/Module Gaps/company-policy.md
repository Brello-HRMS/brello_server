# Module: Company Policy

## 1. Purpose & Current Usage

- Two entities: `CompanyPolicyType` (master category — either system-defined with `organization_id = null` and `is_system = true`, or org-scoped custom) and `CompanyPolicy` (a specific policy document: `title`, `placeholder`, `type_id` FK → `CompanyPolicyType`, `content` (text/markdown), `is_deleted`). Both extend `BaseEntity` (`id`, `enterprise_id`, `organization_id`, `status`, `code`, `description`, timestamps, `modified_by/at`, `deleted_by/at`).
  - `entities/company-policy-type.entity.ts:12-25`
  - `entities/company-policy.entity.ts:12-32`
- Two services:
  - `CompanyPolicyTypeService` — CRUD for policy categories, protects system types from edit/delete, blocks deactivate/delete while active policies reference the type (`services/company-policy-type.service.ts:49-91`).
  - `CompanyPolicyService` — CRUD for policy documents, validates `type_id` against the type service, pushes create/update/delete into Global Search indexing (`services/company-policy.service.ts:27-113`).
- Two controllers, both guarded by `JwtAuthGuard` + `AccessGuard` + `RequirePermission('ORG_POLICIES', <action>)`:
  - `POST/PATCH/DELETE /policy-types`, `GET /policy-types` (`controllers/company-policy-type.controller.ts`)
  - `POST/PATCH/DELETE /policies`, `GET /policies/grouped`, `GET /policies/:id` (`controllers/company-policy.controller.ts`)
- Who calls into it today:
  - Frontend admin UI: `brello_webapp/src/pages/policies/PoliciesPage.tsx` via `brello_webapp/src/features/policies/{api,hooks}` hitting `/policies` and `/policy-types`. Reachable only through a single admin route, `brello_webapp/src/routes/adminRoutes.tsx:93` (`organisation/policies`) — there is no separate employee-facing route.
  - `brello_server/src/modules/org-setup/org-setup.service.ts:7,36-37,63` and `org-setup.module.ts:8,22` — injects the raw `CompanyPolicy` TypeORM entity/repository directly (bypassing `CompanyPolicyService`) just to `count()` policies for the onboarding-progress checklist step `COMPANY_POLICIES`.
  - `GlobalSearchModule`: `CompanyPolicyService` calls `SearchIndexingService.indexPolicy`/`removePolicy` (`services/company-policy.service.ts:40,102,111`; indexed in `modules/global-search/services/search-indexing.service.ts:264-286`) so policies surface in Cmd+K search.
  - `AuditModule`: every mutating endpoint on both controllers carries `@AuditLog(AuditLogModule.COMPANY_POLICY, ...)` (`controllers/company-policy.controller.ts:34,64,76`; `controllers/company-policy-type.controller.ts:37,48,60`), backed by `AuditLogModule.COMPANY_POLICY` (`modules/audit/enums/audit-log-module.enum.ts:35`).
- Dead/unused parts:
  - `CompanyPolicyService.findAll()` (`services/company-policy.service.ts:44-49`) is never called — the controller only exposes `findGrouped`, so this method is dead code.
  - Unused `SelectQueryBuilder` import in both repositories (`repositories/company-policy.repository.ts:3`, `repositories/company-policy-type.repository.ts:3`).

## 2. Intended / Ideal Usage

- What's actually built: a small CMS for policy documents — categorize policies under types (system or custom), create/edit/soft-delete policies and types, list policies grouped by category, view-only mode for users without edit permission (`controllers/company-policy.controller.ts:48-51,56-62` toggles `checkActive`/hides fields based on `PermissionResolverService.hasPermission`), and search indexing.
- What "ideal" usage of a company-policy module looks like and is **not** built:
  - **No acknowledgment / read-receipt flow.** There is no join entity linking `CompanyPolicy` to `User` to record who has read/accepted a policy and when. `CompanyPolicy` has no such relation at all.
  - **No versioning.** `update()` overwrites the `content` column in place (`services/company-policy.service.ts:93-96`) with no history/snapshot table, so there is no way to know what a policy said at a past point in time — a prerequisite for any future acknowledgment feature (you need to know *which version* an employee agreed to).
  - **No mandatory/required flag** or linkage to onboarding — a new hire is never required to acknowledge any policy as part of the onboarding checklist (which only checks that policies *exist*, see below).
  - **No file/attachment support.** A dedicated `document` module exists in the codebase (`brello_server/src/modules/document`) for file storage, but `CompanyPolicy` has no attachment field — organizations can only enter markdown/plain text, not upload an actual signed PDF/DOCX policy.
  - **No notification on publish/update** — employees are never proactively notified when a new or updated policy is published.

## 3. Cross-Module Connections

- **Depends on:**
  - `RbacModule` — `AccessGuard`, `RequirePermission`, `PermissionResolverService` (module.ts:11,20; controller.ts:21,31,49,60).
  - `GlobalSearchModule` — `SearchIndexingService` for Cmd+K indexing (module.ts:12,21).
  - `AuditModule` — `AuditContextService` + `@AuditLog` decorator + `AuditLogModule` enum (services/company-policy.service.ts:14,24; services/company-policy-type.service.ts:14,23).
- **Depends on it:**
  - `org-setup` module (onboarding-completion checklist), via direct entity injection rather than the service (see Structural gap #1 below).
- **Missing / expected connections:**
  - No dependency on a `NotificationModule` — publishing/updating a policy should plausibly trigger an in-app/email notification, per the existing notification-system design (per project memory: 40+ trigger events already exist for other modules).
  - No dependency on `document` module for attachments (see §2).
  - No "acknowledgment" concept means there is nothing for `AuditModule` to log beyond CRUD — an employee accepting a policy is exactly the kind of event the audit log is designed to capture, but it can't because the feature doesn't exist.

## 4. Gaps

### Structural (architecture, module boundaries, coupling, missing abstractions, layering violations)

- **Cross-module boundary violation:** `org-setup.service.ts:7,36-37,63` and `org-setup.module.ts:8,22` inject `Repository<CompanyPolicy>` directly instead of depending on `CompanyPolicyService`. This duplicates query/filtering logic outside the owning module and will silently drift from the service's business rules (e.g., it doesn't apply the same status/soft-delete semantics `CompanyPolicyService` uses). Matters because the module's encapsulation is already broken by one consumer, making it likelier the next consumer does the same.
- **No acknowledgment sub-domain:** `entities/company-policy.entity.ts:12-32` has no relation to `User` or any join table for tracking read/acceptance. Matters because this is the functional gap between "a page that lists rules" and an auditable HR-compliance workflow — the module's name implies the latter but only the former is implemented.
- **No content versioning:** `services/company-policy.service.ts:93-96` overwrites `content` on every `update()` with no history. Matters because without version history, any future acknowledgment feature can't answer "which version did this employee agree to."

### Coding (bugs, dead code, inconsistent patterns, missing validation/error handling, unsafe assumptions)

- **Broken status validation:** `CreateCompanyPolicyDto`/`UpdateCompanyPolicyDto` (`dto/company-policy.dto.ts:33-35,60-62`) and `CreateCompanyPolicyTypeDto`/`UpdateCompanyPolicyTypeDto` (`dto/policy-type.dto.ts:20-22,35-37`) validate `status` with `@IsEnum(Status, { message: 'Status must be ACTIVE or INACTIVE' })`, but `Status` (`common/enums/status.enum.ts:7-22`) actually has 5 members: `ACTIVE`, `INACTIVE`, `DELETED`, `PENDING`, `ARCHIVED`. A client can `PATCH` `status: "DELETED"` directly, leaving `status=DELETED` while `is_deleted` stays `false` and `deleted_at` stays `null` — an inconsistent, half-deleted record that still passes the `is_deleted=false` filter in `findByOrg`/`findActiveByOrg` and shows up in "all" listings. Matters because it's a real data-integrity bug reachable from a documented, validated API surface, not a hypothetical.
- **Dead code:** `CompanyPolicyService.findAll()` (`services/company-policy.service.ts:44-49`) is never invoked by `CompanyPolicyController` — only `findGrouped` is wired to a route. Matters because it's unmaintained surface area that will bit-rot or mislead future readers into thinking there's a flat-list endpoint.
- **Unused imports:** `SelectQueryBuilder` imported but never used in both repositories (`repositories/company-policy.repository.ts:3`, `repositories/company-policy-type.repository.ts:3`). Minor, but indicates the repos aren't lint-clean.
- **Unordered aggregate:** `findGroupedByOrg`'s `json_agg` (`repositories/company-policy.repository.ts:40`) has no `ORDER BY` inside the aggregate, so per-type `policies` array ordering isn't guaranteed across requests/Postgres versions, unlike `findByOrg` which explicitly orders by `created_at DESC` (`repositories/company-policy.repository.ts:30`). Matters because the grouped view (the only endpoint the UI actually uses) can render policies in an unstable order.

### Technical (performance, security, scalability, test coverage, observability/logging)

- **Zero test coverage:** no `*.spec.ts` files exist anywhere under `company-policy/` (confirmed via search). Matters because the module encodes several business rules (system-type protection, RESTRICT-on-delete for `type_id`, org-scoping, active-policy-count guard before deactivating a type) that are only exercised manually today.
- **Check-then-act race on duplicate names:** `CompanyPolicyTypeService.create()` (`services/company-policy-type.service.ts:34-36`) does a `findByName` lookup then `create`, with no unique DB constraint backing it (no migration file for `company_policy_types`/`company_policies` was found in `docs/migrations`). Two concurrent creates of the same type name in the same org can both pass validation and produce duplicate rows.
- **No file/attachment storage integration:** despite a dedicated `document` module existing in the codebase for file storage, `CompanyPolicy` only stores `content` as markdown/plain text with no attachment reference — organizations cannot upload an actual signed PDF policy document.

## 5. Top 3 Priorities

1. **Fix the `status` validation bug** (`dto/company-policy.dto.ts`, `dto/policy-type.dto.ts` vs `common/enums/status.enum.ts`) — small fix, but it's a live data-integrity bug reachable through the public API today.
2. **Decide and build (or explicitly de-scope) the acknowledgment/read-receipt flow** — this is the single biggest functional gap: as shipped, this is a policy-document CMS, not an HR-compliance acknowledgment system, and that distinction should be a deliberate product decision rather than an accidental omission.
3. **Remove the org-setup → `CompanyPolicy` entity coupling** (`org-setup.service.ts:7,36-37,63`) in favor of a method on `CompanyPolicyService` — cheap to fix now, and prevents the module-boundary violation from being copied by future consumers.
