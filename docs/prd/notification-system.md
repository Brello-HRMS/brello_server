# PRD — Notification System (v1)

**Author:** PM + Engineering Lead  
**Status:** Draft  
**Last Updated:** 2026-06-20  

---

## 1. Overview

Brello currently has no unified notification layer connecting user actions to the people who need to act on them. Approval requests go unnoticed, payslips land silently, trial expirations go unannounced — users must manually poll the app to discover state changes.

This PRD defines what notifications to send, when, to whom, through which channels (Email / In-App / Push), and how to build the system correctly — once — so new triggers can be wired with minimal code.

---

## 2. Goals

- Every meaningful action in Brello surfaces to the right person, on the right channel, at the right time.
- No duplicate effort: one `NotificationService.send()` call dispatches to all relevant channels.
- Users can control what they hear about, per channel, without breaking critical security notices.
- The engineering team can wire a new notification trigger in < 30 minutes.

---

## 3. Current State Audit

| Component | Status | Notes |
|---|---|---|
| `NotificationModule` (server) | ✅ Exists | Entity, repository, controller, service facade all present |
| Email via Nodemailer | ✅ Working | Used for OTPs only; SMTP config in env |
| In-App DB + APIs | ✅ Working | `GET /notifications`, `PATCH /:id/read`, `PATCH /read-all` |
| Push `PushNotificationService` | ❌ Stub | Logs to console; no FCM |
| Real-time delivery | ❌ Missing | No WebSocket or SSE; notifications appear only on refresh |
| Notification UI (webapp) | ⚠️ UI only | Panel, tabs, grouping built — hardcoded dummy data, no API calls |
| Leave / Attendance / Reimbursement / Payroll triggers | ❌ Missing | No notifications wired |
| Announcement broadcast | ❌ Missing | `notification_clicked` field exists but nothing sends |
| Billing / Trial reminders | ⚠️ TODO | Cron exists, `NotificationService` call commented out |
| Notification preferences | ❌ Missing | No per-user opt-in/opt-out |
| Email templates | ⚠️ Inline HTML | No template engine; hardcoded strings |
| Device tokens for Push | ❌ Missing | No `user_device_tokens` table |

---

## 4. Scope (What This PRD Covers)

### In Scope — Phase 1
- Complete In-App notification delivery (wire API to webapp UI)
- Complete Email notifications for all workflow events
- Real-time delivery via Server-Sent Events (SSE)
- Unread count badge on bell icon
- Notification preferences (per user, per event group, per channel)
- Email templates (HTML, Handlebars-based)
- All module triggers listed in Section 6

### In Scope — Phase 2
- Web Push via Firebase Cloud Messaging (FCM)
- Mobile Push (if mobile app launches)
- Daily digest email (batched low-priority notifications)
- Notification grouping ("5 leave requests approved")

### Out of Scope
- SMS notifications
- Slack / Teams integration
- Notification analytics dashboard
- Third-party email providers (SendGrid, SES) — using existing Nodemailer SMTP

---

## 5. Notification Channels

### 5.1 In-App
Persistent record in `notifications` table. Shown in the bell-icon panel. Grouped by date. Tabs: All / Unread / Requires Action / Approvals / Attendance. Delivered in real-time via SSE. Badge count on bell icon refreshes on each SSE event.

### 5.2 Email
Transactional HTML emails sent via Nodemailer. Use Handlebars `.hbs` templates stored in `src/modules/notification/templates/`. Every email has:
- Brello logo header
- Action-specific body
- CTA button linking to the relevant page in app
- Footer with unsubscribe link (for non-critical emails)

### 5.3 Push (Phase 2)
Firebase Cloud Messaging for web and mobile. Requires device token registration on login. Short title + message + deep-link URL payload. Not in Phase 1.

---

## 6. Notification Events Catalog

Priority legend:
- 🔴 **Critical** — always sent, no opt-out (security/compliance)
- 🟠 **High** — action required; on by default
- 🟡 **Medium** — status updates; on by default
- 🟢 **Low** — informational; on by default, user can mute

---

### 6.1 Auth & Security

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| Login OTP sent | Self | ❌ | ✅ | ❌ | 🔴 | Already implemented |
| New device / location login | Self | ✅ | ✅ | ❌ | 🔴 | Security alert |
| Password changed | Self | ✅ | ✅ | ❌ | 🔴 | Immediate |

**Email Subject Examples:**
- `Your Brello login OTP is 847291`
- `Security alert: New login from Chrome on macOS`

---

### 6.2 Employee Lifecycle

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| Invitation sent to new employee | Invitee | ❌ | ✅ | ❌ | 🔴 | Already implemented; contains OTP + login URL |
| Employee profile activated | Employee | ✅ | ✅ | ❌ | 🟡 | Welcome email |
| Offboarding initiated | Employee + HR Admin | ✅ | ✅ | ❌ | 🟠 | Include last working day |
| Work anniversary (yearly) | Employee + their Manager | ✅ | ❌ | ✅ | 🟢 | Cron: daily at 08:00 |
| Birthday today | Employee's Team Members | ✅ | ❌ | ❌ | 🟢 | Opt-out allowed |

**In-App copy examples:**
- `🎉 It's Sarah's 2nd work anniversary today!`
- `👋 John Doe has been invited to Brello.`

---

### 6.3 Leave Management

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| Leave request submitted | Approver (Manager / HR) | ✅ | ✅ | ✅ | 🟠 | Include dates, type, reason |
| Leave approved | Employee (requester) | ✅ | ✅ | ✅ | 🟠 | Include approved dates |
| Leave rejected | Employee (requester) | ✅ | ✅ | ✅ | 🟠 | Include rejection reason |
| Leave request withdrawn by employee | Approver | ✅ | ✅ | ❌ | 🟡 | |
| Leave balance running low (< 2 days remaining) | Employee | ✅ | ✅ | ❌ | 🟡 | Cron: weekly Monday |
| Leave balance credited (accrual / manual) | Employee | ✅ | ❌ | ❌ | 🟢 | |

**Trigger points in code:**
- `LeaveRequestService.create()` → notify approver
- `LeaveRequestService.approve()` → notify requester
- `LeaveRequestService.reject()` → notify requester
- `LeaveRequestService.cancel()` → notify approver
- New cron `LeaveBalanceLowCron` (weekly) → notify employee

**Email Subject Examples:**
- `[Action Required] Priya Sharma has applied for 3 days of Casual Leave`
- `Your Casual Leave (Jun 25–27) has been approved`

---

### 6.4 Attendance

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| Shift assigned to employee | Employee | ✅ | ✅ | ✅ | 🟡 | |
| Shift updated / changed | Employee | ✅ | ✅ | ❌ | 🟡 | |
| Remote work request submitted | Approver | ✅ | ✅ | ✅ | 🟠 | |
| Remote work approved | Employee | ✅ | ✅ | ❌ | 🟠 | |
| Remote work rejected | Employee | ✅ | ✅ | ❌ | 🟠 | |
| Attendance mark missing (no clock-in by 11:00 AM) | Employee | ✅ | ❌ | ✅ | 🟡 | Cron; skip weekends/holidays |
| Late clock-in (after shift start + grace) | Employee's Manager | ✅ | ❌ | ❌ | 🟢 | Respect manager assignment |
| Attendance regularization requested | Manager / HR | ✅ | ✅ | ❌ | 🟠 | Manual correction requests |
| Attendance regularization approved/rejected | Employee | ✅ | ✅ | ❌ | 🟠 | |

**Trigger points in code:**
- `RuleAssignmentService.assign()` → shift assigned
- `RemoteApprovalService.approve/reject()` → remote approval flow
- New cron `AttendanceMissingCron` (daily 11:00 AM) → push to employees without clock-in

---

### 6.5 Payroll

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| Payslip generated (payroll run completed) | Each affected employee | ✅ | ✅ | ✅ | 🟠 | Email contains payslip PDF attachment |
| Salary revised | Employee | ✅ | ✅ | ❌ | 🟠 | Effective date, new CTC |
| Payroll reminder: attendance not locked (T-4 days) | Payroll Admin / HR | ✅ | ✅ | ❌ | 🟠 | Existing cron; just wire it |
| Payroll reminder: pending leave requests (T-4 days) | Payroll Admin / HR | ✅ | ✅ | ❌ | 🟠 | Existing cron; just wire it |
| Payroll run failed | Payroll Admin | ✅ | ✅ | ❌ | 🔴 | System-level error |
| Advance salary requested | Payroll Admin / HR | ✅ | ✅ | ❌ | 🟠 | If advance feature exists |

**Trigger points in code:**
- `PayrollRunService.process()` → payslip email per employee
- `EmployeeSalaryEngine.revise()` → salary revised
- `PayrollReminderCron` (existing) → wire `NotificationService` (TODO already in cron)
- `PayrollRunService.fail()` → critical alert

**Email Subject Examples:**
- `Your payslip for May 2026 is ready`
- `[Action Required] Payroll closes in 4 days — 3 attendance records not locked`

---

### 6.6 Reimbursement

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| Reimbursement request submitted | Approver (Manager / Finance) | ✅ | ✅ | ✅ | 🟠 | Amount, category, date |
| Reimbursement approved | Employee (requester) | ✅ | ✅ | ✅ | 🟠 | |
| Reimbursement rejected | Employee (requester) | ✅ | ✅ | ✅ | 🟠 | Include reason |
| Reimbursement paid out | Employee | ✅ | ✅ | ❌ | 🟡 | If payout tracking exists |

**Trigger points in code:**
- `ReimbursementService.create()` → notify approver
- `ReimbursementService.approve()` → notify requester
- `ReimbursementService.reject()` → notify requester

---

### 6.7 Announcements

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| New announcement published | All active employees in org | ✅ | ✅ | ✅ | 🟡 | Bulk send; batch in chunks of 100 |
| Announcement targeted to specific departments | Dept. employees | ✅ | ✅ | ✅ | 🟡 | If targeting is supported |

**Trigger points in code:**
- `AnnouncementService.publish()` → broadcast to org

**Note:** Bulk send must be queued/batched — never send 500 emails in a single transaction. Use a background job queue or chunked `Promise.allSettled()`.

---

### 6.8 Projects & Clients

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| Assigned to a project | Employee | ✅ | ✅ | ❌ | 🟡 | Project name, start date, manager |
| Removed from a project | Employee | ✅ | ❌ | ❌ | 🟢 | |
| Project deadline approaching (T-3 days) | Project members | ✅ | ✅ | ❌ | 🟡 | Cron; daily |
| New client added | Account Manager | ✅ | ❌ | ❌ | 🟢 | |

---

### 6.9 Billing & Subscriptions (Platform → Org Admin)

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| Trial expiring in 7 days | Org Admin | ✅ | ✅ | ❌ | 🟠 | Existing cron; wire it |
| Trial expiring in 3 days | Org Admin | ✅ | ✅ | ❌ | 🟠 | Existing cron |
| Trial expiring tomorrow | Org Admin | ✅ | ✅ | ❌ | 🔴 | Existing cron |
| Trial expired | Org Admin | ✅ | ✅ | ❌ | 🔴 | Immediate |
| Subscription activated | Org Admin | ✅ | ✅ | ❌ | 🟡 | Payment confirmed |
| Subscription renewal successful | Org Admin | ✅ | ✅ | ❌ | 🟡 | Include next renewal date |
| Subscription renewal failed | Org Admin | ✅ | ✅ | ❌ | 🔴 | Grace period starts |
| Subscription expired (grace over) | Org Admin | ✅ | ✅ | ❌ | 🔴 | Access restricted |
| Invoice generated | Billing Contact | ✅ | ✅ | ❌ | 🟡 | Attach PDF |
| Payment successful | Billing Contact | ✅ | ✅ | ❌ | 🟡 | |
| Payment failed | Billing Contact | ✅ | ✅ | ❌ | 🔴 | Include retry instructions |
| Plan upgraded / downgraded | Org Admin | ✅ | ✅ | ❌ | 🟡 | |

**Email Subject Examples:**
- `⚠️ Your Brello trial ends in 3 days`
- `Invoice #INV-2026-047 for ₹12,500 is ready`
- `Payment failed — please update your billing details`

---

### 6.10 Feedback & Support (already partial)

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| Feedback/issue submitted | Platform Admin | ✅ | ✅ | ❌ | 🟡 | Currently In-App only; add Email |
| Ticket status updated | Submitter | ✅ | ✅ | ❌ | 🟡 | Currently In-App only; add Email |
| Reply added to ticket (non-internal) | Other party | ✅ | ✅ | ❌ | 🟡 | Currently In-App only; add Email |
| Ticket resolved | Submitter | ✅ | ✅ | ❌ | 🟡 | |

---

### 6.11 Platform Admin Alerts

| Event | Recipient | In-App | Email | Push | Priority | Notes |
|---|---|---|---|---|---|---|
| New organization registered | Platform Admin | ✅ | ✅ | ❌ | 🟡 | |
| New lead captured | Platform Admin | ✅ | ❌ | ❌ | 🟢 | Batched daily digest if volume is high |
| Organization subscription expired (no renewal) | Platform Admin | ✅ | ✅ | ❌ | 🟠 | |

---

## 7. Notification Preferences

Each user can configure their notification preferences at **Settings → Notifications**.

### Preference Schema

```
user_notification_preferences
  - id (UUID)
  - user_id
  - organization_id
  - event_group (enum: LEAVE, ATTENDANCE, PAYROLL, REIMBURSEMENT, ANNOUNCEMENT, PROJECT, SECURITY, BILLING, SYSTEM)
  - channel (enum: IN_APP, EMAIL, PUSH)
  - is_enabled (boolean, default true)
  - created_at, updated_at
  - UNIQUE (user_id, organization_id, event_group, channel)
```

### Rules
- 🔴 Critical events (Security, Billing payment failure, System errors) are **non-configurable** — always sent.
- All other event groups: user can toggle per channel.
- Org Admin can set org-wide defaults (e.g. disable birthday notifications org-wide).
- Preferences are loaded once per session and cached in React Query with `staleTime: 5 minutes`.

### UI
- Settings page: toggle matrix (Event Group × Channel)
- Inline mute from notification item: "Mute this type"

---

## 8. Technical Architecture

### 8.1 Server-Side

#### NotificationService (enhanced facade)
```typescript
class NotificationService {
  send(dto: SendNotificationDto): Promise<void>
  // Routes to IN_APP + EMAIL + PUSH based on:
  // 1. dto.channels (explicit) OR event default channels
  // 2. User preferences (filtered for non-critical)

  broadcast(userIds: string[], dto: Omit<SendNotificationDto, 'user_id'>): Promise<void>
  // For bulk sends (announcements); chunks to 100 per batch

  broadcastOrg(organizationId: string, dto): Promise<void>
  // Fetches all active user IDs for org, then calls broadcast()
}
```

#### SendNotificationDto (enhanced)
```typescript
{
  user_id?: string           // target user
  target_email?: string      // for non-user emails (leads, invites)
  channels: NotificationType[] // [IN_APP, EMAIL, PUSH]
  event_group: EventGroup    // for preference filtering
  is_critical: boolean       // bypasses preferences if true
  title: string
  message: string
  metadata?: Record<string, any>  // stored in JSONB; used for deep-links
  template?: string          // email template name (e.g. 'leave-approved')
  template_data?: Record<string, any>  // Handlebars context
  organization_id?: string   // for multi-tenant scoping
  enterprise_id?: string
}
```

#### Email Template Engine
- Add `handlebars` package to dependencies.
- Templates live in `src/modules/notification/templates/email/`.
- One `.hbs` file per event (e.g. `leave-approved.hbs`, `payslip-ready.hbs`).
- `EmailNotificationService` compiles template + data → HTML string → sends via Nodemailer.
- Shared `base-layout.hbs` wraps all emails with Brello header, footer, unsubscribe link.

#### Real-Time Delivery: Server-Sent Events (SSE)
- Add `GET /notifications/stream` endpoint using NestJS `@Sse()`.
- Client connects on login; server pushes events when `InAppNotificationService.send()` is called.
- Use `EventEmitter2` (`@nestjs/event-emitter`) as the in-process event bus.
- `InAppNotificationService.send()` → saves to DB → emits `notification.created` event → SSE controller pushes to connected client.
- One SSE connection per tab (reconnects automatically on disconnect via `EventSource`).
- Heartbeat `ping` event every 30s to keep connection alive through load balancers.

Why SSE over WebSocket: Notifications are server → client only (no bidirectional need). SSE is simpler, HTTP/2 compatible, and requires no socket.io overhead.

#### Push (Phase 2)
- Add `firebase-admin` package.
- Add `user_device_tokens` table (`user_id`, `token`, `platform: web|android|ios`, `created_at`, `last_seen`).
- Register token on FCM token refresh (`POST /notifications/device-token`).
- `PushNotificationService.send()` calls `admin.messaging().send()`.

### 8.2 Client-Side

#### API Integration
- Add `src/features/notifications/api/notifications.ts`:
  - `getNotifications()` — `GET /notifications`
  - `getUnreadNotifications()` — `GET /notifications/unread`
  - `markAsRead(id)` — `PATCH /notifications/:id/read`
  - `markAllAsRead()` — `PATCH /notifications/read-all`
  - `getUnreadCount()` — `GET /notifications/unread-count` (new endpoint needed)
  - `getPreferences()` — `GET /notifications/preferences`
  - `updatePreference(dto)` — `PATCH /notifications/preferences`

#### SSE Integration
- `src/features/notifications/hooks/useNotificationStream.ts`
- On mount: `new EventSource('/api/v1/notifications/stream', { withCredentials: true })`
- On message: call `queryClient.invalidateQueries(['notifications'])` + update badge count in Zustand store.
- On unmount: close `EventSource`.

#### Zustand Store (enhanced)
```typescript
{
  unreadCount: number
  setUnreadCount: (n: number) => void
  incrementUnread: () => void
}
```

#### Badge Count
- Header bell icon reads `unreadCount` from store.
- Shows badge if `unreadCount > 0` (capped at "99+" display).
- SSE event increments count without full re-fetch.
- Opening notification panel triggers `markAllAsRead()` + resets count.

---

## 9. Data Models (New / Changed)

### New: `user_notification_preferences`
```sql
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL,
  event_group VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, organization_id, event_group, channel)
);
```

### New: `user_device_tokens` (Phase 2)
```sql
CREATE TABLE user_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL, -- web | android | ios
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Modified: `notifications`
Add fields:
```sql
ALTER TABLE notifications ADD COLUMN event_group VARCHAR(50);
ALTER TABLE notifications ADD COLUMN action_url TEXT;   -- deep link into app
ALTER TABLE notifications ADD COLUMN icon VARCHAR(50);  -- icon name for UI
ALTER TABLE notifications ADD COLUMN priority VARCHAR(20) DEFAULT 'medium';
```

---

## 10. API Contracts (New Endpoints)

### GET /notifications/unread-count
```json
Response: { "data": { "count": 7 } }
```

### GET /notifications/stream
Server-Sent Events endpoint. Streams events of shape:
```
data: {"type":"notification.created","payload":{"id":"...","title":"...","message":"...","is_read":false,"created_at":"...","icon":"...","action_url":"..."}}
```

### GET /notifications/preferences
```json
Response: {
  "data": [
    { "event_group": "LEAVE", "channel": "IN_APP", "is_enabled": true },
    { "event_group": "LEAVE", "channel": "EMAIL", "is_enabled": true },
    ...
  ]
}
```

### PATCH /notifications/preferences
```json
Request: { "event_group": "LEAVE", "channel": "EMAIL", "is_enabled": false }
Response: { "data": { "updated": true } }
```

### POST /notifications/device-token (Phase 2)
```json
Request: { "token": "fcm-token-xyz", "platform": "web" }
Response: { "data": { "registered": true } }
```

---

## 11. Email Templates Required

| Template Name | Event | Variables |
|---|---|---|
| `otp-login` | OTP for login | `{{otp}}`, `{{expires_in}}` |
| `employee-invite` | New employee invitation | `{{employee_name}}`, `{{login_url}}`, `{{otp}}` |
| `leave-request` | New leave submitted (to approver) | `{{employee_name}}`, `{{leave_type}}`, `{{from_date}}`, `{{to_date}}`, `{{days}}`, `{{reason}}`, `{{action_url}}` |
| `leave-approved` | Leave approved (to employee) | `{{employee_name}}`, `{{leave_type}}`, `{{from_date}}`, `{{to_date}}`, `{{approved_by}}` |
| `leave-rejected` | Leave rejected (to employee) | `{{employee_name}}`, `{{leave_type}}`, `{{from_date}}`, `{{to_date}}`, `{{reason}}` |
| `payslip-ready` | Payroll processed | `{{employee_name}}`, `{{month_year}}`, `{{net_pay}}`, `{{action_url}}` |
| `salary-revised` | Salary change | `{{employee_name}}`, `{{effective_date}}`, `{{new_ctc}}` |
| `payroll-reminder` | Payroll closing soon | `{{admin_name}}`, `{{days_left}}`, `{{pending_count}}`, `{{action_url}}` |
| `reimbursement-request` | Reimbursement submitted | `{{employee_name}}`, `{{amount}}`, `{{category}}`, `{{action_url}}` |
| `reimbursement-approved` | Reimbursement approved | `{{employee_name}}`, `{{amount}}`, `{{approved_by}}` |
| `reimbursement-rejected` | Reimbursement rejected | `{{employee_name}}`, `{{amount}}`, `{{reason}}` |
| `announcement` | New announcement | `{{org_name}}`, `{{title}}`, `{{summary}}`, `{{action_url}}` |
| `shift-assigned` | Shift assignment | `{{employee_name}}`, `{{shift_name}}`, `{{start_time}}`, `{{end_time}}`, `{{effective_date}}` |
| `trial-expiring` | Trial ending soon | `{{org_name}}`, `{{days_left}}`, `{{upgrade_url}}` |
| `trial-expired` | Trial ended | `{{org_name}}`, `{{upgrade_url}}` |
| `subscription-renewed` | Auto-renewal successful | `{{org_name}}`, `{{plan_name}}`, `{{next_renewal}}`, `{{amount}}` |
| `payment-failed` | Payment failure | `{{org_name}}`, `{{amount}}`, `{{retry_url}}` |
| `invoice-ready` | Invoice generated | `{{org_name}}`, `{{invoice_number}}`, `{{amount}}`, `{{due_date}}` |
| `feedback-update` | Support ticket update | `{{user_name}}`, `{{ticket_id}}`, `{{status}}`, `{{action_url}}` |
| `security-new-login` | New device login | `{{user_name}}`, `{{device}}`, `{{location}}`, `{{time}}` |

---

## 12. Frontend Requirements

### Bell Icon Badge
- Visible in Header next to avatar.
- Red circle badge with number. Shows "99+" if count > 99.
- Fetched on page load via `GET /notifications/unread-count`.
- Updated in real-time via SSE (increment on new notification event).
- Cleared on open (optimistic) + confirmed after `markAllAsRead()` API call.

### Notification Panel Tabs
| Tab | Filter |
|---|---|
| All | All in-app notifications |
| Unread | `is_read = false` |
| Requires Action | `priority = 'high'` OR `event_group IN ('LEAVE', 'REIMBURSEMENT', 'ATTENDANCE')` AND `is_read = false` |
| Approvals | `event_group IN ('LEAVE', 'REIMBURSEMENT', 'REMOTE_WORK')` |
| Attendance | `event_group = 'ATTENDANCE'` |

### Notification Item
- Icon (per event type, already implemented in `notificationTypes.ts`)
- Title (bold)
- Message (2 lines max, ellipsis)
- Relative timestamp ("2 min ago", "Yesterday")
- Unread indicator (blue dot)
- Click → marks as read + navigates to `action_url` (deep link)
- "Mark as read" button on hover

### Settings Page: Notification Preferences
- Route: `/settings/notifications`
- Table/matrix: rows = event groups, columns = channels (In-App, Email, Push)
- Toggle per cell
- Disabled toggles for Critical events with tooltip "Required for security"
- Save on toggle (individual PATCH calls, debounced 500ms)

---

## 13. Non-Functional Requirements

### Performance
- `NotificationService.send()` must be fire-and-forget in all service callers. Never block the primary transaction. Wrap in `void notificationService.send(...).catch(logger.error)`.
- Bulk broadcasts (announcements) chunked into batches of 100 to avoid DB connection exhaustion.
- SSE connections must not degrade under 500 concurrent users. Test with load testing before release.

### Reliability
- Failed email delivery should log to DB (`notification_delivery_log`) with status + error. Retry up to 3 times with exponential backoff (30s, 5m, 30m).
- In-app notifications must always succeed even if email fails (separate try/catch per channel).
- Critical notifications (🔴) must never be silently dropped. Alert to Sentry/log aggregator on failure.

### Security
- OTP emails are never stored in `notifications` table (they're transient).
- `action_url` in notifications must always be a relative path (e.g. `/leave/requests/123`), never an absolute external URL — prevents open redirect.
- SSE stream is JWT-authenticated: token validated on connection.

### Observability
- Log every notification sent: `{ notification_id, user_id, channel, event_group, status, latency_ms }`.
- Alerting: if email failure rate > 10% in 5 min → PagerDuty/Slack alert.

---

## 14. Delivery Phases

### Phase 1 (Core — 4 weeks)
**Week 1: Foundation**
- [ ] Wire `NotificationPanel` to real API (`GET /notifications`, unread count)
- [ ] Add `GET /notifications/unread-count` endpoint
- [ ] Implement SSE endpoint + client `EventSource` hook
- [ ] Integrate `handlebars` templating in `EmailNotificationService`
- [ ] Add `action_url`, `event_group`, `icon`, `priority` fields to notification entity

**Week 2: Leave + Attendance + Reimbursement**
- [ ] Wire leave request → approver notification (In-App + Email)
- [ ] Wire leave approved/rejected → employee notification
- [ ] Wire reimbursement submit / approve / reject notifications
- [ ] Wire remote work approval notifications
- [ ] Add `AttendanceMissingCron` (11 AM daily)
- [ ] Wire shift assignment notification
- [ ] Write email templates for all above events

**Week 3: Payroll + Billing + Announcements**
- [ ] Wire payroll reminder cron (TODO already exists — just call `NotificationService`)
- [ ] Wire payslip ready → employee email (with PDF attachment)
- [ ] Wire salary revision notification
- [ ] Wire trial reminder cron (TODO already exists)
- [ ] Wire billing subscription events (renewed, failed, expired)
- [ ] Wire invoice generated notification
- [ ] Wire announcement publish → broadcast to org

**Week 4: Preferences + Polish**
- [ ] `user_notification_preferences` table + API endpoints
- [ ] Preferences UI (Settings → Notifications toggle matrix)
- [ ] Preference filtering in `NotificationService.send()`
- [ ] Mark-as-read from notification item (deep-link navigation)
- [ ] Notification delivery log + retry logic
- [ ] QA: test all 40+ trigger events end-to-end

### Phase 2 (Push + Advanced — 3 weeks)
- [ ] Firebase Admin SDK setup + `user_device_tokens` table
- [ ] FCM token registration on login
- [ ] `PushNotificationService` real implementation
- [ ] Web service worker for background push (PWA)
- [ ] Daily digest email (batched low-priority notifications)
- [ ] Notification grouping ("5 leave requests")
- [ ] Employee birthday / work anniversary crons

---

## 15. Open Questions

| # | Question | Owner | Decision Needed By |
|---|---|---|---|
| 1 | Which SMTP provider in production? (current config is generic SMTP — AWS SES? Postmark?) | Infra | Week 1 |
| 2 | Should announcements go to ALL employees or support department targeting? | PM | Week 3 |
| 3 | Who is the "approver" for leave requests — direct manager, HR, or configurable per rule? | PM | Week 2 |
| 4 | Should late arrival notifications go to manager or HR admin? (org-wide setting?) | PM | Week 2 |
| 5 | Do we need WhatsApp notifications for payslip (common in Indian HRMS)? | PM | Phase 2 |
| 6 | Should payslip PDF be sent as email attachment or just a link to app? (security consideration) | Security + PM | Week 3 |
| 7 | Is there a mobile app in roadmap? (affects push architecture choice) | CTO | Phase 2 |

---

## 16. Success Metrics (Post-Launch)

| Metric | Target | Measurement |
|---|---|---|
| Leave request response time | 50% reduction in time-to-approve | Compare before/after launch |
| Email delivery rate | > 98% | `notification_delivery_log` |
| In-app notification open rate | > 60% | `is_read / total sent` |
| SSE connection stability | < 1% drop in first 60s | Connection logs |
| User opt-out rate per event group | < 15% | Preferences table |
| Support tickets about "missed notifications" | Near zero | Zendesk/Support module |
