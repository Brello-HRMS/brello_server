# Feature 3 — Queue & Reliability via BullMQ

> Phase 3 of the notification build plan. Moves notification dispatch off the synchronous request path and onto a reliable async queue with retries and a dead-letter queue.

---

## Goal

No notification send should block an API response or fail silently. All channel sends are enqueued, retried on failure with exponential backoff, and dead-lettered after exhausting retries.

---

## Why BullMQ

- Native Node.js/NestJS fit — no separate infra beyond Redis (already added in Phase 2)
- Exponential backoff built-in: formula `2^(attemptsMade-1) × delay` (verified against BullMQ source)
- No built-in DLQ — but the community pattern (two queue instances) is well-established and simple to implement

---

## Scope

### Server (brello_server)

**1. Install packages**

```bash
npm install bullmq @bull-board/express @bull-board/api
```

**2. Queue module structure**

```
src/modules/queue/
  ├── queue.module.ts          — global module, exports all queues
  ├── queues/
  │     ├── email.queue.ts     — Queue + DLQ definitions
  │     ├── in-app.queue.ts
  │     └── push.queue.ts
  └── workers/
        ├── email.worker.ts    — processes email jobs → calls EmailNotificationService
        ├── in-app.worker.ts   — processes in-app jobs → calls InAppNotificationService, then publishes to Redis
        └── push.worker.ts     — processes push jobs → calls PushNotificationService (stub until Phase 6)
```

**3. Queue configuration per channel**

```typescript
// Shared worker options
const workerOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },  // 2s → 4s → 8s → 16s → 32s
  removeOnComplete: true,
  removeOnFail: false,  // keep in BullMQ's failed set for DLQ
};
```

**4. Dead-letter queue pattern**

```typescript
// In each worker's failed event handler
worker.on('failed', async (job, err) => {
  if (job.attemptsMade >= (job.opts.attempts ?? 5)) {
    await dlQueue.add('dead', {
      originalJob: job.name,
      data: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
  }
});
```

One DLQ per channel (e.g., `email-dlq`, `in-app-dlq`, `push-dlq`). DLQ jobs are not retried automatically — they require manual inspection or a separate admin action.

**5. Refactor NotificationService.send()**

Before Phase 3:
```typescript
// Directly calls service
this.emailNotificationService.send(dto);
```

After Phase 3:
```typescript
// Enqueues a job
await this.emailQueue.add('send', dto);
```

The `send()` method becomes a dispatcher to the appropriate queue. Services themselves are unchanged — workers call them.

**6. BullBoard dashboard (optional, dev only)**

Mount on `/admin/queues` gated behind a platform-admin guard. Gives visual access to queued, active, completed, failed, and dead-lettered jobs.

---

### Web App

No changes in this phase.

---

## Job Payload Shape

```typescript
// Email job
interface EmailJobData {
  user_id?: string;
  target_email: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  event_type?: string;
}

// In-app job
interface InAppJobData {
  user_id: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  event_type?: string;
}
```

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/modules/queue/queue.module.ts` | New |
| `src/modules/queue/queues/email.queue.ts` | New |
| `src/modules/queue/queues/in-app.queue.ts` | New |
| `src/modules/queue/queues/push.queue.ts` | New |
| `src/modules/queue/workers/email.worker.ts` | New |
| `src/modules/queue/workers/in-app.worker.ts` | New |
| `src/modules/queue/workers/push.worker.ts` | New |
| `src/modules/notification/services/notification.service.ts` | Enqueue instead of direct calls |
| `src/modules/notification/notification.module.ts` | Import QueueModule |
| `src/app.module.ts` | Import QueueModule globally |

---

## Done When

- [ ] `NotificationService.send()` returns immediately after enqueuing (no awaiting delivery)
- [ ] An email that fails on first attempt is retried automatically with exponential backoff
- [ ] After 5 failed attempts, the job appears in the DLQ queue (not lost)
- [ ] Successful jobs are removed from the queue automatically
- [ ] In-app notifications still trigger the Redis pub/sub event (SSE) after worker saves to DB
- [ ] BullBoard dashboard accessible at `/admin/queues` (dev only)
