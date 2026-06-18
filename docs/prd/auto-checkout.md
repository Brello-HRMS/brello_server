# Product Requirement Document (PRD)

# Module: Auto Checkout System — Attendance Module

## Product: Brello HRMS

---

# 1. Executive Summary

Employees can check in but forget to check out. Without an automated resolution, attendance sessions remain open indefinitely. This corrupts payroll calculations, inflates worked hours, and pollutes reporting dashboards.

The Auto Checkout System resolves open attendance sessions automatically, using a per-shift configurable engine that respects legitimate overtime, handles cross-midnight night shifts, and produces a clean audit trail for every automated action.

---

# 2. Current State Audit

## 2.1 What Already Exists (Partially Implemented)

| Entity / Field | Location | Current State | Gap |
|---|---|---|---|
| `Shift.auto_checkout_time` | `shift.entity.ts:24` | Column exists (`varchar(5)`, nullable) | Never read or enforced anywhere in the codebase |
| `Shift.is_night_shift` | `shift.entity.ts:36` | Column exists (`boolean`) | Flag is stored but never consulted in check-in, check-out, or any calculation |
| `AttendanceSource.AUTO` | `attendance-source.enum.ts:2` | Enum value exists | Never assigned to any session; check-out always uses employee's `dto.device` |
| `AttendanceStatus.MISSED_CHECKOUT` | `attendance-status.enum.ts` | Enum value exists | Only set via admin manual override; no automated path sets this |
| `AttendanceRule.overtime_after_hours` | `attendance-rule.entity.ts:46` | Used for overtime calculation | Not used in auto-checkout timing decision |
| `AttendanceRule.overtime_multiplier` | `attendance-rule.entity.ts:50` | Stored | Never used in any calculation |

## 2.2 What Is Missing (Net New)

- No background job or scheduler in the entire codebase
- `@nestjs/schedule` is not installed / not imported in `AppModule`
- No `AutoCheckoutService` exists
- No correction request workflow (employee disputes auto-checkout time)
- No `is_auto_checkout` flag on `AttendanceSession`
- No `overtime_grace_minutes` or `max_session_hours` on `Shift`
- Night shift cross-midnight logic not implemented anywhere
- `AuditEventType.AUTO_CHECKOUT` enum value missing
- Payroll has no special handling for auto-checkout records

---

# 3. Industry Benchmark Analysis

## How leading HRMS platforms handle forgotten checkouts

### Zoho People
- Configures a **missed punch cutoff time** per shift (e.g., 11:59 PM)
- At cutoff, open sessions are closed with `source = SYSTEM`
- Attendance is marked `MISSED_PUNCH` — a distinct status from `PRESENT`
- Employee receives an in-app notification to regularize
- HR can approve or reject regularization requests
- Payroll treats `MISSED_PUNCH` as a pending item until regularized

### greytHR
- Uses a **maximum working hours cap** (e.g., 14 hours) per shift
- Auto-checkout = `check_in_at + max_hours`
- If check-out exceeds shift end + overtime buffer, session is closed at the calculated cap
- Auto-checkout records are flagged for manager review before payroll lock
- Overtime is calculated only up to the configured `max_overtime_hours`, not beyond

### Keka
- Defines an **auto-close time** in shift configuration, typically `shift_end + 2 hours`
- Night shift sessions close the following morning at the calculated shift-end-next-day + buffer
- Distinct `checkout_type: AUTO | MANUAL | BIOMETRIC` field on session
- Regularization feature lets employees submit the correct checkout time
- Managers approve/reject regularization; audit trail shows both auto and corrected values

### Darwinbox
- Configures **overtime limit per shift** (e.g., 4 hours maximum OT)
- Auto-checkout = `shift_end_time + overtime_limit`
- Separate **attendance regularization** module — employee submits what the correct checkout was
- Regularization goes through configurable approval chain (1-level or 2-level)
- Payroll locks attendance after regularization deadline

### SAP SuccessFactors / Workday
- Enterprise-grade approach with **time collector rules**
- Session closure driven by: shift end + overtime cap OR midnight cap (whichever is earliest)
- Full audit with before/after snapshot on every automated change
- Integration with biometric systems — device sync delay is accounted for with a configurable buffer
- Payroll never reads raw attendance; it reads a **processed/approved attendance summary**

## Common Patterns Across All Systems

1. **Two-parameter cap**: Every system uses BOTH a time-based cap (shift end + buffer) AND a duration-based cap (max session hours)
2. **Source tagging**: Auto-closed sessions are always tagged separately from manual and device checkouts
3. **Regularization path**: Employees always have a way to dispute and correct auto-checkout
4. **Payroll freeze**: Payroll processing waits for auto-checkout records to be either confirmed or corrected
5. **Audit trail**: Every auto-checkout writes a before/after audit record, not just the checkout action

---

# 4. Recommended Architecture

## 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BRELLO HRMS                                  │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────────────────────────────┐   │
│  │  Employee    │    │          Attendance Module                │   │
│  │  App/Web     │    │                                          │   │
│  │  Check-in    │───▶│  AttendanceService.checkIn()             │   │
│  │  Check-out   │───▶│  AttendanceService.checkOut()            │   │
│  └──────────────┘    │                                          │   │
│                      │  [NEW] AutoCheckoutService               │   │
│  ┌──────────────┐    │    └─ resolveAutoCheckoutTime()          │   │
│  │  @Cron Job   │    │    └─ processOrganization()              │   │
│  │  (every 15m) │───▶│    └─ closeOpenSession()                 │   │
│  └──────────────┘    │    └─ auditAutoCheckout()                │   │
│                      │                                          │   │
│  ┌──────────────┐    │  [NEW] CorrectionRequestService          │   │
│  │  Employee    │    │    └─ submitCorrection()                  │   │
│  │  Correction  │───▶│    └─ approveCorrection()                │   │
│  │  Request     │    │    └─ rejectCorrection()                  │   │
│  └──────────────┘    └──────────────────────────────────────────┘   │
│                                          │                          │
│                      ┌───────────────────▼───────────────────────┐  │
│                      │            Payroll Module                 │  │
│                      │  PayrollSourceRepository                  │  │
│                      │    └─ attendanceSummary() [MODIFIED]      │  │
│                      └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 4.2 Data Flow — Auto Checkout

```
[Every 15 minutes] @Cron fires
        │
        ▼
Fetch all orgs with auto_checkout_enabled shifts
        │
        ▼
For each org: fetch open sessions (check_out_at IS NULL)
        │
        ▼
For each open session:
    Resolve shift for that session's attendance_record.shift_id
        │
        ├── Calculate auto_checkout_at:
        │       min(
        │         shift_end + overtime_grace_minutes,   ← time-based cap
        │         check_in_at + max_session_hours       ← duration-based cap
        │       )
        │
        ├── Is now >= auto_checkout_at?
        │       NO  → skip (session is still within allowed window)
        │       YES → proceed
        │
        ▼
Close session:
    session.check_out_at = auto_checkout_at   ← NOT now(), but the calculated cutoff
    session.source = AUTO
    session.is_auto_checkout = true            ← NEW flag
        │
        ▼
Recompute attendance_record:
    worked_minutes, overtime_minutes, status
    record.has_auto_checkout = true            ← NEW flag for payroll/HR visibility
        │
        ▼
Write AuditLog (event_type = AUTO_CHECKOUT)
        │
        ▼
Notify employee (push notification / in-app alert)
```

---

# 5. Auto Checkout Algorithm

## 5.1 Core Formula

```
auto_checkout_at = min(
  shift_end_datetime + overtime_grace_minutes,
  session.check_in_at + shift.max_session_hours * 60
)
```

Where `shift_end_datetime` is calculated as:

```
# Same-day shift (e.g., 09:00 – 18:00)
shift_end_datetime = date_of_check_in + shift.end_time

# Night shift (e.g., 22:00 – 06:00, is_night_shift = true)
shift_end_datetime = date_of_check_in + 1 day + shift.end_time
```

## 5.2 Worked Minutes Computation

```
worked_minutes = diffMinutes(session.check_in_at, auto_checkout_at)
```

This is the same function used in the normal checkout flow (`attendance-calc.util.ts:diffMinutes`). No special formula is needed — the auto-checkout time simply becomes the check-out timestamp.

## 5.3 Overtime Calculation

Overtime follows the exact same path as a manual checkout:

```
if (rule.overtime_after_hours && worked_minutes > rule.overtime_after_hours * 60):
    overtime_minutes = worked_minutes - (rule.overtime_after_hours * 60)
else:
    overtime_minutes = 0
```

This ensures auto-checkout does NOT strip valid overtime — if the employee worked past the overtime threshold before the auto-checkout cutoff, those hours are captured.

## 5.4 Example Walkthrough

**Scenario: Evening Shift Employee Forgets Checkout**

```
Shift Config:
  start_time:            "14:00"
  end_time:              "22:00"
  is_night_shift:        false
  overtime_grace_minutes: 90       (NEW field)
  max_session_hours:     14        (NEW field)
  auto_checkout_enabled: true      (NEW field)

Rule Config:
  overtime_after_hours:  8.0       (existing field)

Employee:
  check_in_at:  2024-01-15 13:45:00  (checked in 15 min early)

Calculation:
  shift_end_datetime       = 2024-01-15 22:00:00
  time-based cap           = 22:00 + 90 min  = 2024-01-15 23:30:00
  duration-based cap       = 13:45 + 14h     = 2024-01-16 03:45:00
  auto_checkout_at         = min(23:30, 03:45) = 2024-01-15 23:30:00

  worked_minutes           = diffMinutes(13:45, 23:30) = 585 min = 9h 45m
  full_day_hours threshold = 8h = 480 min
  overtime_after_hours     = 8h = 480 min
  overtime_minutes         = 585 - 480 = 105 min = 1h 45m

  attendance_status        = PRESENT (worked > full_day_hours, checked in before grace)
  is_overtime              = true
  has_auto_checkout        = true    (flagged for payroll review)
```

**Scenario: Night Shift**

```
Shift Config:
  start_time:            "22:00"
  end_time:              "06:00"
  is_night_shift:        true
  overtime_grace_minutes: 60
  max_session_hours:     12

Employee:
  check_in_at:  2024-01-15 21:50:00

Calculation:
  shift_end_datetime       = 2024-01-16 06:00:00  (next day, is_night_shift = true)
  time-based cap           = 2024-01-16 06:00 + 60 min = 2024-01-16 07:00:00
  duration-based cap       = 2024-01-15 21:50 + 12h   = 2024-01-16 09:50:00
  auto_checkout_at         = min(07:00, 09:50) = 2024-01-16 07:00:00

  attendance_record.date   = 2024-01-15  (date of check-in, NOT checkout)
  worked_minutes           = diffMinutes(21:50, 07:00 next day) = 550 min = 9h 10m
```

## 5.5 Why This Prevents Each Failure Mode

| Failure Mode | Prevention |
|---|---|
| Infinite open sessions | `max_session_hours` is an absolute hard cap — no session can exceed it regardless of shift config |
| Payroll corruption | `has_auto_checkout` flag prevents payroll from silently accepting inflated hours; payroll can require HR sign-off |
| Lost overtime | `auto_checkout_at` is `shift_end + overtime_grace_minutes`, not `shift_end`. Employees who work valid OT get it captured |
| Night shift wrong date | `attendance_record.date` is always the check-in date; the checkout time can be on a later calendar day |
| Device sync delay | Cron runs every 15 min; a configurable `sync_buffer_minutes` on the shift prevents premature auto-checkout during sync windows |

---

# 6. Shift Configuration Model

## 6.1 Current `shifts` Table — Fields to ADD

```sql
-- New migration: add_auto_checkout_fields_to_shifts

ALTER TABLE shifts
  ADD COLUMN overtime_grace_minutes  INT          NOT NULL DEFAULT 120,
  ADD COLUMN max_session_hours       DECIMAL(4,2) NOT NULL DEFAULT 14.00,
  ADD COLUMN auto_checkout_enabled   BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN sync_buffer_minutes     INT          NOT NULL DEFAULT 0;
```

## 6.2 Updated Shift Configuration JSON

```json
{
  "name": "Evening Shift",
  "start_time": "14:00",
  "end_time": "22:00",
  "late_grace_minutes": 15,
  "is_night_shift": false,
  "auto_checkout_time": "23:30",
  "overtime_grace_minutes": 90,
  "max_session_hours": 14.0,
  "auto_checkout_enabled": true,
  "sync_buffer_minutes": 0,
  "full_day_hours": 8.0,
  "half_day_hours": 4.0,
  "allow_multiple_checkins": false
}
```

## 6.3 Field Reference

| Field | Type | Default | Description |
|---|---|---|---|
| `start_time` | `HH:mm` | required | Shift start time |
| `end_time` | `HH:mm` | required | Shift end time |
| `late_grace_minutes` | int | 0 | Minutes after start_time before marking late |
| `is_night_shift` | boolean | false | Whether shift crosses midnight (end_time is next calendar day) |
| `auto_checkout_time` | `HH:mm` | nullable | **DEPRECATED** — was never enforced; replaced by the computed formula. Keep column for backward compat but ignore in engine |
| `overtime_grace_minutes` | int | 120 | **NEW** — Minutes after shift_end_time during which overtime is still captured before auto-checkout fires |
| `max_session_hours` | decimal | 14.0 | **NEW** — Absolute hard cap on session duration regardless of shift or overtime |
| `auto_checkout_enabled` | boolean | true | **NEW** — Per-shift toggle to disable auto-checkout (e.g., for executives with flexible hours) |
| `sync_buffer_minutes` | int | 0 | **NEW** — Extra delay before auto-checkout to absorb biometric device sync delays |
| `full_day_hours` | decimal | required | Hours required to qualify as a full working day |
| `half_day_hours` | decimal | required | Hours required to qualify as a half-day |
| `allow_multiple_checkins` | boolean | false | Allow multiple check-in/check-out pairs per day |

---

# 7. Attendance Record & Session Changes

## 7.1 `attendance_sessions` Table — Fields to ADD

```sql
-- New migration: add_auto_checkout_fields_to_attendance_sessions

ALTER TABLE attendance_sessions
  ADD COLUMN is_auto_checkout BOOLEAN NOT NULL DEFAULT false;
```

**Purpose:** Marks sessions that were closed by the auto-checkout engine. The `source` column is already `AUTO` for these, but the boolean allows instant index lookups without enum comparisons.

## 7.2 `attendance_records` Table — Fields to ADD

```sql
-- New migration: add_auto_checkout_fields_to_attendance_records

ALTER TABLE attendance_records
  ADD COLUMN has_auto_checkout BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN correction_status VARCHAR(20) NULL;
  -- correction_status: NULL | 'PENDING' | 'APPROVED' | 'REJECTED'
```

**Purpose:**
- `has_auto_checkout` — HR and payroll can filter/flag records that were auto-closed
- `correction_status` — Tracks whether the employee has submitted a correction request and its outcome

## 7.3 Full Attendance Record Schema (After Changes)

```
attendance_records
──────────────────
id                    uuid PK
organization_id       uuid NOT NULL
enterprise_id         uuid NOT NULL
employee_id           uuid NOT NULL
date                  date NOT NULL
shift_id              uuid FK → shifts
rule_id               uuid FK → attendance_rules
first_check_in_at     timestamptz
last_check_out_at     timestamptz
worked_minutes        int DEFAULT 0
overtime_minutes      int DEFAULT 0
late_minutes          int
is_late               boolean DEFAULT false
is_half_day           boolean DEFAULT false
is_overtime           boolean DEFAULT false
attendance_status     enum (PRESENT|LATE|HALF_DAY|ABSENT|MISSED_CHECKOUT|...)
attendance_mode       enum (OFFICE_IN|REMOTE_IN)
source                enum (AUTO|MANUAL|WEB|MOBILE|BIOMETRIC)
has_auto_checkout     boolean DEFAULT false          ← NEW
correction_status     varchar(20) NULL               ← NEW (NULL|PENDING|APPROVED|REJECTED)
remote_reason         text
notes                 text
office_id             uuid FK → geo_fences
office_name           varchar(255)
is_deleted            boolean DEFAULT false
```

## 7.4 Full Attendance Session Schema (After Changes)

```
attendance_sessions
────────────────────
id                         uuid PK
organization_id            uuid NOT NULL
enterprise_id              uuid NOT NULL
attendance_record_id       uuid FK → attendance_records (CASCADE)
employee_id                uuid NOT NULL
check_in_at                timestamptz NOT NULL
check_out_at               timestamptz NULL
worked_minutes             int DEFAULT 0
is_auto_checkout           boolean DEFAULT false       ← NEW
attendance_mode            enum (OFFICE_IN|REMOTE_IN)
source                     enum (AUTO|MANUAL|WEB|MOBILE|BIOMETRIC)
geo_status                 enum
check_in_latitude          decimal(10,7)
check_in_longitude         decimal(10,7)
check_out_latitude         decimal(10,7) NULL
check_out_longitude        decimal(10,7) NULL
distance_from_office_meters int
remote_reason              text
notes                      text
check_in_ip                varchar(45)
check_out_ip               varchar(45)
```

---

# 8. New Entity: Attendance Correction Request

When an employee's session is auto-closed, they must be able to request a correction. This is a new entity and workflow.

## 8.1 `attendance_correction_requests` Table

```sql
CREATE TABLE attendance_correction_requests (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL,
  enterprise_id             UUID NOT NULL,
  attendance_record_id      UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  attendance_session_id     UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  employee_id               UUID NOT NULL,

  -- What actually happened (employee's claim)
  requested_check_out_at    TIMESTAMPTZ NOT NULL,
  employee_reason           TEXT NOT NULL,

  -- What the system auto-closed with (snapshot at time of request)
  auto_checkout_at          TIMESTAMPTZ NOT NULL,
  auto_worked_minutes       INT NOT NULL,

  -- Approval workflow
  approval_status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewed_by               UUID NULL,
  reviewed_at               TIMESTAMPTZ NULL,
  reviewer_notes            TEXT NULL,

  -- Timestamps
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted                BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_correction_requests_org_status
  ON attendance_correction_requests(organization_id, approval_status)
  WHERE is_deleted = false;

CREATE UNIQUE INDEX idx_correction_requests_session
  ON attendance_correction_requests(attendance_session_id)
  WHERE is_deleted = false;
```

## 8.2 Correction Request Workflow

```
Employee sees auto-checkout on their dashboard
        │
        ▼
Employee submits correction request:
  POST /attendance/me/correction-requests
  {
    attendance_session_id: "...",
    requested_check_out_at: "2024-01-15T22:45:00Z",
    employee_reason: "Forgot to check out before leaving at 10:45 PM"
  }
        │
        ▼
System validates:
  - Session must have is_auto_checkout = true
  - requested_check_out_at must be <= auto_checkout_at (can't claim later than auto-checkout)
  - requested_check_out_at must be >= session.check_in_at
  - No existing pending correction for this session
        │
        ▼
Creates CorrectionRequest record (approval_status = PENDING)
Updates attendance_record.correction_status = 'PENDING'
        │
        ▼
HR/Manager reviews:
  GET /attendance/admin/correction-requests (paginated, filterable by status/date/employee)
  POST /attendance/admin/correction-requests/:id/approve
  POST /attendance/admin/correction-requests/:id/reject
        │
        ├── APPROVE:
        │     Updates session.check_out_at = requested_check_out_at
        │     Recalculates worked_minutes, overtime_minutes, attendance_status
        │     Updates attendance_record with corrected values
        │     Sets correction_status = 'APPROVED'
        │     Logs AuditEventType.CORRECTION_APPROVED
        │
        └── REJECT:
              Keeps auto-checkout values unchanged
              Sets correction_status = 'REJECTED'
              Logs AuditEventType.CORRECTION_REJECTED
```

---

# 9. Audit Event Types — Changes

## 9.1 New Values to Add to `AuditEventType` Enum

```typescript
// audit-event-type.enum.ts — ADD these values
export enum AuditEventType {
  // ... existing values ...
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  OFFICE_IN = 'OFFICE_IN',
  REMOTE_IN = 'REMOTE_IN',
  GEO_REJECTION = 'GEO_REJECTION',
  MANUAL_CREATE = 'MANUAL_CREATE',
  MANUAL_UPDATE = 'MANUAL_UPDATE',
  MANUAL_DELETE = 'MANUAL_DELETE',
  STATUS_OVERRIDE = 'STATUS_OVERRIDE',
  REMOTE_APPROVE = 'REMOTE_APPROVE',
  REMOTE_REJECT = 'REMOTE_REJECT',

  // NEW:
  AUTO_CHECKOUT = 'AUTO_CHECKOUT',           // System auto-closed session
  CORRECTION_SUBMITTED = 'CORRECTION_SUBMITTED',
  CORRECTION_APPROVED = 'CORRECTION_APPROVED',
  CORRECTION_REJECTED = 'CORRECTION_REJECTED',
}
```

---

# 10. Background Job Design

## 10.1 Package Requirement

Install `@nestjs/schedule`:

```bash
npm install @nestjs/schedule
```

Register in `AppModule`:

```typescript
// app.module.ts
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),   // ADD
    // ...other modules
  ],
})
export class AppModule {}
```

## 10.2 AutoCheckoutService — New Service

**File:** `src/modules/attendance/services/auto-checkout.service.ts`

**Cron schedule:** Every 15 minutes (`0,15,30,45 * * * *`)

**Execution Logic:**

```
1. Fetch all distinct shift configurations where auto_checkout_enabled = true

2. For each shift:
   a. Calculate expected auto_checkout_at based on current time context
   b. Query all open sessions where check_in_at is old enough to trigger

3. For each qualifying open session (batches of 100):
   a. Resolve the attendance rule for the session's shift
   b. Compute auto_checkout_at (the precise timestamp to use as checkout)
   c. If current_time < auto_checkout_at: skip (not yet due)
   d. Compute worked_minutes = diffMinutes(session.check_in_at, auto_checkout_at)
   e. Compute computeAttendanceStatus(worked_minutes, rule, isLate)
   f. Update session: check_out_at, worked_minutes, source = AUTO, is_auto_checkout = true
   g. Update attendance_record: last_check_out_at, worked_minutes, overtime_minutes,
      attendance_status, has_auto_checkout = true
   h. Write audit log: event_type = AUTO_CHECKOUT, old_value, new_value
   i. Enqueue notification to employee

4. Log total processed count and any errors
```

## 10.3 Database Query Design

**Fetch open sessions eligible for auto-checkout:**

```sql
SELECT
  s.id              AS session_id,
  s.check_in_at,
  s.employee_id,
  s.attendance_record_id,
  s.organization_id,
  s.enterprise_id,
  ar.shift_id,
  ar.rule_id,
  sh.start_time,
  sh.end_time,
  sh.is_night_shift,
  sh.overtime_grace_minutes,
  sh.max_session_hours,
  sh.sync_buffer_minutes,
  rl.overtime_after_hours,
  rl.full_day_hours,
  rl.half_day_hours,
  rec.first_check_in_at,
  rec.is_late
FROM attendance_sessions s
JOIN attendance_records ar    ON ar.id = s.attendance_record_id
JOIN shifts sh                ON sh.id = ar.shift_id
JOIN attendance_rules rl      ON rl.id = ar.rule_id
JOIN attendance_records rec   ON rec.id = s.attendance_record_id
WHERE
  s.check_out_at IS NULL
  AND s.is_deleted = false
  AND sh.auto_checkout_enabled = true
  AND sh.is_deleted = false
  -- Earliest possible auto-checkout is check_in + half_day_hours
  -- This prevents firing on sessions that just opened
  AND s.check_in_at <= NOW() - INTERVAL '4 hours'
ORDER BY s.check_in_at ASC
LIMIT 500;
```

**Why `LIMIT 500`:** This is processed in one cron tick. Each tick processes the oldest 500 open sessions. If there are more, they will be picked up in the next tick (15 minutes later). This prevents long-running transactions.

## 10.4 Indexes Required for Performance

```sql
-- Existing index on open sessions (verify it exists):
CREATE INDEX idx_sessions_open
  ON attendance_sessions(organization_id, employee_id, check_in_at)
  WHERE check_out_at IS NULL AND is_deleted = false;

-- New index for auto-checkout job:
CREATE INDEX idx_sessions_auto_checkout_candidates
  ON attendance_sessions(check_in_at)
  WHERE check_out_at IS NULL AND is_deleted = false;
```

## 10.5 Concurrency Safety

- Use a database-level advisory lock or `SELECT ... FOR UPDATE SKIP LOCKED` to prevent two cron instances from processing the same session simultaneously (relevant if multiple server instances run)
- Each session update should be wrapped in a transaction
- Failures on individual sessions should be caught and logged without stopping the batch

```typescript
// Pseudocode for safe batch processing
for (const session of sessions) {
  try {
    await dataSource.transaction(async (manager) => {
      // SELECT ... FOR UPDATE SKIP LOCKED
      const locked = await manager.findOne(AttendanceSession, {
        where: { id: session.id, check_out_at: IsNull() },
        lock: { mode: 'pessimistic_write_or_fail' },
      });
      if (!locked) return; // Another instance grabbed it
      await this.closeSession(manager, session);
    });
  } catch (err) {
    this.logger.error(`Auto-checkout failed for session ${session.id}: ${err.message}`);
    // Continue with next session — don't abort the batch
  }
}
```

## 10.6 Scaling for Millions of Records

| Concern | Solution |
|---|---|
| Query performance | Partial index on `(check_in_at) WHERE check_out_at IS NULL` — only open sessions are indexed |
| Batch size | Process max 500 sessions per tick; 15-minute cadence means backlog clears quickly |
| Write amplification | Two writes per session (session + record). Batching updates within a tick reduces round-trips |
| Multiple server instances | `SELECT FOR UPDATE SKIP LOCKED` prevents double-processing |
| Log volume | Audit logs for AUTO_CHECKOUT should not bloat the main audit table — consider a separate partition or TTL |
| Multi-tenant isolation | Each session carries `organization_id`; job processes all orgs in one pass but writes are tenant-isolated |

---

# 11. Edge Cases

## 11.1 Night Shifts Crossing Midnight

```
shift.is_night_shift = true
shift.start_time    = "22:00"
shift.end_time      = "06:00"

check_in_at = 2024-01-15 21:55:00

attendance_record.date     = 2024-01-15   ← date of check-in
shift_end_datetime         = 2024-01-16 06:00:00   ← next day
auto_checkout_at           = 2024-01-16 07:00:00   (shift_end + 60 min grace)

Cron at 2024-01-15 23:45 → session is open but auto_checkout_at hasn't passed → skip
Cron at 2024-01-16 07:15 → NOW() > auto_checkout_at → fire auto-checkout
```

**Rule for night shift date assignment:** `attendance_record.date` is always the date of `check_in_at`. This is the current behavior and must not change.

## 11.2 Multiple Sessions in One Day

When `allow_multiple_checkins = true`, an employee may have:
- Session 1: 09:00–12:30 (closed normally)
- Session 2: 13:00–? (forgot to check out)

The auto-checkout engine processes **each open session independently**. It only acts on sessions where `check_out_at IS NULL`. After auto-closing session 2, it recalculates the total `worked_minutes` across all sessions for that day using the same aggregation logic as `checkOut()`.

## 11.3 Long Shifts (>12 Hours)

```
shift.start_time     = "06:00"
shift.end_time       = "20:00"   (14-hour shift)
overtime_grace_minutes = 120
max_session_hours    = 16

auto_checkout_at = min(20:00 + 120min, check_in + 16h)
                 = min(22:00, 06:00 + 16h = 22:00)
                 = 22:00
```

For shifts where `end_time - start_time >= 12 hours`, the `max_session_hours` default of 14 must be reviewed. Recommended: set `max_session_hours = shift_duration_hours + 4` as a guideline in shift creation UI.

## 11.4 Employee Missed Checkout for Multiple Days

If an employee checked in 3 days ago and never checked out, there is one open session from 3 days ago.

```
session.check_in_at = 2024-01-13 09:00:00
auto_checkout_at    = 2024-01-13 20:00:00  (shift_end + grace)
max_session_cap     = 2024-01-13 23:00:00  (check_in + 14h)
auto_checkout_at    = min(20:00, 23:00) = 2024-01-13 20:00:00
```

The cron job on 2024-01-16 will detect this session (check_out_at IS NULL, check_in_at is old) and auto-close it with `check_out_at = 2024-01-13 20:00:00`. The attendance record for 2024-01-13 is updated.

The attendance records for 2024-01-14 and 2024-01-15 remain as `ABSENT` (no check-in, no session). This is correct behavior — the system should not create attendance records for days the employee didn't check in.

## 11.5 Biometric Device Offline / Sync Delay

If a biometric device is offline, check-ins are buffered locally and synced when the device reconnects. The sync may arrive with a delay (e.g., 30–60 minutes after the actual check-in).

`sync_buffer_minutes` on the shift handles this:

```
auto_checkout_at = min(
  shift_end + overtime_grace_minutes + sync_buffer_minutes,
  check_in_at + max_session_hours
)
```

Recommended `sync_buffer_minutes = 30` for organizations using biometric devices.

## 11.6 Employee Checks In Very Late (Near Shift End)

```
shift.end_time       = "18:00"
overtime_grace_minutes = 90
employee.check_in_at = "17:45:00"

auto_checkout_at = 18:00 + 90min = 19:30
worked_minutes   = diffMinutes(17:45, 19:30) = 105 min

full_day_hours   = 8h = 480 min → ABSENT
half_day_hours   = 4h = 240 min → ABSENT
105 < 240 → status = ABSENT
```

This is correct behavior — the employee checked in too late to qualify for even a half-day. The auto-checkout still fires at the normal time; the status calculation handles it.

## 11.7 `PENDING_APPROVAL` Sessions

When a session is auto-closed but the record has `attendance_status = PENDING_APPROVAL` (remote check-in awaiting approval), the auto-checkout engine must preserve the `PENDING_APPROVAL` status — identical to the behavior in `checkOut()`:

```typescript
// attendance.service.ts:checkOut() — existing guard (line 373-381)
// Auto-checkout engine must replicate this same guard:
const computed =
  record.attendance_status === AttendanceStatus.PENDING_APPROVAL
    ? { ...keepPendingApprovalValues }
    : computeAttendanceStatus(totalWorkedMinutes, rule, isLate);
```

## 11.8 Mobile App Crash / Connection Failure

Employee check-in succeeded (server-side session created) but app crashes. Employee is effectively checked in with no way to check out from app.

This is fully handled by the auto-checkout engine — the session exists on the server and will be auto-closed at the scheduled time regardless of client state.

---

# 12. Payroll Impact

## 12.1 How Payroll Currently Reads Attendance

`PayrollSourceRepository` counts `PRESENT`, `LATE`, `OVERTIME`, and `MISSED_CHECKOUT` as present days. This is the status stored on `attendance_records.attendance_status`.

After auto-checkout, the status will be computed normally (PRESENT, LATE, HALF_DAY, etc.). The payroll module will see these as regular attendance records — which is correct behavior when the auto-checkout time is accurate.

## 12.2 The Problem: Silent Inclusion

If auto-checkout fires at an incorrect time (e.g., employee actually worked 2 more hours but the system closed the session at shift_end + grace), payroll would silently under-count hours. The `has_auto_checkout` flag exists to prevent this.

## 12.3 Recommended Payroll Policy

| Scenario | Payroll Treatment | Action Required |
|---|---|---|
| Auto-checkout, no correction requested | Count as present with auto-computed hours | None |
| Auto-checkout, correction pending | Flag as `PENDING CORRECTION` — exclude from payroll run until resolved | HR must resolve before payroll lock |
| Auto-checkout, correction approved | Use corrected hours and status | None — system recalculates |
| Auto-checkout, correction rejected | Use original auto-checkout hours | None |

## 12.4 Changes Required in `PayrollSourceRepository`

Add a check: if the attendance summary period contains any records with `correction_status = 'PENDING'`, the payroll preparation service should either:
- **Block payroll run** with a validation error listing the pending corrections, OR
- **Include the auto-checkout values** but mark the payroll run item with a warning flag

**Recommended for V1:** Block payroll run and surface the list of pending correction requests to HR. This is the safest approach and matches the behavior of Zoho People and greytHR.

## 12.5 Overtime in Payroll

`AttendanceRule.overtime_multiplier` is currently stored but never used. Auto-checkout does not change this — the overtime multiplier integration with salary components remains a future enhancement.

For now: `overtime_minutes` is correctly calculated and stored; payroll components that reference OT can read `attendance_records.overtime_minutes` when that integration is built.

---

# 13. API Design

## 13.1 Employee APIs (New)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/attendance/me/correction-requests` | List my correction requests |
| POST | `/attendance/me/correction-requests` | Submit a correction for an auto-checkout session |
| GET | `/attendance/me/correction-requests/:id` | View a specific correction request |

**POST `/attendance/me/correction-requests` — Request Body:**
```json
{
  "attendance_session_id": "uuid",
  "requested_check_out_at": "2024-01-15T22:45:00Z",
  "employee_reason": "Forgot to check out. Actually left at 10:45 PM."
}
```

## 13.2 Admin APIs (New)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| GET | `/attendance/admin/correction-requests` | ATTENDANCE.view | List all correction requests (filterable) |
| GET | `/attendance/admin/correction-requests/:id` | ATTENDANCE.view | View single correction request |
| POST | `/attendance/admin/correction-requests/:id/approve` | ATTENDANCE.approve | Approve correction — updates session & record |
| POST | `/attendance/admin/correction-requests/:id/reject` | ATTENDANCE.approve | Reject correction — keeps auto-checkout values |

**GET `/attendance/admin/correction-requests` — Query Params:**
```
?approval_status=PENDING
&employee_id=uuid (optional)
&from_date=2024-01-01
&to_date=2024-01-31
&page=1
&limit=20
```

## 13.3 Shift Config APIs — Changes to Existing

**Create/Update Shift DTOs** must include new fields:

```typescript
// create-shift.dto.ts — ADD:
@IsInt()
@Min(0)
@Max(480)   // max 8 hours overtime grace
overtime_grace_minutes: number = 120;

@IsDecimal()
@Min(8)
@Max(24)
max_session_hours: number = 14;

@IsBoolean()
auto_checkout_enabled: boolean = true;

@IsInt()
@Min(0)
@Max(120)
sync_buffer_minutes: number = 0;
```

---

# 14. Changes to Existing Code

## 14.1 `shift.entity.ts` — Add Columns

```typescript
// ADD to Shift entity:
@Column({ type: 'int', default: 120 })
overtime_grace_minutes: number;

@Column({ type: 'decimal', precision: 4, scale: 2, default: 14 })
max_session_hours: number;

@Column({ type: 'boolean', default: true })
auto_checkout_enabled: boolean;

@Column({ type: 'int', default: 0 })
sync_buffer_minutes: number;
```

## 14.2 `attendance-session.entity.ts` — Add Column

```typescript
// ADD to AttendanceSession entity:
@Column({ type: 'boolean', default: false })
is_auto_checkout: boolean;
```

## 14.3 `attendance-record.entity.ts` — Add Columns

```typescript
// ADD to AttendanceRecord entity:
@Column({ type: 'boolean', default: false })
has_auto_checkout: boolean;

@Column({ type: 'varchar', length: 20, nullable: true })
correction_status: string | null;
```

## 14.4 `audit-event-type.enum.ts` — Add Values

```typescript
AUTO_CHECKOUT          = 'AUTO_CHECKOUT',
CORRECTION_SUBMITTED   = 'CORRECTION_SUBMITTED',
CORRECTION_APPROVED    = 'CORRECTION_APPROVED',
CORRECTION_REJECTED    = 'CORRECTION_REJECTED',
```

## 14.5 `attendance.service.ts` — Extract Shared Checkout Logic

The current `checkOut()` method contains inline logic for computing worked_minutes and updating the record. This logic must be extracted into a shared internal method (`applyCheckout()`) that is callable by both the employee-triggered `checkOut()` and the `AutoCheckoutService`. Without this extraction, the two paths will diverge and cause maintenance bugs.

```typescript
// Extract from checkOut() into a private method:
private async applyCheckout(
  sessionId: string,
  attendanceRecordId: string,
  checkOutAt: Date,
  source: AttendanceSource,
  options: { isAutoCheckout: boolean; performedBy: string; organizationId: string; enterpriseId: string }
): Promise<ComputedAttendance>
```

## 14.6 `attendance-calc.util.ts` — Add Night Shift Calculation

```typescript
// NEW function:
export function resolveShiftEndDatetime(
  checkInAt: Date,
  shift: Pick<Shift, 'end_time' | 'is_night_shift'>
): Date {
  const [endHour, endMin] = shift.end_time.split(':').map(Number);
  const endDate = new Date(checkInAt);
  endDate.setHours(endHour, endMin, 0, 0);

  if (shift.is_night_shift && endDate <= checkInAt) {
    // end_time is the next calendar day
    endDate.setDate(endDate.getDate() + 1);
  }

  return endDate;
}

// NEW function:
export function resolveAutoCheckoutAt(
  checkInAt: Date,
  shift: Pick<Shift, 'end_time' | 'is_night_shift' | 'overtime_grace_minutes' | 'max_session_hours' | 'sync_buffer_minutes'>
): Date {
  const shiftEnd = resolveShiftEndDatetime(checkInAt, shift);

  // Time-based cap: shift end + overtime grace + sync buffer
  const timeCap = new Date(shiftEnd);
  timeCap.setMinutes(
    timeCap.getMinutes() + shift.overtime_grace_minutes + shift.sync_buffer_minutes
  );

  // Duration-based cap: check-in + max session hours
  const durationCap = new Date(checkInAt);
  durationCap.setMinutes(
    durationCap.getMinutes() + Math.round(shift.max_session_hours * 60)
  );

  // Use whichever cap fires first
  return timeCap < durationCap ? timeCap : durationCap;
}
```

## 14.7 `attendance.module.ts` — Register New Services

```typescript
providers: [
  // ... existing providers ...
  AutoCheckoutService,       // NEW
  CorrectionRequestService,  // NEW
]
```

---

# 15. V1 Implementation Scope for Brello HRMS

## 15.1 V1 — Minimum Viable Auto-Checkout (Recommended First Scope)

| Item | Priority | Effort | Notes |
|---|---|---|---|
| DB migration: add 4 fields to `shifts` | Must | Low | `overtime_grace_minutes`, `max_session_hours`, `auto_checkout_enabled`, `sync_buffer_minutes` |
| DB migration: add `is_auto_checkout` to `attendance_sessions` | Must | Low | |
| DB migration: add `has_auto_checkout` + `correction_status` to `attendance_records` | Must | Low | |
| Add enum values to `AuditEventType` | Must | Low | `AUTO_CHECKOUT`, `CORRECTION_*` |
| Update `Shift` entity + DTOs + shift service validation | Must | Low | |
| `resolveShiftEndDatetime()` utility function | Must | Low | Night shift support |
| `resolveAutoCheckoutAt()` utility function | Must | Low | Core formula |
| Extract `applyCheckout()` from `AttendanceService.checkOut()` | Must | Medium | Shared logic |
| `AutoCheckoutService` with `@Cron` every 15 minutes | Must | Medium | Batch processing |
| Install + register `@nestjs/schedule` | Must | Low | |
| Partial index for open sessions | Must | Low | Query performance |
| Update `is_night_shift` handling in `isCheckInLate()` | Must | Medium | Night shifts currently ignored |
| Admin: view auto-checkout records (filter by `has_auto_checkout`) | Should | Low | Existing daily preview endpoint — add filter param |
| Employee: see auto-checkout indicator on dashboard | Should | Low | Return `is_auto_checkout` in session response |

## 15.2 V1.1 — Correction Request Workflow

| Item | Priority |
|---|---|
| `attendance_correction_requests` table + entity | Must |
| `CorrectionRequestService` (submit/approve/reject) | Must |
| Employee API: submit correction request | Must |
| Admin API: list + approve/reject correction requests | Must |
| Payroll block on pending corrections | Should |
| Email/push notification on correction status change | Should |

## 15.3 V2 — Future Enhancements

| Item | Notes |
|---|---|
| `overtime_multiplier` integration with payroll salary components | Connect `AttendanceRule.overtime_multiplier` to pay computation |
| Biometric device integration with sync delay handling | Use `sync_buffer_minutes` at device-config level |
| Auto-mark absent for employees with no check-in by end of day | Separate daily job; simpler than auto-checkout |
| Regularization deadline enforcement | Prevent corrections after payroll lock date |
| Shift swap support | If employee swaps shifts, auto-checkout must use the swapped shift |

---

# 16. Enterprise-Safe Defaults

| Config | V1 Default | Rationale |
|---|---|---|
| `overtime_grace_minutes` | 120 (2 hours) | Covers most reasonable overtime scenarios |
| `max_session_hours` | 14 | Hard cap prevents multi-day open sessions; accommodates long shifts |
| `auto_checkout_enabled` | true | Opt-out model — safest default |
| `sync_buffer_minutes` | 0 | No buffer by default; org with biometrics should set 30 |
| Cron frequency | 15 minutes | Frequent enough to close sessions within a reasonable window; low enough to not stress DB |
| Correction window | 7 days | Employee can request correction within 7 days of auto-checkout |
| Payroll behavior on pending correction | Block | Conservative — HR must explicitly confirm or approve |

---

# 17. Migration Plan

```
Migration 1: add_auto_checkout_fields_to_shifts
  - overtime_grace_minutes INT NOT NULL DEFAULT 120
  - max_session_hours DECIMAL(4,2) NOT NULL DEFAULT 14.00
  - auto_checkout_enabled BOOLEAN NOT NULL DEFAULT true
  - sync_buffer_minutes INT NOT NULL DEFAULT 0

Migration 2: add_auto_checkout_flags_to_sessions
  - attendance_sessions.is_auto_checkout BOOLEAN NOT NULL DEFAULT false

Migration 3: add_auto_checkout_flags_to_records
  - attendance_records.has_auto_checkout BOOLEAN NOT NULL DEFAULT false
  - attendance_records.correction_status VARCHAR(20) NULL

Migration 4: create_attendance_correction_requests
  - Full table creation (see Section 8.1)
  - Indexes

Migration 5: add_open_session_auto_checkout_index
  - CREATE INDEX idx_sessions_auto_checkout_candidates
    ON attendance_sessions(check_in_at)
    WHERE check_out_at IS NULL AND is_deleted = false
```

All migrations are non-destructive. Defaults ensure existing data is unaffected. The `auto_checkout_time` column on `shifts` is preserved but deprecated — no removal in V1.
