# Feature 6 — Web Push Notifications

> Phase 6 of the notification build plan. Delivers notifications to users even when the browser tab is closed, using the Web Push Protocol and browser service workers.

---

## Goal

Critical notifications (leave approvals, payroll reminders) reach users even when they're not actively using Brello — via the browser's native OS notification system.

---

## Architecture

```
Server generates VAPID key pair (one-time setup)
    │
Client requests push permission → subscribes → sends PushSubscription to server
    │
Server stores subscription in push_subscriptions table
    │
When a push notification fires:
    Server looks up subscriptions for user
    Calls web-push.sendNotification() for each endpoint
    Browser OS delivers notification even if tab is closed
    Service worker intercepts → shows OS notification
    User clicks → opens Brello or navigates to the relevant section
```

---

## Scope

### Server (brello_server)

**1. Install packages**

```bash
npm install web-push
npm install --save-dev @types/web-push
```

**2. VAPID key generation (one-time)**

```bash
npx web-push generate-vapid-keys
```

Store in env:
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:admin@brello.io
```

Expose public key via `GET /notifications/vapid-public-key` (unauthenticated — client needs it before subscribing).

**3. New entity**

`src/modules/notification/entities/push-subscription.entity.ts`

```typescript
@Entity('push_subscriptions')
export class PushSubscription extends BaseEntity {
  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 500 })
  endpoint: string;

  @Column({ type: 'varchar', length: 255 })
  p256dh: string;  // keys.p256dh from browser PushSubscription

  @Column({ type: 'varchar', length: 255 })
  auth: string;    // keys.auth from browser PushSubscription

  @Column({ type: 'enum', enum: ['web', 'android', 'ios'], default: 'web' })
  platform: string;
}
// Unique on endpoint
```

**4. New endpoints**

`POST /notifications/push-subscription`
- Auth: JWT required
- Body: `{ endpoint, keys: { p256dh, auth } }` (the raw browser `PushSubscription` object)
- Upserts by endpoint (replace if exists for this user)

`DELETE /notifications/push-subscription`
- Body: `{ endpoint }`
- Removes the subscription (called when user explicitly disables push in preferences)

**5. Update PushNotificationService**

Replace the mock log with actual delivery:

```typescript
async send(dto: SendNotificationDto): Promise<void> {
  const subscriptions = await this.pushSubRepo.findByUserId(dto.user_id);
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: dto.title, body: dto.message, data: dto.metadata })
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired — delete it
        await this.pushSubRepo.deleteByEndpoint(sub.endpoint);
      }
    }
  }
}
```

---

### Web App (brello_webapp)

**1. Service worker**

Create `public/sw.js`:

```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Brello', {
      body: data.body,
      icon: '/icons/icon-192.png',
      data: data.data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(url));
});
```

**2. Push subscription hook**

Create `src/hooks/usePushSubscription.ts`:

```typescript
export async function subscribeToPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const vapidKey = await getVapidPublicKey();  // GET /notifications/vapid-public-key
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  await registerPushSubscription(sub.toJSON());  // POST /notifications/push-subscription
}
```

Mount in the notification settings panel behind "Enable push notifications" toggle. Only show on browsers that support `window.Notification` and `navigator.serviceWorker`.

**3. Permission prompt**

Never auto-prompt for push permission on page load — this is considered spam and will be rejected by browsers. Prompt only when:
- User explicitly clicks "Enable push notifications" in Notification Settings (Phase 5)
- Or after a clear user action that indicates they want alerts

---

## Token Hygiene (Critical)

Push endpoints expire silently. The server must handle `410 Gone` and `404` responses from the push service by immediately deleting the stale subscription from `push_subscriptions`. Without this, the table fills with dead endpoints and delivery attempts fail silently.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/modules/notification/entities/push-subscription.entity.ts` | New |
| `src/modules/notification/repositories/push-subscription.repository.ts` | New |
| `src/modules/notification/services/push-notification.service.ts` | Replace stub with web-push |
| `src/modules/notification/controllers/notification.controller.ts` | Add push-subscription + vapid-public-key endpoints |
| `src/config/` | Add VAPID config |
| `brello_webapp/public/sw.js` | New — service worker |
| `brello_webapp/src/hooks/usePushSubscription.ts` | New |
| `brello_webapp/src/features/notifications/components/NotificationSettings/` | Add push toggle (Phase 5) |
| `brello_webapp/src/main.tsx` (or app entry) | Register service worker |

---

## Done When

- [ ] User can enable push notifications from Notification Settings
- [ ] A notification sent when the Brello tab is closed appears as an OS notification
- [ ] Clicking the OS notification opens Brello (or the relevant page)
- [ ] Expired endpoints are removed automatically (no 410/404 errors accumulate)
- [ ] Push works in Chrome, Firefox, Edge (Safari requires additional entitlement — out of scope for MVP)
