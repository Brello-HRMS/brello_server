# Leave Collection Setup

End-to-end walkthrough for the **Leave Balance** and **Leave Request** Postman folders. Each step builds on the previous — run them in order the first time.

---

## Prerequisites

Complete `GETTING_STARTED.md` first to have:
- `enterprise_id`, `organization_id`, `user_id`, `access_token` in your Postman variables
- A user with `LEAVE_MGMT.{view, create, update, approve, delete}` permissions for HR-side calls
- An **active** `LeaveConfig` for the organization (use the **Leave Configuration** folder: Create Draft → Update → Activate)

> **What "active" means:** `LeaveConfig.status = ACTIVE`, with at least one `LeaveType` allocated. Without this, every endpoint here returns `422 NO_ACTIVE_CONFIG`.

---

## LWP Setup (One-Time, Per Org)

LWP (Loss of Pay) is recognized by `LeaveType.code = 'LWP'`. The colleague's `leave-config` module doesn't surface a UI for system types, so for v1 you seed it directly:

```sql
INSERT INTO brello.leave_types (id, name, code, days, accrual, allow_half_day, config_id, organization_id, enterprise_id, status, modified_by)
VALUES (
  gen_random_uuid(),
  'Loss of Pay',
  'LWP',
  0,                              -- days is ignored for unlimited types
  'none',
  true,
  '<your-active-leave-config-id>',
  '<your-organization-id>',
  '<your-enterprise-id>',
  'ACTIVE',
  '<your-user-id>'
);
```

After seeding, the LWP row will appear in every employee's `GET /leave-balances/me` with `is_unlimited: true` and all numeric fields `null`. No initialization needed.

---

## Step-by-Step Flow

### Phase 1 — Initialize Balances (HR)

#### 1. Set the target employee

Manually copy the target employee's UUID into the `employee_id` collection variable. Or, if testing against your own account, set `employee_id` = `user_id`.

#### 2. Initialize Balance for One Employee

`POST /api/v1/leave-balances/initialize`

```json
{
  "employee_id": "{{employee_id}}",
  "leave_year": 2026,
  "carry_forward": []
}
```

> **Idempotent.** Calling this twice for the same `(employee, year)` returns `409 ALREADY_INITIALIZED`. The test script saves the first balance row's `id` to `leave_balance_id` and `leave_type_id`.

**With carry-forward from prior year:**
```json
{
  "employee_id": "{{employee_id}}",
  "leave_year": 2026,
  "carry_forward": [
    { "leave_type_id": "<casual-uuid>", "days": 3 }
  ]
}
```

#### 3. Bulk Initialize (Year Rollover)

`POST /api/v1/leave-balances/initialize/bulk`

```json
{
  "leave_year": 2026,
  "scope": "ORGANIZATION",
  "auto_carry_forward": true
}
```

`scope` options:
- `ORGANIZATION` — every active employee in the org
- `DEPARTMENT` — pair with `department_ids: [...]`
- `EMPLOYEES` — pair with `employee_ids: [...]`

`auto_carry_forward: true` reads each employee's prior-year `available_days` and seeds `carry_forward` automatically.

> Already-initialized employees are **skipped, not failed**. The response returns `initialized_count` plus `skipped[]` with reasons.

---

### Phase 2 — Read Balances

#### 4. Get My Balance

`GET /api/v1/leave-balances/me?leave_year=2026`

Self-service — no `LEAVE_MGMT` permission required. Returns:

```json
{
  "employee_id": "...",
  "leave_year": 2026,
  "leave_cycle": { "start": "2026-01-01", "end": "2026-12-31" },
  "total_allocated": 24,
  "total_available": 18,
  "balances": [
    {
      "leave_type_code": "CL",
      "leave_type_name": "Casual Leave",
      "is_unlimited": false,
      "allocated_days": 12,
      "used_days": 4,
      "pending_days": 1,
      "consumed_days": 5,
      "available_days": 7
    },
    {
      "leave_type_code": "LWP",
      "is_unlimited": true,
      "allocated_days": null,
      "used_days": 0,
      "pending_days": 0,
      "consumed_days": null,
      "available_days": null
    }
  ]
}
```

> Use `consumed_days` (= used + pending) for UI cards like `5 / 12`. Don't compute it client-side — leads to off-by-one errors when there are pending requests.

#### 5. List All Balances (HR)

`GET /api/v1/leave-balances?leave_year=2026&search=jane&low_balance=true`

Filters supported:
- `search` — free-text on employee name OR employee code (≥ 2 chars)
- `department_id`, `leave_type_id`, `employee_id` — exact match
- `low_balance=true` — `available_days <= 2`
- `status=ACTIVE|INACTIVE`

Requires `LEAVE_MGMT.view`.

#### 6. Get Balance Ledger (Audit Trail)

`GET /api/v1/leave-balances/{{leave_balance_id}}/ledger`

Immutable history of every credit/debit on the row. Entry types:

| `entry_type`        | When written                                       |
| ------------------- | -------------------------------------------------- |
| `INITIAL_GRANT`     | Balance row created                                |
| `CARRY_FORWARD`     | On init with carry-forward days                    |
| `MANUAL_ADJUSTMENT` | HR called `/adjust`                                |
| `REQUEST_HOLD`      | Leave request → PENDING                            |
| `REQUEST_RELEASE`   | Leave request rejected / cancelled                 |
| `REQUEST_CONSUME`   | Leave request approved                             |
| `MONTHLY_ACCRUAL`   | Monthly cron (not yet implemented in v1)           |
| `LAPSE`             | Year rollover with no carry-forward                |

`running_balance` is `null` for unlimited types (LWP).

---

### Phase 3 — Manual Adjustments

#### 7. Adjust Balance

`PATCH /api/v1/leave-balances/{{leave_balance_id}}/adjust`

```json
{
  "direction": "CREDIT",
  "days": 2,
  "reason": "Bonus leaves for project milestone"
}
```

- `days` must be in `0.5` increments
- `reason` is mandatory (5–500 chars)
- `DEBIT` cannot drop `available_days` below zero → `422 INSUFFICIENT_BALANCE`
- LWP returns `422 UNLIMITED_TYPE_NOT_ADJUSTABLE`

Generates a `MANUAL_ADJUSTMENT` ledger entry. Requires `LEAVE_MGMT.update`.

#### 8. Recompute (Self-Heal)

`POST /api/v1/leave-balances/{{leave_balance_id}}/recompute`

Re-aggregates `used_days` and `pending_days` from the source-of-truth `leave_requests` table. Use this if you suspect drift between the cache and the source. Returns:

```json
{
  "before": { "used_days": 4, "pending_days": 1, "available_days": 7 },
  "after":  { "used_days": 4, "pending_days": 1, "available_days": 7 },
  "drift_detected": false
}
```

No-op for unlimited types.

---

### Phase 4 — Apply for Leave (Employee)

#### 9. Validate (Dry-Run)

`POST /api/v1/leave-requests/validate`

```json
{
  "leave_type_id": "{{leave_type_id}}",
  "from_date": "2026-05-12",
  "to_date": "2026-05-14",
  "is_half_day": false,
  "reason": "Family vacation planned in advance."
}
```

Use this to power a live "Days: 3" counter in the Apply Leave UI. Returns `is_valid`, `computed_days_breakdown`, and `balance_before / balance_after`. Persists nothing.

> **Always** call this on date-pick, not on submit. Cheaper than catching a 422 on submit.

#### 10. Create Leave Request (Submit)

`POST /api/v1/leave-requests`

```json
{
  "leave_type_id": "{{leave_type_id}}",
  "from_date": "2026-05-12",
  "to_date": "2026-05-14",
  "reason": "Family vacation planned in advance.",
  "submit": true
}
```

Behaviors:
- `submit: true` (default) → status goes straight to `PENDING`, balance is held
- `submit: false` → status stays `DRAFT`; edit later, then call `/submit`
- `is_half_day: true` requires `from_date == to_date` AND a `half_day_slot: "FIRST_HALF" | "SECOND_HALF"`
- Server computes `total_days` — never trust the client value
- Saves `leave_request_id` for downstream calls

Half-day example:
```json
{
  "leave_type_id": "{{leave_type_id}}",
  "from_date": "2026-05-12",
  "to_date": "2026-05-12",
  "is_half_day": true,
  "half_day_slot": "FIRST_HALF",
  "reason": "Doctor's appointment."
}
```

LWP example (skips balance check + max_per_month):
```json
{
  "leave_type_id": "{{lwp_leave_type_id}}",
  "from_date": "2026-07-01",
  "to_date": "2026-07-05",
  "reason": "Personal — unpaid leave."
}
```

#### 11. List My Requests

`GET /api/v1/leave-requests/me?status=PENDING,APPROVED&page=1&limit=20`

Each row includes the unified `manager_note` field — resolves to:
- `null` for DRAFT / PENDING
- `approver_comment` for APPROVED
- `rejection_reason` for REJECTED
- admin cancel `reason` for CANCELLED-by-admin
- `null` for CANCELLED-by-self

#### 12. Get Request Detail + Timeline

`GET /api/v1/leave-requests/{{leave_request_id}}` — full detail
`GET /api/v1/leave-requests/{{leave_request_id}}/history` — append-only audit trail

The history endpoint powers the request-detail timeline UI (Applied → PENDING → APPROVED).

#### 13. Update / Cancel

| Endpoint                                             | Allowed When                                       |
| ---------------------------------------------------- | -------------------------------------------------- |
| `PATCH /leave-requests/:id` (full edit)              | DRAFT only                                         |
| `PATCH /leave-requests/:id` (`reason`, `attachments` only) | PENDING                                       |
| `POST /leave-requests/:id/submit`                    | DRAFT → re-runs all validations                    |
| `POST /leave-requests/:id/cancel`                    | DRAFT, PENDING, or APPROVED (before from_date)     |
| `DELETE /leave-requests/:id`                         | DRAFT only — hard delete                           |

> To change dates on a PENDING request: cancel and re-create. Dates are **frozen** once submitted.

---

### Phase 5 — Approve / Reject (HR / Manager)

#### 14. Pending Approvals (Manager Inbox)

`GET /api/v1/leave-requests/pending-approval`

Returns all `PENDING` requests in the org that the caller can approve. Requires `LEAVE_MGMT.approve`.

> v1 limitation: every user with `LEAVE_MGMT.approve` sees all pending requests in the org. Manager-of routing (`reports_to_id`) is a v2 task.

#### 15. Approve

`POST /api/v1/leave-requests/{{leave_request_id}}/approve`

```json
{ "comment": "Enjoy your holiday" }
```

- **Self-approval forbidden** — even with the permission
- Re-validates balance at approval time (race-safe). If concurrent approvals would over-consume, the loser gets `422 INSUFFICIENT_BALANCE_AT_APPROVAL`
- Atomic transaction with row-lock on the balance row
- Snapshots balance into `balance_snapshot_at_approval` for auditing

#### 16. Reject

`POST /api/v1/leave-requests/{{leave_request_id}}/reject`

```json
{ "rejection_reason": "Conflicts with planned release." }
```

`rejection_reason` is mandatory (5–500 chars). Releases held days back to `available`.

#### 17. Admin Cancel (HR Override)

`POST /api/v1/leave-requests/{{leave_request_id}}/admin-cancel`

```json
{ "reason": "Retroactive correction approved by HR." }
```

Cancels any non-terminal request — including APPROVED requests whose start date has passed. Credits days back, even if already consumed. Requires `LEAVE_MGMT.delete`.

---

## State Machine Reference

```
        ┌─────────┐    submit    ┌──────────┐   approve   ┌──────────┐
        │  DRAFT  │ ───────────▶│ PENDING  │ ──────────▶ │ APPROVED │
        └─────────┘              └──────────┘              └──────────┘
             │                       │   │                       │
       delete│                cancel │   │ reject         cancel │ (before from_date)
             ▼                       ▼   ▼                       ▼
       (hard delete)            ┌──────────┐    ┌──────────┐ ┌──────────┐
                                │CANCELLED │    │ REJECTED │ │CANCELLED │
                                └──────────┘    └──────────┘ └──────────┘
```

| Transition             | Ledger Entry Generated                          |
| ---------------------- | ----------------------------------------------- |
| `DRAFT → PENDING`      | `REQUEST_HOLD` (debit pending_days)             |
| `PENDING → APPROVED`   | `REQUEST_CONSUME` (debit used, release pending) |
| `PENDING → REJECTED`   | `REQUEST_RELEASE` (release pending)             |
| `PENDING → CANCELLED`  | `REQUEST_RELEASE` (release pending)             |
| `APPROVED → CANCELLED` | `REQUEST_RELEASE` (re-credit available)         |

---

## Error Reference

| Scenario                                                     | HTTP | Code                              |
| ------------------------------------------------------------ | ---- | --------------------------------- |
| No active LeaveConfig for org                                | 422  | `NO_ACTIVE_CONFIG`                |
| Initialize twice for same `(employee, year)`                 | 409  | `ALREADY_INITIALIZED`             |
| Adjust on LWP balance                                        | 422  | `UNLIMITED_TYPE_NOT_ADJUSTABLE`   |
| Adjust would drop available below 0                          | 422  | `INSUFFICIENT_BALANCE`            |
| Date range crosses leave year                                | 422  | `OUT_OF_LEAVE_YEAR`               |
| `from_date < today` and rule disallows                       | 422  | `BACKDATED_NOT_ALLOWED`           |
| `from_date < today - max_backdated_days`                     | 422  | `BACKDATED_LIMIT_EXCEEDED`        |
| Sum of monthly leaves > `LeaveRules.max_per_month`           | 422  | `MAX_PER_MONTH_EXCEEDED`          |
| `is_half_day=true` but disabled at config or leave-type      | 422  | `HALF_DAY_DISABLED`               |
| `is_half_day=true` but `from_date != to_date`                | 422  | `HALF_DAY_RANGE`                  |
| Available balance < requested days                           | 422  | `INSUFFICIENT_BALANCE`            |
| Concurrent approval consumed the balance first               | 422  | `INSUFFICIENT_BALANCE_AT_APPROVAL`|
| Date range overlaps another PENDING/APPROVED request         | 409  | `OVERLAPPING_REQUEST`             |
| State transition not allowed (e.g. approve a CANCELLED row)  | 422  | `INVALID_STATE`                   |
| Self-cancel an approved leave whose start date has passed    | 422  | `ALREADY_CONSUMED`                |
| Approver = requester                                          | 403  | `SELF_APPROVAL_FORBIDDEN`         |
| Caller is not the request owner                              | 403  | `NOT_REQUEST_OWNER`               |

---

## v1 Limitations (Documented Gaps)

These are documented in the API contracts as out-of-scope for v1:

1. **Manager-of routing** — `pending-approval` returns all pending requests in the org, not just those reporting to the caller. Requires wiring `User.reports_to_id` into the query.
2. **Monthly accrual + year rollover crons** — service has the math (`computeAccruedDays`) but no scheduler. For now, accrued = allocated for `accrual=none`, and full allocation for `accrual=monthly` types if the year is in the past.
3. **Holiday integration in date math** — only weekends (Sat/Sun) are subtracted from billable days. Public holidays from `HolidayCalendar` are not yet wired in.
4. **Notification module wiring** — no notifications fired on submit / approve / reject. The `notification` module exists but isn't called from leave-request transitions.
5. **Leave year cycle** — uses calendar year (Jan–Dec). Fiscal year support requires adding a `cycle_start_month` column to `LeaveConfig` (deferred).
6. **Multi-level approval chains** — single-step approval only.
7. **Comp-off (compensatory off)** — not modeled.
