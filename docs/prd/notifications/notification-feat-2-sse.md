# Feature 2 — Real-Time Delivery via SSE

> Phase 2 of the notification build plan. Adds Redis and a Server-Sent Events endpoint so new notifications appear instantly in the UI without polling.

---

## Goal

When a notification is saved to the database, the connected browser client receives it in real time without a page refresh or polling.

---

## Why SSE (not WebSockets)

Brello notifications are strictly server → client. SSE is the correct primitive:
- Browser `EventSource` auto-reconnects natively — no library needed
- NestJS has first-class `@Sse()` + `Observable` support
- Works over HTTP/2 with no connection limit
- WebSockets add bidirectional complexity that isn't needed here

---

## Architecture

```
InAppWorker saves notification to Postgres
    │
    └── publishes to Redis channel: notifications:user:{userId}
              │
              └── SSE endpoint subscribed to that channel
                        │
                        └── pushes MessageEvent to browser EventSource
```

---

## Scope

### Server (brello_server)

**1. Add Redis**

Install: `ioredis`

Create `src/common/redis/redis.module.ts` — provides a singleton `ioredis` client via `ConfigService` (reads `redis.host`, `redis.port`, `redis.password` from config).

**2. SSE endpoint**

`GET /notifications/stream`
- Auth: JWT required
- Returns: `Observable<MessageEvent>` (`text/event-stream` content type)
- NestJS decorator: `@Sse('stream')`
- Implementation:
  ```typescript
  return new Observable(observer => {
    const sub = redisSubscriber.subscribe(`notifications:user:${user.userId}`);
    sub.on('message', (channel, data) => {
      observer.next({ data: JSON.parse(data) });
    });
    return () => sub.unsubscribe();
  });
  ```
- Use a dedicated Redis subscriber client (separate from the publisher — Redis requires separate connections for pub/sub)

**3. Publish after in-app save**

In `InAppNotificationService.send()`, after `repository.save(notification)`:
```typescript
await this.redisPublisher.publish(
  `notifications:user:${dto.user_id}`,
  JSON.stringify({ id: notification.id, title: notification.title, message: notification.message, created_at: notification.created_at })
);
```

**4. Config**

Add to config schema:
```
redis:
  host: string (default: localhost)
  port: number (default: 6379)
  password: string (optional)
```

---

### Web App (brello_webapp)

**1. useNotificationStream hook**

Create `src/hooks/useNotificationStream.ts`:

```typescript
export function useNotificationStream() {
  const appendFromStream = useNotificationStore(s => s.appendFromStream);

  useEffect(() => {
    const es = new EventSource('/api/notifications/stream', { withCredentials: true });
    es.onmessage = (e) => {
      const notification = mapNotification(JSON.parse(e.data));
      appendFromStream(notification);
      useNotificationStore.getState().fetchUnreadCount();  // refresh badge
    };
    es.onerror = () => es.close();  // browser auto-reconnects via EventSource
    return () => es.close();
  }, []);
}
```

**2. Mount in root layout**

Call `useNotificationStream()` inside the authenticated layout component so it's active for the entire session.

---

## Infrastructure Note

Redis must be running. For local dev, add to `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

For production, use Upstash (free tier) or a managed Redis instance.

---

## Files to Touch

| File | Change |
|------|--------|
| `src/common/redis/redis.module.ts` | New — Redis provider |
| `src/modules/notification/controllers/notification.controller.ts` | Add `@Sse('stream')` endpoint |
| `src/modules/notification/services/in-app-notification.service.ts` | Publish to Redis after save |
| `src/modules/notification/notification.module.ts` | Import RedisModule |
| `brello_webapp/src/hooks/useNotificationStream.ts` | New — SSE hook |
| `brello_webapp/src/components/layout/AuthLayout.tsx` (or equivalent) | Mount the hook |
| `docker-compose.yml` | Add Redis service |

---

## Done When

- [ ] A notification created server-side (via any trigger) appears in the open NotificationPanel within 1–2 seconds without refresh
- [ ] Unread badge count increments in real time
- [ ] Closing and reopening the browser tab reconnects the SSE stream automatically
- [ ] SSE endpoint returns 401 without a valid JWT
