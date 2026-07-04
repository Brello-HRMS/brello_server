# Brello Notification System — Build Plan

## Context

The notification system is partially built. The server has a working facade (EMAIL, IN_APP, PUSH channels), a persisted in-app entity, SMTP email via nodemailer, and four REST endpoints. The web app has a polished UI (NotificationPanel, NotificationItem) but zero API integration — everything runs on dummy data. Push is a stub. There is no real-time delivery, no queue, no user preferences, and no unread count from the server.

This document is a design reference to build the full system. It covers what the industry does, what Brello should do specifically, and in what order.

---

## What Industry Research Confirmed (Verified Claims)

These findings survived adversarial 3-agent verification against primary sources (MDN, BullMQ source, LinkedIn/Confluent benchmarks):

1. **SSE beats WebSocket for notification delivery.** SSE auto-reconnects natively (browser EventSource API sends `Last-Event-ID` on reconnect — zero code needed). WebSockets have no built-in reconnection; libraries like Socket.IO add it as an opt-in layer. SSE's HTTP/1.1 six-connection-per-domain limit is fully eliminated by HTTP/2 multiplexing.
2. **BullMQ on Redis is the right queue for Node.js at Brello's scale.** Kafka handles 100K+ msg/sec (LinkedIn benchmarks: 2M writes/sec), but that's for massive pipelines. BullMQ/Redis is the standard Node.js workhorse and fits a NestJS stack cleanly.
3. **BullMQ has no built-in dead-letter queue.** The standard pattern: two queue instances (main + DLQ), move jobs on `worker.on('failed')` when `job.attemptsMade >= maxAttempts`.
4. **BullMQ exponential backoff formula:** `2^(attemptsMade-1) × delay`. With `delay=1000ms`: 1s → 2s → 4s → 8s per successive retry.

---

## Architecture Overview

```
Client (browser)
  │  SSE stream (/notifications/stream)
  │  REST calls (mark read, preferences)
  │
NestJS Server
  │
  ├── NotificationService (facade) ──── enqueues job to BullMQ
  │
  ├── BullMQ Workers
  │     ├── EmailWorker ──────────────── Resend API (replaces nodemailer)
  │     ├── InAppWorker ─────────────── Postgres (existing entity)
  │     └── PushWorker ──────────────── FCM HTTP v1 API
  │
  ├── SSE Controller ─────────────────── streams to connected clients
  │     └── Reads from Redis pub/sub ──── InAppWorker publishes after save
  │
  └── Preferences Controller ─────────── per-user per-channel settings
```

---

## Channel-by-Channel Plan

### 1. In-App Notifications (Real-Time)

**What needs to be built:**

**Server:**
- `GET /notifications/stream` — SSE endpoint using NestJS `@Sse()` decorator. Returns an `Observable<MessageEvent>` that wraps a Redis pub/sub subscription keyed to `notifications:user:{userId}`.
- `GET /notifications/unread-count` — returns `{ count: number }` (not the full array). Used to badge the bell icon without fetching all notifications.
- After `InAppWorker` saves a notification to Postgres, it publishes `{ id, title, message }` to `notifications:user:{userId}` channel in Redis. The SSE endpoint picks this up and pushes it to the connected client.

**Client:**
- Replace `useState(DUMMY_NOTIFICATIONS)` in `NotificationPanel` with a Zustand store (or RTK Query slice).
- Add a `useNotificationStream()` hook that opens an `EventSource` to `/notifications/stream`, listens for `message` events, and appends to the store.
- On mount, fetch `/notifications` (all) and `/notifications/unread-count`. Update the bell badge from the count endpoint.
- Wire `markAsRead` and `markAllAsRead` buttons to `PATCH /notifications/:id/read` and `PATCH /notifications/read-all`.

**Key decision — SSE, not WebSockets:**  
Brello's notifications are server-to-client only (no client → server real-time messages). SSE is the correct primitive. It's simpler to implement in NestJS (`@Sse()` + `Observable`), auto-reconnects in the browser, and works seamlessly under HTTP/2.

---

### 2. Email Notifications

**What needs to be changed:**

**Replace nodemailer + raw SMTP with a transactional email provider.**  
The current `EmailNotificationService` sends directly via SMTP. This is fragile (no deliverability guarantees, no open/click tracking, no webhooks for bounces, no retry infrastructure).

**Recommended provider: Resend**  
- Designed for developer-first use (clean REST API, TypeScript SDK)
- Free tier: 3,000 emails/month — sufficient for MVP
- Webhook support for bounce/complaint events
- Built-in email rendering with React Email (pairs well with the stack)
- Alternatives: Postmark (better deliverability tracking, more expensive), SendGrid (more enterprise features, more complex)

**HTML email templates:**  
Current implementation wraps the message in `<p>${dto.message}</p>`. Replace with **React Email** — write templates as React components, render server-side to HTML. This gives proper layouts, branding, and dark mode support.

```
src/modules/notification/templates/
  ├── otp-email.tsx          (already triggered in AuthService)
  ├── trial-reminder.tsx     (planned in TrialReminderCron)
  └── base-layout.tsx        (shared wrapper with logo/footer)
```

**Queue email sends through BullMQ:**  
Do not call the Resend API synchronously in the request path. Enqueue a job; the EmailWorker calls Resend. This decouples delivery latency from API response time and enables retry.

```typescript
// EmailWorker config
attempts: 5
backoff: { type: 'exponential', delay: 2000 }  // 2s→4s→8s→16s→32s
removeOnComplete: true
removeOnFail: false  // keep failed jobs for DLQ inspection
```

**Dead-letter queue for email:**  
```typescript
emailWorker.on('failed', (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    emailDLQ.add('dead', { ...job.data, error: err.message });
  }
});
```

---

### 3. Push Notifications

**What needs to be built (Phase 2 — not immediate):**

**Web Push (browser):**
- Use the **Web Push Protocol** via the `web-push` npm package on the server
- Client: register a Service Worker, call `registration.pushManager.subscribe()` with the server's VAPID public key, send the subscription object to `POST /notifications/push-subscription`
- Server: store subscription objects in a new `push_subscriptions` table (`user_id`, `endpoint`, `keys.p256dh`, `keys.auth`)
- When a push notification is triggered, look up the user's subscriptions and call `webpush.sendNotification()` for each

**Mobile (if Brello goes native later):**
- Use **Firebase Cloud Messaging (FCM)** HTTP v1 API via `firebase-admin` SDK
- Store FCM tokens in `push_subscriptions` table alongside web push subscriptions (differentiate by `platform` column: `web` | `android` | `ios`)

**Token hygiene:**
- FCM and web push subscriptions expire/become invalid. On `410 Gone` or `404` response from the push endpoint, delete the subscription from the database immediately.

---

### 4. Queue & Reliability (BullMQ)

**What needs to be added:**

Install `bullmq` and `ioredis`. Create a `QueueModule` in NestJS:

```
src/modules/queue/
  ├── queue.module.ts
  ├── queues/
  │     ├── email.queue.ts
  │     ├── in-app.queue.ts
  │     └── push.queue.ts
  └── workers/
        ├── email.worker.ts
        ├── in-app.worker.ts
        └── push.worker.ts
```

`NotificationService.send()` stops calling channel services directly. Instead it adds a job to the appropriate BullMQ queue. Workers process jobs asynchronously.

**BullBoard** (optional): Mount `@bull-board/express` on `/admin/queues` for a visual dashboard to inspect queued/failed/completed jobs. Useful during development.

---

### 5. Notification Preferences

**What needs to be built:**

New `notification_preferences` table:
```sql
user_id        UUID (FK users)
channel        ENUM('IN_APP', 'EMAIL', 'PUSH')
event_type     VARCHAR  -- e.g. 'leave_approval', 'payroll', 'otp'
enabled        BOOLEAN  DEFAULT TRUE
PRIMARY KEY (user_id, channel, event_type)
```

New endpoints:
- `GET /notifications/preferences` — returns user's preference matrix
- `PATCH /notifications/preferences` — update one or more preferences

`NotificationService.send()` checks preferences before enqueuing:
```typescript
const pref = await preferencesRepo.find({ user_id, channel: dto.type, event_type: dto.event_type });
if (pref && !pref.enabled) return;  // silently skip
```

**Frontend:**  
Add a "Notification Settings" page/modal with toggles per channel per event type. Design mirrors common HRMS patterns (row = event type, columns = channels).

---

### 6. Database Schema Enhancements

**Current schema is good for MVP.** For scale, two things to add later:

1. **Unread count as a counter cache.** Instead of `SELECT COUNT(*) WHERE is_read=false AND user_id=?` on every request, maintain a `users.unread_notification_count` integer column, increment on insert, decrement on mark-read. Or use Redis as the counter store (faster for frequent reads).

2. **Archive old notifications.** Add a background job (cron) that moves notifications older than 90 days from the `notifications` table to a `notifications_archive` table. This keeps the hot table small and queries fast.

---

### 7. Frontend State Management

Replace the current local `useState` in `NotificationPanel` with a proper store:

**Recommended: Zustand slice** (lightweight, fits the existing app pattern)

```typescript
// store/notificationStore.ts
interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  fetchAll: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  appendFromStream: (n: Notification) => void;
}
```

The SSE hook pushes to `appendFromStream`. The bell badge reads from `unreadCount`.

---

## Third-Party Platform Alternative (Novu / Knock)

Platforms like **Novu** (open-source) and **Knock** (hosted) provide: multi-channel fan-out, template management, delivery logs, preferences UI, and React components for the inbox. They replace everything built in sections 1–5 above.

**Brello's situation:** The server-side foundation is already 40% built. A platform makes sense if the team wants to skip infrastructure work and move fast. Novu's self-hosted option fits a privacy-conscious deployment. Knock's hosted plan starts at ~$100/month.

**Recommendation: Build custom.** Brello already has the entity, repository, and controller. Completing the custom system gives full control, zero vendor dependency, and is the right call at this scale.

---

## Implementation Phases

Each phase has a dedicated feature file with full detail on scope, files, and done criteria.

| Phase | Feature File | Duration |
|-------|-------------|----------|
| 0 | [notification-triggers.md](notification-triggers.md) — Audit of all 37 trigger points across the system | Reference |
| 1 | [notification-feat-1-api-wiring.md](notification-feat-1-api-wiring.md) — Frontend API integration + unread count | 1–2 days |
| 2 | [notification-feat-2-sse.md](notification-feat-2-sse.md) — Real-time delivery via SSE + Redis | 2–3 days |
| 3 | [notification-feat-3-bullmq.md](notification-feat-3-bullmq.md) — Queue & reliability via BullMQ + DLQ | 2–3 days |
| 4 | [notification-feat-4-email-upgrade.md](notification-feat-4-email-upgrade.md) — Resend + React Email templates | 1–2 days |
| 5 | [notification-feat-5-preferences.md](notification-feat-5-preferences.md) — Per-user per-channel preferences | 2 days |
| 6 | [notification-feat-6-push.md](notification-feat-6-push.md) — Web push via service workers | 3–4 days |

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/modules/notification/controllers/notification.controller.ts` | Add `/stream`, `/unread-count`, `/preferences` endpoints |
| `src/modules/notification/services/in-app-notification.service.ts` | Publish to Redis after save |
| `src/modules/notification/services/email-notification.service.ts` | Replace nodemailer with Resend |
| `src/modules/notification/services/notification.service.ts` | Enqueue jobs instead of direct calls |
| `src/modules/notification/templates/` | New — React Email templates |
| `src/modules/queue/` | New — QueueModule, queues, workers |
| `src/modules/notification/entities/notification-preference.entity.ts` | New |
| `brello_web_app/src/store/notificationStore.ts` | New — Zustand store |
| `brello_web_app/src/hooks/useNotificationStream.ts` | New — SSE hook |
| `brello_web_app/src/features/notifications/components/NotificationPanel/NotificationPanel.tsx` | Replace dummy data with store |

---

## Pricing Reference

### Research Cost (This Session)
The deep-research workflow that produced this document ran 108 agents, 753 tool uses, and consumed **2,299,772 subagent tokens** over ~18 minutes.

| Model | Input | Output |
|-------|-------|--------|
| Claude Sonnet 4.6 | $3.00 / MTok | $15.00 / MTok |

Estimated cost (assuming ~70% input / 30% output split typical for research agents):
- Input: ~1,610,000 tokens × $3/MTok ≈ **$4.83**
- Output: ~690,000 tokens × $15/MTok ≈ **$10.35**
- **Total research cost: ~$15–17**

---

### Recommended Service Pricing

#### Resend (Email)
| Plan | Price | Volume |
|------|-------|--------|
| Free | $0 | 3,000 emails/month, 100/day |
| Pro | $20/month | 50,000 emails/month |
| Scale | $90/month | 200,000 emails/month |

Resend charges $1.00 per additional 1,000 emails on Pro/Scale. **Free tier covers Brello's MVP comfortably.**

#### Redis (for BullMQ + SSE pub/sub)
- **Self-hosted**: Free (runs as a container alongside the NestJS app)
- **Upstash (serverless Redis)**: Free tier 10,000 commands/day; Pay-as-you-go $0.20 per 100K commands after that
- **Redis Cloud**: $7/month for 250MB managed instance

#### Firebase Cloud Messaging (Push)
- **Free** — FCM has no cost per message. Google charges nothing for notification delivery to Android, iOS, or web.

#### BullMQ
- **Free** — open-source npm package. Only cost is the Redis instance it runs on.

#### Novu (if chosen over custom build)
| Plan | Price | Notes |
|------|-------|-------|
| Free | $0 | 30,000 events/month |
| Business | $250/month | 250,000 events/month |
| Self-hosted | $0 | Run on your own infra, unlimited |

#### Knock (if chosen over custom build)
| Plan | Price | Notes |
|------|-------|-------|
| Free | $0 | 10,000 monthly notifications |
| Starter | $100/month | 100,000 notifications |
| Pro | $400/month | 500,000 notifications |

**Knock has no self-hosted option — it's fully managed.**

#### React Email (Templates)
- **Free** — open-source, MIT license.

---

### Cost Summary for Brello MVP

| Service | Monthly Cost |
|---------|-------------|
| Resend (Free tier) | $0 |
| Redis (self-hosted or Upstash free) | $0 |
| FCM | $0 |
| BullMQ | $0 |
| **Total MVP** | **$0/month** |

At scale (>3K emails/month + managed Redis):
- Resend Pro: $20/month
- Upstash or Redis Cloud: $7–$15/month
- **Total scaled**: ~$27–35/month

---

## Verification Checklist (when building)

- [ ] Bell badge shows real unread count from server
- [ ] Opening NotificationPanel loads real data
- [ ] Marking a single notification as read updates badge count and item style without page reload
- [ ] Marking all as read clears badge
- [ ] Creating a new in-app notification (via any trigger) appears in the panel in real time via SSE, without refresh
- [ ] Sending an OTP email delivers to inbox (not spam) via Resend
- [ ] A failed email job retries with exponential backoff; after max attempts it appears in the DLQ queue
- [ ] Disabling a notification preference prevents that notification type from being enqueued
