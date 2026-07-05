# Feature 5 — Notification Preferences

> Phase 5 of the notification build plan. Lets users control which notification types they receive and on which channels.

---

## Goal

Users should be able to silence specific notification types (e.g. "don't email me about attendance corrections") without breaking other channels or other notification types.

---

## Scope

### Server (brello_server)

**1. New entity**

`src/modules/notification/entities/notification-preference.entity.ts`

```typescript
@Entity('notification_preferences')
export class NotificationPreference extends BaseEntity {
  @Column('uuid')
  user_id: string;

  @Column({ type: 'enum', enum: NotificationType })
  channel: NotificationType;  // IN_APP | EMAIL | PUSH

  @Column({ type: 'varchar', length: 100 })
  event_type: string;  // e.g. 'leave.approved', 'payroll.reminder', 'attendance.correction'

  @Column({ default: true })
  enabled: boolean;
}
// Composite unique: (user_id, channel, event_type)
```

**2. Event type constants**

Create `src/common/enums/notification-event-type.enum.ts`:

```typescript
export enum NotificationEventType {
  // Leave
  LEAVE_SUBMITTED = 'leave.submitted',
  LEAVE_APPROVED = 'leave.approved',
  LEAVE_REJECTED = 'leave.rejected',
  LEAVE_CANCELLED = 'leave.cancelled',

  // Reimbursement
  REIMBURSEMENT_SUBMITTED = 'reimbursement.submitted',
  REIMBURSEMENT_APPROVED = 'reimbursement.approved',
  REIMBURSEMENT_REJECTED = 'reimbursement.rejected',
  REIMBURSEMENT_PAID = 'reimbursement.paid',

  // Attendance
  ATTENDANCE_AUTO_CHECKOUT = 'attendance.auto_checkout',
  ATTENDANCE_CORRECTION_APPROVED = 'attendance.correction.approved',
  ATTENDANCE_CORRECTION_REJECTED = 'attendance.correction.rejected',

  // Payroll
  PAYROLL_REMINDER = 'payroll.reminder',

  // Billing
  BILLING_TRIAL_REMINDER = 'billing.trial_reminder',
  BILLING_SUBSCRIPTION_EXPIRED = 'billing.subscription_expired',
  BILLING_GRACE_PERIOD = 'billing.grace_period',

  // Auth
  AUTH_OTP = 'auth.otp',  // always enabled, cannot be turned off
}
```

**3. Preference repository**

`src/modules/notification/repositories/notification-preference.repository.ts`

Method: `findPreference(userId, channel, eventType): Promise<NotificationPreference | null>`

**4. Gate in NotificationService**

In `NotificationService.send()`, before enqueuing:

```typescript
if (dto.event_type && dto.event_type !== NotificationEventType.AUTH_OTP) {
  const pref = await this.prefRepo.findPreference(dto.user_id, dto.type, dto.event_type);
  if (pref && !pref.enabled) return;  // user has disabled this, skip silently
}
```

Auth OTPs (`auth.otp`) are always forced through — users cannot disable OTP delivery.

**5. New endpoints**

`GET /notifications/preferences`
- Returns the user's full preference matrix
- For event types with no saved preference, returns `enabled: true` (default)

`PATCH /notifications/preferences`
- Body: `{ channel: NotificationType, event_type: string, enabled: boolean }`
- Upserts a preference row for the current user

**6. Migration**

New table `notification_preferences` with composite unique constraint on `(user_id, channel, event_type)`.

---

### Web App (brello_webapp)

**Notification Settings panel**

A new settings page or modal (accessible from user profile menu or the NotificationPanel header).

Layout: table/grid with event type rows and channel columns (IN_APP / EMAIL / PUSH).

```
                    In-App    Email    Push
Leave approved        ✓         ✓       ○
Leave rejected        ✓         ✓       ○
Payroll reminder      ✓         ✓       ○
Trial reminder        —         ✓       —
...
```

- Toggle switches per cell
- Disabled state for channels not yet available (PUSH = Phase 6)
- Auth OTP row shown as locked (always on, no toggle)
- On change: call `PATCH /notifications/preferences`
- On load: call `GET /notifications/preferences` to populate state

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/modules/notification/entities/notification-preference.entity.ts` | New |
| `src/common/enums/notification-event-type.enum.ts` | New |
| `src/modules/notification/repositories/notification-preference.repository.ts` | New |
| `src/modules/notification/controllers/notification.controller.ts` | Add preferences endpoints |
| `src/modules/notification/services/notification.service.ts` | Add preference gate before enqueue |
| `src/modules/notification/services/in-app-notification.service.ts` | Pass `event_type` through |
| `src/modules/notification/dto/send-notification.dto.ts` | Add `event_type` field |
| All trigger call sites (leave, reimbursement, etc.) | Pass `event_type` when calling `send()` |
| `brello_webapp/src/features/notifications/components/NotificationSettings/` | New |

---

## Done When

- [ ] User can toggle email notifications off for leave approvals
- [ ] After toggling off, a leave approval no longer sends that user an email
- [ ] Auth OTP emails cannot be toggled off
- [ ] Preference changes persist across sessions
- [ ] Default state (no saved preference) = all channels enabled
