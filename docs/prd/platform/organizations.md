# Tech PRD — Platform Organizations

## Module: PLATFORM → Organizations

---

## Overview

Lets an Enterprise-level admin browse, inspect, and operate on every
Organization belonging to the current Enterprise. Read-heavy with a small set
of mutating "operator" actions: suspend / reactivate, change plan, force
password reset, transfer ownership. Scoped strictly to the caller's
`enterprise_id` — a Brello operator can only see Brello's orgs.

---

## Tech Stack

- **Framework**: NestJS (TypeORM, PostgreSQL)
- **Auth**: JWT via JwtAuthGuard + `@LoggedInUser()` (must have `appId = PLATFORM`)
- **Pattern**: Repository → Service → Controller
- **Tenancy**: every query filters by `organization.enterprise_id = jwt.enterpriseId`

---

## Scope

### In Scope (V1)

**Organization List**
- Paginated table of orgs under the current enterprise
- Filter by status (active / suspended), plan, search by name/subdomain
- Sort by name, created_at, user_count, plan_name
- Per-row quick stats: user count, current plan, subscription status, last activity

**Organization Details**
- Profile: name, subdomain, industry, contact owner, created date
- Subscription: current plan, status (Active / Expired / Cancelled), start/end date, days remaining
- Users: top 10 most recent users + count by role
- Activity: last login across all users, recent audit_log events for this org
- Apps enabled: which apps from `enterprise_app` are active for this enterprise (read-only)
- Plan apps: which apps the org's plan includes (read-only)

**Operator actions**
- **Suspend** an org — sets `organization.status = 'SUSPENDED'`, blocks logins from its users
- **Reactivate** — restores status to ACTIVE
- **Change plan** — updates `organization_subscription.plan_id`, end_date pushed forward by configurable window (default 30 days)
- **Resend onboarding** — re-sends the initial welcome email to the owner user
- **Force password reset** — invalidates user sessions, sends reset link to owner

Every mutating action writes an `audit_log` row keyed by `target_organization_id`
and `actor_user_id`.

### Out of Scope (V1)

- Hard delete of an Organization (suspend only)
- Bulk operations (multi-select suspend / plan change)
- Editing organization profile fields from the Platform side (org admins do this themselves)
- Direct user management — handled in a future Platform Users sub-module
- Billing / invoice history per org — depends on `invoice` table not yet in schema
- "Impersonate" / "View as" — security review needed before exposing

---

## User Roles

| Role                   | Access                                                       |
|------------------------|--------------------------------------------------------------|
| PLATFORM_SUPER_ADMIN   | Full — view + all operator actions                           |
| Custom Platform role   | Subject to `module_access` on `PLAT_ORG_LIST` / `PLAT_ORG_DETAILS` per action |

Permission mapping per endpoint:

| Endpoint                  | RequirePermission                              |
|---------------------------|------------------------------------------------|
| List / detail (read)      | `PLAT_ORG_LIST.view` / `PLAT_ORG_DETAILS.view` |
| Suspend / reactivate      | `PLAT_ORG_DETAILS.update`                      |
| Change plan               | `PLAT_ORG_DETAILS.update`                      |
| Resend onboarding         | `PLAT_ORG_DETAILS.update`                      |
| Force password reset      | `PLAT_ORG_DETAILS.update`                      |

---

## Organization Lifecycle (from Platform view)

```
ACTIVE ──suspend──► SUSPENDED ──reactivate──► ACTIVE
   │
   └─ plan changes are independent of status; an Active org's plan
      can swap between STANDARD ↔ PREMIUM at any time
```

`organization.status` enum: `ACTIVE | SUSPENDED | DELETED` (DELETED is for soft
delete via `deleted_at`, never set directly through these endpoints).

---

## Data Sources

Reads / writes from existing tables only — no new schema for V1.

| Table                      | Used for                                                                |
|----------------------------|-------------------------------------------------------------------------|
| `organizations`            | Listing, status updates                                                 |
| `organization_profile`     | Industry, address, contact details                                      |
| `organization_subscription`| Plan, status, dates                                                     |
| `plan` (+ `plan_app`)      | Plan name, included apps                                                |
| `users`                    | User count, recent users, owner contact                                 |
| `user_role_map` + `role`   | Role breakdown per org                                                  |
| `enterprise_app`           | What apps the Enterprise has provisioned (relevant for plan changes)    |
| `audit_log`                | Recent events feed; one row written per operator action                 |

---

## API Endpoints

Prefix: `/api/v1/platform/organizations`

| Method | Path                          | Description                                       | Permission                   |
|--------|-------------------------------|---------------------------------------------------|------------------------------|
| GET    | /                             | List orgs (paginated, filtered)                   | `PLAT_ORG_LIST.view`         |
| GET    | /:id                          | Org detail (profile + subscription + users + apps)| `PLAT_ORG_DETAILS.view`      |
| POST   | /:id/suspend                  | Suspend org                                       | `PLAT_ORG_DETAILS.update`    |
| POST   | /:id/reactivate               | Reactivate org                                    | `PLAT_ORG_DETAILS.update`    |
| POST   | /:id/change-plan              | Change org's plan                                 | `PLAT_ORG_DETAILS.update`    |
| POST   | /:id/resend-onboarding        | Resend welcome email to owner                     | `PLAT_ORG_DETAILS.update`    |
| POST   | /:id/owner/force-password-reset | Force owner to reset password                   | `PLAT_ORG_DETAILS.update`    |

---

## Request / Response Contracts

### GET /api/v1/platform/organizations

**Query params**

| Param        | Type             | Notes                                          |
|--------------|------------------|------------------------------------------------|
| page         | int (default 1)  |                                                |
| limit        | int (default 20, max 100) |                                       |
| status       | `ACTIVE` \| `SUSPENDED` | optional                                |
| plan_id      | UUID             | optional                                       |
| search       | string           | matches `name` or `subdomain` (ILIKE)          |
| sort         | `name` \| `created_at` \| `user_count` | default `created_at` desc |
| order        | `asc` \| `desc`  | default `desc`                                 |

**Response**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Acme Corp",
        "subdomain": "acme",
        "status": "ACTIVE",
        "plan_id": "uuid",
        "plan_name": "PREMIUM",
        "subscription_status": "ACTIVE",
        "subscription_end_date": "2026-12-31T00:00:00Z",
        "user_count": 87,
        "owner_email": "founder@acme.test",
        "created_at": "2025-09-12T08:00:00Z",
        "last_user_login_at": "2026-05-17T10:24:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 42 }
  }
}
```

### GET /api/v1/platform/organizations/:id

**Response**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "subdomain": "acme",
    "status": "ACTIVE",
    "created_at": "2025-09-12T08:00:00Z",
    "profile": {
      "industry_type_id": "uuid",
      "industry_name": "Software & IT",
      "country": "IN",
      "address_line1": "...",
      "contact_phone": "+91..."
    },
    "owner": {
      "user_id": "uuid",
      "name": "Founder Acme",
      "email": "founder@acme.test",
      "last_login_at": "2026-05-17T10:24:00Z"
    },
    "subscription": {
      "plan_id": "uuid",
      "plan_name": "PREMIUM",
      "status": "ACTIVE",
      "start_date": "2025-09-12T08:00:00Z",
      "end_date": "2026-12-31T00:00:00Z",
      "days_remaining": 228
    },
    "user_stats": {
      "total": 87,
      "by_role": [
        { "role_name": "Super Admin", "count": 2 },
        { "role_name": "HR Admin", "count": 4 },
        { "role_name": "Employee", "count": 81 }
      ]
    },
    "apps_enabled": [
      { "app_id": "uuid", "app_name": "ADMIN" },
      { "app_id": "uuid", "app_name": "EMPLOYEE" }
    ],
    "recent_users": [
      { "id": "uuid", "name": "...", "email": "...", "created_at": "..." }
    ],
    "recent_activity": [
      {
        "id": "uuid",
        "action": "USER_INVITED",
        "actor_email": "founder@acme.test",
        "created_at": "2026-05-15T11:00:00Z"
      }
    ]
  }
}
```

### POST /api/v1/platform/organizations/:id/suspend

**Request**

```json
{ "reason": "Payment overdue" }
```

**Response**

```json
{
  "success": true,
  "message": "Organization suspended",
  "data": { "id": "uuid", "status": "SUSPENDED" }
}
```

### POST /api/v1/platform/organizations/:id/change-plan

**Request**

```json
{
  "plan_id": "uuid",
  "effective_immediately": true,
  "extend_days": 30
}
```

**Response**

```json
{
  "success": true,
  "message": "Plan changed successfully",
  "data": {
    "organization_id": "uuid",
    "new_plan_id": "uuid",
    "subscription_status": "ACTIVE",
    "new_end_date": "2026-06-17T00:00:00Z"
  }
}
```

---

## Module Structure

```
src/modules/platform-organizations/
├── controllers/
│   └── platform-organizations.controller.ts
├── services/
│   ├── platform-organizations.service.ts          # list, detail
│   ├── platform-organization-actions.service.ts   # suspend, reactivate, change-plan, etc.
│   └── platform-organization-audit.service.ts     # writes audit_log for each action
├── repositories/
│   └── platform-organizations.repository.ts
├── dto/
│   ├── list-organizations.query.dto.ts
│   ├── change-plan.dto.ts
│   ├── suspend-organization.dto.ts
│   └── organization-detail.response.dto.ts
└── platform-organizations.module.ts
```

---

## Service Logic

### `PlatformOrganizationsService.list(user, query)`

1. Build base query: `organizations` filtered by `enterprise_id = user.enterpriseId` and `deleted_at IS NULL`.
2. Apply optional `status`, `plan_id` (via join to `organization_subscription`), and `search` (ILIKE).
3. Sort + paginate.
4. Per row, compute aggregates in a single SQL: `user_count`, `last_user_login_at`, owner email (via the user with the SUPER_ADMIN role for the org), plan name.
5. Return `items + pagination` shape.

### `PlatformOrganizationsService.detail(user, id)`

1. Find org by id; assert `enterprise_id` match — else 404 (not 403, to avoid leaking existence).
2. Fire parallel queries:
   - `organization_profile` (left join — may be absent)
   - `organization_subscription` (latest by start_date)
   - `users` aggregate by role for `user_stats`
   - `users` ordered by created_at desc limit 5 for `recent_users`
   - Owner user (first user with SUPER_ADMIN role)
   - `enterprise_app` for app list
   - `audit_log` last 10 rows where `target_organization_id = id`
3. Compute `subscription.days_remaining` from `end_date - now()`.
4. Assemble response.

### `PlatformOrganizationActionsService.suspend(user, id, reason)`

1. Load org (guard `enterprise_id`).
2. If already `SUSPENDED` → 409 Conflict.
3. Update `organization.status = 'SUSPENDED'`, `modified_by = user.userId`, `modified_at = now()`.
4. Write `audit_log` row: action `ORG_SUSPENDED`, target_organization_id, actor_user_id, `metadata = { reason }`.
5. Optional: emit a domain event so the auth module can invalidate active sessions for users in that org (V1 acceptable to rely on the login-time status check).
6. Return updated org snippet.

### `PlatformOrganizationActionsService.changePlan(user, id, dto)`

1. Load org + current subscription (guard `enterprise_id`).
2. Validate `dto.plan_id` exists in `plan` and is `ACTIVE`.
3. Validate the new plan's `plan_app` set is compatible with the apps the org's users have role mappings in (warn but don't block — orgs may lose access to apps they've been using).
4. If `effective_immediately = true`:
   - Mark current subscription as `EXPIRED` if it isn't already.
   - Insert a new `organization_subscription` row with `plan_id = dto.plan_id`, `start_date = now()`, `end_date = now() + extend_days`, `sub_status = ACTIVE`.
5. Else: schedule the change at the current `end_date` (V1: just store a pending row with `start_date = current end_date`).
6. Write `audit_log` row: action `PLAN_CHANGED`, metadata `{ from: oldPlanId, to: newPlanId }`.
7. Return new subscription snapshot.

### `PlatformOrganizationActionsService.resendOnboarding(user, id)`

1. Resolve owner user (first user with SUPER_ADMIN role for the org).
2. Call `EmailNotificationService.sendOrgOnboardingEmail(owner)`.
3. Write `audit_log` row: `ONBOARDING_RESENT`.

### `PlatformOrganizationActionsService.forcePasswordReset(user, id)`

1. Resolve owner user.
2. Invalidate any active sessions (`sessions` table delete by user_id) or bump `users.token_version`.
3. Generate a password-reset token, store in `otps` (or whatever the reset flow uses), email the owner.
4. Write `audit_log` row: `OWNER_PASSWORD_RESET_FORCED`.

---

## Enums

```typescript
export enum OrganizationStatus {
  ACTIVE    = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED   = 'DELETED',
}

export enum PlatformOrgAction {
  ORG_SUSPENDED              = 'ORG_SUSPENDED',
  ORG_REACTIVATED            = 'ORG_REACTIVATED',
  PLAN_CHANGED               = 'PLAN_CHANGED',
  ONBOARDING_RESENT          = 'ONBOARDING_RESENT',
  OWNER_PASSWORD_RESET_FORCED = 'OWNER_PASSWORD_RESET_FORCED',
}
```

---

## Validation / Guards

- Every endpoint MUST verify `org.enterprise_id === user.enterpriseId` and return **404** (not 403) on mismatch, to avoid leaking the existence of other Enterprises' organizations.
- A SUSPENDED org cannot have its plan changed — return 422 with a clear message; the operator must reactivate first.
- The auth flow (`AuthService.loginWithOtp`) must reject logins for users whose org is `SUSPENDED` (separate from this module but a required dependency).

---

## Open questions / future work

- **View-as / impersonation**: deferred until a token-exchange flow + audit-trail design is agreed upon.
- **Bulk operations**: out of scope for V1; revisit when the Enterprise has > 100 orgs.
- **Billing tab in org detail**: depends on `invoice` and `payment` tables landing.
- **Custom plan overrides per org**: links to the `organization_feature_override` table proposed in Feature Management.
