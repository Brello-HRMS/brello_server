# Tech PRD — Platform Plans

## Module: PLATFORM → Plans

---

## Overview

Lets an Enterprise admin define and configure the subscription plans the
Enterprise sells (e.g. `STANDARD`, `PREMIUM`). A plan is a bundle of:
- one or more **apps** the customer organization gets access to (`plan_app`)
- a set of **modules** within those apps (`plan_module`)
- per-(module × action) **enabled flags** that act as the ceiling on what any
  role inside an org can do (`plan_module_action`)

The Platform UI surfaces a Plan List for quick browsing and a Plan Configuration
screen for the matrix-style action toggles.

---

## Tech Stack

- **Framework**: NestJS (TypeORM, PostgreSQL)
- **Auth**: JwtAuthGuard + `@LoggedInUser()` (`appId = PLATFORM`)
- **Pattern**: Repository → Service → Controller
- **Tenancy**: plans are global to the platform today. If we go multi-Enterprise
  reseller, plans will become enterprise-scoped (`plan.enterprise_id`).
  V1 treats `enterprise_id IS NULL` as "platform-owned plan"; Brello's plans
  are shared until a reseller customizes.

---

## Scope

### In Scope (V1)

- List plans with org-count, price, status
- Create / Edit / Archive a plan
- Configure `plan_app` set (which apps this plan unlocks)
- Configure `plan_module` set (which modules under each app)
- Toggle `plan_module_action.enabled` per `(module, action)` pair — matrix UI
- Bulk-toggle helpers: "enable all actions on module", "disable entire module"
- Read-only preview of orgs currently on the plan

### Out of Scope (V1)

- Pricing tiers per region / currency
- Discount coupons / promo codes
- Trial-period configuration per plan
- Hard delete of a plan in use (archive only)
- Migration tooling for "move every org from plan A → plan B"
- Plan versioning (changes are applied immediately to every org on the plan)

---

## User Roles

| Role                  | Access                                              |
|-----------------------|-----------------------------------------------------|
| PLATFORM_SUPER_ADMIN  | Full                                                |
| Custom Platform role  | Subject to `module_access` on `PLAT_PLAN_LIST` / `PLAT_PLAN_CONFIG` |

| Endpoint               | RequirePermission                  |
|------------------------|------------------------------------|
| List / Detail (read)   | `PLAT_PLAN_LIST.view`              |
| Create                 | `PLAT_PLAN_LIST.create`            |
| Update plan metadata   | `PLAT_PLAN_LIST.update`            |
| Archive                | `PLAT_PLAN_LIST.archive`           |
| Configure modules/actions | `PLAT_PLAN_CONFIG.update`       |

---

## Plan Lifecycle

```
DRAFT → ACTIVE ──archive──► ARCHIVED
```

- `DRAFT` — plan visible to platform admin but not selectable on lead-register.
- `ACTIVE` — surfaced on the public/lead signup flow.
- `ARCHIVED` — hidden from new signups; existing org subscriptions keep working.

`plan.status` reuses the BaseEntity `Status` enum (`ACTIVE` / `INACTIVE`).
A simple flag `plan.is_published` (boolean) gates whether it shows up on the
signup form. (V1 short-cut — no extra enum.)

---

## Data Sources

Existing tables — no new schema:

| Table                | Used for                                       |
|----------------------|------------------------------------------------|
| `plan`               | Plan rows (name, price, description, status)   |
| `plan_app`           | Apps unlocked by a plan                        |
| `plan_module`        | Modules unlocked by a plan                     |
| `plan_module_action` | Per-action toggles (the ceiling matrix)        |
| `organization_subscription` | Org-count, "in use" guard for archival    |
| `app`, `modules`, `actions` | Lookup for the matrix UI                |

One small addition: `plan.is_published BOOLEAN NOT NULL DEFAULT false` — to be
added via TypeORM synchronize next boot.

---

## API Endpoints

Prefix: `/api/v1/platform/plans`

| Method | Path                   | Description                              | Permission                  |
|--------|------------------------|------------------------------------------|-----------------------------|
| GET    | /                      | List plans (with org-count summary)      | `PLAT_PLAN_LIST.view`       |
| GET    | /:id                   | Plan detail + apps/modules/actions matrix | `PLAT_PLAN_LIST.view`      |
| POST   | /                      | Create plan                              | `PLAT_PLAN_LIST.create`     |
| PUT    | /:id                   | Update plan metadata (name, price, etc.) | `PLAT_PLAN_LIST.update`     |
| POST   | /:id/publish           | Publish (set `is_published = true`)      | `PLAT_PLAN_LIST.update`     |
| POST   | /:id/unpublish         | Unpublish                                | `PLAT_PLAN_LIST.update`     |
| POST   | /:id/archive           | Archive (block new subs, keep existing)  | `PLAT_PLAN_LIST.archive`    |
| PUT    | /:id/apps              | Set the `plan_app` list                  | `PLAT_PLAN_CONFIG.update`   |
| PUT    | /:id/modules           | Bulk-set `plan_module` + `plan_module_action` matrix | `PLAT_PLAN_CONFIG.update` |
| GET    | /:id/subscribers       | Orgs currently on this plan              | `PLAT_PLAN_LIST.view`       |

---

## Request / Response Contracts

### GET /api/v1/platform/plans

**Response**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "STANDARD",
        "price": 999,
        "is_published": true,
        "status": "ACTIVE",
        "org_count": 28,
        "app_count": 2,
        "module_count": 49
      }
    ]
  }
}
```

### GET /api/v1/platform/plans/:id

**Response** — full configuration including matrix:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "STANDARD",
    "description": "...",
    "price": 999,
    "discount": 0,
    "features": ["Up to 50 users", "Email support"],
    "is_published": true,
    "status": "ACTIVE",
    "apps": [
      { "app_id": "uuid", "app_name": "ADMIN", "is_active": true },
      { "app_id": "uuid", "app_name": "EMPLOYEE", "is_active": true }
    ],
    "modules": [
      {
        "module_id": "uuid",
        "module_code": "DASHBOARD",
        "module_name": "Dashboard",
        "app_id": "uuid",
        "enabled": true,
        "actions": [
          { "action_id": "uuid", "action_name": "View", "enabled": true }
        ]
      }
    ]
  }
}
```

### PUT /api/v1/platform/plans/:id/modules

**Request** — replace the matrix in one shot:

```json
{
  "modules": [
    {
      "module_id": "uuid",
      "enabled": true,
      "actions": [
        { "action_id": "uuid", "enabled": true },
        { "action_id": "uuid", "enabled": false }
      ]
    }
  ]
}
```

**Response**

```json
{
  "success": true,
  "message": "Plan configuration updated",
  "data": {
    "plan_id": "uuid",
    "modules_updated": 49,
    "actions_updated": 1078
  }
}
```

---

## Module Structure

```
src/modules/platform-plans/
├── controllers/
│   └── platform-plans.controller.ts
├── services/
│   ├── platform-plans.service.ts          # CRUD + lifecycle (publish/archive)
│   └── platform-plan-config.service.ts    # apps/modules/actions matrix
├── repositories/
│   └── platform-plans.repository.ts
├── dto/
│   ├── create-plan.dto.ts
│   ├── update-plan.dto.ts
│   ├── set-plan-apps.dto.ts
│   └── set-plan-modules.dto.ts
└── platform-plans.module.ts
```

---

## Service Logic

### `PlatformPlansService.list()`

- `LEFT JOIN organization_subscription` aggregate `org_count` per plan.
- `LEFT JOIN plan_app`, `plan_module` for counts.
- Single query, no N+1.

### `PlatformPlansService.archive(id)`

1. Load plan; error if already archived.
2. Block archival if there are `organization_subscription` rows with `sub_status = ACTIVE` referencing this plan — return 422 with the count and require explicit reassignment.
   - Configurable override flag for force-archive (super-admin only).
3. Set `status = INACTIVE`, `is_published = false`.
4. Write `audit_log` row.

### `PlatformPlanConfigService.setModules(planId, payload)`

1. Validate every `module_id` exists and the user's enterprise is allowed to grant it (sanity check).
2. In a transaction:
   - Upsert each module's `plan_module.enabled`.
   - For each module's `actions`, upsert `plan_module_action.enabled` rows.
   - Delete rows that exist in DB but aren't in the payload (full-replace semantics).
3. Commit; return counts of updated rows.
4. Write `audit_log` row: `PLAN_MATRIX_UPDATED`.

### Effects on existing organizations

Because permission resolution always reads `plan_module_action` at runtime, a
matrix change takes effect **immediately** for every org on the plan. No
backfill needed. This is intentional but worth surfacing in the UI ("This
change affects 28 organizations").

---

## Enums

No new enums — reuses `Status` from `common/enums`.

---

## Open questions / future work

- **Plan versioning** — if an org should keep its old plan's rules after a
  config change, we need versioned `plan_module_action` rows + a snapshot at
  subscription time. Out of V1.
- **Reseller-Enterprise plans** — when we white-label, do they get isolated
  plan rows or inherit Brello's? V1 assumes shared / platform-owned.
- **Pricing complexity** — flat price today. Future: per-seat, usage-based,
  region-specific.
