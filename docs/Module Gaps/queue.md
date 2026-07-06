# Module: Queue

## 1. Purpose & Current Usage

`brello_server/src/modules/queue/` is a two-file, `@Global()` NestJS module that stands up six BullMQ `Queue` instances (3 live queues + 3 dead-letter queues) and exposes them via DI tokens.

- `queue.constants.ts` — defines `QUEUE_NAMES` (Redis queue names), `QUEUE_TOKENS` (DI injection tokens), and `DEFAULT_JOB_OPTIONS` (`attempts: 5`, exponential backoff starting at 2000ms, `removeOnComplete: { count: 20 }`, `removeOnFail: false`).
- `queue.module.ts` — a `queueProvider()` factory that builds a raw `bullmq.Queue` per name/token pair, wired to Redis via `ConfigService` (`redis.host` / `redis.port` / `redis.password`, defaulting to `localhost:6379`). All 6 providers are exported so any module in the app can inject them once `QueueModule` is imported anywhere (it's global).

**Consumers (full repo grep for `QUEUE_TOKENS` / `QUEUE_NAMES` / `DEFAULT_JOB_OPTIONS` / `QueueModule`):**

- `brello_server/src/modules/notification/notification.module.ts:15,27` — imports `QueueModule` (the only module in the entire codebase that imports it).
- `brello_server/src/modules/notification/services/notification.service.ts:15-17,41,45,49,65-68` — injects `EMAIL`/`IN_APP`/`PUSH` queues, enqueues via `DEFAULT_JOB_OPTIONS`.
- `brello_server/src/modules/notification/workers/email.worker.ts:5,16,22,40` — injects `EMAIL_DLQ`, consumes `QUEUE_NAMES.EMAIL`, references `DEFAULT_JOB_OPTIONS.attempts` for its own dead-letter check.
- `brello_server/src/modules/notification/workers/in-app.worker.ts:5,16,22,40` — same pattern for `IN_APP` / `IN_APP_DLQ`.
- `brello_server/src/modules/notification/workers/push.worker.ts:5,16,22,40` — same pattern for `PUSH` / `PUSH_DLQ`.
- `brello_server/src/main.ts:12,55-60` — imports `QUEUE_TOKENS` directly in the bootstrap file (outside any module) to wire all 6 queues into a Bull Board dashboard at `/admin/queues`.

**Dead/unused parts:** none of the exported providers are unused — all 6 tokens are consumed somewhere. However, the module's only real consumer domain is Notification; despite living under a generic `modules/queue/` path suggesting shared infra, it is 100% notification-specific (queue names are literally `brello-notifications-*`).

## 2. Intended / Ideal Usage

Correct shared-queue infrastructure for this app would provide: a generic `registerQueue(name)` style API (or NestJS `bullmq`'s own `BullModule.registerQueue`) so other domains (e.g. audit export, billing invoicing, letter generation) can add a queue without editing this module's source; a single source of truth for Redis connection options (currently duplicated); actual consumption/monitoring of dead-letter queues (not just a bucket that never drains); and a properly gated observability dashboard.

- **Retry/backoff:** configured — `attempts: 5`, exponential backoff at 2000ms base (`queue.constants.ts:19-24`). This part is reasonable.
- **Dead-letter queue:** queues exist (`EMAIL_DLQ`, `IN_APP_DLQ`, `PUSH_DLQ`) and each worker's `'failed'` handler pushes the terminal failure into its DLQ (e.g. `email.worker.ts:39-49`). But nothing ever reads from a DLQ — see Gaps below.
- **Monitoring:** Bull Board (`@bull-board/api@^8.1.0`, `@bull-board/express@^8.1.0` in `package.json:25-26`) is not just installed — it is actually mounted and reachable at `/admin/queues` in `main.ts:51-64`, covering all 6 queues. This is genuinely wired up, not dead dependency weight.

## 3. Cross-Module Connections

**Depends on:**
- `@nestjs/config` `ConfigService` for `redis.host` / `redis.port` / `redis.password` (`queue.module.ts:9-17`), sourced from `brello_server/src/core/properties/sample.properties.yaml:59-62`. Note `dev.properties.yaml` has no `redis:` section at all — it silently relies on the `localhost`/`6379` code defaults in `queue.module.ts:13-14`.
- `bullmq` package directly (no wrapper/abstraction layer such as `@nestjs/bullmq`).

**Depends on this module:**
- `NotificationModule` and its `NotificationService`, `EmailWorker`, `InAppWorker`, `PushWorker` (see full list in section 1).
- `main.ts` bootstrap, via direct `app.get(QUEUE_TOKENS.X)` calls outside of any module boundary.

**Missing/expected connections:**
- No module other than Notification consumes it, despite the generic `modules/queue/` naming/location implying shared infra for the whole app.
- `RedisModule` (`brello_server/src/common/redis/redis.module.ts`) already exists as the app's Redis abstraction (used for pub/sub in Notification's SSE flow) but `QueueModule` does not use it or share its client — it opens its own raw `ioredis`-backed BullMQ connections instead of reusing `RedisService`.

## 4. Gaps

### Structural
- **Not actually generic/shared despite its name and location.** `queue.module.ts:22-29` hardcodes exactly 6 notification-specific queues; there is no factory/registration API for other modules to add a queue. Any new async workflow (e.g. billing, letter generation) would either have to edit this shared module's source directly or bypass it and hand-roll its own BullMQ setup — both are architecturally worse than a `forFeature`-style registration pattern. Matters because the module's purpose (per its own framing) is to be reusable shared infra, but it is coupled 1:1 to a single domain.
- **Redis connection config duplicated 4 times instead of centralized.** The same `{ host, port, password }` construction from `ConfigService` appears independently in `queue.module.ts:12-16`, `email.worker.ts:27-31`, `in-app.worker.ts:27-31`, and `push.worker.ts:27-31` — and a *fifth*, slightly different version already exists in `RedisService.createClient` (`common/redis/redis.service.ts:14-19`). Matters because a future Redis config change (e.g. adding TLS or a Sentinel/cluster config) requires touching 4+ call sites correctly, and any one being missed causes a worker to silently connect to the wrong Redis.

### Coding
- **Dead-letter queues are write-only — nothing ever consumes them.** Each worker's `failed` handler enqueues into its DLQ (`email.worker.ts:43-48`, `in-app.worker.ts:43-48`, `push.worker.ts:43-48`), but a full-repo grep for `new Worker(` (`grep -rn "new Worker" src`) shows only 3 workers total — one per live queue — and none listening on `QUEUE_NAMES.EMAIL_DLQ` / `IN_APP_DLQ` / `PUSH_DLQ`. Jobs land in the DLQ and sit there forever with no alerting or replay path other than manually inspecting Bull Board. Matters because permanently-failed notifications (e.g. failed OTP emails) are effectively invisible unless an engineer proactively checks the dashboard.
- **`removeOnFail: false` combined with DLQ hand-off causes duplicate, unbounded storage.** `DEFAULT_JOB_OPTIONS` (`queue.constants.ts:23`) keeps every failed job in the original queue forever (`removeOnFail: false`), while the same job's data is *also* copied into the DLQ on final failure (`email.worker.ts:43-48`). So each permanently-failed job is stored twice, indefinitely, in Redis. Matters for Redis memory growth over time in production with no compaction ever happening.
- **`main.ts` reaches into a module's internals from outside the module system.** `main.ts:12,55-60` imports `QUEUE_TOKENS` from `modules/queue/queue.constants` and calls `app.get<Queue>(...)` directly in the bootstrap function rather than through a dedicated `BullBoardModule`/provider. Matters because it breaks encapsulation — the queue module's tokens are treated as bootstrap-level globals rather than being consumed through NestJS's module graph like everywhere else.

### Technical
- **Bull Board dashboard is mounted with zero authentication, in every environment.** `main.ts:50-64` mounts `/admin/queues` unconditionally (no `NODE_ENV` check, no guard, no middleware) — the code comment even says `// dev only, no auth guard (add platform-admin gate in prod)`, acknowledging the gap without fixing it. Matters because the dashboard exposes full job payloads (`SendNotificationDto` — includes `user_id`, `target_email`, notification content/metadata) to anyone who can reach `/admin/queues`, in production as much as locally — this is the most exploitable and highest-blast-radius gap in this module.
- **No test coverage at all.** A search for queue-related spec files (`find . -iname "*queue*spec*"`) returns nothing — there are no unit tests for `queue.module.ts`, `queue.constants.ts`, or the worker DLQ-handoff logic. Matters because the retry/backoff/DLQ behavior (the module's entire value proposition) is unverified by automation.
- **No queue-level concurrency, rate limiting, or job-size/TTL controls.** Workers are constructed with only a `connection` option (`email.worker.ts:26-32` and identical in the other two workers) — no `concurrency`, `limiter`, or `stalledInterval` tuning, so all three run at BullMQ's default concurrency of 1 job at a time regardless of load. Matters for throughput under notification bursts (e.g. org-wide announcements triggering `broadcastAllChannels` for every user).

## 5. Top 3 Priorities

1. **Gate or remove the unauthenticated `/admin/queues` Bull Board route in production** (`main.ts:50-64`) — it currently leaks PII-bearing job payloads to anyone who can reach the server; this is a live security exposure, not a design nicety.
2. **Add a consumer (or at minimum alerting) for the three DLQ queues** — right now dead-lettered notifications (including failed auth OTPs) are silently invisible, defeating the purpose of having a DLQ at all.
3. **Generalize `QueueModule` into a real registration API (or adopt `@nestjs/bullmq`) and centralize the Redis connection builder** — as written, the "shared" module is single-tenant to Notification and duplicates Redis connection logic in 4+ places, so the next team that needs a queue will likely bypass it entirely.
