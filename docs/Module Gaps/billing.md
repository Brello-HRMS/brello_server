# Module: Billing

## 1. Purpose & Current Usage

`brello_server/src/modules/billing/` owns subscription billing, invoicing, GST computation, Razorpay payment collection, and billing-profile management for organizations.

**Entities**
- `entities/invoice.entity.ts` — `Invoice` (`InvoiceStatus`: PENDING/PAID/FAILED/OVERDUE/CANCELLED), snapshots plan/billing-profile at generation time.
- `entities/invoice-line-item.entity.ts` — `InvoiceLineItem`, cascade-deleted with invoice.
- `entities/payment.entity.ts` — `Payment` (`PaymentStatus`: INITIATED/PROCESSING/SUCCESS/FAILED), Razorpay order/link/payment ids, raw webhook payload.
- `entities/billing-profile.entity.ts` — `BillingProfile` (GSTIN, address, billing email), one-per-org.

**Services**: `invoice.service.ts` (generate/list/markPaid/markFailed), `payment.service.ts` (initiate/createPaymentLink/verify/webhook handling/renew-on-success), `razorpay.service.ts` (Razorpay SDK wrapper + signature verification), `subscription-billing.service.ts` (plan changes, cancellation), `billing-overview.service.ts`, `plan-comparison.service.ts`, `employee-count.service.ts`, `gst-calculator.service.ts`, `billing-profile.service.ts`, `invoice-pdf.service.ts` (PDFKit + S3 via `StorageService`).

**Controllers**: `billing-overview.controller.ts` (`GET /billing/overview`, `/billing/plans`), `subscription.controller.ts` (`/billing/subscriptions/change-plan|cancel|cancel-pending-change`), `invoice.controller.ts`, `payment.controller.ts` (`/billing/payments/initiate|link|verify|:id`), `billing-profile.controller.ts`, `razorpay-webhook.controller.ts` (`POST /billing/webhooks/razorpay`, `@Public()`).

**Crons**: `renewal-invoice.cron.ts` (daily 02:00, generates invoice on `next_renewal_date`), `subscription-expiry.cron.ts` (daily 03:00, TRIAL/ACTIVE→GRACE→EXPIRED), `trial-reminder.cron.ts` (daily 09:00, T-7/T-3/T-1).

**Guard/decorator**: `guards/active-subscription.guard.ts` registered globally as `APP_GUARD` in `billing.module.ts:93-96`, but it is a no-op unless `@RestrictedOnExpiry()` (`decorators/restricted-on-expiry.decorator.ts`) is applied to a route — a repo-wide grep (`grep -rn "RestrictedOnExpiry"`) shows **zero usages outside the decorator/guard files themselves**. So the guard exists, is wired into every request, and does nothing.

**Who calls into it today**:
- Frontend: `brello_webapp/src/pages/billing/BillingPlanPage.tsx`, `BillingInvoicePage.tsx`, `BillingPaymentHistoryPage.tsx`, and `OrgPlatformCard.tsx` all call `billing/*` REST endpoints.
- `modules/organization/services/organization.service.ts:219-226` creates the initial `OrganizationSubscription` (14-day TRIAL) directly against the `plan` module's entity — it does not go through any billing service.
- `modules/rbac/services/permission-resolver.service.ts:182-195` and `modules/app-module/services/module-access.service.ts` read `OrganizationSubscription`/`sub_status` directly (via the `plan` module's repository), independent of the billing module's own guard.
- No other backend module imports anything exported from `BillingModule` (`InvoiceService`, `PaymentService`, `SubscriptionBillingService`, `BillingOverviewService`, `EmployeeCountService`, `GstCalculatorService`, `BillingProfileService`) — a repo-wide `grep` for `modules/billing` outside the module itself only matches `app.module.ts`.

**Dead/unused parts**: `@RestrictedOnExpiry()` / `ActiveSubscriptionGuard` (defined, globally mounted, never triggered on any route — confirmed by grep). `InvoiceStatus.OVERDUE` is defined on the entity but no code path ever sets it (`grep -rn "InvoiceStatus.OVERDUE" services|crons` only shows it being *read* in `invoice.repository.ts:37` and `billing-overview.service.ts:217`, never assigned).

## 2. Intended / Ideal Usage

Per `brello_server/docs/prd/billing-payment-crons.md`, the intended end state is a staged, app-aware lock model: soft grace → **ADMIN app locked at D+5 overdue** → **EMPLOYEE app locked at D+10 overdue (== EXPIRED)** → instant unlock on payment, backed by a "Billing Enforcement" cron that marks invoices OVERDUE and sets a `lock_level` (NONE/ADMIN/FULL) on the subscription, a Dunning cron (D0/2/5/8/10 reminders), a Payment Reconciliation cron (poll Razorpay every 30 min for stuck INITIATED/PROCESSING payments), and a Stale Payment-Link Cleanup cron.

**Gap vs. implemented reality** (PRD §2.1/§8 vs. code):
- `lock_level`, `bill_due_at`, `admin_locked_at`, `full_locked_at` columns do not exist on `OrganizationSubscription` (`modules/plan/entities/organization-subscription.entity.ts` has only `sub_status` and `grace_period_ends_at` — confirmed by reading the full entity, no such columns present).
- The Billing Enforcement, Dunning Reminder, Payment Reconciliation, and Stale Payment-Link Cleanup crons described in PRD §6 do not exist — only `renewal-invoice.cron.ts`, `subscription-expiry.cron.ts`, and `trial-reminder.cron.ts` are present in `crons/`.
- `ActiveSubscriptionGuard` still implements the PRD's "current state" (binary expiry, decorator-based, unused) rather than the PRD §9 target (lock-level + app-aware, allow-list based, globally enforcing).
- PRD calls the existing webhook idempotency "✅ Exists ... idempotent" — confirmed true in code (`payment.service.ts:259-263` skip-if-already-SUCCESS check) — so that part of the PRD's audit is accurate.

## 3. Cross-Module Connections

**Depends on**:
- `plan` module — `OrganizationSubscription`, `Plan`, `OrganizationSubscriptionRepository`, `PlanRepository` (imported via `forwardRef(() => PlanModule)` in `billing.module.ts:64`, since `plan` also needs billing-adjacent types).
- `organization` module — `OrganizationProfile` (seeds `BillingProfile` in `billing-profile.service.ts:26-39`).
- `notification` module — imported into `billing.module.ts:45/66`, but only `trial-reminder.cron.ts` actually calls `NotificationService.send()` (line 73-86). No other billing file references `NotificationService`.
- `document` module — `StorageService` for invoice PDF upload/presign (`invoice-pdf.service.ts:3,20,24`).
- `user` module — `UserProfile` (headcount), `User`/`UserRoleMap` (trial-reminder recipient lookup).
- `audit` module — `AuditContextService` in `subscription-billing.service.ts:18,53` (pre-value only, for `changePlan`), and `@AuditLog(...)` decorators on `subscription.controller.ts:23,38,45`.

**Depends on this module**: Nothing in the backend imports billing's exported services (confirmed by grep — only `app.module.ts` references `BillingModule` itself). The frontend (`brello_webapp`) is the only consumer, hitting the REST controllers directly.

**Missing/expected connections**:
- `subscription-expiry.cron.ts` has **zero** `NotificationService` calls — an org silently transitions TRIAL/ACTIVE→GRACE→EXPIRED with no email/in-app/push notice to the org admin (confirmed: no import of `NotificationService` or `NotificationModule` types anywhere in the file).
- `trial-reminder.cron.ts:73-85` sends `NotificationType.EMAIL` only — no `NotificationType.IN_APP` companion send — and never sets `event_type` on the DTO (only `metadata.template`). Per `NotificationService.send()` (`modules/notification/services/notification.service.ts:30-37`), the preference gate is keyed off `dto.event_type ?? dto.metadata?.event_type`; since neither is set, `eventType` is `undefined` and the entire per-user preference check is skipped — trial reminders bypass user notification preferences entirely rather than respecting an opt-out.
- `invoice.service.ts`, `payment.service.ts`, and `subscription-billing.service.ts` have no `NotificationService` references at all — invoice generation, payment success/failure, and plan changes produce no notification of any kind.
- **The most consequential missing connection is not inside billing at all**: `permission-resolver.service.ts:181-195` (`getActivePlanId`) only matches `sub_status IN (ACTIVE, TRIAL)`; for GRACE or EXPIRED subscriptions it returns `planId = null`. `applyPlanRestrictions` then explicitly takes the branch at line 206-208, "No plan found → no plan restrictions applied (pass everything through)" and returns the caller's full role-based permissions unrestricted. Combined with `ActiveSubscriptionGuard` never firing (§1), this means **an EXPIRED organization today has no reduced access anywhere in the codebase** — billing's own status machine and the RBAC layer both fail open.

## 4. Gaps

### Structural
- **Enforcement guard is fully decoupled from the state it's meant to guard.** `ActiveSubscriptionGuard` (`guards/active-subscription.guard.ts:20-25`) only acts when a route carries `@RestrictedOnExpiry()`, and that decorator is applied nowhere (`decorators/restricted-on-expiry.decorator.ts`, zero usages found repo-wide). The module ships an access-control mechanism with no attachment point, i.e., dead weight that gives false confidence that expiry is enforced.
- **No shared "is this org blocked" abstraction.** Billing (`ActiveSubscriptionGuard`) and RBAC (`permission-resolver.service.ts:181-195`) each independently derive access implications from `sub_status`, with different (and contradictory) fail-open/fail-closed behavior, instead of billing owning and exposing one authoritative "org access state" service that RBAC/guards consume.

### Coding
- **`trial-reminder.cron.ts` never sets `event_type`**, so `NotificationService`'s preference gate is silently bypassed for every trial reminder (`trial-reminder.cron.ts:73-85` vs. `notification.service.ts:30-37`) — the opposite of the intended "checks user preferences before enqueuing" behavior described in that service's own docstring.
- **`subscription-expiry.cron.ts` has no notification call in either transition loop** (lines 45-52 for GRACE, 61-65 for EXPIRED) — an org can go fully EXPIRED with no admin ever being told why access changed.
- **Non-atomic invoice-number sequencing.** `invoice.repository.ts:71-79` (`nextSequenceForMonth`) does a `SELECT COUNT(*) ... LIKE 'BRL-YYYYMM-%'` then increments in application code — two renewal invoices generated concurrently in the same month (e.g. the daily cron overlapping a manual "immediate" plan-change invoice from `subscription-billing.service.ts:104-112`) can compute the same sequence number and collide on the `invoice_number` unique index (`invoice.entity.ts:16`), causing an unhandled insert failure rather than a graceful retry.
- **`InvoiceStatus.OVERDUE` is defined but dead** — nothing ever transitions an invoice into it (`invoice.entity.ts:11`, read in `invoice.repository.ts:37` and `billing-overview.service.ts:217` but never assigned anywhere in `invoice.service.ts`).

### Technical
- **Webhook signature verification is implemented correctly** — `razorpay.service.ts:141-152` computes HMAC-SHA256 over the raw body with `timingSafeEqual` (`safeEqual`, lines 155-162), and `main.ts:16` enables `rawBody: true` so the controller has the exact bytes Razorpay signed. This is a real strength, not a gap — call it out so it isn't re-flagged in a future audit.
- **No payment reconciliation / stuck-payment sweep.** `payment.service.ts` has no cron or scheduled job to resolve `Payment` rows stuck in `INITIATED`/`PROCESSING` (e.g., user closes checkout before Razorpay fires the webhook, or the webhook is dropped) — this is the PRD's flagged "money-correctness safety net" (§7.4) and it is entirely absent from `crons/`, meaning a paid org can remain in `GRACE`/`EXPIRED` indefinitely if the one webhook attempt is lost.
- **No refund handling anywhere in the module** — `grep -rni "refund"` across `modules/billing/` returns zero matches; there is no service method, webhook case (`refund.processed`/`refund.created`), or entity field for tracking a refund against a `Payment`/`Invoice`.
- **Idempotency on webhook success path relies on payment_id/link_id lookups only, not event-id deduplication** — `handleWebhookEvent` (`payment.service.ts:247-308`) checks "already SUCCESS" but has no record of *which webhook event ids* have been processed, so a `payment.failed` event replayed after a later `payment.captured` was already applied could still hit `markFailed` on an already-paid invoice (the `if (invoice)` check at line 306 doesn't guard on current `invoice_status`, unlike the success branch's `invoice.invoice_status !== InvoiceStatus.PAID` check at line 292).
- **No test coverage found** — no `*.spec.ts` files exist under `modules/billing/` (only source files were found by the initial directory listing), so signature verification, webhook idempotency, and the renewal/expiry cron logic all ship unverified by automated tests.
- **Stale payment-link rows are never cleaned up** — `createPaymentLink` (`payment.service.ts:113-186`) persists an `INITIATED` `Payment` before calling Razorpay, and there is no cron to expire/cancel abandoned links, matching the PRD's flagged gap (§2.2, §7.5) with no mitigation in code.

## 5. Top 3 Priorities

1. **Fix the fail-open access control chain.** Today neither `ActiveSubscriptionGuard` (inert, no decorated routes) nor RBAC's `permission-resolver.service.ts` (explicitly passes through all permissions when no active/trial plan is found) restrict a GRACE/EXPIRED organization in any way — the entire non-payment enforcement story described in the PRD is currently theater. This is the highest-value, highest-risk fix because it directly controls whether non-paying customers can use the product indefinitely.
2. **Wire `NotificationService` into `subscription-expiry.cron.ts`, `invoice.service.ts`, and `payment.service.ts`, and fix `trial-reminder.cron.ts` to set `event_type` and send `IN_APP` alongside `EMAIL`.** Without this, org admins get no signal at all when they lose access, when an invoice is generated, or when a payment succeeds/fails — pure product/support-load risk.
3. **Add a payment reconciliation cron and refund support.** A missed webhook can strand a paying customer in GRACE/EXPIRED with no automatic recovery path, and there is currently no way to represent a refund against a payment/invoice at all — both are real-money correctness gaps with zero code-level mitigation today.
