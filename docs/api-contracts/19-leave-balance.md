# **Leave Balance Module — API Contract (v1.0)**

> Per-employee leave ledger derived from the active `LeaveConfig`. Tracks allocated, used, pending and available days per leave type per leave year, plus a ledger of every credit/debit operation.

---

# **1. Base Configuration**

### **Base URL**

```
/api/v1/leave-balances
```

### **Authentication**

```
Authorization: Bearer <JWT_TOKEN>
```

### **Required Permission Module**

`LEAVE_MGMT` — actions: `view`, `create`, `update`, `approve`

> **Self-service:** `GET /me` is permitted to any authenticated user without an explicit `LEAVE_MGMT.view` grant — every employee can read their own balance.

---

# **2. Conceptual Model**

```
LeaveConfig (org-wide, ACTIVE)
   └── LeaveType (Casual / Sick / Earned / …)
            │
            ▼
   LeaveBalance  ←── one row per (employee_id, leave_type_id, leave_year)
            │
            ▼
   LeaveBalanceLedger  ←── append-only audit trail of credits/debits
```

### **2.1 LeaveBalance — Computed Fields**

| Field            | Source                                                           |
| ---------------- | ---------------------------------------------------------------- |
| `allocated_days` | Snapshot from `LeaveType.days` at initialization                 |
| `accrued_days`   | If `accrual=monthly`: floor((months_elapsed / 12) × allocated)   |
| `carry_forward`  | Days carried from previous year (default 0)                      |
| `used_days`      | Sum of `APPROVED` request days that fall on/before today         |
| `pending_days`   | Sum of `PENDING` request days                                    |
| `consumed_days`  | `used_days + pending_days` — pre-computed for UI cards (avoids client-side mistakes) |
| `adjustment`     | Net of HR manual adjustments (can be +/-)                        |
| `available_days` | `accrued + carry_forward + adjustment − used − pending`          |
| `is_unlimited`   | `true` for system leave types like LWP (see §11). When true, `allocated_days`, `accrued_days`, `available_days` and `consumed_days` are all `null` |

### **2.2 Ledger Entry Types**

| Type                  | Direction | Trigger                                               |
| --------------------- | --------- | ----------------------------------------------------- |
| `INITIAL_GRANT`       | credit    | Balance row created on join / year rollover           |
| `CARRY_FORWARD`       | credit    | Year rollover with unused balance carried over        |
| `MONTHLY_ACCRUAL`     | credit    | Monthly cron for `accrual=monthly` leave types        |
| `MANUAL_ADJUSTMENT`   | credit/debit | HR `PATCH /:id/adjust`                             |
| `REQUEST_HOLD`        | debit     | Leave request transitions to `PENDING`                |
| `REQUEST_RELEASE`     | credit    | Leave request `REJECTED` / `CANCELLED`                |
| `REQUEST_CONSUME`     | debit     | Leave request `APPROVED`                              |
| `LAPSE`               | debit     | Year rollover, days lapsed (no carry forward allowed) |

> Ledger entries are **immutable**. Corrections are made via a new `MANUAL_ADJUSTMENT` entry, never by editing/deleting.

---

# **3. Global Standards**

## **3.1 Data Types**

| Type     | Description                              |
| -------- | ---------------------------------------- |
| uuid     | UUID v4                                  |
| date     | `YYYY-MM-DD`                             |
| year     | Integer (e.g., `2026` — start year of leave cycle) |
| float    | Decimal with up to 2 decimals (half-days)|

## **3.2 Status Enum (Balance Row)**

```
"status": "ACTIVE" | "INACTIVE"
```

`INACTIVE` is set when the employee is offboarded or the year rolls over.

## **3.3 Pagination**

```
?page=1&limit=20
```

```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 100 }
}
```

---

# **4. Initialization APIs**

## **4.1 Initialize Balance for One Employee**

### **POST** `/initialize`

Creates `LeaveBalance` rows for one employee × one leave year, one row per `LeaveType` in the active `LeaveConfig`. Idempotent — calling twice with the same `(employee_id, leave_year)` returns `409 CONFLICT`.

### **Permission**

`LEAVE_MGMT.create`

### **Request**

```json
{
  "employee_id": "uuid (required)",
  "leave_year": "integer (required, e.g. 2026)",
  "carry_forward": [
    {
      "leave_type_id": "uuid",
      "days": "float (>= 0)"
    }
  ]
}
```

### **Validations**

* `employee_id` must reference an `ACTIVE` employee in the caller's organization.
* `leave_year` must match an existing leave cycle window (derived from `LeaveConfig.leave_cycle`).
* `carry_forward[]` is optional. Each `leave_type_id` must belong to the active `LeaveConfig`.
* An active `LeaveConfig` (`status=ACTIVE`) must exist for the org. Otherwise → `422 BUSINESS_ERROR` (`NO_ACTIVE_CONFIG`).

### **Response — 201 Created**

```json
{
  "success": true,
  "data": {
    "employee_id": "uuid",
    "leave_year": 2026,
    "balances": [
      {
        "id": "uuid",
        "leave_type_id": "uuid",
        "leave_type_code": "CL",
        "leave_type_name": "Casual Leave",
        "is_unlimited": false,
        "allocated_days": 12,
        "accrued_days": 12,
        "carry_forward": 0,
        "used_days": 0,
        "pending_days": 0,
        "consumed_days": 0,
        "available_days": 12
      }
    ]
  }
}
```

---

## **4.2 Bulk Initialize**

### **POST** `/initialize/bulk`

Initializes all employees in one call — used at year rollover or first-time setup. Skips employees already initialized for the year (returns them in `skipped[]`).

### **Permission**

`LEAVE_MGMT.create`

### **Request**

```json
{
  "leave_year": "integer (required)",
  "scope": "ORGANIZATION | DEPARTMENT | EMPLOYEES",
  "department_ids": ["uuid"],
  "employee_ids": ["uuid"],
  "auto_carry_forward": true
}
```

### **Validations**

* Exactly one of `scope` value's required fields must be populated:
  * `ORGANIZATION` → no extra fields
  * `DEPARTMENT` → `department_ids` non-empty
  * `EMPLOYEES` → `employee_ids` non-empty
* `auto_carry_forward = true` → server reads each employee's prior-year `available_days` and seeds `carry_forward` automatically (capped per leave-type policy — TBD on policy field).

### **Response — 201 Created**

```json
{
  "success": true,
  "data": {
    "initialized_count": 48,
    "skipped": [
      { "employee_id": "uuid", "reason": "ALREADY_INITIALIZED" }
    ]
  }
}
```

---

# **5. Read APIs**

## **5.1 Get My Balance (Self-Service)**

### **GET** `/me`

Returns the caller's balance for the requested year. If no balance exists → `404 NOT_FOUND`.

### **Permission**

Authenticated user (no `LEAVE_MGMT` grant required).

### **Query**

| Param        | Type    | Required | Default      | Description                            |
| ------------ | ------- | -------- | ------------ | -------------------------------------- |
| `leave_year` | integer | ❌        | current year | Leave cycle start year                 |

### **Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "employee_id": "uuid",
    "leave_year": 2026,
    "leave_cycle": { "start": "2026-04-01", "end": "2027-03-31" },
    "total_allocated": 24,
    "total_available": 18,
    "balances": [
      {
        "id": "uuid",
        "leave_type_id": "uuid",
        "leave_type_code": "CL",
        "leave_type_name": "Casual Leave",
        "is_unlimited": false,
        "accrual": "none",
        "allow_half_day": true,
        "allocated_days": 12,
        "accrued_days": 12,
        "carry_forward": 0,
        "adjustment": 0,
        "used_days": 4,
        "pending_days": 1,
        "consumed_days": 5,
        "available_days": 7
      },
      {
        "id": "uuid",
        "leave_type_id": "uuid",
        "leave_type_code": "LWP",
        "leave_type_name": "Loss of Pay",
        "is_unlimited": true,
        "accrual": "none",
        "allow_half_day": true,
        "allocated_days": null,
        "accrued_days": null,
        "carry_forward": null,
        "adjustment": null,
        "used_days": 0,
        "pending_days": 0,
        "consumed_days": null,
        "available_days": null
      }
    ]
  }
}
```

> **Note:** `LWP` (Loss of Pay) always appears in the `balances[]` for every employee — it does **not** need to be configured per `LeaveConfig` and does **not** need to be initialized via §4. See §11.

---

## **5.2 Get Employee Balance**

### **GET** `/employee/:employee_id`

Returns balance for any employee in the caller's organization.

### **Permission**

`LEAVE_MGMT.view`

### **Path / Query**

| Param          | Type    | Description            |
| -------------- | ------- | ---------------------- |
| `employee_id`  | uuid    | Required path param    |
| `leave_year`   | integer | Optional, defaults to current year |

### **Response — 200 OK**

Same shape as **5.1**.

---

## **5.3 List Balances (HR / Admin)**

### **GET** `/`

Paginated list of all balance rows, with filters.

### **Permission**

`LEAVE_MGMT.view`

### **Query**

| Param            | Type    | Description                                             |
| ---------------- | ------- | ------------------------------------------------------- |
| `leave_year`     | integer | Defaults to current year                                |
| `department_id`  | uuid    | Filter by department                                    |
| `leave_type_id`  | uuid    | Filter by leave type                                    |
| `employee_id`    | uuid    | Filter by employee (exact match)                        |
| `search`         | string  | Free-text match on employee name OR employee code (≥ 2 chars) |
| `status`         | enum    | `ACTIVE` \| `INACTIVE`                                  |
| `low_balance`    | boolean | If `true`, returns rows where `available_days <= 2`     |
| `page`, `limit`  | integer | Pagination                                              |

### **Response — 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "employee_name": "Jane Doe",
      "department_name": "Engineering",
      "leave_type_id": "uuid",
      "leave_type_code": "CL",
      "leave_type_name": "Casual Leave",
      "is_unlimited": false,
      "leave_year": 2026,
      "allocated_days": 12,
      "available_days": 7,
      "used_days": 4,
      "pending_days": 1,
      "consumed_days": 5
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 250 }
}
```

---

## **5.4 Get Balance by ID**

### **GET** `/:id`

### **Permission**

`LEAVE_MGMT.view`

### **Response — 200 OK**

Single balance row in the same shape as `balances[]` in **5.1**.

---

## **5.5 Get Balance Ledger**

### **GET** `/:id/ledger`

Returns the immutable history of credits/debits for a single balance row.

### **Permission**

`LEAVE_MGMT.view`

### **Query**

| Param        | Type | Description           |
| ------------ | ---- | --------------------- |
| `from_date`  | date | Optional date filter  |
| `to_date`    | date | Optional date filter  |
| `page`, `limit` | int |                    |

### **Response — 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "balance_id": "uuid",
      "type": "INITIAL_GRANT",
      "direction": "CREDIT",
      "days": 12,
      "running_balance": 12,
      "reference_id": null,
      "reason": "Year start grant",
      "created_at": "2026-04-01T00:00:00.000Z",
      "modified_by": "system"
    },
    {
      "id": "uuid",
      "type": "REQUEST_CONSUME",
      "direction": "DEBIT",
      "days": 4,
      "running_balance": 8,
      "reference_id": "leave-request-uuid",
      "reason": "Leave request approved",
      "created_at": "2026-05-12T10:30:00.000Z",
      "modified_by": "user-uuid"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 4 }
}
```

---

# **6. Mutation APIs**

## **6.1 Manual Adjustment (HR Override)**

### **PATCH** `/:id/adjust`

Credit or debit a balance manually. **Reason is mandatory** — every adjustment is auditable. Generates a `MANUAL_ADJUSTMENT` ledger entry.

### **Permission**

`LEAVE_MGMT.update`

### **Request**

```json
{
  "direction": "CREDIT | DEBIT (required)",
  "days": "float (required, > 0, max 2 decimals)",
  "reason": "string (required, 5–500 chars)"
}
```

### **Validations**

* `DEBIT` cannot drop `available_days` below zero → `422 INSUFFICIENT_BALANCE`.
* `days` must be > 0; for half-day support use 0.5 increments only.
* Balance must be `ACTIVE`.

### **Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "available_days": 9,
    "ledger_entry_id": "uuid"
  }
}
```

---

## **6.2 Recompute Balance**

### **POST** `/:id/recompute`

Forces a recomputation of `used_days`, `pending_days`, and `available_days` from the source-of-truth `LeaveRequest` table. Used as a self-heal endpoint when ledger and request state diverge.

### **Permission**

`LEAVE_MGMT.update`

### **Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "before": { "available_days": 9, "used_days": 4, "pending_days": 1 },
    "after":  { "available_days": 8, "used_days": 5, "pending_days": 0 },
    "drift_detected": true
  }
}
```

---

# **7. Lifecycle / Cron**

| Trigger                               | Effect                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| **New employee onboarded**            | Auto-call `/initialize` for current year (server-side, no API needed).       |
| **Monthly accrual (cron, 1st of month)** | For each `accrual=monthly` leave type, append `MONTHLY_ACCRUAL` ledger entry.|
| **Year rollover (cron, leave cycle start)** | Mark prior year's rows `INACTIVE`. Bulk-initialize new year with `auto_carry_forward`. |
| **`LeaveConfig` activated mid-year**  | New leave types get balance rows; removed types are marked `INACTIVE` (not deleted). |
| **Employee offboarded**               | All balance rows → `INACTIVE`.                                                |

> These are **not** exposed as REST endpoints — they run as scheduled tasks in `LeaveBalanceTasks` and as side-effects of other operations.

---

# **8. Core Business Rules (Critical)**

1. **Ledger is the source of truth** — `available_days` on the balance row is a denormalized cache of the ledger sum. Any divergence is a bug, fixable via `/:id/recompute`.
2. **Single active `LeaveConfig` per org** — initialization fails without one.
3. **Leave year scoping** — every balance row is bound to a single leave year; updates never cross years.
4. **Half-days** — only `0.5` and `1.0` increments are valid `days` values. Rejected if `LeaveType.allow_half_day = false`.
5. **No deletes** — balance rows are soft-deleted (`status = INACTIVE`).
6. **No retroactive year edits without `MANUAL_ADJUSTMENT`** — past-year balances are read-only.
7. **Multi-tenant isolation** — every query is filtered by `enterprise_id` + `organization_id` from the JWT.

---

# **9. Error Catalog**

| HTTP | Code                    | Scenario                                                            |
| ---- | ----------------------- | ------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`      | Invalid DTO (missing fields, bad types)                             |
| 403  | `FORBIDDEN`             | Caller lacks `LEAVE_MGMT.<action>`                                  |
| 404  | `BALANCE_NOT_FOUND`     | No balance for the requested `(employee, leave_type, year)`         |
| 404  | `EMPLOYEE_NOT_FOUND`    | `employee_id` does not exist in the org                             |
| 409  | `ALREADY_INITIALIZED`   | Balance already exists for the `(employee, year)` pair              |
| 422  | `NO_ACTIVE_CONFIG`      | No `LeaveConfig` with `status=ACTIVE` for the organization          |
| 422  | `INSUFFICIENT_BALANCE`  | Debit would drop `available_days` below zero                        |
| 422  | `LEAVE_TYPE_HALFDAY_DISABLED` | `days` is fractional but leave type does not allow half-days  |
| 422  | `INACTIVE_BALANCE`      | Attempt to mutate an `INACTIVE` (offboarded / past-year) row        |
| 422  | `UNLIMITED_TYPE_NOT_ADJUSTABLE` | Manual adjust attempted on an unlimited type (e.g., LWP)    |

---

# **10. Edge Cases Covered**

* **Employee joins mid-year** → on init, `accrued_days = (months_remaining / 12) × allocated` for monthly-accrual types; full `allocated` for `accrual=none`.
* **Leave config changed (allocated days reduced)** → existing balances retain their original `allocated_days` until next year rollover. New employees get the new value.
* **Employee transferred to another organization** → balances do **not** migrate; the new org initializes fresh balances.
* **Leave type renamed** → `leave_type_name` in responses is always resolved live from `LeaveType`, so the rename propagates without data migration.
* **Concurrent approval races** — atomic check-and-decrement on `pending_days/used_days` is enforced via DB row-level lock. Collisions return `409 CONFLICT` to the loser.

---

# **11. System-Defined Leave Types (LWP)**

Some leave types are **system-defined** and exist outside the `LeaveConfig` flow. They are **not** managed by HR through the leave-config stepper, are **not** counted toward `LeaveConfig.total_leave`, and do **not** require initialization via §4.

### **11.1 Reserved Codes**

Identified by a reserved value on `LeaveType.code`:

| `code` | Display name  | Behavior                                                         |
| ------ | ------------- | ---------------------------------------------------------------- |
| `LWP`  | Loss of Pay   | Unlimited; bypasses balance checks; flagged as unpaid in payroll |

> **No code change required in the `leave-config` module.** A single seeded `LeaveType` row with `code = 'LWP'`, scoped to the platform (or seeded per organization on creation), is sufficient. The recognition happens at the `leave-balance` and `leave-request` service layer by matching `code`.

### **11.2 Balance Surfacing Rules**

For every `is_unlimited = true` leave type:

1. The row is **always present** in `GET /me`, `GET /employee/:id`, and `GET /` responses — even when no balance row was initialized.
2. `allocated_days`, `accrued_days`, `carry_forward`, `adjustment`, `consumed_days`, `available_days` are all returned as `null`. Frontend renders this as `0/∞`.
3. `used_days` and `pending_days` are populated normally by counting requests, so HR/the employee can still see "how much LWP has been used this year."
4. `total_allocated` and `total_available` aggregates **exclude** unlimited types.
5. Bulk init (§4.2) and per-employee init (§4.1) **silently skip** unlimited types; they are not stored as balance rows.

### **11.3 Ledger Behavior**

* No `INITIAL_GRANT`, `CARRY_FORWARD`, `MONTHLY_ACCRUAL`, or `LAPSE` entries are generated for unlimited types.
* `REQUEST_HOLD` / `REQUEST_CONSUME` / `REQUEST_RELEASE` entries **are** generated (so usage can be audited) — but `running_balance` is `null` since there is no finite running total.

### **11.4 Manual Adjustment**

`PATCH /:id/adjust` returns `422 UNLIMITED_TYPE_NOT_ADJUSTABLE` when targeting an unlimited type. There is no balance to adjust.

### **11.5 Recompute**

`POST /:id/recompute` is a no-op for unlimited types (200 OK with `drift_detected: false`).
