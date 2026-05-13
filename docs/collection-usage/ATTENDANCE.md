# Attendance Collection Setup

End-to-end walkthrough for the **Attendance Config** and **Attendance (Check-In / Check-Out)** Postman folders. Each step builds on the previous — run them in order the first time.

---

## Prerequisites

Complete `GETTING_STARTED.md` first to have:
- `enterprise_id`, `organization_id`, `user_id`, `access_token` in your Postman variables
- An HR / admin user with `ATTENDANCE_CONFIG.{view, create, update, delete, activate}` for configuring shifts, weekly-offs, and rules
- A separate `ATTENDANCE.{view, create, update, delete, approve}` grant for the admin daily-preview / manual-entry / approval endpoints (see [Grant Admin Access](#grant-admin-access) below)

> **What "configured" means:** every employee that will punch in must resolve to exactly **one** active attendance rule (either employee-level or via their department). Without this resolution, every check-in returns `404 No attendance rule assigned to this employee or their department`.

---

## Grant Admin Access

The admin endpoints (`/attendance/admin/*`) are gated by `RequirePermission('ATTENDANCE', ...)`. The `ATTENDANCE` module is not seeded by default — use the provided template SQL once per organization:

```bash
# Edit the config block in docs/seeds/grant-module-access.sql:
#   v_email        = '<your-admin-email>'
#   v_module_code  = 'ATTENDANCE'
#   v_module_name  = 'Attendance'
#   v_action_codes = ARRAY['view', 'create', 'update', 'approve', 'delete']
#
# Then run it (psql or via the Node runner under scripts/):
psql "<conn-string>" -f docs/seeds/grant-module-access.sql
```

The script is **idempotent** — re-running it is safe. It will:
1. Create the `ATTENDANCE` AppModule (if missing) in the user's current app.
2. Ensure the action codes exist.
3. Grant access for every active role the user has in that app.
4. Enable the module + actions in the org's active subscription plan.

> **Employee-side endpoints** (`/attendance/check-in`, `/check-out`, `/me/today`, `/me/history`, `/rules`) require only `JwtAuthGuard` — any authenticated user can call them. No `ATTENDANCE` grant needed.

---

## Step-by-Step Flow

### Phase 1 — Configure attendance (HR, one-time per org)

These live in the **Attendance Config** folder and use `ATTENDANCE_CONFIG.*` permissions, not `ATTENDANCE.*`.

#### 1. Create a Shift

`POST /api/v1/attendance/shifts`

```json
{
  "name": "General Shift",
  "start_time": "09:00",
  "end_time": "18:00",
  "late_grace_minutes": 15,
  "auto_checkout_time": "20:00",
  "allow_multiple_checkins": false,
  "full_day_hours": 8,
  "half_day_hours": 4
}
```

Auto-saves `shift_id`. `late_grace_minutes` is added to `start_time` to determine `is_late` on check-in.

#### 2. Create a Weekly Off

`POST /api/v1/attendance/weekly-offs`

```json
{
  "name": "Sat-Sun Off",
  "days": ["SATURDAY", "SUNDAY"]
}
```

Auto-saves `weekly_off_id`. For rotating Saturday-offs, use the `saturday_rule` + `saturday_off_weeks` fields documented in the request body.

#### 3. Create an Attendance Rule

`POST /api/v1/attendance/rules`

```json
{
  "name": "Mumbai HQ Default",
  "shift_id": "{{shift_id}}",
  "weekly_off_id": "{{weekly_off_id}}",
  "full_day_hours": 8,
  "half_day_hours": 4,
  "overtime_after_hours": 9,
  "overtime_multiplier": 1.5,
  "allow_multiple_checkins": false,
  "require_geo_fencing": true,
  "allow_remote_in": true,
  "require_remote_reason": true,
  "remote_approval_required": false,
  "geo_fence": {
    "office_name": "Mumbai HQ",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "radius_meters": 500
  }
}
```

Auto-saves `attendance_rule_id`.

> The remote-attendance flags on the rule (`allow_remote_in`, `require_remote_reason`, `remote_approval_required`) drive the check-in validation logic. Toggle them to suit your policy.

#### 4. Assign the Rule

Either to a department:

`POST /api/v1/attendance/rules/{{attendance_rule_id}}/assign-departments`

```json
{ "department_ids": ["{{department_id}}"] }
```

…or to specific employees (employee-level wins over department-level):

`POST /api/v1/attendance/rules/{{attendance_rule_id}}/assign-employees`

```json
{ "employee_ids": ["{{employee_id}}"] }
```

---

### Phase 2 — Employee daily flow

All endpoints below are in the **Attendance (Check-In / Check-Out) → Employee** folder. They use only `JwtAuthGuard`.

#### 5. Inspect Effective Rules (optional, recommended before first check-in)

`GET /api/v1/attendance/rules`

Returns the rule resolved for the logged-in employee, so the client can decide whether to:
- prompt for GPS permission (if `geo_fencing_enabled`),
- show a "Working from where?" picker (if `allow_remote_in`),
- collect a reason (if `require_remote_reason`),
- show a "Pending Approval" badge after a remote check-in (if `remote_approval_required`).

```json
{
  "full_day_hours": 8,
  "half_day_hours": 4,
  "late_after": "09:00",
  "grace_minutes": 15,
  "overtime_after_hours": 9,
  "multiple_sessions_allowed": false,
  "geo_fencing_enabled": true,
  "office_radius_meters": 500,
  "allow_remote_in": true,
  "require_remote_reason": true,
  "remote_approval_required": false
}
```

#### 6. Check-In (Office-In)

`POST /api/v1/attendance/check-in`

```json
{
  "latitude": 19.076,
  "longitude": 72.8777,
  "device": "WEB",
  "notes": "Reached office"
}
```

Behavior:
- Distance is computed by the **Haversine formula** against the rule's geo-fence.
- Inside `office_radius_meters` ⇒ `attendance_mode = "OFFICE_IN"`, `geo_status = "VALID"`.
- `is_late` is true if `check_in > shift.start_time + late_grace_minutes`.
- Auto-saves `attendance_id` and `attendance_session_id`.

Response (truncated):
```json
{
  "attendance_id": "...",
  "attendance_session_id": "...",
  "attendance_mode": "OFFICE_IN",
  "attendance_status": "PRESENT",
  "geo_status": "VALID",
  "distance_from_office_meters": 120,
  "office": { "office_id": "...", "office_name": "Mumbai HQ" },
  "check_in_time": "2026-05-13T09:12:00.000Z",
  "shift": { "shift_id": "...", "shift_name": "General Shift", "start_time": "09:00", "end_time": "18:00" },
  "is_late": false
}
```

#### 7. Check-In (Remote-In)

`POST /api/v1/attendance/check-in`

Same endpoint as Office-In — the server decides based on coordinates:

```json
{
  "latitude": 19.2,
  "longitude": 72.95,
  "device": "WEB",
  "remote_reason": "Work From Home",
  "notes": "WFH today"
}
```

Behavior:
- If outside `office_radius_meters` AND `allow_remote_in=true` ⇒ `attendance_mode = "REMOTE_IN"`.
- If `require_remote_reason=true` and `remote_reason` is missing ⇒ 400 `REMOTE_REASON_REQUIRED`.
- If `remote_approval_required=true` ⇒ record is created in `attendance_status = "PENDING_APPROVAL"`, a row is inserted into `attendance_remote_approvals` for HR to review, and the response carries `requires_approval: true, approval_status: "PENDING"`.

Suggested `remote_reason` values (from the PRD): `Work From Home`, `Client Visit`, `Field Work`, `Travel`, `Emergency`, `Health Issue`, `Internet Issue`, `Other`. There is no server-side enum — keep these in a frontend constants file.

#### 8. Live Today Status

`GET /api/v1/attendance/me/today`

Drives the dashboard widget (the live `00:00:00` timer in the mock). Returns:

```json
{
  "attendance_id": "...",
  "attendance_session_id": "...",
  "date": "2026-05-13",
  "attendance_mode": "OFFICE_IN",
  "attendance_status": "PRESENT",
  "check_in_time": "09:12 AM",
  "check_out_time": null,
  "worked_duration_live": "03:42:15",
  "live_session": true,
  "shift": { "shift_name": "General Shift", "start_time": "09:00", "end_time": "18:00" },
  "office": { "office_name": "Mumbai HQ" }
}
```

> `worked_duration_live` is computed server-side on every call. If the client polls (e.g. every 30s) the ticker stays accurate without trusting client clocks.

#### 9. Check-Out

`POST /api/v1/attendance/check-out`

```json
{
  "latitude": 19.076,
  "longitude": 72.8777,
  "notes": "Leaving for the day"
}
```

Behavior:
- 404 if no open session.
- Recomputes `worked_minutes`, `is_late`, `is_half_day`, `is_overtime`, and the final `attendance_status` against rule thresholds.
- If the record is `PENDING_APPROVAL`, the status is **left untouched** — it stays pending until HR approves/rejects.
- `worked_hours` is returned as `HH:mm`.

#### 10. My Attendance History

`GET /api/v1/attendance/me/history?page=1&limit=20&month=5&year=2026`

Optional filters:
- `month` (1–12) + `year`
- `attendance_mode` — `OFFICE_IN` | `REMOTE_IN`
- `attendance_status` — `PRESENT` | `HALF_DAY` | `LATE` | `ABSENT` | …

Each row carries date, 12-hour check-in/check-out, worked hours, mode, status, shift name, and the original remote reason.

---

### Phase 3 — Admin daily preview & manual corrections

All endpoints below are in the **Attendance (Check-In / Check-Out) → Admin** folder and require the `ATTENDANCE.*` permissions seeded above.

#### 11. Daily Preview

`GET /api/v1/attendance/admin/daily-preview?date=2026-05-13&page=1&limit=20`

Backs the **Admin → Daily Preview** screen. Returns:

```json
{
  "summary": {
    "present": 142,
    "absent": 12,
    "late": 8,
    "half_day": 5,
    "on_leave": 4,
    "missed_checkout": 3,
    "office_in": 110,
    "remote_in": 32,
    "geo_violations": 0
  },
  "items": [
    {
      "attendance_id": "...",
      "employee": { "employee_id": "...", "name": "John Doe", "emp_code": "EMP-001", "department": "Design" },
      "date": "2026-05-13",
      "shift": { "shift_name": "General Shift" },
      "check_in": "09:12 AM",
      "check_out": "06:05 PM",
      "worked_hours": "08:53",
      "attendance_mode": "OFFICE_IN",
      "attendance_status": "PRESENT",
      "source": "WEB",
      "remote_reason": null,
      "notes": null
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 167 }
}
```

Optional filters: `department_id`, `shift_id`, `attendance_status`, `attendance_mode`, `search` (name or emp code, ≥2 chars). Requires `ATTENDANCE.view`.

> `summary.geo_violations` is `0` in v1. Wiring the geo-log aggregate is a follow-up.

#### 12. Add Manual Entry

`POST /api/v1/attendance/admin/manual-entry`

```json
{
  "employee_id": "{{employee_id}}",
  "date": "2026-05-12",
  "check_in": "09:12",
  "check_out": "18:05",
  "attendance_mode": "OFFICE_IN",
  "remote_reason": null,
  "notes": "Manual correction by HR — forgot to punch out"
}
```

Behavior:
- 409 if a record already exists for `(employee_id, date)`. Use **Update Attendance** instead.
- Recomputes worked hours / status from `check_in` + `check_out` against the employee's effective rule.
- If `attendance_status_override` is provided, it wins.
- `source` is forced to `MANUAL`. Writes a `MANUAL_CREATE` row to the audit log.
- Auto-saves `attendance_id`.

Requires `ATTENDANCE.create`.

#### 13. Update Attendance

`PUT /api/v1/attendance/admin/{{attendance_id}}`

```json
{
  "check_in": "09:30",
  "check_out": "18:10",
  "attendance_mode": "OFFICE_IN",
  "attendance_status_override": "PRESENT",
  "notes": "Approved by HR"
}
```

Any combination of fields can be supplied. Worked hours / status are recomputed. Writes `STATUS_OVERRIDE` (if `attendance_status_override` is set) or `MANUAL_UPDATE` to the audit log. Requires `ATTENDANCE.update`.

#### 14. Delete Attendance

`DELETE /api/v1/attendance/admin/{{attendance_id}}`

Soft-deletes the record and removes its sessions. Writes `MANUAL_DELETE` to the audit log. Requires `ATTENDANCE.delete`.

---

### Phase 4 — Remote-attendance approval workflow

Only relevant when an active rule has `remote_approval_required=true`.

#### 15. Pending Remote Approvals (Manager Inbox)

`GET /api/v1/attendance/admin/remote-approvals?page=1&limit=20`

Returns the queue of `PENDING_APPROVAL` remote check-ins:

```json
{
  "items": [
    {
      "attendance_id": "...",
      "employee": { "employee_id": "...", "name": "John Doe", "emp_code": "EMP-001" },
      "date": "2026-05-13",
      "check_in_time": "09:25 AM",
      "remote_reason": "Work From Home",
      "distance_from_office_meters": 4200,
      "approval_status": "PENDING"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

Requires `ATTENDANCE.view`.

#### 16. Approve

`POST /api/v1/attendance/admin/remote-approvals/{{attendance_id}}/approve`

- 404 if no pending approval row exists for that record.
- 409 if it has already been approved or rejected.
- Recomputes the final attendance status from current worked minutes (`PRESENT` / `HALF_DAY` / `LATE` / `ABSENT`).
- Writes `REMOTE_APPROVE` to the audit log.

Requires `ATTENDANCE.approve`.

#### 17. Reject

`POST /api/v1/attendance/admin/remote-approvals/{{attendance_id}}/reject`

```json
{ "reason": "Outside approved work region" }
```

- `reason` is mandatory.
- Forces `attendance_status = "ABSENT"` and records the rejection reason in the audit log.

Requires `ATTENDANCE.approve`.

---

### Phase 5 — Audit Trail

#### 18. Audit Logs

`GET /api/v1/attendance/admin/audit-logs?page=1&limit=20`

Filters: `employee_id`, `date` (YYYY-MM-DD), `event_type`. Each entry carries the actor (`performed_by`), `device`, `ip_address`, and `old_value` / `new_value` JSON snapshots. Requires `ATTENDANCE.view`.

| `event_type`     | When written                                                |
| ---------------- | ----------------------------------------------------------- |
| `OFFICE_IN`      | Successful check-in inside office radius                    |
| `REMOTE_IN`      | Successful check-in outside office radius                   |
| `CHECK_OUT`      | Successful check-out                                        |
| `GEO_REJECTION`  | Check-in blocked because outside radius + remote disabled   |
| `MANUAL_CREATE`  | HR added a manual entry                                     |
| `MANUAL_UPDATE`  | HR edited an entry (no status override)                     |
| `STATUS_OVERRIDE`| HR edited an entry with explicit status override            |
| `MANUAL_DELETE`  | HR soft-deleted an entry                                    |
| `REMOTE_APPROVE` | HR approved a pending remote check-in                       |
| `REMOTE_REJECT`  | HR rejected a pending remote check-in                       |

---

## Status & Mode Reference

`attendance_status` (PRD-aligned):

| Status              | Set By                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `PRESENT`           | Check-out with `worked_minutes >= full_day_hours * 60` and not late |
| `HALF_DAY`          | `half_day_hours * 60 <= worked_minutes < full_day_hours * 60`     |
| `ABSENT`            | `worked_minutes < half_day_hours * 60`, or rejection of remote-in |
| `LATE`              | Worked enough hours but checked in past `start_time + grace`      |
| `OVERTIME`          | Implicit via `is_overtime` flag + `overtime_minutes`              |
| `PENDING_APPROVAL`  | Remote check-in awaiting HR approval                              |
| `MISSED_CHECKOUT`   | (v2) nightly job marks records with no check-out                  |
| `ON_LEAVE`          | (v2) nightly job marks records overlapping approved leaves        |
| `HOLIDAY`           | (v2) nightly job marks records on calendar holidays               |
| `WEEKLY_OFF`        | (v2) nightly job marks records on rule's weekly-off days          |

`attendance_mode`: `OFFICE_IN` | `REMOTE_IN`.

`source`: `WEB` | `MOBILE` | `MANUAL` | `BIOMETRIC` | `AUTO`.

`geo_status` (on sessions, not records): `VALID` | `OUTSIDE_RADIUS` | `GPS_DISABLED` | `MOCK_LOCATION` | `REJECTED` | `NOT_APPLICABLE`.

---

## Error Reference

| Scenario                                                       | HTTP | Code / Message                                                                 |
| -------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| Open session already exists                                    | 409  | `Employee already checked in`                                                  |
| Record exists today + rule disallows multiple check-ins        | 409  | `Already checked in once today...`                                             |
| Geo-fencing enabled, lat/lng missing                           | 400  | `GPS_REQUIRED`                                                                 |
| Outside radius + `allow_remote_in=false`                       | 400  | `REMOTE_ATTENDANCE_DISABLED`                                                   |
| Outside radius + reason required but missing                   | 400  | `REMOTE_REASON_REQUIRED`                                                       |
| Check-out called with no open session                          | 404  | `No active check-in found`                                                     |
| Employee has no rule (or department rule)                      | 404  | `No attendance rule assigned to this employee or their department`             |
| Manual entry on a date that already has a record               | 409  | `Attendance record already exists for this employee on this date. Use update.` |
| Manual entry / update: `check_out < check_in`                  | 400  | `check_out must be after check_in`                                             |
| Approve/Reject a non-pending row                               | 409  | `Approval already approved` / `Approval already rejected`                      |
| Approve/Reject a row that has no approval record               | 404  | `Pending remote approval not found`                                            |
| Missing `ATTENDANCE.*` grant for an admin endpoint             | 403  | `FORBIDDEN_RESOURCE`                                                           |

---

## v1 Limitations (Documented Gaps)

1. **No nightly finalization job.** `MISSED_CHECKOUT`, `ON_LEAVE`, `HOLIDAY`, `WEEKLY_OFF` status values are defined but never written. The PRD's "daily attendance finalization" job is deferred.
2. **No leave-conflict check on check-in.** An employee with an `APPROVED` leave today is not blocked from checking in. Cross-module wiring with `leave_requests` is deferred.
3. **Single office per rule.** "Multi-office nearest-radius detection" from the PRD is not implemented — each rule has exactly one geo-fence.
4. **No notifications.** Check-in confirmation, missed-checkout reminder, geo-violation alert, remote-approval status emails / push are not wired. The `notification` module exists but isn't called from attendance transitions.
5. **`summary.geo_violations` is always 0.** Geo-rejection events are written to the audit log (`event_type = GEO_REJECTION`) but the daily-preview summary doesn't aggregate them yet.
6. **No biometric / WiFi / Bluetooth attendance ingestion.** Only `WEB` / `MOBILE` / `MANUAL` are wired; `BIOMETRIC` is in the enum for forward compatibility.
7. **Server-local "today".** `me/today` and the daily-preview default-date use the server's local date, not the employee's timezone. Multi-region orgs should pass an explicit `date` to the preview.
8. **Worked-minutes recompute on approval.** Approving a remote check-in late in the day uses the current worked minutes — the employee should typically check-out **before** HR approves.
