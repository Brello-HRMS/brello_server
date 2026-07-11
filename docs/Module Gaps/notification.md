# Module: Notification

## 1. Purpose & Current Usage

- **Facade + fan-out platform**: `NotificationService.send()` (`src/modules/notification/services/notification.service.ts:26`) is the single entry point. It runs a per-user/per-event preference gate (`findPreference`, lines 30-37) then enqueues onto one of three BullMQ queues (EMAIL / IN_APP / PUSH) via `QUEUE_TOKENS` from `modules/queue/queue.constants.ts`.
- **Workers**: `EmailWorker`, `InAppWorker`, `PushWorker` (`workers/*.worker.ts`) each own a dedicated `bullmq.Worker`, delegate to the matching channel service, and push to a channel-specific DLQ (`*_DLQ` queue) when `job.attemptsMade >= DEFAULT_JOB_OPTIONS.attempts` (5 attempts, exponential backoff from 2000ms).
- **Channel services**: `EmailNotificationService` (Resend or SMTP, renders React-Email templates), `InAppNotificationService` (persists to `notifications` table + publishes to Redis pub/sub for SSE), `PushNotificationService` (Web Push via VAPID + FCM via firebase-admin, auto-prunes stale subscriptions).
- **Realtime delivery**: `SseController` (`controllers/sse.controller.ts`) exposes `GET /notifications/stream`, opening a dedicated Redis subscriber per connection scoped to `notifications:user:{userId}`.
- **Preferences & subscriptions**: `NotificationController` exposes CRUD for preferences (`GET/PATCH /notifications/preferences`), push subscription registration (`POST/DELETE /notifications/push-subscription`), VAPID key retrieval, unread count/list, and mark-as-read endpoints.
- **Actual callers of `NotificationService.send()`** (grepped across `src/modules`, excluding the notification module itself):
  - `attendance/services/auto-checkout.service.ts:206`
  - `auth/services/platform-admin-auth.service.ts:94,160`
  - `auth/services/auth.service.ts:152,540,650`
  - `user/services/employee.service.ts:1156`
  - `lead/services/lead.service.ts:179`
  - `letter-management/issued-letters/services/issued-letter.service.ts` (sets `event_type` explicitly, lines 249/304)
  - `billing/crons/trial-reminder.cron.ts:73`
  - `feedback/services/feedback.service.ts` and `feedback/services/platform-feedback.service.ts` **inject** `NotificationService` but never call `.send()` — dead injections.
  - `payroll/services/payroll-reminder.cron.ts` only has a comment referencing future use — no live call.
- **Dead/unused parts**:
  - `NotificationService.broadcastAllChannels()` (`notification.service.ts:61-71`) — zero call sites anywhere in the repo (confirmed via repo-wide grep, only match is its own definition).
  - The PUSH channel (`PushNotificationService`, `PushWorker`, VAPID/FCM setup) has full infrastructure but zero producers — nothing ever sets `type: NotificationType.PUSH`.
  - `CreateNotificationDto` (`dto/create-notification.dto.ts`) is defined but never imported/used anywhere in the codebase.
  - `NotificationController.createTestNotification()` (`controllers/notification.controller.ts:136-147`) is an explicitly-flagged `// TODO: remove before production` debug endpoint, still mounted with no environment guard.

## 2. Intended / Ideal Usage

A production-grade notification platform should: (a) treat channel delivery as fully decoupled, idempotent, retryable units of work where a worker failure *always* surfaces to the queue's retry/backoff machinery; (b) rate-limit both at the infrastructure level (per-queue throughput caps to respect provider limits like Resend/FCM send rates) and at the business level (cap identical/near-duplicate notifications per user per time window to prevent spam from bulk operations, e.g. mass employee updates); (c) make SSE (or any long-lived push channel) horizontally scalable — bounded number of upstream connections regardless of connected client count, periodic heartbeats to survive idle-timeout proxies, and a replay/backlog mechanism so notifications published while a client is disconnected aren't silently lost; (d) have DB access patterns backed by explicit indexes and bounded/paginated queries; and (e) have test coverage on the gating logic (preferences), the worker retry/DLQ paths, and template rendering.

## 3. Cross-Module Connections

- **Depends on**: `modules/queue` (BullMQ queue/DLQ providers + `DEFAULT_JOB_OPTIONS`), `common/redis` (`RedisService` for pub/sub), `common/guards/sse-jwt.guard.ts` (query-param JWT auth for EventSource), `common/entities/base.entity.ts` (for `Notification` entity), TypeORM repositories, Resend/nodemailer/web-push/firebase-admin SDKs.
- **Depends on it (callers)**: attendance (auto-checkout), auth (login/OTP/platform-admin), user (employee onboarding), lead, letter-management (issued letters), billing (trial reminder cron) — see full list in §1. Feedback module and payroll-reminder cron have the dependency wired but unused.
- **Missing/expected connections**: no module calls the PUSH channel, so `PushNotificationService`/`PushWorker`/VAPID/FCM setup are fully dark code paths (untested in production traffic); `broadcastAllChannels` suggests an intended "critical, all-channel" use case (e.g. security alerts) that no module has adopted.

## 4. Gaps

### Structural

- **`broadcastAllChannels` bypasses the preference gate entirely and is unreachable dead code.** It enqueues directly to all three queues (`notification.service.ts:64-70`) without ever calling `preferenceRepository.findPreference` (that gate only lives inside `send()`, lines 30-37). So even if it were wired up, it would ignore user opt-outs — a correctness trap for whoever eventually calls it. Combined with zero current callers, it should either be deleted or rewritten to route each channel through `send()` (`this.send({...dto, type: X})` for each channel) so the gate applies uniformly. Matters because dead code with a latent preference-bypass bug is worse than no code — it will look "ready to use" to the next engineer.
- **No abstraction distinguishes "user preference lookup" from "delivery."** `send()` inlines the gate check directly rather than through a reusable policy object; every new channel or bulk-broadcast path has to remember to reimplement it (as `broadcastAllChannels` proves by omission). Worth extracting into a small `NotificationPreferenceGate` used by both paths.

### Coding

- **In-app worker failures are silently swallowed, defeating the retry/DLQ system.** `InAppNotificationService.send()` catches all persistence errors and returns `null` instead of rethrowing (`services/in-app-notification.service.ts:58-64`). `InAppWorker`'s processor (`workers/in-app.worker.ts:23-25`) just does `await this.inAppService.send(job.data)` — since nothing throws, BullMQ marks the job `completed` even when the DB write failed. The DLQ code path (lines 39-50) can never fire for in-app write failures. This matters because the module's whole retry/backoff/DLQ design is inert for one of its two heavily-used channels.
- **Push worker failures are also swallowed via `Promise.allSettled`.** `PushNotificationService.send()` (`services/push-notification.service.ts:78-86`) fans out per-subscription sends with `Promise.allSettled` and never inspects the settled results; genuine delivery errors thrown inside `sendWebPush`/`sendFcm` (lines 107-109, 135-138) are caught by `allSettled` and discarded, so the outer `send()` always resolves and the push job is always reported `completed` to BullMQ regardless of actual delivery success. Same effect as the in-app bug — retry/backoff/DLQ never engage for push delivery failures.
- **`event_type` omission silently bypasses the preference gate** — already covered in `docs/prd/notification-trigger-rollout-plan.md`, not re-detailed here per scope, but it's worth noting the gate itself (`notification.service.ts:30-37`) has no logging/metric when `eventType` is undefined, so these silent bypasses are invisible in production telemetry.
- **`NotificationController.createTestNotification` (`controllers/notification.controller.ts:136-147`) is a live, unguarded debug endpoint** behind only standard JWT auth — any authenticated user can spam themselves (or, if `user.userId` were attacker-controlled via a different bug, others) with test notifications. It's explicitly marked `// TODO: remove before production` but is still mounted.
- **`CreateNotificationDto` is unused dead code** (`dto/create-notification.dto.ts`) — no controller or service references it; `SendNotificationDto` is the DTO actually in use.

### Technical

- **No rate limiting anywhere in the pipeline.** Neither the BullMQ `Worker` options (`workers/*.worker.ts:21-33`) nor the `Queue` providers (`modules/queue/queue.module.ts:11-18`) set a `limiter: { max, duration }`, and there is no per-user throttling in `NotificationService.send()` or the channel services. A bulk operation (e.g., mass employee update) firing many `send()` calls for the same user in a burst will queue and deliver all of them with no dedup/cap — this is a real spam vector, not just a theoretical one, given several callers (`auth.service.ts`, `employee.service.ts`) are in loops/bulk flows.
- **No worker concurrency configured** — the `Worker` constructor options in all three workers omit `concurrency`, so each defaults to BullMQ's serial (1-at-a-time) processing per process. At any real volume (e.g., a payroll run notifying hundreds of employees) this becomes a throughput bottleneck with no horizontal knob other than adding whole processes.
- **`removeOnFail: false` in `DEFAULT_JOB_OPTIONS`** (`modules/queue/queue.constants.ts:23`) means every permanently-failed job stays in the main queue's failed set *forever*, in addition to being copied into the DLQ — unbounded growth of Redis memory for the primary queue with no TTL/cleanup policy.
- **SSE opens one dedicated Redis connection per connected client.** `SseController.stream()` calls `this.redisService.createSubscriber()` per invocation (`controllers/sse.controller.ts:36`), each a brand-new `ioredis` TCP connection with no shared connection/pub-sub multiplexing. At scale (many concurrent logged-in users), this directly multiplies against Redis's `maxclients`, and there's no cap or backpressure — a classic SSE-fan-out scaling gap.
- **No SSE heartbeat/keep-alive and no reconnection replay.** The `Observable` in `sse.controller.ts:34-61` never emits a periodic comment/ping, so idle connections behind a reverse proxy with a shorter idle timeout than the browser's retry window can be silently killed without the client knowing until it tries to write. Because delivery is pure Redis pub/sub (`in-app-notification.service.ts:42-55`), any notification published while a client is disconnected/reconnecting is lost forever — there's no `Last-Event-ID`/backlog mechanism, so a dropped SSE connection is a real (if partially mitigated by the separate REST unread-count/list endpoints) delivery gap.
- **No DB indexes on the `notifications` table's query columns.** `Notification` (`entities/notification.entity.ts`) declares no `@Index` on `user_id`, `type`, `is_read`, or `status`, yet every repository method (`repositories/notification.repository.ts:13-41`) filters on exactly that combination. `findAllInApp` additionally has no pagination/limit — it returns every historical notification for a user in one query, which will degrade linearly as notification volume grows.
- **Zero test coverage.** No `*.spec.ts` file exists anywhere under `src/modules/notification/` — the preference gate, the two silent-failure worker bugs above, and template rendering all ship with no automated verification.

## 5. Top 3 Priorities

1. **Fix the in-app and push worker error-swallowing bugs** (`in-app-notification.service.ts:58-64`, `push-notification.service.ts:78-86`) — right now the DLQ/retry infrastructure that looks solid on paper is dead for 2 of 3 channels; this is a silent, high-impact reliability gap that would go undetected until users report "I never got notified."
2. **Add per-user/per-event rate limiting** (application-level dedup/cap, plus BullMQ `limiter` options on the queues) — with zero throttling today, any bulk workflow is one bug away from spamming a user or tripping a provider's (Resend/FCM) rate limit.
3. **Delete or correctly rewire `broadcastAllChannels`** — it's unreachable, and its current implementation bypasses the preference gate, so leaving it in place is an attractive nuisance for the next engineer who wires it up expecting gate-respecting behavior.
