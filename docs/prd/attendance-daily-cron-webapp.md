# Product Requirement Document (PRD)

# Module: Attendance Daily Status View & Calendar — Webapp

## Product: Brello HRMS

---

# 1. Executive Summary

This PRD covers all frontend changes required to support the `attendance-daily-cron.md` backend changes and to complete the employee attendance experience. It is **complementary** to `auto-checkout-webapp.md` — read both together for the full picture.

The central UI problem: the webapp currently shows only employees who checked in. Absent employees, employees on leave, and holiday/weekly-off days are invisible in every attendance view. This PRD fixes that by:

1. Making the admin daily preview show **all employees** — not just those who have records
2. Adding a **monthly attendance calendar** for employees (new page)
3. Adding an **attendance summary card** for employees (on dashboard)
4. Adding a **pre-checkout countdown banner** (on ClockInCard)
5. Adding **leave / holiday / weekly-off status** to all attendance tables
6. Surfacing the **data completeness warning** in the payroll flow

---

# 2. Current State Audit

| File | Current Behavior | Required Change |
|---|---|---|
| `DailyPreviewPage.tsx` | Shows only employees with attendance records | Show all employees; include NOT_CHECKED_IN rows |
| `ClockInCard.tsx` | Shows timer, check-in/out button | Add pre-checkout countdown banner |
| `EmployeeProfilePage.tsx` | Uses mock data; shows only check-in days | Show all days; include ABSENT, WEEKLY_OFF, HOLIDAY, ON_LEAVE |
| `attendance/types/index.ts` | No `NOT_CHECKED_IN` virtual status | Add virtual status; add `DailyPreviewItem.is_virtual` flag |
| Dashboard page | Shows ClockInCard only | Add attendance summary card below ClockInCard |
| No monthly calendar exists | — | New page: employee attendance calendar |
| No payroll data-completeness UI | — | Show warning when payroll period has no-data employees |

---

# 3. Admin Daily Preview — Complete Roster View

## 3.1 The Core Problem

The current `DailyPreviewPage.tsx` fetches `GET /attendance/admin/daily-preview?date=...` which returns only employees with `attendance_record` rows. For today's date (before the 1 AM materialization job runs), employees who haven't checked in simply don't appear in the list.

HR cannot answer: "Who hasn't shown up today?" without cross-referencing a separate employee list.

## 3.2 New Stats Grid

**Current (4 cards):**
```
Present | Absent | Late | Half-Day
```

**New (7 cards in two rows):**
```
Row 1:
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Present      │ │ Absent       │ │ Late         │ │ Half-Day     │
│    47        │ │    12        │ │     8        │ │      3       │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

Row 2:
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ On Leave     │ │ Not Checked  │ │ Auto Checkout│
│     5        │ │     4        │ │     2        │
└──────────────┘ └──────────────┘ └──────────────┘
```

Color coding:
- Present: green
- Absent: red
- Late: orange
- Half-Day: yellow
- On Leave: blue
- Not Checked In (today only): gray — "Session expected but no check-in yet"
- Auto Checkout: amber (from auto-checkout-webapp.md)

## 3.3 Table Changes — Show All Employees

The table must show **all employees** with a rule assignment, sorted by:
1. Checked in (with check-in time, ascending)
2. Not checked in yet (today only) / Absent
3. On leave / Holiday / Weekly off (at the bottom)

**New virtual status row** for employees with no record (today only):

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [Avatar] Priya Sharma        │ Today │ —         │ —          │ —       │ [NOT CHECKED IN] │
│          EMP001 • Engineering│       │           │            │         │                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

`NOT CHECKED IN` renders as a gray badge. It is NOT a stored status — it is derived from the absence of a record for today's date. For past dates (after 1 AM job has run), this will not appear — those employees will have explicit `ABSENT` records.

**Status badge mapping (complete):**

| `attendance_status` | Badge Text | Color |
|---|---|---|
| `PRESENT` | Present | Green |
| `LATE` | Late | Orange |
| `HALF_DAY` | Half-Day | Yellow |
| `ABSENT` | Absent | Red |
| `ON_LEAVE` | On Leave | Blue |
| `HOLIDAY` | Holiday | Purple |
| `WEEKLY_OFF` | Weekly Off | Gray |
| `OVERTIME` | Overtime | Teal |
| `MISSED_CHECKOUT` | Missed Checkout | Red |
| `PENDING_APPROVAL` | Pending | Yellow |
| `NOT_CHECKED_IN` (virtual) | Not Checked In | Light Gray |

## 3.4 Filter Panel (Wire up the currently-dead Filter button)

The existing `Filter` button in `DailyPreviewPage.tsx` does nothing. Replace it with a filter dropdown panel:

```
┌───────────────────────────────────────────────────┐
│  FILTER ATTENDANCE                            [×] │
│                                                   │
│  Status                                           │
│  ☑ Present   ☑ Late    ☑ Half-Day                 │
│  ☑ Absent    ☑ On Leave ☑ Weekly Off              │
│  ☑ Holiday   ☑ Auto Checkout                      │
│  ☑ Not Checked In                                 │
│                                                   │
│  Department  [All Departments ▼]                  │
│                                                   │
│  Check-In Mode                                    │
│  ○ All   ○ Office Only   ○ Remote Only            │
│                                                   │
│  Show Only                                        │
│  ☐ Has Auto Checkout (from auto-checkout PRD)     │
│  ☐ Has Pending Correction                         │
│                                                   │
│              [Reset]        [Apply Filter]        │
└───────────────────────────────────────────────────┘
```

**State:** Filter state is local to the component. Applied filters persist while the admin is on the page (reset on page reload).

## 3.5 Type Changes for Daily Preview

```typescript
// attendance/types/index.ts — ADD:

// Virtual status for today's employees with no record
export type VirtualAttendanceStatus = 'NOT_CHECKED_IN';

export interface DailyPreviewItem {
  // ... existing fields ...
  has_auto_checkout: boolean;           // from auto-checkout-webapp.md
  correction_status: string | null;     // from auto-checkout-webapp.md
  is_virtual: boolean;                  // NEW — true if employee has no record (today only)
}

export interface DailyPreviewSummary {
  // ... existing fields ...
  auto_checkout: number;                // from auto-checkout-webapp.md
  on_leave: number;                     // already exists in backend summary
  not_checked_in: number;              // NEW — today-only virtual count
}
```

## 3.6 API Changes

```typescript
// api/attendance.ts — update DailyPreviewParams:
export interface DailyPreviewParams {
  date?: string;
  page?: number;
  limit?: number;
  search?: string;
  attendance_status?: string[];         // NEW — multi-select filter
  department_id?: string;              // NEW — department filter
  attendance_mode?: string;            // NEW — OFFICE_IN | REMOTE_IN
  has_auto_checkout?: boolean;         // from auto-checkout-webapp.md
  correction_status?: string;          // from auto-checkout-webapp.md
  include_no_record?: boolean;         // NEW — include employees with no record for today
}
```

---

# 4. Employee Monthly Attendance Calendar

## 4.1 Overview

**New Page:** `src/pages/attendance/MyAttendanceCalendarPage.tsx`
**Route:** `/attendance/my-calendar`
**Access:** Employee (own data only)

This is the primary new UI surface. Employees can see their full month of attendance at a glance, including ABSENT days, leave days, holidays, and working days.

## 4.2 UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  My Attendance — January 2024                                       │
│                          [< Prev]  [Jan 2024 ▼]  [Next >]         │
│─────────────────────────────────────────────────────────────────────│
│  Monthly Summary                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Working  │ │ Present  │ │ Absent   │ │ On Leave │ │ OT Hours │ │
│  │  22 days │ │   18     │ │    3     │ │    1     │ │  4h 30m  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│─────────────────────────────────────────────────────────────────────│
│  Calendar View                                                      │
│                                                                     │
│   Mon    Tue    Wed    Thu    Fri    Sat    Sun                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                │
│  │  1 │ │  2 │ │  3 │ │  4 │ │  5 │ │  6 │ │  7 │                │
│  │ ✓  │ │ L  │ │ ✓  │ │ ✓  │ │ ✓  │ │ —  │ │ —  │                │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                │
│  ...                                                                │
│                                                                     │
│  ✓ Present  L Late  ½ Half-Day  ✗ Absent  🏖 Leave  🎉 Holiday      │
│  — Weekly Off  [AUTO] Auto Checkout                                │
└─────────────────────────────────────────────────────────────────────┘
```

## 4.3 Calendar Cell Design

Each calendar cell represents one calendar day:

```
┌──────────┐
│  15      │   ← date number
│  ✓ 8:30  │   ← status icon + check-in time (for PRESENT/LATE)
│  9h 15m  │   ← worked hours
└──────────┘
```

**Cell variants by status:**

| Status | Background | Icon | Shows |
|---|---|---|---|
| `PRESENT` | White | ✓ (green) | Check-in time, worked hours |
| `LATE` | White | ⏱ (orange) | Check-in time + "Late X min" |
| `HALF_DAY` | Light yellow | ½ (yellow) | Check-in time, worked hours |
| `OVERTIME` | Light teal | ✓+ (teal) | Check-in, worked hours, OT |
| `ABSENT` | Light red | ✗ (red) | — |
| `ON_LEAVE` | Light blue | 🏖 (blue) | Leave type name |
| `HOLIDAY` | Light purple | ★ (purple) | Holiday name |
| `WEEKLY_OFF` | Light gray | — (gray) | "Weekly Off" |
| `MISSED_CHECKOUT` | Light red | ⚠ (red) | Check-in time only |
| `AUTO` checkout | amber ring | [AUTO] badge | Check-in, auto-checkout time |
| Future date | Very light gray | — | — |
| Today (no record yet) | Light gray | ? | "Not checked in" |

**Clicking a cell opens a `DayDetailPanel`** (right-slide drawer) showing the full day's session details, correction request status (if applicable), and any audit notes.

## 4.4 `DayDetailPanel` Component

**File:** `src/features/attendance/components/DayDetailPanel.tsx`

```
┌──────────────────────────────────────┐
│  Wednesday, Jan 15, 2024        [×] │
│────────────────────────────────────│
│  Status:  [PRESENT]                 │
│  Shift:   General Shift (9AM–6PM)   │
│                                     │
│  Sessions                           │
│  ────────────────────────────────── │
│  ● Check-in   09:05 AM  Office      │
│  ○ Check-out  06:32 PM  ✓ Manual    │
│    Duration   9h 27m                │
│                                     │
│  ─── Late: 5 minutes ───            │
│                                     │
│  [No correction request]           │
└──────────────────────────────────────┘
```

For auto-checkout days:
```
│  Sessions                           │
│  ────────────────────────────────── │
│  ● Check-in   01:45 PM  Office      │
│  ○ Check-out  11:30 PM  [AUTO]      │
│    Duration   9h 45m                │
│                                     │
│  Correction Request: PENDING        │
│  Requested time: 10:45 PM          │
│  [View Request]                     │
```

---

# 5. Employee Dashboard — New Attendance Summary Card

## 5.1 Overview

Add a new `AttendanceSummaryCard` component below the existing `ClockInCard` on the employee dashboard.

**File:** `src/features/dashboard/components/AttendanceSummaryCard/AttendanceSummaryCard.tsx`

## 5.2 UI Design

```
┌──────────────────────────────────────────────────────────────────────┐
│  This Month — January 2024                        [View Calendar →] │
│────────────────────────────────────────────────────────────────────  │
│                                                                      │
│   Present     Absent     On Leave    Overtime                        │
│   ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐                       │
│   │  18   │  │   3   │  │   1   │  │ 4h30m │                       │
│   │ days  │  │ days  │  │ days  │  │       │                       │
│   └───────┘  └───────┘  └───────┘  └───────┘                       │
│                                                                      │
│   Working days this month: 22                                        │
│   Attendance rate: 81.8%                                             │
│                                                                      │
│   ████████████████████░░░░░░░░░░░                                   │
│   ↑ 18 / 22 working days                                            │
└──────────────────────────────────────────────────────────────────────┘
```

**The progress bar** fills proportionally to `present_days / working_days`. Color thresholds:
- ≥ 90%: green
- 75–89%: yellow
- < 75%: red (likely LOP-impacting)

## 5.3 API

Use a new endpoint (or extend the existing `GET /attendance/me/history`):

```typescript
// New API function in api/attendance.ts:
export const getMyMonthlyAttendanceSummary = (
  month: number,  // 1–12
  year: number,
): Promise<MonthlyAttendanceSummary> =>
  (apiClient.get(`${BASE}/me/summary`, { params: { month, year } }) as Promise<ApiEnvelope<MonthlyAttendanceSummary>>)
    .then(res => res.data);

export interface MonthlyAttendanceSummary {
  month: number;
  year: number;
  working_days: number;
  present_days: number;        // includes full + (half * 0.5)
  absent_days: number;
  on_leave_days: number;
  holiday_days: number;
  weekly_off_days: number;
  overtime_minutes: number;
  attendance_rate: number;     // present_days / working_days * 100
}
```

## 5.4 New Hook

**File:** `src/features/dashboard/hooks/useAttendanceSummary.ts`

```typescript
export const useAttendanceSummary = (month: number, year: number) => {
  return useQuery({
    queryKey: ['attendance-monthly-summary', month, year],
    queryFn: () => getMyMonthlyAttendanceSummary(month, year),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });
};
```

---

# 6. ClockInCard — Pre-Checkout Countdown Banner

## 6.1 Overview

When the backend determines an employee's session will be auto-closed within 30 minutes, it sends an in-app notification. The ClockInCard should detect this and show a live countdown banner.

## 6.2 Implementation Approach

Two options:

**Option A (Recommended for V1):** Poll `GET /attendance/me/today` every 5 minutes while `live_session = true`. The API response includes a new field `auto_checkout_at` (when the session will be auto-closed). If `auto_checkout_at` is within 30 minutes of now, the ClockInCard renders the countdown banner.

**Option B (V2):** Use WebSocket notifications for real-time push from server.

Option A is simpler and consistent with the existing polling pattern in `useAttendance.ts`.

## 6.3 New `TodayAttendance` Field

```typescript
// api/attendance.ts — TodayAttendance — ADD:
export interface TodayAttendance {
  // ... existing fields (including those from auto-checkout-webapp.md) ...
  auto_checkout_at: string | null;    // NEW — ISO timestamp of expected auto-checkout
                                       // null if no open session or not applicable
}
```

## 6.4 UI — Countdown Banner

Shown when: `live_session === true` AND `auto_checkout_at` is within 30 minutes

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⏱  Auto checkout in 18 min — Don't forget to check out           │
│     Session will close at 11:30 PM to prevent overtime overflow    │
│                               [Check Out Now ↗]                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Countdown timer:** Live countdown (`18:42`, `18:41`, ...) computed from `auto_checkout_at - Date.now()` using a `setInterval` in the hook. Counts down in real-time without re-fetching the API.

**Color transitions:**
- 30–10 min remaining: Amber background
- < 10 min remaining: Red background (urgent)

**"Check Out Now" button:** Triggers the same `checkOut()` handler already in `useAttendance.ts` — no new code needed there.

## 6.5 `useAttendance.ts` Hook Changes

```typescript
// Add to returned state:
autoCheckoutAt: today?.auto_checkout_at ?? null,   // NEW
minutesUntilAutoCheckout: computed from autoCheckoutAt,  // NEW — derived value
showCheckoutCountdown: minutesUntilAutoCheckout !== null && minutesUntilAutoCheckout <= 30, // NEW
```

---

# 7. Employee Attendance History Page — Complete Days

## 7.1 Current Problem

`EmployeeProfilePage.tsx` uses mock data and only shows days where the employee has an `attendance_record`. For a proper attendance history, every working day should appear — including ABSENT, WEEKLY_OFF, HOLIDAY, and ON_LEAVE days.

## 7.2 New Behavior

After the daily materialization job runs, `GET /attendance/me/history?month=1&year=2024` will return ALL days for the month (the backend query returns all records, which now includes materialized ABSENT/WEEKLY_OFF/HOLIDAY/ON_LEAVE records).

The frontend just needs to render the complete list correctly:

```
Date          Check-In    Check-Out   Hours    Status
──────────────────────────────────────────────────────
Jan 15, Mon   9:05 AM     6:32 PM    9h 27m   [Present]
Jan 14, Sun   —           —          —        [Weekly Off]
Jan 13, Sat   —           —          —        [Weekly Off]
Jan 12, Fri   9:45 AM     5:30 PM    7h 45m   [Late] +45 min late
Jan 11, Thu   —           —          —        [ABSENT]      ← explicit ABSENT record
Jan 10, Wed   —           —          —        [On Leave] Sick Leave
Jan 09, Tue   10:00 AM    —          9h 45m   [Present] [AUTO]
```

WEEKLY_OFF and HOLIDAY rows should be visually de-emphasized (lighter background) since they don't represent working days.

## 7.3 Row Click → Day Detail Panel

Clicking any row opens `DayDetailPanel` (reused from the calendar view). This gives employees a single place to see session details and correction status for any historical day.

---

# 8. Admin Employee History Page

The admin view of an employee's attendance history (`GET /attendance/admin/employees/:id/history`) should similarly show complete days after materialization.

**Add to the page:**
1. Month summary bar (same as employee's own view)
2. Export button (CSV/Excel of the filtered month)
3. Status filter (show all statuses including WEEKLY_OFF, HOLIDAY)
4. One-click manual correction for any day

---

# 9. Payroll — Data Completeness Warning

## 9.1 Where

In the payroll preparation flow (wherever the payroll run is initiated in the webapp — the existing payroll module).

## 9.2 Warning Condition

Before the payroll run is submitted, check if any employees in the pay period have `no_data = true` in their attendance summary. If so, show:

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚠  Attendance Data Incomplete                                      │
│                                                                      │
│  The following employees have no attendance records for this         │
│  pay period. Their salary will be calculated with 0 working days.   │
│                                                                      │
│  • Ravi Kumar (EMP001)  — Jan 2024: No records                      │
│  • Priya Singh (EMP004)  — Jan 2024: No records                     │
│                                                                      │
│  [View Employees]    [Continue Anyway]    [Cancel]                  │
└──────────────────────────────────────────────────────────────────────┘
```

After the daily materialization job is deployed, this warning should rarely appear (only for employees without rule assignments). But it's a safety net.

## 9.3 Pending Corrections Warning (from auto-checkout-webapp.md)

Already specified in `auto-checkout-webapp.md` — if any employee has `correction_status = PENDING` in the pay period, block or warn before payroll run.

---

# 10. Notification Inbox (In-App)

## 10.1 Overview

The `NotificationService` saves in-app notifications to a `notifications` table. The webapp needs a UI to display them.

**New Component:** `NotificationBell` in the top navigation bar

**File:** `src/components/common/NotificationBell/NotificationBell.tsx`

## 10.2 UI

```
[Bell Icon] (3)   ← unread count badge
     ↓ click
┌──────────────────────────────────────────────────┐
│  Notifications                          Mark all │
│──────────────────────────────────────────────────│
│  🕐 Your attendance was auto-closed     2 min ago │
│     Jan 15 session closed at 11:30 PM            │
│     [View → Request Correction]                   │
│──────────────────────────────────────────────────│
│  ✅ Correction approved by HR          1 hour ago │
│     Jan 12 attendance updated                    │
│──────────────────────────────────────────────────│
│  ⚠  Checkout reminder                  Yesterday │
│     Your session was auto-closed at 11:30 PM     │
│──────────────────────────────────────────────────│
│              [View all notifications]             │
└──────────────────────────────────────────────────┘
```

## 10.3 API

```typescript
// api/notifications.ts (new file):
export interface INotification {
  id: string;
  title: string;
  message: string;
  type: 'IN_APP' | 'EMAIL' | 'PUSH';
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const getNotifications = (params?: { page?: number; limit?: number; unread_only?: boolean }):
  Promise<{ items: INotification[]; unread_count: number; pagination: ... }> =>
  apiClient.get('/notifications/me', { params }).then(res => res.data);

export const markNotificationRead = (id: string): Promise<void> =>
  apiClient.patch(`/notifications/${id}/read`);

export const markAllNotificationsRead = (): Promise<void> =>
  apiClient.patch('/notifications/me/mark-all-read');
```

## 10.4 Polling

Poll `GET /notifications/me?unread_only=true&limit=1` every 60 seconds to update the unread badge count. On receiving an attendance-related notification, also invalidate `['attendance-today']` query to refresh ClockInCard state.

---

# 11. New Routes Summary

| Route | Component | Access | Description |
|---|---|---|---|
| `/attendance/my-calendar` | `MyAttendanceCalendarPage` | Employee | Monthly calendar view |
| `/attendance/my-calendar/:year/:month` | `MyAttendanceCalendarPage` | Employee | Specific month |
| `/attendance/correction-requests` | `AdminCorrectionRequestsPage` | Admin | From auto-checkout-webapp.md |
| `/attendance/my-corrections` | `MyCorrectionRequestsPage` | Employee | From auto-checkout-webapp.md |

---

# 12. Sidebar Navigation Changes

## 12.1 Employee App Sidebar

Under "Attendance" group:
- My Attendance (existing — daily today view)
- My Calendar (new) — `/attendance/my-calendar`
- My Corrections (new) — `/attendance/my-corrections` — from auto-checkout-webapp.md

## 12.2 Admin App Sidebar

Under "Attendance" group:
- Daily Preview (existing)
- Correction Requests (new — with pending badge) — `/attendance/correction-requests` — from auto-checkout-webapp.md
- Attendance Setup (existing)

---

# 13. New Components Summary

| Component | File | Purpose |
|---|---|---|
| `AttendanceSummaryCard` | `dashboard/components/AttendanceSummaryCard/` | Monthly summary on dashboard |
| `MyAttendanceCalendarPage` | `pages/attendance/MyAttendanceCalendarPage.tsx` | Monthly calendar page |
| `DayDetailPanel` | `features/attendance/components/DayDetailPanel.tsx` | Right-slide panel for day detail |
| `NotificationBell` | `components/common/NotificationBell/` | Top-nav notification inbox |
| Filter panel (inline) | Inside `DailyPreviewPage.tsx` | Status/dept filter dropdown |
| `CorrectionRequestModal` | (from auto-checkout-webapp.md) | Employee submits correction |
| `AdminCorrectionRequestsPage` | (from auto-checkout-webapp.md) | Admin reviews corrections |
| `CorrectionDetailModal` | (from auto-checkout-webapp.md) | Admin approves/rejects |
| Pre-checkout countdown banner | Inside `ClockInCard.tsx` | Live countdown to auto-checkout |

---

# 14. New Hooks Summary

| Hook | File | Purpose |
|---|---|---|
| `useAttendanceSummary` | `dashboard/hooks/useAttendanceSummary.ts` | Monthly summary query |
| `useAttendanceCalendar` | `features/attendance/hooks/useAttendanceCalendar.ts` | Calendar data (month + year) |
| `useNotifications` | `features/notification/hooks/useNotifications.ts` | Notification inbox query |
| `useCorrectionRequests` | (from auto-checkout-webapp.md) | Employee correction requests |
| `useAdminCorrectionRequests` | (from auto-checkout-webapp.md) | Admin correction management |

---

# 15. New API Functions Summary

```typescript
// api/attendance.ts — ADD:
getMyMonthlyAttendanceSummary(month, year)  // Summary card on dashboard
getMyAttendanceCalendar(month, year)        // Full month records for calendar

// api/notifications.ts — NEW FILE:
getNotifications(params)
markNotificationRead(id)
markAllNotificationsRead()

// api/attendance.ts — ALREADY IN auto-checkout-webapp.md:
submitCorrectionRequest(data)
getMyCorrectionRequests(params)
getAdminCorrectionRequests(params)
approveCorrectionRequest(id)
rejectCorrectionRequest(id, data)
```

New endpoint to add to backend: `GET /attendance/me/summary?month=1&year=2024` — returns `MonthlyAttendanceSummary` (aggregate counts for the month).

---

# 16. Component Reuse Map

All new UI uses existing components — no new primitives needed:

| New Element | Reuse |
|---|---|
| DayDetailPanel drawer | `Dialog` (position: right) |
| Calendar grid | Custom layout in `.module.scss` — no external calendar library needed |
| Monthly summary stats | Pattern from `DailyPreviewPage` stat cards |
| Countdown banner | Same pattern as auto-checkout alert banner (`ClockInCard`) |
| Notification dropdown | `Popover` component (already exists) |
| Filter panel | `Dialog` or inline positioned `div` with existing `Checkbox`, `Select` components |
| Status badges | Existing `.statusBadge` pattern + new color classes per status |
| Progress bar | CSS `width: X%` with transition — no library |

---

# 17. Styling Notes

**New CSS classes for additional statuses** (add to shared attendance styles or per-page SCSS):

```scss
// Weekly off & holiday — subtle, de-emphasized
.weeklyOff {
  background-color: var(--color-gray-50);
  color: var(--color-gray-500);
}

.holiday {
  background-color: #f3e8ff;   // light purple
  color: #7c3aed;
}

.onLeave {
  background-color: #eff6ff;   // light blue
  color: #1d4ed8;
}

.notCheckedIn {
  background-color: var(--color-gray-50);
  color: var(--color-gray-400);
  font-style: italic;
}

// Countdown banner urgency levels
.countdownWarning {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

.countdownUrgent {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

// Calendar cell variants
.calendarCell {
  &.present    { border-left: 3px solid #16a34a; }
  &.late       { border-left: 3px solid #ea580c; }
  &.halfDay    { border-left: 3px solid #d97706; }
  &.absent     { border-left: 3px solid #dc2626; background: #fef2f2; }
  &.onLeave    { border-left: 3px solid #2563eb; background: #eff6ff; }
  &.holiday    { border-left: 3px solid #7c3aed; background: #f3e8ff; }
  &.weeklyOff  { background: var(--color-gray-50); }
  &.autoCheckout { outline: 2px solid #f59e0b; }
}
```

---

# 18. V1 Implementation Scope

## Phase 1 — Highest Impact (Admin Daily Preview)

| Item | File | Effort |
|---|---|---|
| Add `NOT_CHECKED_IN` virtual status to types | `attendance/types/index.ts` | Low |
| Show all employees in daily preview via include_no_record | `DailyPreviewPage.tsx` + API | Medium |
| Add 3 new stat cards (On Leave, Not Checked In, Auto Checkout) | `DailyPreviewPage.tsx` | Low |
| Wire up Filter button with status/department filters | `DailyPreviewPage.tsx` | Medium |
| Complete status badge coverage (HOLIDAY, WEEKLY_OFF, ON_LEAVE) | `DailyPreviewPage.tsx` | Low |

## Phase 2 — Employee Calendar & Summary

| Item | File | Effort |
|---|---|---|
| `AttendanceSummaryCard` on dashboard | New component | Medium |
| `useAttendanceSummary` hook + API | New hook + api/attendance.ts | Low |
| `MyAttendanceCalendarPage` (calendar grid) | New page | High |
| `DayDetailPanel` (day detail drawer) | New component | Medium |
| `useAttendanceCalendar` hook | New hook | Low |
| New route `/attendance/my-calendar` | `routes/index.tsx` | Low |
| Sidebar entries (My Calendar, My Corrections) | Backend menu config + sidebar | Low |

## Phase 3 — Countdown Banner & Notifications

| Item | File | Effort |
|---|---|---|
| `auto_checkout_at` field in TodayAttendance type | `api/attendance.ts` | Low |
| Pre-checkout countdown banner | `ClockInCard.tsx` + module.scss | Medium |
| Countdown timer logic | `dashboard/hooks/useAttendance.ts` | Low |
| `NotificationBell` component | New component | High |
| Notification polling hook | New hook + new API file | Medium |

## Phase 4 — History Page Completeness & Payroll Warning

| Item | File | Effort |
|---|---|---|
| Complete status display in `EmployeeProfilePage` | Existing page + mock → real API | Medium |
| Export button (CSV) on admin history page | Admin employee history page | Medium |
| Payroll data-completeness warning | Payroll preparation page | Medium |
| Day detail panel in history rows | Reuse DayDetailPanel | Low |
