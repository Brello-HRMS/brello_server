# Product Requirement Document (PRD)

# Module: Auto Checkout System — Webapp (Frontend)

## Product: Brello HRMS

---

# 1. Executive Summary

This document covers all frontend changes required to support the Auto Checkout System described in `auto-checkout.md`. It maps every change to an exact file in the webapp, describes what the user sees and does, and specifies new components, types, API functions, and routing additions needed.

**Three user surfaces are affected:**

1. **Admin — Shift Configuration** (`/attendance/setup`) — replace the current `auto_checkout_time` field with the new engine-driven config fields
2. **Admin — Daily Preview** (`/attendance/daily-preview`) — surface auto-checkout badges and correction request management
3. **Employee — Dashboard & History** — show auto-checkout alerts and the correction request submission flow

---

# 2. Current State Audit

## 2.1 What Exists and Must Change

| File | Current State | Required Change |
|---|---|---|
| `CreateShiftModal.tsx` | `auto_checkout_time` TimePicker in "CHECK-OUT SETTINGS" section | Replace with `overtime_grace_minutes`, `max_session_hours`, `auto_checkout_enabled`, `sync_buffer_minutes` |
| `shiftSchema.ts` | Validates `auto_checkout_time >= end_time` | Remove `auto_checkout_time` rule; add validation for 4 new fields |
| `setupTypes.ts` — `IShift` | Has `auto_checkout_time?: string` | Add 4 new fields; keep `auto_checkout_time` only as optional deprecated read field |
| `setupTypes.ts` — `ICreateShiftForm` | Has `auto_checkout_time?: string` | Remove from create form; add new fields |
| `ShiftsTab.tsx` | Columns: Name, Start, End, Hours, Status, Action | Add auto-checkout enabled indicator column |
| `DailyPreviewPage.tsx` | Table: Employee, Date, Check-in, Check-out, Hours, Status, Notes, Actions | Add auto-checkout badge; add correction status column; wire up Actions menu |
| `DailyPreviewItem` type | No `has_auto_checkout` or `correction_status` fields | Add both fields |
| `ClockInCard.tsx` | Shows status badge, timer, clock in/out button | Add auto-checkout alert banner; add "Request Correction" link |
| `TodayAttendance` type (`api/attendance.ts`) | No `is_auto_checkout`, no correction fields | Add `is_auto_checkout`, `has_auto_checkout`, `correction_status` |
| `DailyPreviewSummary` type | No `auto_checkout` count | Add `auto_checkout: number` |
| `api/attendance.ts` | No correction request API functions | Add 5 new functions |

## 2.2 What Is Entirely New

| Item | Description |
|---|---|
| `CorrectionRequestModal.tsx` | Employee submits correction for auto-closed session |
| `MyCorrectionRequestsPage.tsx` | Employee views their own correction request history |
| `AdminCorrectionRequestsPage.tsx` | Admin reviews, approves, rejects all correction requests |
| `CorrectionDetailModal.tsx` | Admin views full detail of one correction request before deciding |
| `useCorrectionRequests.ts` | React Query hooks for employee correction request flow |
| `useAdminCorrectionRequests.ts` | React Query hooks for admin correction request flow |
| Correction request types | `ICorrectionRequest`, `ISubmitCorrectionForm`, etc. |
| New routes | `/attendance/correction-requests` (admin), `/me/correction-requests` (employee) |
| Sidebar entries | "Correction Requests" count badge under Attendance (admin) |
| Stats card | "Auto Checkout" stat in the daily preview stats grid |

---

# 3. Shift Configuration — Changes

## 3.1 `CreateShiftModal.tsx` — "CHECK-OUT SETTINGS" Section Redesign

### Current UI

```
CHECK-OUT SETTINGS
┌──────────────────────────────┐
│ Auto Checkout Time [TimePicker] │
└──────────────────────────────┘
```

### New UI

```
AUTO CHECKOUT
─────────────────────────────────────────────────────────────
┌─────────────────────────────────────────────────────────┐
│ Enable Auto Checkout                          [Toggle ON] │
│ Automatically close sessions that remain open past the   │
│ configured limit.                                        │
└─────────────────────────────────────────────────────────┘

(shown only when auto_checkout_enabled = true)

┌──────────────────────────┐  ┌──────────────────────────┐
│ Overtime Buffer (mins)   │  │ Max Session Hours         │
│ [120         ▼]          │  │ [14.0        ▼]          │
│ Grace period after shift │  │ Hard cap. Session auto-  │
│ end before auto-closing  │  │ closes at check-in +     │
│                          │  │ this duration.           │
└──────────────────────────┘  └──────────────────────────┘

┌──────────────────────────┐
│ Device Sync Buffer (mins)│
│ [0           ▼]          │
│ Extra buffer for         │
│ biometric device delays  │
└──────────────────────────┘
```

**Field details:**

| Field | Type | Default | Min | Max | Helper Text |
|---|---|---|---|---|---|
| `auto_checkout_enabled` | Toggle | true | — | — | "Automatically close sessions that remain open past the configured limit" |
| `overtime_grace_minutes` | Number input | 120 | 0 | 480 | "Minutes after shift end before auto-checkout fires. Preserves valid overtime." |
| `max_session_hours` | Number input | 14 | 1 | 24 | "Hard cap on session duration regardless of shift or overtime." |
| `sync_buffer_minutes` | Number input | 0 | 0 | 120 | "Extra delay to absorb biometric device sync delays. Set 30 for biometric orgs." |

**Helper text note:** The form should show a computed preview line:

```
Auto checkout fires at: Shift end (22:00) + 120 min = 11:30 PM, 
or check-in + 14h, whichever is earlier.
```

This preview updates live as the user changes `end_time`, `overtime_grace_minutes`, `max_session_hours`, and `is_night_shift`.

**Night shift label change:** When `is_night_shift = true`, the preview should say:

```
Auto checkout fires at: Shift end (06:00 next day) + 120 min = 08:00 AM next day,
or check-in + 14h, whichever is earlier.
```

### Visual Layout Change Summary

Remove the entire "CHECK-OUT SETTINGS" section heading and replace with "AUTO CHECKOUT" heading. The old `auto_checkout_time` TimePicker is completely removed — no deprecation warning needed in the UI since the field was never enforced.

---

## 3.2 `shiftSchema.ts` — Zod Schema Changes

**Remove:**
```typescript
auto_checkout_time: z.string().min(1, 'Auto checkout time is required'),
// and the .refine() block for auto_checkout_time >= end_time
```

**Add:**
```typescript
auto_checkout_enabled: z.boolean().default(true),
overtime_grace_minutes: z.coerce.number()
  .min(0, 'Must be 0 or more')
  .max(480, 'Maximum 8 hours (480 minutes)'),
max_session_hours: z.coerce.number()
  .min(1, 'Must be at least 1 hour')
  .max(24, 'Cannot exceed 24 hours'),
sync_buffer_minutes: z.coerce.number()
  .min(0, 'Must be 0 or more')
  .max(120, 'Maximum 2 hours (120 minutes)'),
```

**Cross-field validation to add:**
```
.refine(
  data => !data.auto_checkout_enabled || data.overtime_grace_minutes >= 0,
  { message: 'Overtime buffer is required when auto-checkout is enabled', path: ['overtime_grace_minutes'] }
)
.refine(
  data => !data.auto_checkout_enabled || data.max_session_hours > (data.full_day_hours ?? 8),
  { message: 'Max session hours should be greater than full day hours', path: ['max_session_hours'] }
)
```

---

## 3.3 `setupTypes.ts` — Type Changes

```typescript
// IShift — add new fields, keep auto_checkout_time as deprecated read-only
export interface IShift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_night_shift?: boolean;
  late_grace_minutes: number;
  /** @deprecated Never enforced. Kept for backward read compat only. */
  auto_checkout_time?: string;
  // NEW:
  auto_checkout_enabled: boolean;
  overtime_grace_minutes: number;
  max_session_hours: number;
  sync_buffer_minutes: number;
  allow_early_checkin?: boolean;
  full_day_hours?: number;
  half_day_hours?: number;
  status: Status;
}

// ICreateShiftForm — remove auto_checkout_time, add new fields
export interface ICreateShiftForm {
  name: string;
  start_time: string;
  end_time: string;
  is_night_shift?: boolean;
  late_grace_minutes: number;
  // auto_checkout_time removed
  auto_checkout_enabled: boolean;
  overtime_grace_minutes: number;
  max_session_hours: number;
  sync_buffer_minutes: number;
  full_day_hours: number;
  half_day_hours: number;
}
```

---

## 3.4 `ShiftsTab.tsx` — Column Changes

Add one new column after "End" and before "Hours":

| Column | Accessor | Render |
|---|---|---|
| Auto Checkout | `auto_checkout_enabled` | If `true`: green dot + "Enabled". If `false`: gray dot + "Off". Use the existing `StatusBadge` component with a custom status mapping. |

The existing "Hours" column should also be updated to show the formula-computed auto-checkout time as a tooltip or subtitle:

```
Hours: 8 hrs
       Auto checkout: ~22:00 + 2h = 00:00
```

---

# 4. Daily Preview — Changes

## 4.1 Stats Grid

**Current:** 4 stat cards: Total Present, Total Absent, Late Arrivals, Half-Day

**New:** Add a 5th stat card:

```
┌──────────────────┐
│ Auto Checked Out │
│       3          │
└──────────────────┘
```

Color: amber/orange to signal "needs review" without being alarming.

This reads from `DailyPreviewSummary.auto_checkout` which is a new field added to the backend response.

---

## 4.2 Table Changes

### New columns and indicators

**"Check-out" column** — add auto-checkout badge:

```
Current: "10:02 PM"
New:     "10:02 PM  [AUTO]"
```

`[AUTO]` is a small amber pill badge rendered inline next to the time when `record.has_auto_checkout === true`.

**"Correction" column** — new column after Status:

| Value | Display |
|---|---|
| `null` | — (dash) |
| `PENDING` | Yellow pill: "Correction Pending" |
| `APPROVED` | Green pill: "Corrected" |
| `REJECTED` | Gray pill: "Correction Rejected" |

### Actions column — wire up the `MoreVertical` menu

The current "Actions" column renders a `MoreVertical` icon button that does nothing. This must be replaced with a proper dropdown menu. For rows with `has_auto_checkout === true`, the menu should include:

```
┌──────────────────────────────┐
│ ✎ Edit Attendance            │
│ ─────────────────────────── │
│ ⧖ View Correction Request    │  (if correction_status exists)
│ ✓ Approve Correction         │  (if correction_status = PENDING)
│ ✗ Reject Correction          │  (if correction_status = PENDING)
└──────────────────────────────┘
```

For rows without auto-checkout, the menu keeps the existing behavior (or shows only "Edit Attendance").

### Filter additions

The existing `Filter` icon button currently does nothing. Wire it up with a filter dropdown that includes:

- Status filter (existing values: Present, Late, Absent, etc.)
- **NEW:** "Has Auto Checkout" checkbox filter — filters to show only auto-checkout records

---

## 4.3 Type Changes (`attendance/types/index.ts`)

```typescript
// DailyPreviewItem — add:
export interface DailyPreviewItem {
  // ... existing fields ...
  has_auto_checkout: boolean;           // NEW
  correction_status: string | null;     // NEW: null | 'PENDING' | 'APPROVED' | 'REJECTED'
}

// DailyPreviewSummary — add:
export interface DailyPreviewSummary {
  // ... existing fields ...
  auto_checkout: number;                // NEW
}

// DailyPreviewParams — add:
export interface DailyPreviewParams {
  // ... existing fields ...
  has_auto_checkout?: boolean;          // NEW filter param
  correction_status?: string;           // NEW filter param
}
```

---

# 5. Employee Dashboard — Changes

## 5.1 `TodayAttendance` Type (`api/attendance.ts`)

```typescript
export interface TodayAttendance {
  // ... existing fields ...
  is_auto_checkout: boolean;            // NEW — today's session was auto-closed
  has_auto_checkout: boolean;           // NEW — record-level flag
  correction_status: string | null;     // NEW: null | 'PENDING' | 'APPROVED' | 'REJECTED'
}
```

---

## 5.2 `ClockInCard.tsx` — Auto Checkout Alert Banner

When `today.is_auto_checkout === true` and `today.correction_status === null`, show an alert banner below the timer:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠  Your attendance was auto-closed at 11:30 PM.                   │
│      If this is incorrect, you can request a correction.           │
│                                          [Request Correction →]    │
└─────────────────────────────────────────────────────────────────────┘
```

When `today.correction_status === 'PENDING'`:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⏳ Your correction request is pending review.                      │
└─────────────────────────────────────────────────────────────────────┘
```

When `today.correction_status === 'APPROVED'`:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✓  Your correction was approved. Attendance updated.               │
└─────────────────────────────────────────────────────────────────────┘
```

**Styling:** Amber background (`var(--color-warning-bg)` or CSS amber-50 equivalent) with `var(--color-warning)` border for the pending/alert states. Green for approved. The card's existing `.card` container gets no layout change — the banner is inserted between the `shiftInfo` row and the location notice.

**Interaction:** "Request Correction →" opens `CorrectionRequestModal` (new component).

---

## 5.3 `useAttendance.ts` — Hook Changes

```typescript
// Return values to add:
return {
  // ... existing values ...
  isAutoCheckout: today?.is_auto_checkout ?? false,       // NEW
  correctionStatus: today?.correction_status ?? null,     // NEW
  isCorrectionModalOpen,                                  // NEW
  setIsCorrectionModalOpen,                               // NEW
  lastCheckoutTime: today?.check_out_time ?? null,        // NEW — pass to modal
  attendanceId: today?.attendance_id ?? null,             // NEW — pass to modal
  attendanceSessionId: today?.attendance_session_id ?? null, // NEW
};
```

---

# 6. New Components

## 6.1 `CorrectionRequestModal.tsx`

**Location:** `src/features/attendance/components/CorrectionRequestModal.tsx`

**Trigger:** "Request Correction →" in the ClockInCard auto-checkout banner

**UI:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Request Attendance Correction                                  [×] │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│  AUTO CHECKOUT DETAILS                                              │
│  ─────────────────────────────────────────────────────────────────  │
│  Date              Jan 15, 2024                                     │
│  Auto-closed at    11:30 PM                                         │
│  Hours recorded    9h 45m                                           │
│                                                                     │
│  WHAT ACTUALLY HAPPENED                                             │
│  ─────────────────────────────────────────────────────────────────  │
│  Actual Check-Out Time  *                                           │
│  [TimePicker — max: auto_checkout_at, min: check_in_at]            │
│                                                                     │
│  Reason  *                                                          │
│  [Textarea — "Forgot to check out before leaving at 10:45 PM..."]  │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                  [Cancel]         [Submit Request]                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Validation:**
- `requested_check_out_at` is required and must be `>= check_in_at` and `<= auto_checkout_at`
- Reason is required (min 10 characters)

**On Submit:** Calls `submitCorrectionRequest()` API → shows success toast → closes modal → refetches today's attendance (which now shows `correction_status: 'PENDING'`)

**Form handling:** React Hook Form + Zod (consistent with `CreateShiftModal`)

---

## 6.2 `MyCorrectionRequestsPage.tsx`

**Location:** `src/pages/attendance/MyCorrectionRequestsPage.tsx`

**Route:** `/attendance/my-corrections`

**Access:** Employee (not admin-only)

**Purpose:** Employee sees all their correction requests and their outcomes over time.

**UI Layout:**

```
Page Header: "My Correction Requests"
Subtitle: "View the status of your attendance correction submissions"

Filters row:
  [Status: All ▼]   [Month/Year picker]

Table:
  Date | Check-In | Auto-Closed At | Requested Time | Reason (truncated) | Status | Action

Status chips:
  PENDING   → Yellow:  "Pending Review"
  APPROVED  → Green:   "Approved"
  REJECTED  → Red:     "Rejected"

Action column:
  PENDING  → "View" (opens read-only detail modal)
  APPROVED → "View"
  REJECTED → "View" (shows rejection notes)

Empty state:
  Icon + "No correction requests"
  Subtitle: "When your attendance is auto-closed, you can submit a correction here."
```

---

## 6.3 `AdminCorrectionRequestsPage.tsx`

**Location:** `src/pages/attendance/AdminCorrectionRequestsPage.tsx`

**Route:** `/attendance/correction-requests`

**Access:** Admin (requires `ATTENDANCE.approve` permission)

**UI Layout:**

```
Page Header: "Correction Requests"
Subtitle: "Review and resolve employee attendance correction requests"

Stats bar:
  [Pending: 5]  [Approved today: 12]  [Rejected today: 2]

Filters:
  [Status: Pending ▼]  [Employee search]  [Date range]

Table columns:
  Employee | Date | Check-In | Auto-Closed At | Requested Time | Reason | Submitted | Status | Action

Row appearance:
  PENDING rows: white background
  APPROVED rows: subtle green-tinted row
  REJECTED rows: subtle gray-tinted row

Action column per row:
  PENDING  → [Approve] [Reject] (two action buttons)
  APPROVED → "Approved" (read-only chip)
  REJECTED → "Rejected" (read-only chip)

Clicking [Approve] or [Reject] → opens CorrectionDetailModal for final confirmation
```

---

## 6.4 `CorrectionDetailModal.tsx`

**Location:** `src/features/attendance/components/CorrectionDetailModal.tsx`

**Used by:** `AdminCorrectionRequestsPage`

**UI:**

```
┌────────────────────────────────────────────────────────────────────┐
│  Correction Request — Ravi Kumar                              [×] │
│────────────────────────────────────────────────────────────────────│
│                                                                    │
│  ATTENDANCE RECORD                                                 │
│  ──────────────────────────────────────────────────────────────── │
│  Date              Jan 15, 2024                                    │
│  Check-In          01:45 PM                                        │
│  Auto-Closed At    11:30 PM  [AUTO]                               │
│  Hours Recorded    9h 45m                                          │
│                                                                    │
│  EMPLOYEE'S REQUEST                                                │
│  ──────────────────────────────────────────────────────────────── │
│  Requested Time    10:45 PM                                        │
│  Hours (if corrected)  9h 00m                                     │
│  Submitted         Jan 15, 2024, 11:58 PM                         │
│  Reason                                                            │
│  "Forgot to check out before leaving at 10:45 PM. The              │
│  attendance system auto-closed my session."                        │
│                                                                    │
│  TIME COMPARISON                                                   │
│  ──────────────────────────────────────────────────────────────── │
│  Auto-closed: 9h 45m  →  Requested: 9h 00m  (-45 min)            │
│                                                                    │
│  ──────────────────────────────────────────────────────────────── │
│  (Reject mode only — shown when clicking Reject):                  │
│  Rejection Notes (optional)                                        │
│  [Textarea]                                                        │
│                                                                    │
│             [Reject]            [Approve & Update]                 │
└────────────────────────────────────────────────────────────────────┘
```

**On Approve:** Calls `approveCorrectionRequest(id)` → success toast "Attendance updated with corrected time" → closes modal → invalidates correction requests query
**On Reject:** Calls `rejectCorrectionRequest(id, notes)` → success toast "Correction request rejected" → closes modal

---

# 7. New API Functions (`src/api/attendance.ts`)

```typescript
// --- Correction Request Types ---
export interface ICorrectionRequest {
  id: string;
  attendance_record_id: string;
  attendance_session_id: string;
  employee_id: string;
  employee_name?: string;           // populated in admin view
  employee_code?: string;           // populated in admin view
  date?: string;                    // from attendance_record
  check_in_at?: string;             // from session
  auto_checkout_at: string;
  auto_worked_minutes: number;
  requested_check_out_at: string;
  employee_reason: string;
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_notes?: string | null;
  created_at: string;
}

export interface ISubmitCorrectionPayload {
  attendance_session_id: string;
  requested_check_out_at: string;   // ISO 8601
  employee_reason: string;
}

export interface IRejectCorrectionPayload {
  reviewer_notes?: string;
}

export interface CorrectionRequestListParams {
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  employee_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

// --- Employee APIs ---
export const submitCorrectionRequest = (data: ISubmitCorrectionPayload): Promise<unknown> =>
  apiClient.post(`${BASE}/me/correction-requests`, data);

export const getMyCorrectionRequests = (
  params?: CorrectionRequestListParams,
): Promise<{ items: ICorrectionRequest[]; pagination: { page: number; limit: number; total: number } }> =>
  (
    apiClient.get(`${BASE}/me/correction-requests`, { params }) as Promise<
      ApiEnvelope<{ items: ICorrectionRequest[]; pagination: { page: number; limit: number; total: number } }>
    >
  ).then((res) => res.data);

// --- Admin APIs ---
export const getAdminCorrectionRequests = (
  params?: CorrectionRequestListParams,
): Promise<{ items: ICorrectionRequest[]; pagination: { page: number; limit: number; total: number } }> =>
  (
    apiClient.get(`${BASE}/admin/correction-requests`, { params }) as Promise<
      ApiEnvelope<{ items: ICorrectionRequest[]; pagination: { page: number; limit: number; total: number } }>
    >
  ).then((res) => res.data);

export const approveCorrectionRequest = (id: string): Promise<unknown> =>
  apiClient.post(`${BASE}/admin/correction-requests/${id}/approve`);

export const rejectCorrectionRequest = (
  id: string,
  data?: IRejectCorrectionPayload,
): Promise<unknown> =>
  apiClient.post(`${BASE}/admin/correction-requests/${id}/reject`, data ?? {});
```

---

# 8. New Hooks

## 8.1 `useCorrectionRequests.ts`

**Location:** `src/features/attendance/hooks/useCorrectionRequests.ts`

```typescript
// Pattern: matches existing useShifts.ts / useRules.ts pattern

export const useCorrectionRequests = (params?: CorrectionRequestListParams) => {
  // useQuery for list
  // useMutation for submitCorrectionRequest
  // Returns: requests, isLoading, submitCorrection, isSubmitting
}
```

## 8.2 `useAdminCorrectionRequests.ts`

**Location:** `src/features/attendance/hooks/useAdminCorrectionRequests.ts`

```typescript
export const useAdminCorrectionRequests = (params?: CorrectionRequestListParams) => {
  // useQuery for list (queryKey: ['correction-requests', params])
  // useMutation for approveCorrectionRequest (invalidates list on success)
  // useMutation for rejectCorrectionRequest (invalidates list on success)
  // Returns: requests, isLoading, total, approve, isApproving, reject, isRejecting
}
```

---

# 9. Routing Changes

## 9.1 New Routes to Register

**Location:** `src/routes/index.tsx`

```typescript
// Employee route:
{
  path: '/attendance/my-corrections',
  element: <MyCorrectionRequestsPage />,
  // Accessible to all employees
}

// Admin route:
{
  path: '/attendance/correction-requests',
  element: <AdminCorrectionRequestsPage />,
  // Requires ModuleCode.ATTENDANCE access
}
```

## 9.2 Sidebar Navigation

The sidebar menu is server-driven via `getMenu()` API. The backend menu configuration must add:

**Under the Attendance group (admin app):**
- "Correction Requests" — route: `/attendance/correction-requests` — with pending count badge

The pending count badge should pull from the same correction requests list API filtered to `PENDING`. The sidebar can use an independent query (`useQuery(['correction-requests-pending-count'])`) that fetches `?approval_status=PENDING&limit=1` and reads the `pagination.total` as the badge count.

**Under the Attendance group (employee app):**
- "My Corrections" — route: `/attendance/my-corrections`

---

# 10. Employee Attendance History Page

The existing `EmployeeProfilePage.tsx` (which currently uses mock data) needs two additions:

1. **Auto-checkout badge** in the checkout time column — same amber `[AUTO]` pill as in daily preview

2. **Correction status chip** in the status column — shown as a secondary row below the main status badge:

```
Present
Correction Pending   ← smaller, secondary chip in yellow
```

3. **"Request Correction" action** in the row action menu — only visible for records where `has_auto_checkout = true` and `correction_status = null`

The `AttendanceHistoryItem` type in `api/attendance.ts` needs two new fields:

```typescript
export interface AttendanceHistoryItem {
  // ... existing fields ...
  has_auto_checkout: boolean;          // NEW
  correction_status: string | null;    // NEW
}
```

---

# 11. Component Reuse Map

All new UI should use existing components — no new design primitives are needed.

| New UI Element | Reuse |
|---|---|
| CorrectionRequestModal dialog shell | `Dialog` (position: center, maxWidth: 520px) |
| CorrectionDetailModal dialog shell | `Dialog` (position: right, maxWidth: 560px) |
| Requested time picker | `TimePicker` |
| Reason textarea | `Input` with `type="textarea"` (or check if textarea variant exists) |
| Approve/Reject buttons | `Button` variants: `success` for Approve, `danger` for Reject |
| Status chips in table | New CSS classes in the page's `.module.scss`, or repurpose `StatusBadge` |
| Auto-checkout [AUTO] pill | Inline `<span>` with amber CSS class, consistent with existing status badge pattern |
| No data state | `NoDataFound` component |
| Deletion/rejection confirmation | `WarningModal` |
| Admin page filter panel | Pattern from `DailyPreviewPage` — local state + query params |
| Toast notifications | `showToast` from `ToastFeature` |

---

# 12. Shift Setup Modal — Visual Preview Component

Add a computed preview block at the bottom of the "AUTO CHECKOUT" section in `CreateShiftModal`. This is a read-only info box that updates live as the user changes time and config fields:

```
┌──────────────────────────────────────────────────────────────────┐
│  ℹ  Auto-checkout fires at:                                      │
│     • 11:30 PM  (Shift end 10:00 PM + 90 min overtime buffer)   │
│     • OR 09:00 AM+1  (Check-in + 14h cap) — whichever is first  │
└──────────────────────────────────────────────────────────────────┘
```

Implementation: `useWatch` on `end_time`, `is_night_shift`, `overtime_grace_minutes`, `max_session_hours`. Compute the preview client-side using the same formula from the backend PRD:

```typescript
function computeAutoCheckoutPreview(
  endTime: string,
  isNightShift: boolean,
  overtimeGraceMinutes: number,
  maxSessionHours: number,
): string {
  // Parse end_time HH:mm → add overtimeGraceMinutes → format as "HH:MM AM/PM [next day if night shift]"
  // Format max cap as "check-in + Xh"
}
```

This is purely cosmetic — the actual calculation happens on the server. The preview helps HR admins understand what they are configuring.

---

# 13. V1 Implementation Scope

## Phase 1 — Shift Config Changes (Quickest to ship)

| Item | File | Effort |
|---|---|---|
| Remove `auto_checkout_time` field | `CreateShiftModal.tsx`, `shiftSchema.ts`, `setupTypes.ts`, `ICreateShiftForm` | Low |
| Add 4 new fields to shift form | `CreateShiftModal.tsx`, `shiftSchema.ts`, `setupTypes.ts` | Low |
| Update shift API calls | `api/attendance.ts`, `useShifts.ts` | Low |
| Add auto-checkout column in ShiftsTab | `ShiftsTab.tsx` | Low |
| Add live preview block in CreateShiftModal | `CreateShiftModal.tsx` | Medium |

## Phase 2 — Daily Preview Enhancements

| Item | File | Effort |
|---|---|---|
| Add `has_auto_checkout` + `correction_status` to types | `attendance/types/index.ts` | Low |
| Add [AUTO] badge in checkout column | `DailyPreviewPage.tsx` | Low |
| Add correction status column | `DailyPreviewPage.tsx` | Low |
| Add auto-checkout stat card | `DailyPreviewPage.tsx` | Low |
| Wire up Actions menu dropdown | `DailyPreviewPage.tsx` | Medium |
| Add has_auto_checkout filter | `DailyPreviewPage.tsx` | Medium |

## Phase 3 — Employee Auto-Checkout Alert

| Item | File | Effort |
|---|---|---|
| Update `TodayAttendance` type | `api/attendance.ts` | Low |
| Auto-checkout banner in ClockInCard | `ClockInCard.tsx`, `ClockInCard.module.scss` | Medium |
| Update `useAttendance` return values | `dashboard/hooks/useAttendance.ts` | Low |
| `CorrectionRequestModal.tsx` | New file | Medium |
| `useCorrectionRequests.ts` | New file | Medium |
| New correction API functions (employee) | `api/attendance.ts` | Low |

## Phase 4 — Admin Correction Management

| Item | File | Effort |
|---|---|---|
| `AdminCorrectionRequestsPage.tsx` | New file | High |
| `CorrectionDetailModal.tsx` | New file | Medium |
| `useAdminCorrectionRequests.ts` | New file | Medium |
| New correction API functions (admin) | `api/attendance.ts` | Low |
| New routes | `src/routes/index.tsx` | Low |
| Sidebar pending count badge | Backend menu API change + frontend query | Medium |
| Employee history page updates | `EmployeeProfilePage.tsx` | Medium |
| `MyCorrectionRequestsPage.tsx` | New file | Medium |

---

# 14. Styling Notes

All new components follow the existing pattern:

- SCSS Modules (`.module.scss` alongside component)
- CSS custom properties for colors: `var(--color-warning)`, `var(--color-success)`, `var(--color-error)`, `var(--color-gray-50)`
- Lucide React icons
- Framer Motion for modal enter/exit animations (already used in `Dialog`)
- No new dependencies required

**New CSS variables to add** (if not already in the design system):

```scss
--color-warning: #f59e0b;
--color-warning-bg: #fffbeb;
--color-warning-border: #fde68a;
--color-auto-checkout: #f59e0b;    // [AUTO] badge color
```

These amber/yellow values are the standard for "attention but not error" across all HRMS systems.
