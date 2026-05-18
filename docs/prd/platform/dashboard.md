# Tech PRD — Platform Dashboard

## Module: PLATFORM → Dashboard

---

## Overview

The first screen an Enterprise-level admin (e.g. a Brello platform operator)
sees on login. Surfaces aggregate health and activity across every Organization
that belongs to the current Enterprise — total org count, active subscriptions,
recently active orgs, plan distribution, MRR-style metrics, and recent platform
events. Read-only; pure aggregation over existing tables.

---

## Tech Stack

- **Framework**: NestJS (TypeORM, PostgreSQL)
- **Auth**: JWT via JwtAuthGuard + `@LoggedInUser()` (must have `appId = PLATFORM`)
- **Pattern**: Repository → Service → Controller
- **Caching**: short TTL (60s) in-memory cache per `(enterprise_id, metric)` to absorb dashboard refresh thrashing

---

## Scope

### In Scope (V1)

**Overview tile-set** — counters with deltas:
- Total Organizations (active / suspended)
- Total Users across orgs
- Active Subscriptions
- Trial Subscriptions ending within 7 days
- New Organizations this month (vs. previous month)
- Plan distribution (orgs per plan)
- Recently active organizations (top 5 by last login)
- Recent platform audit events (last 10 from `audit_log`)

**Key Metrics tab** — time-series widgets:
- Organizations created over time (line, last 12 months)
- Plan adoption over time (stacked bar, last 12 months)
- Subscription status breakdown (donut: Active / Expired / Cancelled)
- User growth (line, last 12 months — sum of users across all orgs)

### Out of Scope (V1)

- Real-time websocket updates (poll-based refresh only)
- Per-organization drill-down (handled in the Organizations module)
- Revenue / payment metrics (depends on `invoice` / `payment` tables which don't exist yet)
- Customizable widget layout
- Exporting metrics to CSV / PDF
- Email-scheduled digests

---

## User Roles

| Role                  | Access                                                |
|-----------------------|-------------------------------------------------------|
| PLATFORM_SUPER_ADMIN  | View all dashboard widgets                            |
| Custom Platform role  | Subject to `module_access` on PLAT_OVERVIEW / PLAT_KEY_METRICS with `view` action |

All endpoints require `@RequirePermission('PLAT_OVERVIEW', 'view')` or
`@RequirePermission('PLAT_KEY_METRICS', 'view')` as appropriate.

---

## Data Sources

No new tables. Pure aggregation over:

| Source table              | Used for                                                              |
|---------------------------|-----------------------------------------------------------------------|
| `organizations`           | Total orgs, active vs suspended, new this month, recently active      |
| `organization_subscription` | Active / Trial / Expired counts, trial-ending-soon list             |
| `plan`                    | Joined for plan-name display                                          |
| `users`                   | Total user count, active users in last N days                         |
| `audit_log`               | Recent platform events feed                                           |

All queries filter by `organization.enterprise_id = <jwt.enterpriseId>`.

---

## API Endpoints

Prefix: `/api/v1/platform/dashboard`

| Method | Path             | Description                                              | Permission                       |
|--------|------------------|----------------------------------------------------------|----------------------------------|
| GET    | /overview        | Tile counters + recently-active orgs + recent audit feed | `PLAT_OVERVIEW.view`             |
| GET    | /key-metrics     | Time-series widgets for orgs / plans / users / subs      | `PLAT_KEY_METRICS.view`          |

Both endpoints take an optional `?range=30d|90d|12m` query param (default `12m`
for key-metrics, ignored for overview).

---

## Request / Response Contracts

### GET /api/v1/platform/dashboard/overview

**Response**

```json
{
  "success": true,
  "data": {
    "counters": {
      "total_organizations": { "value": 42, "delta_vs_last_month": +5 },
      "active_organizations": 38,
      "suspended_organizations": 4,
      "total_users": 1267,
      "active_subscriptions": 36,
      "trial_subscriptions": 6,
      "trials_ending_soon": 2,
      "new_organizations_this_month": 5
    },
    "plan_distribution": [
      { "plan_id": "uuid", "plan_name": "STANDARD", "org_count": 28 },
      { "plan_id": "uuid", "plan_name": "PREMIUM",  "org_count": 14 }
    ],
    "recently_active_organizations": [
      {
        "id": "uuid",
        "name": "Acme Corp",
        "plan_name": "PREMIUM",
        "last_user_login_at": "2026-05-17T10:24:00Z",
        "user_count": 87
      }
    ],
    "recent_audit_events": [
      {
        "id": "uuid",
        "action": "ORG_SUSPENDED",
        "actor_email": "ops@brello.co.in",
        "target_organization_id": "uuid",
        "target_organization_name": "Beta Industries",
        "created_at": "2026-05-17T09:12:00Z"
      }
    ]
  }
}
```

### GET /api/v1/platform/dashboard/key-metrics

**Query params**: `range=30d | 90d | 12m` (default `12m`)

**Response**

```json
{
  "success": true,
  "data": {
    "range": "12m",
    "organizations_created": {
      "labels": ["2025-06", "2025-07", "...", "2026-05"],
      "values": [2, 3, 4, 5, 6, 7, 5, 4, 8, 6, 7, 5]
    },
    "plan_adoption": {
      "labels": ["2025-06", "...", "2026-05"],
      "series": [
        { "plan": "STANDARD", "values": [...] },
        { "plan": "PREMIUM",  "values": [...] }
      ]
    },
    "subscription_status": {
      "active":   36,
      "expired":  4,
      "cancelled": 2
    },
    "user_growth": {
      "labels": ["2025-06", "...", "2026-05"],
      "values": [120, 200, 350, 410, 520, ...]
    }
  }
}
```

---

## Module Structure

```
src/modules/platform-dashboard/
├── controllers/
│   └── platform-dashboard.controller.ts
├── services/
│   ├── platform-overview.service.ts          # counters + recent feeds
│   ├── platform-key-metrics.service.ts       # time-series aggregations
│   └── platform-dashboard-cache.service.ts   # 60s in-memory cache
├── dto/
│   ├── overview-response.dto.ts
│   ├── key-metrics-response.dto.ts
│   └── key-metrics-query.dto.ts
├── repositories/
│   └── platform-dashboard.repository.ts      # raw aggregation queries
└── platform-dashboard.module.ts
```

The repository centralizes raw SQL / query-builder calls so services stay thin.

---

## Service Logic

### `PlatformOverviewService.getOverview(user: LoggedInUser)`

1. Resolve `enterpriseId` from `user.enterpriseId`.
2. Try the cache key `overview:<enterpriseId>`. If hit (≤ 60s old), return.
3. Fire 5 queries in parallel:
   - Counter aggregates (total / active / suspended orgs, user count, new-this-month)
   - Subscription buckets (active / trial / trials-ending-soon within 7 days)
   - Plan distribution `JOIN plan`
   - Recently active orgs (top 5 by `MAX(users.last_login_at)`)
   - Recent audit events (last 10 from `audit_log` where `target_enterprise_id = enterpriseId`)
4. Assemble response, set cache, return.

### `PlatformKeyMetricsService.getMetrics(user, range)`

1. Resolve `enterpriseId` and `range`.
2. Build a month-bucket series for the requested range (e.g. last 12 calendar months).
3. Fire 4 queries in parallel:
   - `organizations_created`: `COUNT(*) GROUP BY date_trunc('month', created_at)`
   - `plan_adoption`: `COUNT(*) FROM organization_subscription GROUP BY month, plan_id`
   - `subscription_status`: `COUNT(*) GROUP BY sub_status` (snapshot, not series)
   - `user_growth`: `COUNT(*) FROM users WHERE created_at <= month_end` (cumulative)
4. Zero-fill missing buckets so the chart x-axis is continuous.
5. Cache key `key-metrics:<enterpriseId>:<range>`.

---

## Enums

```typescript
export enum DashboardRange {
  LAST_30D  = '30d',
  LAST_90D  = '90d',
  LAST_12M  = '12m',
}
```

---

## Open questions / future work

- **Drill-down navigation** — clicking a recently-active org should deep-link
  into Organizations → Details. Frontend concern; no backend change.
- **Multi-currency MRR** — currently no `invoice` / `payment` data. When billing
  is added, surface MRR / ARR on the Overview tile-set.
- **Audit event types** — needs a catalog of `audit_log.action` codes the
  Platform UI knows how to render. Build alongside the Audit Logs module.
