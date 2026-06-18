# Product Requirement Document (PRD)

# Module: Attendance Daily Materialization & Status Engine

## Product: Brello HRMS

---

# 1. Executive Summary

The auto-checkout PRD resolves open sessions. This PRD resolves a deeper problem: **the absence of records is invisible to payroll**.

Currently, if an employee never checks in on a working day, no `attendance_record` row is created. The payroll module counts only explicit records — it reads `ABSENT` status rows to calculate Loss of Pay (LOP), but if there is no row at all, the employee is silently excluded from the calculation. An employee who worked zero days in a month could receive full salary.

This PRD designs:
1. **Daily Absent Marking Job** — creates explicit `ABSENT` records for every employee on every working day they didn't check in
2. **Leave → Attendance Sync** — when a leave is approved, create `ON_LEAVE` attendance records for those dates
3. **Holiday → Attendance Sync** — when a holiday is added to a calendar, create `HOLIDAY` attendance records
4. **Weekly Off Materialization** — weekly-off days get explicit `WEEKLY_OFF` records
5. **Pre-Checkout Reminder** — notify employees 30 minutes before auto-checkout fires
6. **Post-Auto-Checkout Notification** — notify employees when their session is auto-closed
7. **Attendance Finalization Job** — lock records after the correction window expires

Together with `auto-checkout.md`, these jobs ensure every calendar day for every active employee has an explicit, accurate attendance record — the prerequisite for correct payroll, accurate dashboards, and reliable reporting.

---

# 2. Critical Bugs Fixed by This PRD

## 2.1 Payroll LOP Under-Calculation (Severity: Critical)

**Current behavior** in `PayrollSourceRepository.getAttendanceSummary()`:
```
working_days = total_records - (WEEKLY_OFF + HOLIDAY records)
absent_days  = count of ABSENT records
```

If an employee has **zero attendance records** for a month:
- `working_days` = 0
- `absent_days`  = 0
- `no_data`      = true

Payroll sees `no_data = true` and marks the payroll run item with `lop_days = 0`. The employee receives full salary despite not working a single day. This is the critical bug.

**Fix:** The daily materialization job ensures every working day either has an explicit record or an `ABSENT` record. After the fix:
- `working_days` = calendar days - (WEEKLY_OFF records + HOLIDAY records)
- `absent_days`  = ABSENT records (now equals actual absent days)

## 2.2 Leave Status Not Reflected in Attendance (Severity: High)

When a leave is approved in the leave module, `attendance_records.attendance_status` is never set to `ON_LEAVE`. If the employee was also absent (no check-in), the record either doesn't exist or shows `ABSENT`. The daily view shows incorrect data and payroll doesn't deduct LOP for days that should be ON_LEAVE (which are typically paid, while ABSENT may be unpaid).

## 2.3 Holidays Not in Attendance (Severity: High)

Public holidays are defined in the holiday calendar but no corresponding `HOLIDAY` attendance records are created. The daily preview shows these days as either blank or ABSENT. Payroll misses HOLIDAY status, mis-categorizing the day as ABSENT (potential LOP).

## 2.4 Admin Daily Preview Shows Only Check-In Employees (Severity: Medium)

The current `GET /attendance/admin/daily-preview` returns only employees who have an `attendance_record` for the date. Employees who didn't check in are invisible to the admin. HR cannot see a complete roster with ABSENT employees marked — they only see who showed up.

---

# 3. Current State — What Exists

| Item | Location | State |
|---|---|---|
| `ScheduleModule.forRoot()` | `app.module.ts` | Already imported — cron infrastructure exists |
| Payroll reminder cron | `payroll/services/payroll-reminder.cron.ts` | Pattern to follow |
| Offboarding cron | `user/services/offboarding-cron.service.ts` | Pattern to follow |
| `employee_status` on UserProfile | `user/entities/user-profile.entity.ts:51` | Filterable |
| `joining_date` on UserProfile | `user/entities/user-profile.entity.ts:73` | Filterable — skip pre-joining |
| `last_working_day` on UserProfile | `user/entities/user-profile.entity.ts:130` | Filterable — skip post-exit |
| Leave `status` field | `leave-request.entity.ts` | APPROVED, PENDING, REJECTED, CANCELLED |
| Leave `from_date`, `to_date` | `leave-request.entity.ts` | Used for date range matching |
| Holiday `date` | `holiday/entities/holiday.entity.ts` | Single date per holiday |
| NotificationService | `modules/notification/` | Email (working), InApp (working), Push (stubbed) |
| `AttendanceStatus.ON_LEAVE` | `attendance-status.enum.ts` | Exists, never auto-set |
| `AttendanceStatus.HOLIDAY` | `attendance-status.enum.ts` | Exists, never auto-set |
| `AttendanceStatus.WEEKLY_OFF` | `attendance-status.enum.ts` | Exists, never auto-set |
| `AttendanceSource.AUTO` | `attendance-source.enum.ts` | Exists, currently unused |

---

# 4. Scenario Matrix — Every Employee × Every Day

The materialization engine must produce exactly one attendance record per (employee, date) pair for all past working dates.

| Condition | Priority | Expected `attendance_status` | Source |
|---|---|---|---|
| Date is before `joining_date` | — | No record (skip) | — |
| Date is after `last_working_day` | — | No record (skip) | — |
| `employee_status` is INACTIVE | — | No record (skip) | — |
| No rule assigned to employee | — | No record (skip — can't determine shift/weekly-off) | — |
| Date falls on weekly off day | 1 (highest priority) | `WEEKLY_OFF` | Weekly Off Materialization |
| Date is a public holiday (from org calendar) | 2 | `HOLIDAY` | Holiday Sync Job |
| Employee has approved leave for this date | 3 | `ON_LEAVE` | Leave Sync Job |
| Working day, employee checked in, checked out | 4 | `PRESENT` / `LATE` / `HALF_DAY` / `OVERTIME` | Normal check-in/out |
| Working day, employee checked in, auto-checked out | 4 | Same as above + `has_auto_checkout=true` | Auto Checkout Job |
| Working day, employee checked in, remote pending | 4 | `PENDING_APPROVAL` | Normal check-in |
| Working day, no check-in at all | 5 (lowest) | `ABSENT` | Daily Absent Marking Job |

**Priority ordering is critical:** A day that is both a weekly-off AND a holiday should be `WEEKLY_OFF` (the weekly-off pattern takes precedence). A day the employee is on leave AND it's a holiday should be `HOLIDAY` (the employee shouldn't use a leave day for a public holiday — but this is a leave policy question; default to `HOLIDAY` and let the leave module recalculate).

---

# 5. Job 1 — Daily Absent Marking Job

## 5.1 Overview

**Service:** `AttendanceMaterializationService`
**File:** `src/modules/attendance/services/attendance-materialization.service.ts`
**Schedule:** Daily at `01:00 AM` server time (1 AM processes the previous calendar day)
**Cron expression:** `0 1 * * *`

This job iterates every active employee in every organization, determines what the previous calendar day should be, and creates the appropriate `attendance_record` if one doesn't exist.

## 5.2 Algorithm

```
For target_date = YESTERDAY (server local date):

For each active organization:
  1. Fetch all holiday_calendar entries for the org for target_date
     → holiday_dates = Set<date>

  2. For each employee in the org with employee_status IN (ACTIVE, OFFBOARDING):
     a. Fetch UserProfile.joining_date, UserProfile.last_working_day
     b. If target_date < joining_date → skip
     c. If last_working_day && target_date > last_working_day → skip

     d. Resolve attendance rule for employee
        → If no rule assigned → skip (can't determine working days)

     e. Resolve shift + weekly_off from the rule
     f. Determine day_of_week for target_date

     g. Check priority conditions:
        IS_WEEKLY_OFF   = isWeeklyOffDay(target_date, weekly_off_pattern)
        IS_HOLIDAY      = holiday_dates.has(target_date)
        IS_ON_LEAVE     = hasApprovedLeave(employee_id, target_date)
        HAS_RECORD      = attendance_records row exists for (employee_id, target_date)

     h. If HAS_RECORD:
        → Check if existing record needs status upgrade (e.g., was ABSENT but now ON_LEAVE)
        → If IS_ON_LEAVE and record.attendance_status == ABSENT → update to ON_LEAVE
        → If IS_HOLIDAY and record.attendance_status == ABSENT → update to HOLIDAY
        → Otherwise → skip (record is correct or was set by checkout flow)

     i. If NOT HAS_RECORD:
        If IS_WEEKLY_OFF    → create record with status=WEEKLY_OFF, source=AUTO
        Else if IS_HOLIDAY  → create record with status=HOLIDAY,    source=AUTO
        Else if IS_ON_LEAVE → create record with status=ON_LEAVE,   source=AUTO
        Else                → create record with status=ABSENT,      source=AUTO

3. Log counts: skipped, weekly_off_created, holiday_created, on_leave_created, absent_created, errors
```

## 5.3 `isWeeklyOffDay()` Function

This logic must mirror how the `WeeklyOff` entity defines days off, including the `saturday_rule`:

```typescript
function isWeeklyOffDay(date: Date, weeklyOff: WeeklyOff): boolean {
  const dayOfWeek = getDayOfWeek(date);  // MONDAY..SUNDAY

  // Fixed off days (excluding Saturday — handled by saturday_rule)
  const fixedOffDays = weeklyOff.days.filter(d => d !== DayOfWeek.SATURDAY);
  if (fixedOffDays.includes(dayOfWeek)) return true;

  // Saturday handling
  if (dayOfWeek === DayOfWeek.SATURDAY) {
    switch (weeklyOff.saturday_rule) {
      case SaturdayRule.ALL_OFF:     return true;
      case SaturdayRule.ALL_WORKING: return false;
      case SaturdayRule.ODD_OFF:
        const weekNum = getWeekOfMonth(date);
        return weekNum % 2 === 1;  // 1st, 3rd, 5th Saturdays
      case SaturdayRule.EVEN_OFF:
        return getWeekOfMonth(date) % 2 === 0;  // 2nd, 4th Saturdays
      case SaturdayRule.CUSTOM:
        return weeklyOff.saturday_off_weeks?.includes(getWeekOfMonth(date)) ?? false;
      default:
        return weeklyOff.days.includes(DayOfWeek.SATURDAY);
    }
  }

  return false;
}
```

## 5.4 Record Created by the Job

```typescript
{
  employee_id,
  organization_id,
  enterprise_id,
  date: targetDate,
  shift_id: rule.shift_id,
  rule_id: rule.id,
  attendance_status: determinedStatus,  // ABSENT | WEEKLY_OFF | HOLIDAY | ON_LEAVE
  source: AttendanceSource.AUTO,
  // All other fields null / 0
  worked_minutes: 0,
  overtime_minutes: 0,
  is_late: false,
  modified_by: SYSTEM_USER_ID,          // a designated system UUID
}
```

## 5.5 Idempotency

The job must be fully idempotent — safe to re-run for the same date without creating duplicate records. Use `INSERT ... ON CONFLICT DO NOTHING` or check existence before insert:

```sql
INSERT INTO attendance_records (
  organization_id, enterprise_id, employee_id, date, shift_id, rule_id,
  attendance_status, source, worked_minutes, overtime_minutes, is_late
)
VALUES (...)
ON CONFLICT (organization_id, employee_id, date) WHERE is_deleted = false
DO NOTHING;
```

The existing unique constraint `(organization_id, employee_id, date) WHERE is_deleted = false` makes this safe.

## 5.6 Performance

| Concern | Solution |
|---|---|
| Large org (1000+ employees) | Process in batches of 200 employees per org; use a cursor |
| Multi-org | Process orgs sequentially (one org at a time) to avoid DB saturation |
| Joining date check | Index on `user_profiles(organization_id, joining_date, employee_status)` |
| Holiday lookup | Cache `holiday_dates` Set per org before employee loop, not per employee |
| Leave lookup | Single query per org for all employees: `SELECT employee_id, from_date, to_date FROM leave_requests WHERE status=APPROVED AND from_date <= target_date AND to_date >= target_date AND org_id = ?` |
| Rule resolution | Cache rule assignments per org in memory for the job run (avoid N+1) |

---

# 6. Job 2 — Leave → Attendance Sync

## 6.1 Problem

When a leave request is approved, no `attendance_record` is created. The daily materialization job at 1 AM catches most cases (if the leave date is in the past). But for **future dates** (leave approved in advance), records don't exist yet — and won't exist until the 1 AM job runs on that future date.

More critically: if an employee already has an `ABSENT` record for a date (created by the 1 AM job from a previous run when leave wasn't yet approved), it needs to be **updated to ON_LEAVE** when the leave is subsequently approved.

## 6.2 Design — Event-Driven Sync via Service Call

When a leave request is **approved** (in `LeaveRequestService.approve()`), call `AttendanceMaterializationService.syncLeaveToAttendance(leaveRequestId)`:

```
For each date in [leave.from_date .. leave.to_date]:
  If is_half_day == true:
    → Upsert record with is_half_day=true, attendance_status=ON_LEAVE, notes="Half-day leave"
  Else:
    → Upsert attendance_record with attendance_status=ON_LEAVE, source=AUTO

  BUT SKIP:
  - Date is in the future AND no existing record → the 1 AM job will handle it
  - OR simply always upsert (safe with ON CONFLICT clause)

  DO NOT OVERRIDE:
  - Records with status PRESENT / LATE / HALF_DAY / OVERTIME
    (employee checked in despite leave being approved — leave manager handles this edge case)
  - Records with status PENDING_APPROVAL (remote approval in progress)
```

When a leave is **cancelled** (in `LeaveRequestService.cancel()`):
```
For each date in [leave.from_date .. leave.to_date]:
  If attendance_record.attendance_status == ON_LEAVE:
    → Re-run materialization for that date:
      If is_working_day → set ABSENT
      If is_weekly_off  → set WEEKLY_OFF
      If is_holiday     → set HOLIDAY
    (Do NOT delete the record — just update status)
```

## 6.3 What Changes in LeaveRequestService

This requires `LeaveRequestService` to import and call `AttendanceMaterializationService`. This creates a dependency from the leave module to the attendance module. To avoid circular dependencies, use NestJS lazy injection or emit an event that the attendance module listens to.

**Recommended:** Use `@nestjs/event-emitter` (install if not present) or use a direct optional dependency with `forwardRef`.

Given the existing architecture has no event emitter, **direct service call** with `forwardRef` is the simplest V1 approach.

---

# 7. Job 3 — Holiday → Attendance Sync

## 7.1 Problem

When a holiday is added to a calendar, all employees under that calendar should have a `HOLIDAY` attendance record created for that date. Currently this never happens.

## 7.2 Design — Trigger on Holiday Create/Delete

When a holiday is **created** (in `HolidayService.create()`), call `AttendanceMaterializationService.syncHolidayToAttendance(holidayId)`:

```
Find all employees in the org with a rule assignment
For each employee:
  If existing record.attendance_status == ABSENT:
    → Update to HOLIDAY, source=AUTO
  If no existing record:
    → Create HOLIDAY record, source=AUTO
  If existing record.attendance_status IN (PRESENT, LATE, HALF_DAY, OVERTIME, WEEKLY_OFF):
    → Skip (employee worked or it's a weekly off — holiday doesn't override)
```

When a holiday is **deleted**:
```
Find all employees with attendance_record.attendance_status == HOLIDAY on that date
AND source == AUTO (don't override admin-set records)
→ Re-run materialization for each (may become ABSENT or WEEKLY_OFF)
```

---

# 8. Job 4 — Weekly Off Materialization

Weekly off records are the simplest: when an employee's rule assignment changes (new rule assigned or weekly-off pattern changed), historical records for weekly off days don't auto-update. The daily 1 AM job handles this for past dates going forward. But a **backfill utility** is needed for retroactive assignment changes.

**V1 Approach:** The 1 AM job handles new days. Backfill is out of scope for V1 — admins can use the manual attendance update API for historical corrections.

---

# 9. Job 5 — Pre-Checkout Reminder (Notification)

## 9.1 Overview

**Service:** Existing `NotificationService`
**Schedule:** Every 30 minutes (`0,30 * * * *`)
**Purpose:** Notify employees 30 minutes before their session will be auto-closed

This prevents the surprise of an unexpected auto-checkout and gives employees time to either check out manually (with the correct time) or note that they need to submit a correction.

## 9.2 Algorithm

```
For each organization:
  For each open session (check_out_at IS NULL):
    Resolve shift for session's attendance_record.shift_id
    Compute auto_checkout_at (same formula as AutoCheckoutService)
    warning_at = auto_checkout_at - 30 minutes

    If NOW() >= warning_at AND NOW() < auto_checkout_at:
      AND session.reminder_sent != true (avoid duplicate reminders):
        Send notification:
          type: IN_APP + EMAIL
          title: "Don't forget to check out"
          message: "Your attendance will be auto-closed at {auto_checkout_at_formatted}.
                    If you've already left, please check out now or submit a correction after."
        Set session.reminder_sent = true
```

## 9.3 New Field Required

```sql
ALTER TABLE attendance_sessions
  ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false;
```

This prevents duplicate reminder notifications if the cron fires twice within the 30-minute window.

## 9.4 Notification Content

| Channel | Content |
|---|---|
| In-App | Title: "Checkout Reminder" / Message: "Your session will auto-close at {time}. Tap to check out." |
| Email | Subject: "Attendance Reminder — Please Check Out" / Body with shift details and auto-checkout time |
| Push | Stubbed for now — will fire when Firebase is integrated |

---

# 10. Job 6 — Post-Auto-Checkout Notification

When `AutoCheckoutService.closeSession()` fires, immediately after closing a session, it should call `NotificationService`:

```typescript
await this.notificationService.send({
  user_id: session.employee_id,
  type: [NotificationType.IN_APP, NotificationType.EMAIL],
  title: 'Your attendance was auto-closed',
  message: `Your attendance for ${formatDate(record.date)} was auto-closed at ` +
           `${formatTime12(autoCheckoutAt)} as you forgot to check out. ` +
           `If this is incorrect, you can submit a correction request.`,
  metadata: {
    attendance_record_id: record.id,
    attendance_session_id: session.id,
    auto_checkout_at: autoCheckoutAt.toISOString(),
  },
});
```

This notification is the trigger that makes the employee aware of the auto-checkout and prompts them to use the correction request feature.

---

# 11. Job 7 — Attendance Finalization Job

## 11.1 Purpose

After the correction window (7 days), auto-checkout records with `correction_status = null` should be **finalized** — meaning they are locked and cannot be corrected. This prevents stale correction requests from affecting already-processed payroll.

## 11.2 Design

**Schedule:** Daily at `02:00 AM` (runs after the absent marking job)
**Cron expression:** `0 2 * * *`

```
For each attendance_record WHERE:
  has_auto_checkout = true
  AND correction_status IS NULL
  AND date <= TODAY - 7 days
  AND is_deleted = false

→ Set correction_status = 'CLOSED'   (new status — window expired)
→ Log count
```

The `CLOSED` status means:
- Employee can no longer submit a correction request
- Payroll can safely process this record without blocking on pending corrections
- The UI shows "Correction window closed" instead of "Request Correction"

## 11.3 New `correction_status` Value

Add `CLOSED` to the allowed values in `attendance_records.correction_status`:
- `NULL` — no correction submitted (still within window if `has_auto_checkout = true`)
- `PENDING` — correction submitted, awaiting HR review
- `APPROVED` — correction approved, session updated
- `REJECTED` — correction rejected, auto-checkout values remain
- `CLOSED` — correction window expired (7 days passed, no action taken)

---

# 12. Payroll Integration Changes

## 12.1 Current Gap

`PayrollSourceRepository.getAttendanceSummary()` counts only rows that exist. After the daily materialization job, all days will have rows, so the calculation becomes accurate automatically — no changes to the payroll query are needed for absent/present/weekly-off/holiday calculation.

However, one specific fix is required:

## 12.2 Fix: `no_data` Flag Behavior

The current `no_data = true` condition means "zero records in the period". After materialization, there will always be records (WEEKLY_OFF, HOLIDAY, ABSENT at minimum), so `no_data` will never be true for an employee with a rule assignment.

The `no_data` flag should be repurposed to mean "employee has no rule assignment for this period" — which indicates they are not managed by the attendance module.

**Update the query condition:**
```sql
-- OLD: no_data = (total_records = 0)
-- NEW: no_data = (employee has no rule_assignment for the period)
```

## 12.3 Fix: LOP Calculation Alignment

After materialization:
- `working_days` = total records - WEEKLY_OFF - HOLIDAY - ON_LEAVE records
- `present_days` = PRESENT + LATE + OVERTIME + MISSED_CHECKOUT + (HALF_DAY × 0.5)
- `absent_days` = ABSENT records (which now equals actual absent working days)
- `lop_days` = `absent_days` + unpaid leave days

This is the correct formula and works automatically once all days have records.

---

# 13. New Service: `AttendanceMaterializationService`

**File:** `src/modules/attendance/services/attendance-materialization.service.ts`

**Responsibilities:**
- `runDailyAbsentMarking(targetDate: Date)` — called by cron at 1 AM
- `syncLeaveToAttendance(leaveRequestId: string)` — called by LeaveRequestService
- `syncHolidayToAttendance(holidayId: string)` — called by HolidayService
- `reverseLeaveSync(leaveRequestId: string)` — called on leave cancellation
- `reverseHolidaySync(holidayId: string)` — called on holiday deletion

**Dependencies:**
- `AttendanceRecordRepository`
- `RuleAssignmentRepository`
- `AttendanceRuleRepository`
- `ShiftRepository`
- `WeeklyOffRepository`
- `UserProfileRepository` (for joining_date, last_working_day, employee_status)
- `LeaveRequestRepository`
- `HolidayRepository`
- `AttendanceAuditLogRepository`

---

# 14. New Cron Service: `AttendanceCronService`

**File:** `src/modules/attendance/services/attendance-cron.service.ts`

Contains all `@Cron` decorated methods:

```typescript
@Injectable()
export class AttendanceCronService {

  @Cron('0 1 * * *', { name: 'daily-absent-marking' })
  async runDailyAbsentMarking() {
    const yesterday = getYesterdayLocalDate();
    await this.materializationService.runDailyAbsentMarking(yesterday);
  }

  @Cron('0 2 * * *', { name: 'attendance-finalization' })
  async runAttendanceFinalization() {
    const cutoffDate = subtractDays(new Date(), 7);
    await this.materializationService.finalizeExpiredCorrectionWindows(cutoffDate);
  }

  @Cron('0,30 * * * *', { name: 'pre-checkout-reminder' })
  async runPreCheckoutReminder() {
    await this.autoCheckoutService.sendPreCheckoutReminders();
  }
}
```

The `AutoCheckoutService` cron (`@Cron('0,15,30,45 * * * *')`) remains in `AutoCheckoutService` as designed in `auto-checkout.md`.

---

# 15. DB Changes Summary

## 15.1 `attendance_sessions` — Add Column (in addition to auto-checkout PRD)

```sql
ALTER TABLE attendance_sessions
  ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false;
```

## 15.2 `attendance_records` — `correction_status` Extended Values

The `correction_status` column (added in auto-checkout.md) gains a new allowed value: `CLOSED`. No schema change needed — it's already `VARCHAR(20)`.

## 15.3 New Indexes

```sql
-- For daily absent marking job: find employees without records for a date
-- (used in EXISTS check — already covered by unique constraint index)

-- For pre-checkout reminder deduplication:
CREATE INDEX idx_sessions_open_reminder
  ON attendance_sessions(organization_id, check_in_at)
  WHERE check_out_at IS NULL AND is_deleted = false AND reminder_sent = false;

-- For finalization job:
CREATE INDEX idx_records_auto_checkout_no_correction
  ON attendance_records(date)
  WHERE has_auto_checkout = true 
    AND correction_status IS NULL
    AND is_deleted = false;
```

---

# 16. Admin Daily Preview API — Change

## 16.1 Current Behavior

`GET /attendance/admin/daily-preview` returns only employees who have an `attendance_record` row for the specified date. Employees who didn't check in (and before the 1 AM job, they have no row) are invisible.

## 16.2 New Behavior

After the daily materialization job, every employee with a rule assignment will have a row for every past date. The daily preview query will naturally show all employees — including those with `ABSENT`, `WEEKLY_OFF`, `HOLIDAY`, `ON_LEAVE` status.

**No API change required** for past dates — the query already returns all records, it just returns fewer because of missing rows.

**For today's date** (before the 1 AM job runs): Add a `?include_no_record=true` parameter that performs a LEFT JOIN between the employee list and attendance_records:

```sql
-- Extended query for admin daily preview (today's date):
SELECT
  u.id as employee_id,
  up.first_name, up.last_name,
  COALESCE(ar.attendance_status, 'NOT_CHECKED_IN') as attendance_status,
  ar.first_check_in_at,
  ar.last_check_out_at,
  ar.worked_minutes
FROM users u
JOIN user_profiles up ON up.user_id = u.id
LEFT JOIN rule_assignments ra ON ra.target_id = u.id AND ra.assignment_type = 'EMPLOYEE' AND ra.is_deleted = false
LEFT JOIN attendance_records ar ON ar.employee_id = u.id 
  AND ar.date = :date 
  AND ar.is_deleted = false
WHERE u.organization_id = :orgId
  AND up.employee_status IN ('ACTIVE', 'OFFBOARDING')
  AND (ra.id IS NOT NULL OR EXISTS(
    SELECT 1 FROM rule_assignments ra2 
    JOIN user_profiles up2 ON up2.department_id = ra2.target_id
    WHERE ra2.target_id = up2.department_id 
      AND up2.user_id = u.id 
      AND ra2.assignment_type = 'DEPARTMENT'
      AND ra2.is_deleted = false
  ))
ORDER BY ar.first_check_in_at ASC NULLS LAST
```

Add `NOT_CHECKED_IN` as a virtual status in the response (not stored in DB) for employees with no record for today.

---

# 17. Module Changes

## 17.1 `attendance.module.ts`

```typescript
providers: [
  // ... existing providers ...
  AutoCheckoutService,             // from auto-checkout.md
  CorrectionRequestService,        // from auto-checkout.md
  AttendanceMaterializationService, // NEW
  AttendanceCronService,           // NEW
]
```

## 17.2 `leave-request.module.ts`

Import `AttendanceMaterializationService` (or use `forwardRef` if circular):

```typescript
imports: [
  forwardRef(() => AttendanceModule),
]
```

Call from `LeaveRequestService.approve()` and `LeaveRequestService.cancel()`.

## 17.3 `holiday.module.ts`

Import `AttendanceMaterializationService`:

```typescript
imports: [
  forwardRef(() => AttendanceModule),
]
```

Call from `HolidayService.create()` and `HolidayService.delete()`.

---

# 18. Audit Trail

All records created by the materialization job use `source = AUTO` and are written to `attendance_audit_logs` with:

```typescript
{
  event_type: AuditEventType.AUTO_ABSENT_MARK,    // NEW audit type
  performed_by: SYSTEM_USER_ID,
  employee_id: employee.id,
  new_value: { attendance_status, date, reason: 'daily-materialization-job' }
}
```

New audit event types to add:
```typescript
AUTO_ABSENT_MARK      = 'AUTO_ABSENT_MARK',      // Daily job created ABSENT record
AUTO_LEAVE_SYNC       = 'AUTO_LEAVE_SYNC',        // Leave approval synced to attendance
AUTO_HOLIDAY_SYNC     = 'AUTO_HOLIDAY_SYNC',      // Holiday creation synced to attendance
AUTO_WEEKLY_OFF_MARK  = 'AUTO_WEEKLY_OFF_MARK',   // Weekly off materialized
CORRECTION_CLOSED     = 'CORRECTION_CLOSED',      // Correction window expired
```

---

# 19. Correction: `@nestjs/schedule` Already Installed

The `auto-checkout.md` PRD includes an instruction to install `@nestjs/schedule`. This is **incorrect** — `ScheduleModule.forRoot()` is already imported in `app.module.ts`. Existing cron services (`payroll-reminder.cron.ts`, `offboarding-cron.service.ts`, `subscription-expiry.cron.ts`) confirm the scheduler works. **No installation needed.**

---

# 20. V1 Implementation Scope

## 20.1 V1 — Critical Bug Fixes (Ship First)

| Item | Priority | Effort | Impact |
|---|---|---|---|
| `AttendanceMaterializationService` — `runDailyAbsentMarking()` | Must | High | Fixes payroll LOP bug |
| `AttendanceCronService` with daily 1 AM cron | Must | Low | Activates materialization |
| Update `PayrollSourceRepository.getAttendanceSummary()` `no_data` logic | Must | Low | Fixes payroll data completeness |
| Daily preview LEFT JOIN for today's date | Should | Medium | Admin sees complete roster |
| `reminder_sent` column on `attendance_sessions` | Should | Low | Enables reminder dedup |
| New audit event types (`AUTO_ABSENT_MARK`, `AUTO_WEEKLY_OFF_MARK`, etc.) | Should | Low | Audit compliance |

## 20.2 V1.1 — Integration Completeness

| Item | Priority | Effort | Impact |
|---|---|---|---|
| Leave → Attendance sync on approval/cancellation | Must | Medium | Fixes ON_LEAVE status gap |
| Holiday → Attendance sync on create/delete | Must | Medium | Fixes HOLIDAY status gap |
| Pre-checkout reminder job (30 min before) | Should | Medium | Reduces surprise auto-checkouts |
| Post-auto-checkout in-app notification | Must | Low | Informs employee immediately |
| Attendance finalization job (7-day window) | Should | Low | Enables payroll to unblock safely |
| `correction_status = 'CLOSED'` handling | Should | Low | Pairs with finalization job |

## 20.3 V2 — Enhanced Scenarios

| Item | Notes |
|---|---|
| Retroactive backfill for existing employees | Run materialization for past N months on feature deploy |
| Half-day leave sync (FIRST_HALF / SECOND_HALF) | Complex — requires split-day attendance logic |
| Shift swap support | Employee working someone else's shift changes weekly-off check |
| Push notifications | Requires Firebase Admin SDK integration |
| Sandwich leave policy integration | `computed_days_breakdown.sandwich_days_added` in leave |

---

# 21. Migration Plan

```
Migration 6: add_reminder_sent_to_sessions
  - attendance_sessions.reminder_sent BOOLEAN NOT NULL DEFAULT false

Migration 7: add_materialization_indexes
  - idx_sessions_open_reminder (partial index)
  - idx_records_auto_checkout_no_correction (partial index)
```

These are additive to the 5 migrations in `auto-checkout.md`. Run in order: migrations 1–5 from auto-checkout.md, then migrations 6–7 from this PRD.
