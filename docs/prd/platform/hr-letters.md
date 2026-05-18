# Tech PRD — Platform HR Letters

## Module: PLATFORM → HR Letters

---

## Overview

Lets the Enterprise define **reusable HR letter templates** that Organizations
can generate per-employee letters from. Two flavors:

- **External Offer Letter Templates** — used during hiring (offer rollout to
  candidates before they're employees)
- **Internal HR Letter Templates** — used post-hire (appointment, promotion,
  appraisal, NOC, experience letter, termination, etc.)

The Org-side counterpart (under ADMIN → HR Letters) is where actual letters
get generated for specific employees / candidates by filling in placeholders.
This PRD covers ONLY the template side (Platform). The generation side will
get its own PRD when the ADMIN module is built.

---

## Tech Stack

- **Framework**: NestJS (TypeORM, PostgreSQL)
- **Auth**: JwtAuthGuard + `@LoggedInUser()` (`appId = PLATFORM`)
- **Pattern**: Repository → Service → Controller
- **Templating**: Handlebars (`{{variable}}` placeholders) over sanitized HTML
- **PDF rendering**: deferred to the org-side generation flow (out of scope here)
- **Tenancy**: `enterprise_id = jwt.enterpriseId`

---

## Scope

### In Scope (V1)

- List + filter templates by category (offer / internal)
- Create / Edit / Archive a template
- Rich-text body with `{{placeholder}}` syntax
- Define + validate a placeholder schema per template (which variables are required, their type, sample value)
- Preview rendering with sample data
- Clone a template
- Mark as "default for category" (one per Enterprise per category)
- Per-letter-type sub-categorization (appointment / promotion / experience / NOC / termination / appraisal / custom)

### Out of Scope (V1)

- Multi-language templates (one language per template; create separate templates per language)
- Conditional sections (`{{#if probation}} ... {{/if}}` — keep V1 to simple variable substitution)
- Inline signature / stamp upload (handled at generation time)
- Version history with diff view
- Auto-import "starter pack" templates from a global catalog

---

## User Roles

| Role                  | Access                                  |
|-----------------------|------------------------------------------|
| PLATFORM_SUPER_ADMIN  | Full                                     |
| Custom Platform role  | Subject to `module_access` on `PLAT_OFFER_TEMPLATES` / `PLAT_INTERNAL_TEMPLATES` |

| Endpoint group  | RequirePermission                                            |
|-----------------|--------------------------------------------------------------|
| Offer templates | `PLAT_OFFER_TEMPLATES.{view,create,update,delete,archive}`   |
| Internal templates | `PLAT_INTERNAL_TEMPLATES.{view,create,update,delete,archive}` |

---

## Template Lifecycle

```
DRAFT → ACTIVE ──archive──► ARCHIVED
```

- `DRAFT` — visible to platform admins, NOT selectable on the org side
- `ACTIVE` — selectable when generating an actual letter
- `ARCHIVED` — hidden from new generation; existing generated letters keep working (they store a snapshot of the body at generation time)

---

## Database Schema (NEW TABLES)

### hr_letter_template

| Column            | Type                                            | Notes                                            |
|-------------------|-------------------------------------------------|--------------------------------------------------|
| id                | UUID PK                                         | BaseEntity                                       |
| enterprise_id     | UUID NOT NULL                                   | scoping                                          |
| organization_id   | NULL (unused)                                   |                                                  |
| category          | ENUM('OFFER','INTERNAL') NOT NULL               |                                                  |
| letter_type       | ENUM (see enums below) NOT NULL                 | sub-category within category                     |
| name              | VARCHAR(255) NOT NULL                           | display name (e.g. "Senior Engineer Offer v2")   |
| description       | TEXT                                            |                                                  |
| body_html         | LONGTEXT NOT NULL                               | sanitized rich text with `{{placeholder}}` tokens|
| status            | ENUM (DRAFT/ACTIVE/ARCHIVED) DEFAULT 'DRAFT'    | reuses `status` from BaseEntity logical wrapper  |
| is_default        | BOOLEAN DEFAULT false                           | default for (enterprise, category, letter_type)  |
| version           | INT NOT NULL DEFAULT 1                          | incremented on each save                         |

**Unique**: `(enterprise_id, name)` and partial unique `(enterprise_id, category, letter_type) WHERE is_default = true AND deleted_at IS NULL`

### hr_letter_template_variable

The list of placeholders a template expects. Used to validate the data
payload at generation time and to power a "fill in" form in the org UI.

| Column                   | Type                                     | Notes                                       |
|--------------------------|------------------------------------------|---------------------------------------------|
| id                       | UUID PK                                  | BaseEntity                                  |
| hr_letter_template_id    | UUID NOT NULL FK                         | → hr_letter_template.id (CASCADE)           |
| key                      | VARCHAR(100) NOT NULL                    | `candidate_name`, `joining_date`, etc.      |
| label                    | VARCHAR(255) NOT NULL                    | UI label for the fill-in form               |
| data_type                | ENUM('STRING','NUMBER','DATE','MONEY','BOOLEAN','LIST') NOT NULL |                        |
| is_required              | BOOLEAN DEFAULT true                     |                                             |
| sample_value             | TEXT NULL                                | used for preview rendering                  |
| source                   | ENUM('MANUAL','EMPLOYEE','CANDIDATE','ORGANIZATION') | hint to the UI to auto-fill from existing data |

**Unique**: `(hr_letter_template_id, key)`

---

## API Endpoints

Prefix: `/api/v1/platform/hr-letters`

| Method | Path                              | Description                              | Permission                          |
|--------|-----------------------------------|------------------------------------------|-------------------------------------|
| GET    | /                                 | List templates (filter: category, type)  | `PLAT_OFFER_TEMPLATES.view` or `PLAT_INTERNAL_TEMPLATES.view` (resolved per category) |
| GET    | /:id                              | Detail (template + variables)            | (same as above)                     |
| POST   | /                                 | Create template                          | `.create`                           |
| PUT    | /:id                              | Update (creates a new version)           | `.update`                           |
| POST   | /:id/publish                      | DRAFT → ACTIVE                           | `.update`                           |
| POST   | /:id/archive                      | ACTIVE → ARCHIVED                        | `.archive`                          |
| POST   | /:id/clone                        | Duplicate with name suffix " (copy)"     | `.create`                           |
| POST   | /:id/set-default                  | Mark default for (category, letter_type) | `.update`                           |
| POST   | /:id/preview                      | Render the body with sample / provided data | `.view`                          |
| POST   | /:id/variables                    | Add a variable                           | `.update`                           |
| PUT    | /:id/variables/:variableId        | Update a variable                        | `.update`                           |
| DELETE | /:id/variables/:variableId        | Delete a variable                        | `.update`                           |

The controller resolves `category` from the path / query to decide which
permission to enforce (`PLAT_OFFER_TEMPLATES` vs `PLAT_INTERNAL_TEMPLATES`) —
implemented as a small helper inside the controller, not a separate decorator.

---

## Request / Response Contracts

### POST /api/v1/platform/hr-letters

**Request**

```json
{
  "category": "INTERNAL",
  "letter_type": "APPOINTMENT",
  "name": "Standard Appointment Letter",
  "description": "Used for full-time hires after probation",
  "body_html": "<p>Dear {{employee_name}}, we are pleased to confirm your appointment as {{designation}} effective {{joining_date}}...</p>",
  "variables": [
    { "key": "employee_name", "label": "Employee Name", "data_type": "STRING", "is_required": true, "source": "EMPLOYEE" },
    { "key": "designation", "label": "Designation", "data_type": "STRING", "is_required": true, "source": "EMPLOYEE" },
    { "key": "joining_date", "label": "Joining Date", "data_type": "DATE", "is_required": true, "source": "EMPLOYEE" },
    { "key": "ctc", "label": "Annual CTC", "data_type": "MONEY", "is_required": true, "source": "MANUAL", "sample_value": "1200000" }
  ]
}
```

**Response**

```json
{
  "success": true,
  "data": { "id": "uuid", "status": "DRAFT", "version": 1 }
}
```

### POST /api/v1/platform/hr-letters/:id/preview

**Request**

```json
{
  "data": {
    "employee_name": "Sara Khan",
    "designation": "Senior Engineer",
    "joining_date": "2026-06-01",
    "ctc": 1500000
  }
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "rendered_html": "<p>Dear Sara Khan, we are pleased to confirm your appointment as Senior Engineer effective 01 Jun 2026...</p>",
    "missing_variables": [],
    "warnings": []
  }
}
```

If `data` is omitted, the server renders with each variable's `sample_value`.
Missing required variables → 422 with the list.

---

## Module Structure

```
src/modules/platform-hr-letters/
├── controllers/
│   └── hr-letter-templates.controller.ts
├── services/
│   ├── hr-letter-templates.service.ts        # CRUD + lifecycle
│   ├── hr-letter-variables.service.ts        # variable schema CRUD
│   └── hr-letter-renderer.service.ts         # Handlebars compile + format helpers
├── entities/
│   ├── hr-letter-template.entity.ts
│   └── hr-letter-template-variable.entity.ts
├── dto/
│   ├── create-template.dto.ts
│   ├── update-template.dto.ts
│   ├── upsert-variable.dto.ts
│   └── preview-template.dto.ts
└── platform-hr-letters.module.ts
```

---

## Service Logic

### `HrLetterTemplatesService.create(user, dto)`

1. Validate template name unique per `(enterprise_id, name)`.
2. Sanitize `body_html` (strip script/style tags, allow standard formatting + `<a>`).
3. Extract placeholder tokens from `body_html` (regex `\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}`) and confirm every token has a matching `variables[].key` — otherwise 422.
4. Insert `hr_letter_template` row with `status = DRAFT`, `version = 1`.
5. Insert each `hr_letter_template_variable` row.
6. Audit log.

### `HrLetterTemplatesService.update(user, id, dto)`

- Same validation as create.
- Bump `version` by 1.
- For variables, full-replace: delete old + insert new (template is in DRAFT or only-light-edited use case).
- If `status = ACTIVE` and the variable schema is changing in a non-additive way (deletes / type changes), warn or block — V1 just blocks: "Archive and create a new template for breaking changes."

### `HrLetterRendererService.render(templateBody, variables, data)`

1. Compile body with Handlebars (cached per template id + version).
2. For each declared variable:
   - Pick `data[key]` if present, else `sample_value`.
   - Format per `data_type` (MONEY → currency-format, DATE → `dd MMM yyyy`).
3. Render.
4. Return `{ rendered_html, missing_variables, warnings }`.

### `HrLetterTemplatesService.setDefault(id)`

1. Load template; reject if not `ACTIVE`.
2. In a transaction, set all other templates with the same `(enterprise_id, category, letter_type)` to `is_default = false`, then set this one `true`.
3. Partial unique index makes step 2 atomic-safe.

---

## Enums

```typescript
export enum LetterCategory {
  OFFER    = 'OFFER',
  INTERNAL = 'INTERNAL',
}

export enum LetterType {
  // OFFER
  OFFER_STANDARD     = 'OFFER_STANDARD',
  OFFER_INTERN       = 'OFFER_INTERN',
  OFFER_CONTRACTOR   = 'OFFER_CONTRACTOR',
  // INTERNAL
  APPOINTMENT        = 'APPOINTMENT',
  PROMOTION          = 'PROMOTION',
  APPRAISAL          = 'APPRAISAL',
  EXPERIENCE         = 'EXPERIENCE',
  RELIEVING          = 'RELIEVING',
  NOC                = 'NOC',
  WARNING            = 'WARNING',
  TERMINATION        = 'TERMINATION',
  CUSTOM             = 'CUSTOM',
}

export enum LetterTemplateStatus {
  DRAFT    = 'DRAFT',
  ACTIVE   = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum LetterVariableType {
  STRING  = 'STRING',
  NUMBER  = 'NUMBER',
  DATE    = 'DATE',
  MONEY   = 'MONEY',
  BOOLEAN = 'BOOLEAN',
  LIST    = 'LIST',
}

export enum LetterVariableSource {
  MANUAL       = 'MANUAL',
  EMPLOYEE     = 'EMPLOYEE',
  CANDIDATE    = 'CANDIDATE',
  ORGANIZATION = 'ORGANIZATION',
}
```

---

## Security notes

- `body_html` MUST be sanitized server-side on save (DOMPurify-equivalent via
  `sanitize-html` package). Never trust client-side sanitization alone.
- Handlebars must run with `noEscape: false` (default) so any data values are
  HTML-escaped — except known-safe pre-rendered fragments (none in V1).
- Strict CSP on the preview render endpoint to prevent stored-XSS via templates.

---

## Open questions / future work

- **Generated letters table** (`hr_letter`) — lives in the ADMIN HR Letters
  module and stores per-employee renders. Out of this PRD's scope.
- **Conditional sections** — Handlebars `{{#if}}` blocks. Add when first
  customer asks.
- **Multi-language** — model: each language is its own template + a
  `language_code` column.
- **Signature & stamp** — image uploads embedded at generation time.
- **Approval workflow** — letters that require manager / HR sign-off before
  sending. Add later if needed.
