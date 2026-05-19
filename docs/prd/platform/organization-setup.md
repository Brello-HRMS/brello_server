# Tech PRD — Platform Organization Setup (System Defaults)

## Module: PLATFORM → Organization Setup

---

## Overview

Lets the Enterprise define **system-default Departments and Designations** that
every Organization under it can use immediately, without an explicit "import"
step. Achieved via **read-through inheritance**:

> A row with `organization_id IS NULL AND enterprise_id = <ent>` is a system
> default. Every Organization under that Enterprise sees it alongside their own
> rows when listing departments/designations.

Policies and Holidays stay **org-managed** (each Organization configures their
own — no platform-level provision for them).

---

## Tech Stack

- **Framework**: NestJS (TypeORM, PostgreSQL)
- **Auth**: JwtAuthGuard + `@LoggedInUser()` (`appId = PLATFORM`)
- **Pattern**: Repository → Service → Controller
- **Tenancy**: system defaults are scoped to `enterprise_id = jwt.enterpriseId`

---

## Scope

### In Scope (V1)

Platform side (CRUD on system defaults):
- List + paginate system departments / designations
- Create / Edit / Delete (soft) a system row
- Clone an existing row

Org side (small widening of existing services):
- `findAllByOrg(orgId)` returns the union of org-own rows **and** the
  Enterprise's system defaults
- Listing payloads flag system rows so the UI can show "system" badge / disable
  edit / delete buttons
- Create / Update / Delete in an org is blocked from acting on a system row
  (404 if the id is a system default and the caller is not a Platform user)

### Out of Scope (V1)

- "Disable a system default for this specific org" toggle
- In-place override (orgs cannot rename a system row; if they want a different
  name, they create their own row with a different code)
- Versioning / change history per row
- Cross-Enterprise sharing (no global "starter pack")
- Policy / Holiday system defaults

---

## User Roles

| Role                  | Access                                                    |
|-----------------------|-----------------------------------------------------------|
| PLATFORM_SUPER_ADMIN  | Full CRUD on system defaults                              |
| Custom Platform role  | Subject to `module_access` on `PLAT_DEPT_TEMPLATES` / `PLAT_DESIGNATION_TEMPLATES` |
| Org-side roles        | Read-only on system defaults via existing department/designation endpoints |

Permission map:

| Endpoint                       | RequirePermission                                       |
|--------------------------------|---------------------------------------------------------|
| Department system CRUD         | `PLAT_DEPT_TEMPLATES.{view,create,update,delete}`       |
| Designation system CRUD        | `PLAT_DESIGNATION_TEMPLATES.{view,create,update,delete}`|

---

## Database — what changes vs today

**No new tables.** Same tables (`departments`, `designations`) hold both
system-default rows and live org-scoped rows. Convention:

> `organization_id IS NULL` (and `org_id IS NULL` for designations)
> means "system default owned by `enterprise_id`".

### Schema changes

| Table          | Required change                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------------|
| `departments`  | Add a **partial unique index** on `(enterprise_id, code) WHERE organization_id IS NULL AND deleted_at IS NULL` so two system defaults can't share a code in one Enterprise. The existing `(organization_id, code)` unique index keeps live org rows unique within an org. |
| `designations` | **Make `org_id` nullable** (currently explicit `NOT NULL`). Add partial unique index on `(enterprise_id, code) WHERE org_id IS NULL AND deleted_at IS NULL`. |

No new columns. No `is_default` flag — a row is a system default by virtue of
having no organization id.

### Indexes to add

```sql
-- departments
CREATE UNIQUE INDEX uniq_department_system_default_per_enterprise
  ON departments (enterprise_id, code)
  WHERE organization_id IS NULL AND deleted_at IS NULL;

-- designations
CREATE UNIQUE INDEX uniq_designation_system_default_per_enterprise
  ON designations (enterprise_id, code)
  WHERE org_id IS NULL AND deleted_at IS NULL;
```

Express in TypeORM via `@Index(..., { unique: true, where: '...' })`.

---

## Read-through behavior (org side)

The existing
[`DepartmentRepository.findAllByOrg`](../../../src/modules/departments/repositories/department.repository.ts) is the only place
that currently filters by `organization_id` strict-equals. We widen the
`WHERE` clause:

```ts
// Before
.andWhere('department.organization_id = :organizationId', { organizationId })

// After
.andWhere(
  '(department.organization_id = :organizationId OR (department.organization_id IS NULL AND department.enterprise_id = :enterpriseId))',
  { organizationId, enterpriseId },
)
```

The org-side service should pass `enterpriseId` from the JWT alongside the
`organizationId`. Same shape for designations
([`DesignationRepository`](../../../src/modules/designations/repositories/designation.repository.ts)).

Response payload gains an `is_system` flag (computed: `organization_id === null`)
so the UI can render a badge and disable edit/delete.

### Single-row reads (`findOneByOrg`, `findByCode`)

Same widening — accept ids that resolve to either an org row or a system
default for the org's enterprise.

### Org-side writes against a system row

`update(id, ...)` and `delete(id, ...)` from the org-admin controllers must
return **404** if the loaded row has `organization_id IS NULL`. Org admins
cannot edit or delete system defaults — Platform admins must do that.

### Cross-scope uniqueness on create

When an org admin creates a new department/designation, the service must
check that `code` isn't already used **either** by another row in the same org
**or** by a system default for the enterprise. Two queries; throw 409 on
collision.

### FK integrity on system-default delete

A system row referenced by `User.department_id` or similar cannot be deleted.
The delete endpoint counts references first; returns 422 with a list of
affected user counts if any exist. Reassign or fork before delete.

---

## API Endpoints

Prefix: `/api/v1/platform/org-setup`

| Method | Path                       | Description                              | Permission                       |
|--------|----------------------------|------------------------------------------|----------------------------------|
| GET    | /departments               | List system departments for this Enterprise | `PLAT_DEPT_TEMPLATES.view`    |
| GET    | /departments/:id           | Detail (with usage count across orgs)    | `PLAT_DEPT_TEMPLATES.view`       |
| POST   | /departments               | Create system department                 | `PLAT_DEPT_TEMPLATES.create`     |
| PUT    | /departments/:id           | Update                                   | `PLAT_DEPT_TEMPLATES.update`     |
| POST   | /departments/:id/clone     | Duplicate                                | `PLAT_DEPT_TEMPLATES.create`     |
| DELETE | /departments/:id           | Soft-delete (blocked if in use)          | `PLAT_DEPT_TEMPLATES.delete`     |

Same shape under `/designations` with `PLAT_DESIGNATION_TEMPLATES.*`
permissions.

All listing/detail endpoints scope by `enterprise_id = jwt.enterpriseId AND organization_id IS NULL` (or `org_id IS NULL` for designations).

---

## Request / Response Contracts

### POST /api/v1/platform/org-setup/departments

**Request**

```json
{
  "name": "Engineering",
  "code": "ENG",
  "description": "Software engineering and platform teams"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Engineering",
    "code": "ENG",
    "is_system": true
  }
}
```

### GET /api/v1/platform/org-setup/departments

**Response**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Engineering",
        "code": "ENG",
        "description": "...",
        "is_system": true,
        "usage_count": 14,
        "created_at": "2026-05-17T12:00:00Z"
      }
    ]
  }
}
```

`usage_count` is "number of users currently linked to this system row,
across all orgs in the Enterprise". Computed via a single SQL aggregate on
`users.department_id`.

### DELETE /api/v1/platform/org-setup/departments/:id

If in use, **422**:

```json
{
  "success": false,
  "message": "Cannot delete: 14 users across 3 organizations reference this department.",
  "data": {
    "user_count": 14,
    "organization_count": 3
  }
}
```

---

## Module Structure

```
src/modules/platform-org-setup/
├── controllers/
│   ├── platform-departments.controller.ts
│   └── platform-designations.controller.ts
├── services/
│   ├── platform-departments.service.ts
│   └── platform-designations.service.ts
├── dto/
│   ├── create-system-department.dto.ts
│   ├── update-system-department.dto.ts
│   ├── create-system-designation.dto.ts
│   └── update-system-designation.dto.ts
└── platform-org-setup.module.ts
```

No new entity files — the existing `Department` and `Designation` entities are
reused. One entity edit: `Designation.org_id` becomes `nullable: true`.

Two existing files that need the widening (single-line) tweak:
- [src/modules/departments/repositories/department.repository.ts](../../../src/modules/departments/repositories/department.repository.ts)
- [src/modules/designations/repositories/designation.repository.ts](../../../src/modules/designations/repositories/designation.repository.ts)

And a small change in the org-side create flow to do the cross-scope
uniqueness check.

---

## Service Logic

### `PlatformDepartmentsService.list(user)`

```ts
return this.repo.find({
  where: {
    enterprise_id: user.enterpriseId,
    organization_id: IsNull(),
    deleted_at: IsNull(),
  },
  order: { created_at: 'DESC' },
});
```

For the `usage_count` field, join `users` and aggregate by `department_id`.
Same pattern for designations.

### `PlatformDepartmentsService.create(user, dto)`

1. Insert with `enterprise_id = user.enterpriseId`, `organization_id = NULL`.
2. Catch the partial unique index violation and surface 409 if `code` collides
   with another system default in this Enterprise.
3. Audit log.

### `PlatformDepartmentsService.delete(user, id)`

1. Load the row; assert `organization_id IS NULL` and `enterprise_id === user.enterpriseId` (else 404).
2. Count `users` (and any other FK referers) where `department_id = id`.
3. If count > 0 → 422 with the breakdown.
4. Otherwise set `deleted_at = NOW()` and `is_deleted = true` (the entity has both for historical reasons).
5. Audit log.

### Updates to existing org-side code

In [`DepartmentService.create`](../../../src/modules/departments/services/department.service.ts):

```ts
// before insert, check both scopes
const dup = await manager
  .createQueryBuilder(Department, 'd')
  .where('d.code = :code', { code: dto.code })
  .andWhere(
    '(d.organization_id = :orgId OR (d.organization_id IS NULL AND d.enterprise_id = :entId))',
    { orgId: user.organizationId, entId: user.enterpriseId },
  )
  .andWhere('d.deleted_at IS NULL')
  .getOne();

if (dup) throw new ConflictException('Department code already exists');
```

In [`DepartmentRepository.findAllByOrg`](../../../src/modules/departments/repositories/department.repository.ts), widen the WHERE clause as
shown in the Read-through section above, and accept `enterpriseId` as a new
argument.

---

## Enums

No new enums.

---

## Open questions / future work

- **Per-org opt-out** — if some org under an Enterprise doesn't want a
  particular system default, V1 just lives with it. Future: a small
  `organization_system_default_hidden` table keyed on `(organization_id, kind, source_id)`.
- **In-place override** — copy-on-write: when an org admin first edits a
  system row, fork to an org-scoped row in the same transaction. Out of V1.
- **Migration of existing data** — `brello_dev` (and any org already in
  `brello_v2`) has departments/designations as live rows only. Backfilling
  some of them as system defaults is a one-off script, not a code change.
- **System default usage analytics** — the `usage_count` field is V1 only.
  Trend over time, per-org breakdown, etc. are platform-dashboard concerns.
