# Feature 1 — Frontend API Wiring + Unread Count

> Phase 1 of the notification build plan. No queue, no SSE — just replacing dummy data with real API calls and adding the one missing server endpoint.

---

## Goal

Make the existing notification UI functional. The bell badge should show real unread count from the database, the NotificationPanel should load real data, and mark-read actions should persist.

---

## Scope

### Server (brello_server)

**New endpoint:**

`GET /notifications/unread-count`
- Auth: JWT required
- Response: `{ count: number }`
- Implementation: `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = false AND type = 'IN_APP' AND status = 'ACTIVE'`
- Add to `NotificationController`
- Add to `InAppNotificationService` as `getUnreadCount(user)`

**No changes** to existing endpoints — `GET /notifications`, `GET /notifications/unread`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` are all already built.

---

### Web App (brello_webapp)

**1. Zustand notification store**

Create `src/store/notificationStore.ts`:

```typescript
interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchAll: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  appendFromStream: (n: Notification) => void;  // used by SSE in Phase 2
}
```

**2. API layer**

Create `src/features/notifications/api/notificationApi.ts`:
- `getAllNotifications()` → `GET /notifications`
- `getUnreadCount()` → `GET /notifications/unread-count`
- `markAsRead(id)` → `PATCH /notifications/:id/read`
- `markAllAsRead()` → `PATCH /notifications/read-all`

**3. Update NotificationPanel**

File: `src/features/notifications/components/NotificationPanel/NotificationPanel.tsx`
- Remove `DUMMY_NOTIFICATIONS` import and `useState` for notifications
- On mount: call `store.fetchAll()`
- Pass store notifications into existing grouping/filtering logic
- Wire `onMarkRead` callback to `store.markRead(id)`
- Wire "Mark as read" group button to `store.markAllRead()` (or a group-specific version)

**4. Update Header bell badge**

File: `src/components/layout/Header/Header.tsx`
- On mount: call `store.fetchUnreadCount()`
- Replace static red dot with conditional render: only show dot if `unreadCount > 0`
- Show count number if `unreadCount > 0` (optional: show "9+" if over 9)

---

## Type Alignment

The server's `Notification` entity uses snake_case (`is_read`, `user_id`, `created_at`). The frontend's current `Notification` interface uses camelCase (`isRead`, `timestamp`).

Options:
1. Transform in the API layer (preferred — keeps UI components clean)
2. Update frontend types to match server

Recommended: add a `mapNotification(raw)` transformer in `notificationApi.ts` that converts snake_case → camelCase and maps `created_at` → `timestamp`.

Also note: the server's `NotificationType` enum is `IN_APP | EMAIL | PUSH` (delivery channels), while the frontend's `NotificationType` enum is `LEAVE | EMPLOYEE | DOCUMENT | PAYROLL | APPROVAL | ATTENDANCE` (UI categories). These are different concepts. The UI categories should be derived from the notification's `metadata` field or a new `event_type` field — not from the server's `type`. For Phase 1, derive the UI icon/category from `metadata.event_type` if present, otherwise default to a generic bell icon.

---

## Files to Touch

| File | Change |
|------|--------|
| `src/modules/notification/controllers/notification.controller.ts` | Add `GET /notifications/unread-count` |
| `src/modules/notification/services/in-app-notification.service.ts` | Add `getUnreadCount(user)` |
| `brello_webapp/src/store/notificationStore.ts` | New — Zustand store |
| `brello_webapp/src/features/notifications/api/notificationApi.ts` | New — API calls + transformer |
| `brello_webapp/src/features/notifications/components/NotificationPanel/NotificationPanel.tsx` | Replace dummy data |
| `brello_webapp/src/components/layout/Header/Header.tsx` | Wire real unread count to bell |

---

## Done When

- [ ] Bell badge dot is hidden when no unread notifications exist
- [ ] Bell badge shows a count when unread notifications exist
- [ ] NotificationPanel displays real notifications from the database
- [ ] Clicking a notification marks it as read (persists on refresh)
- [ ] "Mark as read" group/all button persists on refresh
- [ ] Empty state shows when no notifications exist for the active tab
