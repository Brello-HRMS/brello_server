# Plan & Subscription APIs

Base path: `/api/v1/plans`, `/api/v1/organization-subscriptions`, `/api/v1/plan-modules`, `/api/v1/plan-module-actions`

This module defines tier-based functional access across the application. An organization's effective permissions are bounded by their active plan.

---

## Part A: Plans

Base path: `/api/v1/plans`

### 1. Create Plan

**Method:** `POST` `/api/v1/plans`

**Request Body:**

| Field         | Type     | Description                            |
| ------------- | -------- | -------------------------------------- |
| `name`        | string   | Plan tier name (e.g. Free, Enterprise) |
| `price`       | number   | Cost of the plan                       |
| `description` | string   | Description of tier limits             |
| `discount`    | number   | Global discount applied                |
| `feature`     | string[] | Array of feature strings               |

### 2. Get All Plans

**Method:** `GET` `/api/v1/plans`

### 3. Get Plan by ID

**Method:** `GET` `/api/v1/plans/:id`

### 4. Update Plan

**Method:** `PATCH` `/api/v1/plans/:id`

### 5. Delete Plan

**Method:** `DELETE` `/api/v1/plans/:id`

### 6. Assign Apps to Plan

Associates one or more applications with a plan.

|            |                          |
| ---------- | ------------------------ |
| **Method** | `POST`                   |
| **URL**    | `/api/v1/plans/:id/apps` |
| **Status** | `201 Created`            |

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `id`      | UUID | Plan ID     |

**Request Body:**

| Field    | Type   | Description                                  |
| -------- | ------ | -------------------------------------------- |
| `appIds` | UUID[] | Array of App IDs to associate with this plan |

```json
{
  "appIds": ["880e8400-...", "990e8400-..."]
}
```

---

## Part B: Organization Subscriptions

Base path: `/api/v1/organization-subscriptions`

Links an active Plan to a Tenant Workspace.

### 1. Create Subscription

**Method:** `POST` `/api/v1/organization-subscriptions`

**Request Body:**

| Field             | Type     | Description                      |
| ----------------- | -------- | -------------------------------- |
| `organization_id` | UUID     | Subscriber                       |
| `plan_id`         | UUID     | Plan assigned                    |
| `start_date`      | ISO Date | Timestamp of start               |
| `end_date`        | ISO Date | Expiration timestamp             |
| `status`          | enum     | `Active`, `Expired`, `Cancelled` |

> Note: An organization cannot have >1 Active subscriptions simultaneously.

### 2. Get All Subscriptions

**Method:** `GET` `/api/v1/organization-subscriptions`

### 3. Get Subscription by ID

**Method:** `GET` `/api/v1/organization-subscriptions/:id`

### 4. Update Subscription

**Method:** `PATCH` `/api/v1/organization-subscriptions/:id`

**Request Body:** Partial update of creation payload.

### 5. Delete Subscription

**Method:** `DELETE` `/api/v1/organization-subscriptions/:id`

---

## Part C: Plan Modulators

### Plan-Module Associations (`/api/v1/plan-modules`)

Maps which entire conceptual modules are enabled by default for a `Plan`.

- `POST /` — Create plan-module association
- `GET /` — List all
- `GET /plan/:planId` — Get by plan
- `GET /:id` — Get by ID
- `PATCH /:id` — Update association
- `DELETE /:id` — Remove association

### Plan-Module-Action Definitions (`/api/v1/plan-module-actions`)

Fine grains exactly which actions inside an enabled module are allowed by the `Plan`.

- `POST /` — Create plan-module-action definition
- `GET /` — List all
- `GET /plan/:planId/module/:moduleId` — Get by plan and module
- `GET /:id` — Get by ID
- `PATCH /:id` — Update definition
- `DELETE /:id` — Remove definition
