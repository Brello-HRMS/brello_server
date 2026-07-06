# Module: Client

## 1. Purpose & Current Usage

- The module is a straightforward CRUD unit for the `clients` table: `entities/client.entity.ts` (extends `common/entities/base.entity.ts` for org/enterprise scoping + soft-delete-capable `status`/`deleted_at`/`deleted_by` columns), `repositories/client.repository.ts` (thin TypeORM wrapper), `services/client.service.ts` (business logic), `controllers/client.controller.ts` (REST endpoints under `/clients`), plus `dto/create-client.dto.ts`, `dto/update-client.dto.ts` (PartialType of create), `dto/list-clients.dto.ts`.
- `client.module.ts` imports `GlobalSearchModule` and exports both `ClientService` and `ClientRepository`.
- Real callers today:
  - `brello_server/src/modules/project/services/project.service.ts:10,32,46,95` — `ProjectService` injects `ClientService` and calls `findOne()` to validate a client exists and belongs to the caller's org before creating/listing projects for it.
  - `brello_server/src/modules/project/controllers/client-project.controller.ts:23-46` — nested route `clients/:clientId/projects` (create/list projects scoped to a client).
  - `brello_server/src/modules/project/entities/project.entity.ts:11,24-28` — `Project.client_id` / `@ManyToOne(() => Client)` FK relation.
  - Frontend: `brello_webapp/src/features/client/api/client.ts`, `features/client/hooks/{useClients,useAddClient,useUpdateClient,useDeleteClient}.ts`, `pages/client/{ClientPage,ClientDetailPage}.tsx`, and `features/project/api/projectApi.ts` / `pages/project/*` consume client data for project screens.
- Dead/unused: `ClientRepository` is exported from `ClientModule` (`client.module.ts:13`) but no module outside `client/` imports it directly — only `ClientService` is consumed externally. `Client.projects_count` (`client.entity.ts:28`) is a plain, non-persisted property bolted onto the entity purely to carry a computed value out of the service layer.

## 2. Intended / Ideal Usage

- Based on the sibling `project` module's pattern (`project.service.ts`), a correctly-built module here would: (a) scope every single-record lookup (`findOne`/`update`/`remove`) by `organization_id` the same way `findAll` does via `ListingHelper`, (b) use `softDelete` instead of a hard `DELETE` given `Status.DELETED` is explicitly documented as "soft-deleted (not physically removed from database)" (`common/enums`), and (c) fire a domain event/notification on creation the way `modules/lead/services/lead.service.ts:179-180` calls `NotificationService.send(...)` after creating a lead.
- Ideal `findOne` for use-by-count would use a `COUNT` query (as `findAll` already does via `loadRelationCountAndMap`) rather than hydrating full child rows.

## 3. Cross-Module Connections

- **Depends on**: `GlobalSearchModule` (`SearchIndexingService.indexClient/removeClient`, `client.service.ts:8,53,112,128`), `AuditModule` (`AuditContextService`, `AuditLog` decorator), `auth` module (`JwtAuthGuard`, `LoggedInUser`), `common` (`BaseEntity`, `ListingHelper`, pagination DTOs).
- **Depended on by**: `project` module (`ClientService.findOne` for validation, `Client` entity for the `client_id` FK and nested routing) — this is the only consumer; no `billing`, `letter-management`, or `notification` module references `Client` at all.
- **Missing connection**: no dependency on `NotificationModule` anywhere in the client module (confirmed no `NotificationService` import). This is doubly a gap: (1) `create()` doesn't notify anyone on new-client creation, and (2) the `Client` entity itself has no owner/account-manager field or relation (`client.entity.ts:1-29` — only `poc_name`/`poc_email`/`poc_phone` for the client's own contact, nothing for an internal Brello account manager), so "notify the account manager" isn't even structurally representable today without a schema change.

## 4. Gaps

### Structural (architecture, module boundaries, coupling, missing abstractions, layering violations)

- **No account-manager/owner concept on `Client`.** `client.entity.ts:1-29` has no `account_manager_id`/owner relation, and there's no `ACCOUNT_MANAGER` concept anywhere in the codebase (`project_team_mappings.role` is a free-text varchar, see `modules/project/entities/project-team.entity.ts:29`). Matters because it blocks the very notification feature this module is expected to support — there's no "who" to notify.
- **Soft-delete design contradicted by hard delete.** `client.repository.ts:39-42` does `this.repository.delete(id)` (physical row delete), while the sibling `project.repository.ts:53` (`softDelete`) and the `Status` enum's own doc comment ("soft-deleted, not physically removed from database") both signal the intended pattern is soft delete. Matters because a hard-deleted client permanently destroys history that `Project.client` FK/audit trail expects to still resolve, and the `Status.DELETED` value is effectively unreachable/dead for this entity.

### Coding (bugs, dead code, inconsistent patterns, missing validation/error handling, unsafe assumptions)

- **`created_by` is set but never persisted.** `client.service.ts:49` builds `clientData` with `created_by: user.userId`, but neither `client.entity.ts` nor `common/entities/base.entity.ts` declares a `created_by` column (unlike e.g. `announcement.entity.ts`, `feedback-ticket.entity.ts`, which do define it). The value is silently dropped by TypeORM on save — every client is created with no recoverable "who created this" field despite the code appearing to set one.
- **No notification on create (confirmed).** `client.service.ts:28-55` (`create()`) has no call into `NotificationService` or any equivalent — confirmed via `grep`, zero notification-related imports/calls exist anywhere in the module. Matters because whoever is supposed to be alerted about a new client (account manager, admin, etc.) currently finds out only by looking at the client list.
- **`remove()` has no child-record precheck.** `client.service.ts:116-129` deletes the client with no check for existing `Project` rows first; the FK constraint on `project.entities/project.entity.ts:24-28` (no `onDelete` specified, defaults to RESTRICT) will reject the delete, and the global filter (`common/filters/http-exception.filter.ts:70-74`, code `23503`) surfaces it as a generic "Related record not found." — a confusing message for "this client still has projects," instead of an explicit, actionable check.
- **Untyped repository method.** `client.repository.ts:30-32` (`findOne(options: any)`) takes `any` instead of TypeORM's `FindOneOptions<Client>`, losing compile-time safety on the one call site that uses it (`client.service.ts:31-37`).

### Technical (performance, security, scalability, test coverage, observability/logging)

- **Cross-tenant read/update/delete (no org scoping).** `client.service.ts:74-88` (`findOne`), `:90-114` (`update`), `:116-129` (`remove`) all fetch by raw `id` via `clientRepository.findById`/`findOne` with **no `organization_id`/`enterprise_id` check**, and the controller (`client.controller.ts:50-54, 56-65, 67-72`) never passes the logged-in user into `findOne`/never verifies ownership. Compare `project.service.ts:138-146`, which explicitly checks `project.organization_id !== user.organizationId` before returning. Any authenticated user who knows/guesses a client UUID from another organization can read, edit, or delete that client via `GET/PATCH/DELETE /clients/:id` — this is the most severe issue found.
- **Inefficient count via full relation load.** `client.repository.ts:23-28` (`findById`) eagerly loads the entire `projects` relation, and `client.service.ts:83-85` only uses it to compute `projects_count = client.projects.length`; `findAll` already does this correctly and cheaply via `loadRelationCountAndMap` (`client.service.ts:65`). `findOne` should do the same instead of hydrating every child project row.
- **Zero test coverage.** No `*.spec.ts` or e2e test exists for any file in `modules/client/` (confirmed via filesystem search) — none of the above bugs (including the tenant-scoping hole) would be caught by CI.

## 5. Top 3 Priorities

1. **Fix cross-tenant IDOR on `findOne`/`update`/`remove`** — this is an active data-isolation/security bug allowing any org's user to read/modify/delete another org's client records; highest severity, smallest fix (mirror `project.service.ts`'s org check).
2. **Add account-manager field to `Client` + wire `NotificationService` into `create()`** — closes the known notification gap, but requires a schema change first since there's currently no field representing "account manager" on the entity.
3. **Switch `remove()` to soft delete and add a child-project precheck** — aligns with the `Status` enum's documented intent, avoids destroying history, and replaces a confusing generic FK-violation error with a clear "client has active projects" message.
