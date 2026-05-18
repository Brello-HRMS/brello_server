# Tech PRD — Platform Organization Setup (Templates)

## Module: PLATFORM → Organization Setup

---

## Overview

Lets the Enterprise define **reusable templates** that new (and existing)
Organizations can clone or reference for their initial setup:

- **Department Templates** — common departments (Engineering, HR, Sales)
- **Designation Templates** — common job titles per band
- **Policy Templates** — pre-written company policies (leave, code of conduct)
- **Holiday Templates** — pre-built holiday calendars per country/region

When an Organization is created, the platform offers these as a one-click
import. Edits made by the org afterward stay local; template updates do **not**
back-propagate (a future "sync from template" feature can be added later).

---

## Tech Stack

- **Framework**: NestJS (TypeORM, PostgreSQL)
- **Auth**: JwtAuthGuard + `@LoggedInUser()` (`appId = PLATFORM`)
- **Pattern**: Repository → Service → Controller, with a per-template-kind service to keep service files small
- **Tenancy**: templates are scoped to `enterprise_id = jwt.enterpriseId`; an Enterprise can't see another's templates

---

## Scope

### In Scope (V1)

For each of the four template kinds:
- List + paginate
- Create / Edit / Archive
- Clone an existing template (e.g. duplicate "India 2026 Holidays" → tweak for 2027)
- Import into a specific Organization (one-shot copy)
- Mark a template as "default" — auto-applied on every new org under this Enterprise

### Out of Scope (V1)

- Live sync (template change → existing org change)
- Versioning / history per template
- Cross-Enterprise template sharing
- Conditional rules (e.g. "auto-add this department for orgs in industry X")
- Import wizard with conflict resolution (V1 = simple overwrite or skip)

---

## User Roles

| Role                  | Access                                                    |
|-----------------------|-----------------------------------------------------------|
| PLATFORM_SUPER_ADMIN  | Full                                                      |
| Custom Platform role  | Subject to `module_access` on each `PLAT_*_TEMPLATES` code |

Permission per endpoint group:

| Endpoint               | RequirePermission                                        |
|------------------------|----------------------------------------------------------|
| Departments read/write | `PLAT_DEPT_TEMPLATES.{view,create,update,delete}`        |
| Designations           | `PLAT_DESIGNATION_TEMPLATES.{view,create,update,delete}` |
| Policies               | `PLAT_POLICY_TEMPLATES.{view,create,update,delete}`      |
| Holidays               | `PLAT_HOLIDAY_TEMPLATES.{view,create,update,delete}`     |
| Import-into-org        | `PLAT_ORG_DETAILS.update` + `PLAT_*_TEMPLATES.view`      |

---

## Database Schema (NEW TABLES)

Four new tables. All inherit `BaseEntity`. Two design choices were considered:

- **Option A (chosen):** new `*_template` tables, separate from existing
  org-scoped tables. Keeps templates and live data clearly separated.
- **Option B (rejected):** repurpose existing tables with `organization_id IS NULL`
  meaning "template". Saves tables but mixes lifecycles and complicates queries.

### department_template

| Column          | Type                 | Notes                       |
|-----------------|----------------------|-----------------------------|
| id              | UUID PK              | BaseEntity                  |
| enterprise_id   | UUID NOT NULL        | scoping                     |
| organization_id | NULL (unused)        |                             |
| name            | VARCHAR(150)         |                             |
| code            | VARCHAR(50)          | optional short code         |
| description     | TEXT                 |                             |
| is_default      | BOOLEAN DEFAULT false | auto-apply on new org      |

**Unique**: `(enterprise_id, name)`

### designation_template

| Column          | Type                 | Notes                       |
|-----------------|----------------------|-----------------------------|
| id              | UUID PK              | BaseEntity                  |
| enterprise_id   | UUID NOT NULL        |                             |
| name            | VARCHAR(150)         |                             |
| level           | INT NULL             | e.g. 1–10 band              |
| description     | TEXT                 |                             |
| is_default      | BOOLEAN DEFAULT false |                            |

**Unique**: `(enterprise_id, name)`

### policy_template

| Column          | Type                 | Notes                                                    |
|-----------------|----------------------|----------------------------------------------------------|
| id              | UUID PK              | BaseEntity                                               |
| enterprise_id   | UUID NOT NULL        |                                                          |
| title           | VARCHAR(255)         |                                                          |
| category        | ENUM                 | LEAVE / CONDUCT / SECURITY / IT / OTHER                  |
| content_html    | LONGTEXT             | sanitized rich text                                      |
| version         | VARCHAR(20) NULL     | optional, e.g. "v1.0"                                    |
| is_default      | BOOLEAN DEFAULT false |                                                         |

**Unique**: `(enterprise_id, title)`

### holiday_template

| Column          | Type            | Notes                                  |
|-----------------|-----------------|----------------------------------------|
| id              | UUID PK         | BaseEntity                             |
| enterprise_id   | UUID NOT NULL   |                                        |
| name            | VARCHAR(150)    | e.g. "India 2026"                      |
| country_code    | VARCHAR(2) NULL | ISO country (IN, US, GB)               |
| year            | INT NULL        | optional anchor year                   |
| is_default      | BOOLEAN DEFAULT false |                                  |

### holiday_template_entry

Child rows for each holiday in a `holiday_template`:

| Column                | Type                 | Notes                              |
|-----------------------|----------------------|------------------------------------|
| id                    | UUID PK              | BaseEntity                         |
| holiday_template_id   | UUID NOT NULL FK     | → holiday_template.id              |
| name                  | VARCHAR(150)         | "Diwali"                           |
| date                  | DATE NOT NULL        |                                    |
| type                  | ENUM                 | NATIONAL / RELIGIOUS / REGIONAL / OPTIONAL |
| is_optional           | BOOLEAN DEFAULT false |                                   |

---

## Cloning into an Organization

For each template kind there's a "clone into org" service method. It copies
rows from the template table to the live org-scoped table (`departments`,
`designations`, `company_policies`, `holiday_calendars` + entries). The
imported rows are independent — edits in the org don't flow back.

Auto-apply on org-create: when a new Organization is created via
`OrganizationService.setupCompany`, iterate templates with `is_default = true`
for the Enterprise and run the same import in the same transaction.

---

## API Endpoints

Prefix: `/api/v1/platform/org-setup`

(Routes mirror across the four template kinds — examples shown for departments.)

| Method | Path                                  | Description                              | Permission                       |
|--------|---------------------------------------|------------------------------------------|----------------------------------|
| GET    | /departments                          | List department templates                | `PLAT_DEPT_TEMPLATES.view`       |
| GET    | /departments/:id                      | Detail                                   | `PLAT_DEPT_TEMPLATES.view`       |
| POST   | /departments                          | Create                                   | `PLAT_DEPT_TEMPLATES.create`     |
| PUT    | /departments/:id                      | Update                                   | `PLAT_DEPT_TEMPLATES.update`     |
| POST   | /departments/:id/clone                | Duplicate a template                     | `PLAT_DEPT_TEMPLATES.create`     |
| POST   | /departments/:id/set-default          | Mark as auto-applied for new orgs        | `PLAT_DEPT_TEMPLATES.update`     |
| DELETE | /departments/:id                      | Soft-delete                              | `PLAT_DEPT_TEMPLATES.delete`     |
| POST   | /departments/:id/import/:organization_id | Copy into a specific org              | `PLAT_DEPT_TEMPLATES.view` + `PLAT_ORG_DETAILS.update` |

Same shape for `/designations`, `/policies`, `/holidays`.

For holidays there's an extra child-rows API:

| Method | Path                                  | Description                              |
|--------|---------------------------------------|------------------------------------------|
| GET    | /holidays/:id/entries                 | List dates in a holiday template         |
| POST   | /holidays/:id/entries                 | Add a date                               |
| PUT    | /holidays/:id/entries/:entryId        | Update                                   |
| DELETE | /holidays/:id/entries/:entryId        | Delete                                   |

---

## Request / Response Contracts

### POST /api/v1/platform/org-setup/departments

**Request**

```json
{
  "name": "Engineering",
  "code": "ENG",
  "description": "Software engineering and platform teams",
  "is_default": true
}
```

**Response**

```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Engineering" }
}
```

### POST /api/v1/platform/org-setup/departments/:id/import/:organization_id

**Response**

```json
{
  "success": true,
  "message": "Imported 1 department into organization",
  "data": {
    "organization_id": "uuid",
    "department_id": "uuid"
  }
}
```

### POST /api/v1/platform/org-setup/holidays/:id/entries

**Request**

```json
{
  "name": "Diwali",
  "date": "2026-11-10",
  "type": "RELIGIOUS",
  "is_optional": false
}
```

---

## Module Structure

```
src/modules/platform-org-setup/
├── controllers/
│   ├── department-templates.controller.ts
│   ├── designation-templates.controller.ts
│   ├── policy-templates.controller.ts
│   └── holiday-templates.controller.ts
├── services/
│   ├── department-templates.service.ts
│   ├── designation-templates.service.ts
│   ├── policy-templates.service.ts
│   ├── holiday-templates.service.ts
│   └── template-importer.service.ts        # one place that clones into an org
├── entities/
│   ├── department-template.entity.ts
│   ├── designation-template.entity.ts
│   ├── policy-template.entity.ts
│   ├── holiday-template.entity.ts
│   └── holiday-template-entry.entity.ts
├── dto/
│   └── (one per template kind)
└── platform-org-setup.module.ts
```

---

## Service Logic

### `TemplateImporterService.applyDefaultsToNewOrg(enterpriseId, orgId, manager)`

Called inside the transaction of
[OrganizationService.setupCompany](../../../src/modules/organization/services/organization.service.ts):

1. For each template kind, `find({ enterprise_id, is_default: true, deleted_at: IsNull() })`.
2. Import each into the org via the per-kind importer (see below).
3. Returns counts for logging.

### `TemplateImporterService.importDepartments(templateId, orgId, manager)`

- Read the template.
- Insert a `departments` row using the template's name/code/description, with the target `organization_id` and `enterprise_id`.
- No conflict handling V1 — if a department with the same name exists, return 409 with the conflict.

### `TemplateImporterService.importHolidayTemplate(templateId, orgId, manager)`

- Create a `holiday_calendars` row for the org.
- Insert one `holidays` row per `holiday_template_entry`.

### Auto-default constraint

At most one template per kind per Enterprise can be `is_default`. Enforced
via a partial unique index:

```sql
CREATE UNIQUE INDEX uniq_default_department_template_per_enterprise
  ON department_template (enterprise_id)
  WHERE is_default = true AND deleted_at IS NULL;
```

Same partial index per template kind.

---

## Enums

```typescript
export enum PolicyCategory {
  LEAVE    = 'LEAVE',
  CONDUCT  = 'CONDUCT',
  SECURITY = 'SECURITY',
  IT       = 'IT',
  OTHER    = 'OTHER',
}

export enum HolidayType {
  NATIONAL  = 'NATIONAL',
  RELIGIOUS = 'RELIGIOUS',
  REGIONAL  = 'REGIONAL',
  OPTIONAL  = 'OPTIONAL',
}
```

---

## Open questions / future work

- **Live sync** — push template edits to all orgs that imported it. Needs an
  `imported_from_template_id` column on each child table to track lineage.
- **Conflict resolution UI** — "department name already exists" — let admin
  choose: skip / rename / overwrite. V1 just errors.
- **Cross-Enterprise sharing** — Brello might want to publish a "starter
  industry pack" that resellers can pull from. Out of scope.
