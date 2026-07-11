# Notification Trigger Rollout Plan

**Status:** Draft
**Last Updated:** 2026-07-07
**Relates to:** `docs/prd/notification-system.md` (event catalog & channel targets), `docs/prd/notifications/notification-system.md` (architecture)

## 1. Why this document exists

`docs/prd/notification-system.md` defines *what* should be sent and on which channels. Its own "Current State Audit" (section 3) is now stale — written 2026-06-20, before the platform layer was actually finished. A full code sweep on 2026-07-07 (see section 2) found the opposite problem from what that audit describes: the **platform is done, the triggers are not**. This document is the concrete, file-level plan to close that gap — what to change, where, in what order.

Nothing here should be built without reading the target file first — line numbers will drift.

## 2. Current state (verified against code, 2026-07-07)

### 2.1 Platform layer — done, not a stub

| Piece | Status |
|---|---|
| `NotificationService.send()` / `broadcastAllChannels()` | Working. Queues to BullMQ (EMAIL/IN_APP/PUSH), gates on `user_notification_preferences` via `event_type` |
| In-app persistence + API | Working (`GET /notifications`, `/unread-count`, `/unread`, `PATCH .../read`, `PATCH .../read-all`) |
| Real-time delivery | Working — `GET /notifications/stream` (SSE), `sse.controller.ts` |
| Push | Working infra, **zero callers** — VAPID keys, `push-subscription` entity/repo, `PushNotificationService`, push worker, `POST /notifications/push-subscription`, `GET /notifications/vapid-public-key`. No code anywhere in the repo ever sends `NotificationType.PUSH`. |
| Preferences | Working — `GET/PATCH /notifications/preferences`, gate implemented in `NotificationService.send()` |
| Email templates | **Thin** — only `base-layout.tsx`, `otp-email.tsx`, `trial-reminder.tsx` exist in `src/modules/notification/templates/`. Every other event below needs a new template. |
| `NotificationEventType` enum (`src/common/enums/notification-event-type.enum.ts`) | **Incomplete** — only ~19 values (leave x4, reimbursement x4, attendance x3, `PAYROLL_REMINDER`, `EMPLOYEE_INVITED`/`EMPLOYEE_ACTIVATED`, billing x3, `AUTH_OTP`, letter x2). Most events in this plan need a new enum value before they can respect user preferences. |

**Action item (do this first, once, before any domain phase):** every new call site added below must (a) go through `NotificationService.send()`, never a new bespoke path, and (b) set `event_type` to a real `NotificationEventType` value — several existing calls (trial reminder, letter-issued) skip this and silently bypass the preference gate. Add enum values as needed per phase rather than all at once, to keep each phase's diff self-contained.

### 2.2 What already works end-to-end today

| Event | Channel | Source |
|---|---|---|
| Login OTP | EMAIL | `auth.service.ts:152` (`loginSendOtp`), `:650` (`resendOtp`) |
| Employee invitation | EMAIL | `employee.service.ts:1156` (`sendInviteEmail`) |
| Feedback submitted / ticket status updated / reply added | IN_APP | `feedback.service.ts:52,97,121-128`; `platform-feedback.service.ts:84,107,128-134` — silently no-ops if `PLATFORM_ADMIN_NOTIFICATION_USER_ID` env var is unset |
| Trial reminder (7/3/1 day) | EMAIL only | `trial-reminder.cron.ts:73-85` — PRD also wants IN_APP; doesn't set `event_type`, bypasses preferences |
| Letter issued | IN_APP → employee | `issued-letter.service.ts:169-176` — no `event_type` set |
| Letter viewed / acknowledged | IN_APP → the letter's **generator** (not the employee) | `issued-letter.service.ts:249` (`LETTER_VIEWED`), `:304` (`LETTER_ACKNOWLEDGED`) — backend `acknowledgeMine` endpoint exists but nothing in `MyLettersPage.tsx`/`MyLetterCard.tsx` (webapp) calls it; it's currently dead from the employee's side |

Everything not in this table is **missing** — confirmed by direct grep for `NotificationService`/`notificationService` returning zero hits in the relevant service files.

## 3. Rollout phases

Ordered by (a) how often the workflow fires and (b) how "silent and stuck" it leaves a user today. Each phase is independently shippable — don't block phase N+1 on phase N.

---

### Phase 1 — Leave & Attendance approvals (highest priority)

Every approve/reject workflow in the product is currently silent. This is the phase with the most user-visible impact per line of code changed.

| Event | Recipient | Channels | Wire into | New `NotificationEventType`? |
|---|---|---|---|---|
| Leave submitted | Approver | IN_APP, EMAIL, PUSH | `leave-request.service.ts` create path | Already exists: `LEAVE_SUBMITTED` |
| Leave approved | Requester | IN_APP, EMAIL, PUSH | `leave-request.service.ts` approve path | `LEAVE_APPROVED` (exists) |
| Leave rejected | Requester | IN_APP, EMAIL, PUSH | `leave-request.service.ts` reject path | `LEAVE_REJECTED` (exists) |
| Leave withdrawn/cancelled | Approver | IN_APP, EMAIL | `leave-request.service.ts` cancel path | `LEAVE_CANCELLED` (exists) |
| Leave balance low (<2 days) | Employee | IN_APP, EMAIL | New weekly cron in `leave-balance` module (none exists today) | new: `LEAVE_BALANCE_LOW` |
| Leave balance credited | Employee | IN_APP | Wherever balance accrual/manual-credit happens in `leave-balance.service.ts` | new: `LEAVE_BALANCE_CREDITED` |
| Shift assigned | Employee | IN_APP, EMAIL, PUSH | `shift.service.ts` assign path | new: `SHIFT_ASSIGNED` |
| Shift updated | Employee | IN_APP, EMAIL | `shift.service.ts` update path | new: `SHIFT_UPDATED` |
| Remote work submitted | Approver | IN_APP, EMAIL, PUSH | `remote-approval.service.ts` create path | new: `REMOTE_WORK_SUBMITTED` |
| Remote work approved/rejected | Employee | IN_APP, EMAIL | `remote-approval.service.ts` approve/reject | new: `REMOTE_WORK_APPROVED`/`REJECTED` |
| Attendance mark missing (no clock-in by 11 AM) | Employee | IN_APP, PUSH | New cron — none of the 3 existing attendance crons (`daily-absent-marking` 01:00, `attendance-finalization` 02:00, `pre-checkout-reminder` every 30 min in `attendance-cron.service.ts`) cover this; needs a new 11:00 AM job | new: `ATTENDANCE_MARK_MISSING` |
| Late clock-in | Employee's manager | IN_APP | `attendance.service.ts:388-393` (`applyCheckout`) — comment there explicitly says "does NOT notify — the caller owns that"; add the call at the actual caller | new: `LATE_CLOCK_IN` |
| Regularization requested | Manager/HR | IN_APP, EMAIL | `correction-request.service.ts` create path | already exists as attendance-correction group, or add `REGULARIZATION_REQUESTED` |
| Regularization approved/rejected | Employee | IN_APP, EMAIL | `correction-request.service.ts` approve/reject | `ATTENDANCE_CORRECTION_APPROVED`/`REJECTED` (exist) |

**Recipient resolution note:** "Approver" for leave/remote-work/regularization needs a manager/HR lookup — check what `leave-request.service.ts` already uses to find the approver (likely an existing RBAC/reporting-manager lookup) and reuse it; don't invent a second resolution path.

---

### Phase 2 — Payroll & Reimbursement

The payroll-reminder cron already has the hard part done (data queries) — this is the cheapest phase to close.

| Event | Recipient | Channels | Wire into | Notes |
|---|---|---|---|---|
| Payroll reminder: attendance not locked (T-4) | Payroll Admin/HR | IN_APP, EMAIL | `payroll-reminder.cron.ts` — has an explicit `TODO(notification): ... once recipient resolution (RBAC role lookup) is wired` at lines 18-19, and currently only `logger.warn(...)` at 78-83 | Resolve the payroll-admin RBAC role lookup first — that's the actual blocker per the TODO, not the notification call itself |
| Payroll reminder: pending leave requests (T-4) | Payroll Admin/HR | IN_APP, EMAIL | Same cron, same block | Ship together with the row above — same recipient resolution |
| Payslip generated | Employee | IN_APP, EMAIL (PDF attached), PUSH | `payroll-processing.service.ts:84` (after `run_status = COMPLETED`), or per-employee inside whatever loop finalizes each payslip | new: `PAYSLIP_GENERATED`. Reuse the existing payslip PDF generation (`payslip-pdf.service.ts`) as the email attachment |
| Salary revised | Employee | IN_APP, EMAIL | `employee-salary.service.ts` — `assignSalary` (27), `bulkAssignSalary` (51), `updateEmployeeSalaryStructure` (195) | new: `SALARY_REVISED`. For `bulkAssignSalary`, batch — don't fire one send() per employee synchronously in a tight loop |
| Payroll run failed | Payroll Admin | IN_APP, EMAIL | Needs a failure path added to `payroll-processing.service.ts` (none exists today — currently no failed-status transition at all) | new: `PAYROLL_RUN_FAILED`, 🔴 critical |
| Advance salary requested | — | — | **Feature doesn't exist** (`grep -rin "advance" src/modules/payroll` → no hits) | Skip until the feature itself is built |
| Reimbursement submitted | Approver | IN_APP, EMAIL, PUSH | `reimbursement.service.ts:24` (`create`) | new: `REIMBURSEMENT_SUBMITTED` (exists in enum, just unused) |
| Reimbursement approved/rejected | Requester | IN_APP, EMAIL, PUSH | `admin-reimbursement.service.ts:70` (`updateStatus`) | `REIMBURSEMENT_APPROVED`/`REJECTED` (exist) — include `rejection_reason` (already captured at lines 78-79) in the rejection message |
| Reimbursement paid | Employee | IN_APP, EMAIL | `admin-reimbursement.service.ts:90` (`markPaid`) | `REIMBURSEMENT_PAID` (exists in enum, just unused) |

---

### Phase 3 — Employee Lifecycle & Auth Security

| Event | Recipient | Channels | Wire into | Notes |
|---|---|---|---|---|
| Employee profile activated | Employee | IN_APP, EMAIL | `employee.service.ts:1175-1237` (`activateEmployee`) | `EMPLOYEE_ACTIVATED` (exists in enum, just unused) |
| Offboarding initiated | Employee + HR Admin | IN_APP, EMAIL | `employee.service.ts:944-1040` (`initiateOffboarding`/`updateOffboarding`/`cancelOffboarding`), and `offboarding-cron.service.ts:19-47` for the finalize step | new: `OFFBOARDING_INITIATED` (no enum value exists yet) |
| Password changed | Self | IN_APP, EMAIL | `auth.service.ts:465-501` (`updatePassword`) — currently invalidates sessions with zero notification | new: `PASSWORD_CHANGED`, 🔴 critical, no opt-out |
| New device/location login | Self | IN_APP, EMAIL | Needs new detection logic first — `device_fingerprint` is captured on session (`auth.service.ts:121,220`) but never compared against prior sessions | Bigger lift than the others in this phase: build device-comparison logic, then the notification. Consider scoping as its own follow-up if it slows this phase down. |
| Work anniversary (yearly) | Employee + manager | IN_APP, PUSH | New daily 08:00 cron (none exists) | new: `WORK_ANNIVERSARY` |
| Birthday today | Employee's team | IN_APP | New cron to push `UserRepository.findBirthdaysThisMonth()` (already exists, `user.repository.ts:171`, currently only pull-based via `GET /employee/birthdays`) | new: `BIRTHDAY` |

---

### Phase 4 — Announcements, Projects & Clients

| Event | Recipient | Channels | Wire into | Notes |
|---|---|---|---|---|
| Announcement published | All active org employees | IN_APP, EMAIL, PUSH | `announcement.service.ts` publish path | new: `ANNOUNCEMENT_PUBLISHED`. **Must** batch/chunk — PRD explicitly warns against one transaction sending 500 emails; use `Promise.allSettled()` in chunks of ~100 |
| Announcement targeted to departments | Dept. employees | same | Same publish path — `department_ids` (`create-announcement.dto.ts:45`) and `AnnouncementTarget` entity already model this; just needs the send wired to the resolved audience | Reuse the existing targeting resolution, don't rebuild it |
| Assigned to project | Employee | IN_APP, EMAIL | `project.service.ts:207` (`assignTeam`) | new: `PROJECT_ASSIGNED` |
| Removed from project | Employee | IN_APP | `project.service.ts:260` (`removeTeamMember`) | new: `PROJECT_REMOVED` |
| Project deadline approaching (T-3) | Project members | IN_APP, EMAIL | New daily cron (none exists) | new: `PROJECT_DEADLINE_APPROACHING` |
| New client added | Account manager | IN_APP | `client.service.ts:28` (`create`) | new: `CLIENT_ADDED` |

---

### Phase 5 — Billing/Subscriptions & Platform Admin Alerts

| Event | Recipient | Channels | Wire into | Notes |
|---|---|---|---|---|
| Trial reminder — add IN_APP | Org Admin | + IN_APP (EMAIL already works) | `trial-reminder.cron.ts:73-85` | Also fix: set `event_type: BILLING_TRIAL_REMINDER` so it respects preferences (currently bypasses them) |
| Trial expired | Org Admin | IN_APP, EMAIL, 🔴 critical | `subscription-expiry.cron.ts` — transitions status today with zero notification import | `BILLING_SUBSCRIPTION_EXPIRED` (exists in enum, unused) |
| Subscription activated / renewal success/failed | Org Admin | IN_APP, EMAIL | `subscription-billing.service.ts`, `renewal-invoice.cron.ts`, `organization-subscription.service.ts` | new enum values needed for each sub-state |
| Invoice generated / payment success/failed | Billing Contact | IN_APP, EMAIL | `invoice.service.ts`, `payment.service.ts` | new enum values |
| Plan upgraded/downgraded | Org Admin | IN_APP, EMAIL | `organization-subscription.service.ts` plan-change path | new enum value |
| New organization registered | Platform Admin | IN_APP, EMAIL | `organization.service.ts` / `organization-profile.service.ts:32` | new: `PLATFORM_NEW_ORG` |
| New lead captured | Platform Admin | IN_APP (digest if high volume) | `lead.service.ts` — note the existing `notificationService.send()` at line 179-184 sends an OTP-verification email **to the lead**, not an alert to platform admin; this is a distinct, additional call | new: `PLATFORM_NEW_LEAD` |
| Org subscription expired (no renewal) | Platform Admin | IN_APP, EMAIL | Same `subscription-expiry.cron.ts` gap as the org-admin-facing version above — needs a second recipient (platform admin) on top of the org-admin notification | Reuses the same cron event, different recipient list |

---

### Phase 6 — Letter Management follow-ups (not in the original PRD; found during this audit)

| Item | Fix |
|---|---|
| Letter issued has no `event_type` | Set `event_type: LETTER_ISSUED` (new enum value) on the existing call in `issued-letter.service.ts:169-176` so it respects preferences |
| `acknowledgeMine` is backend-only | Add an "Acknowledge" action to `MyLetterCard.tsx`/`MyLettersPage.tsx` (webapp) that calls the existing endpoint — the backend logic is done, only the UI affordance is missing |
| Letter-viewed/acknowledged notify the wrong person | Confirm intentional: current behavior notifies the **admin who generated the letter**, not the employee. If the goal is closing the loop for HR ("did they see it"), this is correct as-is — just flagging it's not a bug, in case anyone assumed it was employee-facing |

## 4. Cross-cutting follow-ups (do once, not per-phase)

1. **Push channel adoption.** Every phase above lists PUSH for several events per the original PRD, but zero code anywhere calls it today. Decide explicitly: pilot PUSH starting with one phase (e.g. Leave submitted/approved, since that's the highest-value "needs my attention now" case) rather than adding it everywhere at once with no production signal on deliverability/opt-in rates.
2. **Email templates.** Only 3 `.hbs`/`.tsx` templates exist today (`base-layout`, `otp-email`, `trial-reminder`). Every EMAIL event above needs a new template — budget this as real work per phase, not a footnote.
3. **`NotificationEventType` enum growth.** Add enum values phase-by-phase (see tables above), not all upfront — keeps preference-gating changes reviewable alongside the trigger they gate.
4. **Bulk-send safety.** Announcement publish and bulk salary assignment are the two spots in this plan that fan out to many recipients at once — both must use chunked `Promise.allSettled()` (per the existing PRD's explicit warning), not a tight per-recipient loop inside one request/transaction.

## 5. Verification per phase

For each event wired in a phase:
1. Unit test the service method asserts `notificationService.send()` (or the queue) was called with the right `user_id`, `type`, and `event_type` — mock `NotificationService`, don't hit real queues in unit tests.
2. Manual: trigger the real action (submit a leave request, approve it, etc.) against a dev environment and confirm the notification appears in the bell-icon panel (and inbox, for EMAIL) for the right recipient.
3. Confirm the preference gate actually suppresses the notification when the corresponding `event_type` is disabled in `Settings → Notifications` for a test user.
