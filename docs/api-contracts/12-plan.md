# Plan & Subscription APIs

Base path: `/api/v1/plans`, `/api/v1/organization-subscriptions`, `/api/v1/plan-modules`, `/api/v1/plan-module-actions`

This module defines tier-based functional access across the application. An organization's effective permissions are bounded by their active plan.

---

## Part A: Plans

Base path: `/api/v1/plans`

### Auth

| Endpoint         | Auth required      | Who can call            |
|------------------|--------------------|-------------------------|
| `GET /plans`     | No (`@Public()`)   | Anyone — website, apps  |
| `POST /plans`    | `JwtAuthGuard`     | Platform admin          |
| `PATCH /plans/:id` | `JwtAuthGuard`   | Platform admin          |
| `DELETE /plans/:id` | `JwtAuthGuard` | Platform admin          |

> `GET /plans` is public so the customer-facing website can fetch plans without authentication. Platform admins see **all non-deleted plans** (active + inactive). Public callers see **active plans only**.

---

### 1. Create Plan

**Method:** `POST` `/api/v1/plans`

**Authorization:** `Bearer {{access_token}}` (Platform Admin)

**Request Body:**

| Field                       | Type                  | Required | Description                                     |
|-----------------------------|-----------------------|----------|-------------------------------------------------|
| `name`                      | string (2–100 chars)  | Yes      | Plan tier name (e.g. Free, Standard, Enterprise)|
| `price`                     | number ≥ 0            | Yes      | Monthly price per employee (₹)                  |
| `price_per_employee_annual` | number ≥ 0            | No       | Annual price per employee (₹)                   |
| `annual_discount_percent`   | number 0–100          | No       | Discount applied for annual billing             |
| `tier_rank`                 | integer ≥ 0           | No       | 0 = Free, 1 = Standard, 2 = Premium             |
| `billing_cycle_default`     | `Monthly` \| `Annual` | No       | Default billing cycle shown to customers        |
| `description`               | string                | No       | Plan summary shown to customers                 |
| `discount`                  | number 0–100          | No       | General discount (%)                            |
| `feature`                   | string[]              | No       | List of included features                       |
| `status`                    | `ACTIVE` \| `INACTIVE`| No       | Defaults to `ACTIVE`                            |

**Example:**

```json
{
  "name": "Professional",
  "price": 149.00,
  "price_per_employee_annual": 1490.00,
  "annual_discount_percent": 20,
  "tier_rank": 1,
  "billing_cycle_default": "Monthly",
  "description": "For growing teams that need full HRMS capabilities.",
  "discount": 0,
  "feature": ["Leave Management", "Attendance", "Payroll", "Employee Directory"],
  "status": "ACTIVE"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Professional",
    "price": "149.00",
    "price_per_employee_annual": "1490.00",
    "annual_discount_percent": "20.00",
    "tier_rank": 1,
    "billing_cycle_default": "Monthly",
    "description": "For growing teams...",
    "discount": "0.00",
    "feature": ["Leave Management", "Attendance", "Payroll", "Employee Directory"],
    "status": "ACTIVE",
    "created_at": "2026-05-28T...",
    "updated_at": "2026-05-28T..."
  }
}
```

**Error — duplicate name:** `409 Conflict`

---

### 2. Get All Plans

**Method:** `GET` `/api/v1/plans`

**Auth:** None (public endpoint)

**Behaviour:**
- Authenticated platform admin → returns all plans where `status != DELETED`
- Unauthenticated / regular users → returns plans where `status = ACTIVE`

**Response:** `200 OK` — array of plan objects ordered by `price ASC`

---

### 3. Get Plan by ID

**Method:** `GET` `/api/v1/plans/:id`

**Authorization:** `Bearer {{access_token}}`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id`      | UUID | Plan ID     |

**Response:** `200 OK` — single plan object

**Error:** `404 Not Found` if plan does not exist or is deleted

---

### 4. Update Plan

**Method:** `PATCH` `/api/v1/plans/:id`

**Authorization:** `Bearer {{access_token}}` (Platform Admin)

**Request Body:** Any subset of the Create fields. All fields optional.

```json
{
  "price": 199.00,
  "annual_discount_percent": 25,
  "status": "INACTIVE"
}
```

**Response:** `200 OK` — updated plan object

---

### 5. Delete Plan

**Method:** `DELETE` `/api/v1/plans/:id`

**Authorization:** `Bearer {{access_token}}` (Platform Admin)

**Response:** `204 No Content`

> Soft-delete — sets `status = DELETED`. Plan disappears from all public and admin listings.

---

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
