# Notification Triggers — Full System Audit

> Comprehensive list of every place in the Brello system where a notification should be sent.
> Status key: ✅ Implemented | ⚠️ TODO comment in code | ❌ Missing

---

## Leave Requests
**Module:** `src/modules/leave-request/services/leave-request.service.ts`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Leave request submitted | Manager / HR | IN_APP + EMAIL | ❌ Missing |
| Leave request approved | Employee | IN_APP + EMAIL | ❌ Missing |
| Leave request rejected | Employee | IN_APP + EMAIL | ❌ Missing |
| Leave request cancelled by employee | Manager / HR | IN_APP | ❌ Missing |
| Leave request cancelled by admin | Employee | IN_APP + EMAIL | ❌ Missing |

---

## Reimbursement
**Module:** `src/modules/reimbursement/services/reimbursement.service.ts`, `admin-reimbursement.service.ts`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Reimbursement submitted | HR / Finance | IN_APP | ❌ Missing |
| Reimbursement approved | Employee | IN_APP + EMAIL | ❌ Missing |
| Reimbursement rejected | Employee | IN_APP + EMAIL | ❌ Missing |
| Reimbursement marked as paid | Employee | IN_APP + EMAIL | ❌ Missing |

---

## Attendance
**Module:** `src/modules/attendance/services/`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Auto-checkout warning (30 min before) | Employee | IN_APP | ✅ Implemented (`auto-checkout.service.ts`) |
| Auto-checkout completed | Employee | IN_APP | ✅ Implemented (`auto-checkout.service.ts`) |
| Remote attendance approved | Employee | IN_APP | ❌ Missing (`remote-approval.service.ts`) |
| Remote attendance rejected | Employee | IN_APP | ❌ Missing (`remote-approval.service.ts`) |
| Correction request submitted | HR / Manager | IN_APP | ❌ Missing (`correction-request.service.ts`) |
| Correction request approved | Employee | IN_APP | ❌ Missing (`correction-request.service.ts`) |
| Correction request rejected | Employee | IN_APP | ❌ Missing (`correction-request.service.ts`) |

---

## Payroll
**Module:** `src/modules/payroll/services/payroll-reminder.cron.ts`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Payroll prep reminder (pending attendance) | Payroll Admin | EMAIL | ⚠️ TODO (explicit comment in code) |
| Payroll prep reminder (pending corrections) | Payroll Admin | EMAIL | ⚠️ TODO (explicit comment in code) |
| Payroll prep reminder (pending leaves) | Payroll Admin | EMAIL | ⚠️ TODO (explicit comment in code) |

---

## Auth
**Module:** `src/modules/auth/services/auth.service.ts`, `platform-admin-auth.service.ts`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Login OTP | User | EMAIL | ✅ Implemented |
| Forgot password OTP | User | EMAIL | ⚠️ TODO (line 539 — currently logs to console) |
| Resend OTP | User | EMAIL | ✅ Implemented |
| Platform admin registration OTP | Platform Admin | EMAIL | ✅ Implemented |
| Platform admin login OTP | Platform Admin | EMAIL | ✅ Implemented |

---

## Employee / User Lifecycle
**Module:** `src/modules/user/services/employee.service.ts`, `offboarding-cron.service.ts`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Employee invited | Employee | EMAIL | ✅ Implemented |
| Employee activated | Employee | EMAIL | ❌ Missing |
| Employee deactivated | Employee | EMAIL | ❌ Missing |
| Employee offboarding complete | Employee + HR | IN_APP + EMAIL | ❌ Missing (`offboarding-cron.service.ts`) |

---

## Billing / Subscription
**Module:** `src/modules/billing/crons/`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Trial ending in 7 days | Org Admin | EMAIL | ⚠️ TODO (explicit comment in `trial-reminder.cron.ts`) |
| Trial ending in 3 days | Org Admin | EMAIL | ⚠️ TODO (explicit comment in `trial-reminder.cron.ts`) |
| Trial ending in 1 day | Org Admin | EMAIL | ⚠️ TODO (explicit comment in `trial-reminder.cron.ts`) |
| Subscription moved to grace period | Org Admin | EMAIL | ❌ Missing (`subscription-expiry.cron.ts`) |
| Subscription expired | Org Admin | EMAIL | ❌ Missing (`subscription-expiry.cron.ts`) |
| Renewal invoice generated | Org Admin | EMAIL | ❌ Missing (`renewal-invoice.cron.ts`) |

---

## Feedback
**Module:** `src/modules/feedback/services/feedback.service.ts`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Feedback submitted | Platform Admin | IN_APP | ✅ Implemented |
| Follow-up comment added | Platform Admin | IN_APP | ✅ Implemented |
| Feedback status changed | Submitting user | IN_APP | ❌ Missing |

---

## Announcements
**Module:** `src/modules/announcement/services/announcement.service.ts`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Announcement published (immediate) | Target audience | IN_APP + EMAIL + PUSH | ❌ Missing (flags `send_push`, `send_email` exist in entity but no dispatch logic) |
| Scheduled announcement fires | Target audience | IN_APP + EMAIL + PUSH | ❌ Missing (no cron job for scheduled publish) |

---

## Timesheet
**Module:** `src/modules/timesheet/services/timesheet.service.ts`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Timesheet submitted | Manager | IN_APP | ❌ Missing |
| Timesheet approved | Employee | IN_APP | ❌ Missing |
| Timesheet rejected | Employee | IN_APP | ❌ Missing |

---

## Lead
**Module:** `src/modules/lead/services/lead.service.ts`

| Event | Recipient | Channel | Status |
|-------|-----------|---------|--------|
| Lead registration OTP | Lead | EMAIL | ✅ Implemented |

---

## Summary Counts

| Status | Count |
|--------|-------|
| ✅ Implemented | 8 |
| ⚠️ TODO (code comment exists) | 6 |
| ❌ Missing entirely | 23 |
| **Total trigger points** | **37** |

---

## Priority Order for Implementation

### P0 — Critical user-facing flows (implement with Phase 1 triggers)
- Leave: approved / rejected
- Reimbursement: approved / rejected / paid
- Attendance: correction approved / rejected

### P1 — Admin/operational (implement with Phase 3–4)
- Payroll prep reminders
- Billing / trial / expiry emails
- Renewal invoice

### P2 — Enhancement (implement with Phase 5+)
- Announcements (requires push infra)
- Timesheet flows
- Employee lifecycle (activate / deactivate / offboard)
- Feedback status changes
