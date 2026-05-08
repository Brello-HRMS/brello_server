# **Leave Request Module — API Contract (v1.0)**

> Per-employee leave application lifecycle: create → submit → approve/reject/cancel. Tightly coupled to `LeaveBalance` (every state transition moves days between `available`, `pending`, `used`).

---

# **1. Base Configuration**

### **Base URL**

```
/api/v1/leave-requests
```

### **Authentication**

```
Authorization: Bearer <JWT_TOKEN>
```

### **Required Permission Module**

`LEAVE_MGMT` — actions: `view`, `create`, `update`, `approve`, `delete`

> **Self-service:** Endpoints under `/me`, `POST /` (create own), and `POST /:id/cancel` (own request) are permitted to any authenticated user **without** an explicit `LEAVE_MGMT` grant — every employee can apply for and manage their own leaves.

---

# **2. State Machine**

```
        ┌─────────┐    submit    ┌──────────┐   approve   ┌──────────┐
        │  DRAFT  │ ───────────▶│ PENDING  │ ──────────▶ │ APPROVED │
        └─────────┘              └──────────┘              └──────────┘
             │                       │   │                       │
             │ delete                │   │ reject                │ cancel*
             ▼                       │   ▼                       ▼
        (hard delete)                │  ┌──────────┐         ┌──────────┐
                                     │  │ REJECTED │         │CANCELLED │
                                     │  └──────────┘         └──────────┘
                                     │
                                     │ cancel
                                     ▼
                                ┌──────────┐
                                │CANCELLED │
                                └──────────┘
```

`*` Cancellation of an `APPROVED` request is allowed only **before** the leave start date. After start date → `422 ALREADY_CONSUMED`.

### **Balance Effects per Transition**

| From → To              | Ledger Entry Generated                       |
| ---------------------- | -------------------------------------------- |
| `DRAFT → PENDING`      | `REQUEST_HOLD` (debit pending_days)          |
| `PENDING → APPROVED`   | `REQUEST_CONSUME` (debit used, release pending) |
| `PENDING → REJECTED`   | `REQUEST_RELEASE` (release pending)          |
| `PENDING → CANCELLED`  | `REQUEST_RELEASE` (release pending)          |
| `APPROVED → CANCELLED` | `REQUEST_RELEASE` (re-credit to available)   |

---

# **3. Global Standards**

## **3.1 Data Types**

| Type     | Description                                       |
| -------- | ------------------------------------------------- |
| uuid     | UUID v4                                           |
| date     | `YYYY-MM-DD`                                      |
| float    | Up to 2 decimal digits (`0.5` for half-days)      |
| enum     | Predefined string values                          |

## **3.2 Status Enum (Request)**

```
"status": "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
```

## **3.3 Half-Day Slot Enum**

```
"half_day_slot": "FIRST_HALF" | "SECOND_HALF"
```

## **3.4 `manager_note` (List Rows)**

A unified, read-only field on list responses that resolves to whichever approver text is most relevant for the row's current status:

| Request status        | `manager_note` resolves to   |
| --------------------- | ---------------------------- |
| `DRAFT` / `PENDING`   | `null`                       |
| `APPROVED`            | `approver_comment`           |
| `REJECTED`            | `rejection_reason`           |
| `CANCELLED` (by user) | `null`                       |
| `CANCELLED` (admin)   | admin cancel `reason`        |

> Provided as a derived field so frontends don't have to switch on status. The detail endpoint (§5.3) still exposes the underlying fields independently.

## **3.5 Pagination**

```
?page=1&limit=20
```

---

# **4. Employee Self-Service APIs**

## **4.1 Create Leave Request**

### **POST** `/`

Creates a request. If `submit=true` (default), it goes straight to `PENDING` (and the balance is held). If `submit=false`, it stays in `DRAFT` for the employee to edit later.

### **Permission**

Authenticated user (employee creates own request).

### **Request**

```json
{
  "leave_type_id": "uuid (required)",
  "from_date": "date (required, YYYY-MM-DD)",
  "to_date": "date (required, >= from_date)",
  "is_half_day": false,
  "half_day_slot": "FIRST_HALF | SECOND_HALF (required if is_half_day=true)",
  "reason": "string (required, 5–500 chars)",
  "attachment_ids": ["uuid (optional, document module — multiple files allowed)"],
  "submit": true
}
```

### **Validations**

* **`leave_type_id`** must belong to the active `LeaveConfig` in caller's org.
* **`from_date <= to_date`**; both must fall within the active leave year.
* **Half-day rule**: `is_half_day=true` requires `from_date == to_date` AND `LeaveType.allow_half_day=true` AND `LeaveRules.allow_half_day=true`.
* **Backdated rule**: if `from_date < today`:
  * Reject if `LeaveRules.allow_backdated=false` → `422 BACKDATED_NOT_ALLOWED`.
  * Reject if `(today - from_date) > LeaveRules.max_backdated_days` → `422 BACKDATED_LIMIT_EXCEEDED`.
* **Sandwich rule**: server expands `from_date..to_date`, computes effective working days using the org's holiday + weekly-off config. If `LeaveRules.sandwich_rule=true`, intervening weekends/holidays between two leave segments are counted.
* **Max-per-month**: total days requested in the same calendar month (across this + already-pending/approved requests) ≤ `LeaveRules.max_per_month`.
* **Balance check**: `available_days` for the leave type ≥ computed `total_days`. Fails fast with `422 INSUFFICIENT_BALANCE` showing both numbers.
* **Overlap check**: rejects if any existing `PENDING` or `APPROVED` request for the caller overlaps the date range → `409 OVERLAPPING_REQUEST`.

### **Response — 201 Created**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "PENDING",
    "leave_type_id": "uuid",
    "leave_type_name": "Casual Leave",
    "from_date": "2026-05-12",
    "to_date": "2026-05-14",
    "is_half_day": false,
    "total_days": 3,
    "computed_days_breakdown": {
      "calendar_days": 3,
      "weekends": 0,
      "holidays": 0,
      "sandwich_days_added": 0,
      "billable_days": 3
    },
    "submitted_at": "2026-04-21T10:00:00.000Z"
  }
}
```

---

## **4.2 List My Requests**

### **GET** `/me`

### **Query**

| Param          | Type    | Description                                  |
| -------------- | ------- | -------------------------------------------- |
| `status`       | enum    | Filter by status (comma-separated allowed)   |
| `leave_year`   | integer | Default: current year                        |
| `from_date`    | date    | Filter requests with overlap on/after this   |
| `to_date`      | date    | Filter requests with overlap on/before this  |
| `leave_type_id`| uuid    |                                              |
| `page`, `limit`| integer |                                              |

### **Response — 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "status": "APPROVED",
      "leave_type_name": "Casual Leave",
      "from_date": "2026-05-12",
      "to_date": "2026-05-14",
      "total_days": 3,
      "is_half_day": false,
      "reason": "Family vacation planned in advance.",
      "manager_note": "Enjoy your holiday",
      "submitted_at": "2026-04-21T10:00:00.000Z",
      "approved_by_name": "John Manager",
      "approved_at": "2026-04-22T09:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 14 }
}
```

---

## **4.3 Update My Draft / Pending Request**

### **PATCH** `/:id`

Editable fields depend on status:
* `DRAFT` → all fields editable.
* `PENDING` → only `reason` and `attachment_id` editable. To change dates/leave type, cancel and re-create.
* `APPROVED | REJECTED | CANCELLED` → not editable → `422 INVALID_STATE`.

### **Permission**

Caller must be the request owner (`employee_id == jwt.userId`).

### **Request — DRAFT (full edit)**

Same shape as **4.1** request body.

### **Request — PENDING (limited edit)**

```json
{
  "reason": "string",
  "attachment_ids": ["uuid"]
}
```

> When `attachment_ids` is sent, it **replaces** the existing list (not append). Send the full desired set on every PATCH.

### **Response — 200 OK**

Returns updated request in same shape as **4.1** response.

---

## **4.4 Submit Draft**

### **POST** `/:id/submit`

Transitions `DRAFT → PENDING`. Re-runs all validations from **4.1**.

### **Permission**

Owner only.

### **Response — 200 OK**

```json
{
  "success": true,
  "data": { "id": "uuid", "status": "PENDING", "submitted_at": "..." }
}
```

---

## **4.5 Cancel My Request**

### **POST** `/:id/cancel`

Allowed if status is `DRAFT`, `PENDING`, or `APPROVED` (and `from_date > today`).

### **Permission**

Owner only.

### **Request**

```json
{
  "reason": "string (optional, 0–500 chars)"
}
```

### **Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CANCELLED",
    "cancelled_at": "2026-05-01T10:00:00.000Z",
    "released_days": 3
  }
}
```

---

## **4.6 Delete Draft**

### **DELETE** `/:id`

Hard-deletes a `DRAFT` only. Returns `422 INVALID_STATE` for any other status.

### **Permission**

Owner only.

### **Response — 204 No Content**

---

# **5. Manager / HR APIs**

## **5.1 List All Requests (HR / Admin)**

### **GET** `/`

### **Permission**

`LEAVE_MGMT.view`

### **Query**

| Param            | Type    | Description                                  |
| ---------------- | ------- | -------------------------------------------- |
| `status`         | enum    | Comma-separated status filter                |
| `employee_id`    | uuid    | Exact match                                  |
| `search`         | string  | Free-text match on employee name OR employee code (≥ 2 chars) |
| `department_id`  | uuid    |                                              |
| `leave_type_id`  | uuid    |                                              |
| `from_date`      | date    | Range filter (request overlaps the window)   |
| `to_date`        | date    |                                              |
| `submitted_from` | date    | Filter by submission timestamp               |
| `submitted_to`   | date    |                                              |
| `page`, `limit`  | integer |                                              |
| `sort_by`        | string  | `submitted_at` \| `from_date` (default `submitted_at`) |
| `sort_order`     | string  | `ASC` \| `DESC` (default `DESC`)             |

### **Response — 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employee_id": "uuid",
      "employee_code": "EMP-0012",
      "employee_name": "Jane Doe",
      "department_name": "Engineering",
      "leave_type_name": "Casual Leave",
      "from_date": "2026-05-12",
      "to_date": "2026-05-14",
      "total_days": 3,
      "status": "PENDING",
      "reason": "Family vacation planned in advance.",
      "manager_note": null,
      "submitted_at": "2026-04-21T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 64 }
}
```

---

## **5.2 Pending Approvals (Manager Inbox)**

### **GET** `/pending-approval`

Returns all requests in `PENDING` status that the caller is authorized to approve. Approver routing for v1 is **role-based**: any user with `LEAVE_MGMT.approve` in the org sees all pending requests in that org. (Manager-of routing is deferred — see "Open Questions".)

### **Permission**

`LEAVE_MGMT.approve`

### **Query**

Same as **5.1** with `status` forced to `PENDING`.

### **Response — 200 OK**

Same shape as **5.1**.

---

## **5.3 Get Request by ID**

### **GET** `/:id`

### **Permission**

* Owner — always allowed.
* Anyone with `LEAVE_MGMT.view` in the same org.

### **Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "APPROVED",
    "employee": {
      "id": "uuid",
      "name": "Jane Doe",
      "department_name": "Engineering"
    },
    "leave_type": {
      "id": "uuid",
      "name": "Casual Leave"
    },
    "from_date": "2026-05-12",
    "to_date": "2026-05-14",
    "is_half_day": false,
    "total_days": 3,
    "reason": "Family event",
    "attachment_ids": [],
    "computed_days_breakdown": {
      "calendar_days": 3,
      "weekends": 0,
      "holidays": 0,
      "sandwich_days_added": 0,
      "billable_days": 3
    },
    "submitted_at": "2026-04-21T10:00:00.000Z",
    "approved_by": "user-uuid",
    "approved_by_name": "John Manager",
    "approved_at": "2026-04-22T09:00:00.000Z",
    "approver_comment": "Approved",
    "rejection_reason": null,
    "cancelled_at": null,
    "balance_snapshot_at_approval": {
      "leave_type_name": "Casual Leave",
      "available_at_approval": 9,
      "consumed_by_this_request": 3
    }
  }
}
```

---

## **5.4 Approve Request**

### **POST** `/:id/approve`

Atomically transitions `PENDING → APPROVED`, snapshots the balance, and writes a `REQUEST_CONSUME` ledger entry.

### **Permission**

`LEAVE_MGMT.approve`

### **Request**

```json
{
  "comment": "string (optional, 0–500 chars)"
}
```

### **Validations**

* Current status must be `PENDING` → otherwise `422 INVALID_STATE`.
* Re-validates balance at approval time (race-safe). If balance dropped below required → `422 INSUFFICIENT_BALANCE_AT_APPROVAL`.
* Approver `userId` cannot equal `request.employee_id` → `403 SELF_APPROVAL_FORBIDDEN`.

### **Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "APPROVED",
    "approved_at": "2026-04-22T09:00:00.000Z",
    "approved_by": "user-uuid",
    "balance_after": { "leave_type_id": "uuid", "available_days": 6 }
  }
}
```

---

## **5.5 Reject Request**

### **POST** `/:id/reject`

### **Permission**

`LEAVE_MGMT.approve`

### **Request**

```json
{
  "rejection_reason": "string (required, 5–500 chars)"
}
```

### **Validations**

* Current status must be `PENDING`.
* `rejection_reason` is **mandatory** — auditability.

### **Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "REJECTED",
    "rejected_at": "...",
    "rejected_by": "user-uuid",
    "rejection_reason": "Conflicts with planned release"
  }
}
```

---

## **5.6 Cancel Request (HR Override)**

### **POST** `/:id/admin-cancel`

HR can cancel any request — `PENDING` or `APPROVED` (even past start_date). Useful for retroactive corrections. Generates a `REQUEST_RELEASE` ledger entry crediting the balance back.

### **Permission**

`LEAVE_MGMT.delete`

### **Request**

```json
{
  "reason": "string (required, 5–500 chars)"
}
```

### **Response — 200 OK**

Same shape as **4.5** response, with `cancelled_by_admin: true`.

---

## **5.7 Get Approval History / Audit Trail**

### **GET** `/:id/history`

### **Permission**

* Owner OR `LEAVE_MGMT.view`.

### **Response — 200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "from_status": null,
      "to_status": "DRAFT",
      "actor_id": "uuid",
      "actor_name": "Jane Doe",
      "comment": null,
      "created_at": "2026-04-21T09:00:00.000Z"
    },
    {
      "id": "uuid",
      "from_status": "DRAFT",
      "to_status": "PENDING",
      "actor_id": "uuid",
      "actor_name": "Jane Doe",
      "comment": null,
      "created_at": "2026-04-21T10:00:00.000Z"
    },
    {
      "id": "uuid",
      "from_status": "PENDING",
      "to_status": "APPROVED",
      "actor_id": "user-uuid",
      "actor_name": "John Manager",
      "comment": "Approved",
      "created_at": "2026-04-22T09:00:00.000Z"
    }
  ]
}
```

---

# **6. Validation API (Pre-Submit Check)**

## **6.1 Validate Leave Request**

### **POST** `/validate`

A **dry-run** of `POST /` — runs all validations and returns the computed breakdown without persisting anything. Useful for the frontend stepper to show "you'll consume 3 days, balance after: 6 days" before the user clicks Submit.

### **Permission**

Authenticated user.

### **Request**

Same body as **4.1**.

### **Response — 200 OK**

```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "computed_days_breakdown": {
      "calendar_days": 3,
      "weekends": 0,
      "holidays": 0,
      "sandwich_days_added": 0,
      "billable_days": 3
    },
    "balance_before": 9,
    "balance_after": 6,
    "warnings": []
  }
}
```

### **Response — 200 OK (invalid)**

```json
{
  "success": true,
  "data": {
    "is_valid": false,
    "errors": [
      {
        "code": "INSUFFICIENT_BALANCE",
        "message": "Available balance is 2, requested 3"
      }
    ]
  }
}
```

---

# **7. Core Business Rules (Critical)**

1. **Atomic balance update** — every state transition that changes `pending` or `used` runs inside a single DB transaction with row-level lock on `LeaveBalance` to prevent over-consumption races.
2. **Idempotent transitions** — calling `/approve` on an already-`APPROVED` request returns `422 INVALID_STATE`, never silently succeeds.
3. **Self-approval forbidden** — even with `LEAVE_MGMT.approve`, a user cannot approve their own request.
4. **Total days = server-computed** — `total_days` from the client is **ignored**. The server is the only source of truth, applying weekly-off + holiday calendar + sandwich rule.
5. **No edits to dates after submission** — once `PENDING`, dates are immutable; user must cancel and re-create.
6. **Soft-immutable history** — every transition writes to `LeaveRequestHistory`. Records are append-only.
7. **Multi-tenant isolation** — all queries filter by `enterprise_id` + `organization_id`. Cross-org access is impossible by construction.

---

# **8. Error Catalog**

| HTTP | Code                              | Scenario                                                       |
| ---- | --------------------------------- | -------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`                | Invalid DTO                                                    |
| 403  | `FORBIDDEN`                       | Caller lacks the required permission                           |
| 403  | `NOT_REQUEST_OWNER`               | Caller is not the owner of the request                         |
| 403  | `SELF_APPROVAL_FORBIDDEN`         | Approver is the requester                                      |
| 404  | `REQUEST_NOT_FOUND`                | Request id does not exist                                      |
| 404  | `LEAVE_TYPE_NOT_FOUND`             | Leave type not in active config                                |
| 409  | `OVERLAPPING_REQUEST`             | Another active request covers part of the date range           |
| 422  | `INVALID_STATE`                   | Transition not allowed from current status                     |
| 422  | `INSUFFICIENT_BALANCE`            | At creation/submit                                             |
| 422  | `INSUFFICIENT_BALANCE_AT_APPROVAL`| Balance dropped between submit and approve                     |
| 422  | `BACKDATED_NOT_ALLOWED`           | `from_date < today` and rule disallows it                      |
| 422  | `BACKDATED_LIMIT_EXCEEDED`        | `from_date < today - max_backdated_days`                       |
| 422  | `MAX_PER_MONTH_EXCEEDED`          | Sum of monthly leaves exceeds `LeaveRules.max_per_month`        |
| 422  | `HALF_DAY_DISABLED`               | `is_half_day=true` but disabled at config or leave-type level   |
| 422  | `HALF_DAY_RANGE`                  | `is_half_day=true` but `from_date != to_date`                   |
| 422  | `OUT_OF_LEAVE_YEAR`                | Date range falls outside the active leave year                  |
| 422  | `ALREADY_CONSUMED`                | Cancel attempted after `from_date` has passed                   |
| 422  | `NO_ACTIVE_CONFIG`                | No active `LeaveConfig` for the org                             |

---

# **9. Edge Cases Covered**

* **Leave spans the year-end** — rejected with `OUT_OF_LEAVE_YEAR`. User must split into two requests.
* **Weekly off / holiday on `from_date`** — included in `calendar_days` count but excluded from `billable_days` unless sandwich rule applies.
* **Half-day on a non-working day** — rejected; `from_date` must fall on a working day.
* **Approver cancels own approval** — not supported. Use `/admin-cancel` (requires `LEAVE_MGMT.delete`).
* **Race: two requests submitted concurrently for overlapping balance** — DB row-lock on the balance row serializes them; the loser fails with `INSUFFICIENT_BALANCE`.
* **Leave config edited mid-pending-request** — pending requests retain the rules in effect at submission time, snapshotted in a `rules_snapshot` JSON column on the request.
* **Employee offboarded while request is `PENDING`** — auto-cancelled via the offboarding workflow; ledger entry tagged `REASON: EMPLOYEE_INACTIVE`.

---

# **9.1 LWP / Unlimited Leave Types**

`LWP` (Loss of Pay) is a **system-defined** leave type identified by `LeaveType.code = 'LWP'` (see leave-balance §11). It flows through this same request lifecycle, with the following exceptions:

### **Validations skipped for LWP**

| Check                          | Behavior on LWP                                          |
| ------------------------------ | -------------------------------------------------------- |
| `INSUFFICIENT_BALANCE` (create)| **Skipped** — there is no finite balance                 |
| `INSUFFICIENT_BALANCE_AT_APPROVAL` | **Skipped**                                          |
| `MAX_PER_MONTH_EXCEEDED`       | **Skipped** — LWP is not capped per month                |
| `LeaveType.allow_half_day`     | Honoured normally                                        |
| `LeaveRules.allow_backdated`   | Honoured normally                                        |
| `LeaveRules.sandwich_rule`     | Honoured normally                                        |
| Overlap with other requests    | Honoured normally — no double-booking even on LWP        |

### **Validation Endpoint Output**

For LWP, `POST /validate` (§6.1) returns:

```json
{
  "is_valid": true,
  "computed_days_breakdown": { "...": "..." },
  "balance_before": null,
  "balance_after": null,
  "warnings": [
    { "code": "UNPAID_LEAVE", "message": "These days will be unpaid." }
  ]
}
```

### **Ledger / Balance Effects**

* `REQUEST_HOLD` / `REQUEST_CONSUME` / `REQUEST_RELEASE` ledger entries **are** written (so usage is auditable) — `running_balance` is `null`.
* `used_days` and `pending_days` on the LWP balance row tick up/down normally, so the employee can see "12 LWP days used this year." `available_days` remains `null`.

### **Payroll Hand-off**

LWP days from `APPROVED` requests are emitted to the payroll module as unpaid days. (Wiring is owned by the payroll module — out of scope here.)

---

# **10. Open Questions / Future Scope**

These are explicitly **out of v1** and should be tracked separately:

1. **Manager-of routing** — currently any `LEAVE_MGMT.approve` user sees all pending requests in the org. Adding a `manager_id` on `Employee` and routing `pending-approval` to the actual reporting manager is a v2 task.
2. **Multi-level approval** — single-step approval only in v1. Multi-level (manager → HR → director) requires a separate `ApprovalChain` config and is out of scope.
3. **Notifications** — assumed to be handled by the existing `notification` module via service-level events. Not specified here.
4. **Calendar integration / leave visibility within a team** — out of v1.
5. **Compensatory off (comp-off) requests** — these are a separate balance type and are not modeled in `LeaveConfig`. Will need a separate flow.
