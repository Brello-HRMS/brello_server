# Product Requirement Document (PRD)

# Module: Billing & Payment — Crons, Grace Period & Staged App Locking

## Product: Brello HRMS

---

# 1. Executive Summary

The Billing & Payment module already issues renewal invoices and accepts Razorpay payments, but it has **no automated enforcement of non-payment**. Today an organization that stops paying simply drifts into an `EXPIRED` status (after a flat 7-day grace) with a single binary block applied to `@RestrictedOnExpiry()`-decorated routes — a decorator that is currently **applied to zero routes**. There is no intermediate pressure, no differentiation between the admin web app and the employee mobile app, and several lifecycle states (`InvoiceStatus.OVERDUE`, stuck `PaymentStatus.INITIATED/PROCESSING`) exist in the schema but are never transitioned.

This PRD defines the **complete cron suite** for Billing & Payment and a **staged, app-aware locking model** driven by how many days a bill is overdue:

- **Grace window** after the bill due date during which everything keeps working (soft reminders only).
- **Day +5 overdue → Admin lock:** the **ADMIN web app** is restricted to billing/payment screens only. The decision-makers who can pay feel the pain first; employees are unaffected.
- **Day +10 overdue → Employee lock:** the **EMPLOYEE mobile app** is also restricted, completing a full tenant lockout. Only billing/payment and auth routes remain reachable.
- **Payment at any stage instantly unlocks** the tenant and restores `ACTIVE`.

The mechanism is a set of idempotent daily/intraday crons plus an upgrade to the existing subscription guard so it reads a **lock level** and the caller's **app** rather than a single expiry flag.

---

# 2. Current State Audit

## 2.1 What Already Exists

| Capability | Location | Current State | Gap |
|---|---|---|---|
| Renewal invoice generation | [renewal-invoice.cron.ts](../../src/modules/billing/crons/renewal-invoice.cron.ts) | Daily 02:00; generates invoice on `next_renewal_date`, applies pending plan/cycle changes | None for generation; no follow-up if the invoice is never paid |
| Subscription expiry transitions | [subscription-expiry.cron.ts](../../src/modules/billing/crons/subscription-expiry.cron.ts) | Daily 03:00; `TRIAL/ACTIVE` past `end_date` → `GRACE`, `GRACE` past `grace_period_ends_at` → `EXPIRED` | Flat single grace; no staged admin/employee locking |
| Trial reminders | [trial-reminder.cron.ts](../../src/modules/billing/crons/trial-reminder.cron.ts) | Daily 09:00; T-7/T-3/T-1 for trials | Logs only (`TODO` notification); no equivalent for **unpaid renewal/overdue** invoices |
| Subscription states | [organization-subscription.entity.ts:6](../../src/modules/plan/entities/organization-subscription.entity.ts#L6) | `TRIAL, ACTIVE, GRACE, EXPIRED, CANCELLED` + `grace_period_ends_at` | No `lock_level`, no `admin_locked_at` / `employee_locked_at` timestamps |
| Expiry guard | [active-subscription.guard.ts](../../src/modules/billing/guards/active-subscription.guard.ts) | Blocks `@RestrictedOnExpiry()` routes when `sub_status === EXPIRED` | Binary; app-agnostic; not staged |
| Expiry decorator | [restricted-on-expiry.decorator.ts](../../src/modules/billing/decorators/restricted-on-expiry.decorator.ts) | `@RestrictedOnExpiry()` metadata | **Applied to no route in the codebase** |
| Apps | seeded in [seed-brello-v2-base.ts:38](../../src/seeds/seed-brello-v2-base.ts#L38) | `ADMIN` (web) & `EMPLOYEE` (mobile self-service); `appId` carried in JWT / `LoggedInUser` | Locking does not yet read `appId` |
| Razorpay payment + webhook | [payment.service.ts](../../src/modules/billing/services/payment.service.ts), [razorpay-webhook.controller.ts](../../src/modules/billing/controllers/razorpay-webhook.controller.ts) | Checkout verify + `payment.captured/order.paid/payment_link.paid` webhooks, idempotent | No reconciliation for missed webhooks / abandoned payments |

## 2.2 What Is Missing (Net New)

- **No "days overdue" concept.** Locking is requested relative to the **bill due date**; nothing computes or stores days-overdue.
- **No staged lock.** `InvoiceStatus.OVERDUE` ([invoice.entity.ts:7](../../src/modules/billing/entities/invoice.entity.ts#L7)) is defined but never set; nothing distinguishes "admin locked" from "fully locked".
- **No app-aware enforcement.** Guard cannot lock ADMIN at D+5 while leaving EMPLOYEE open until D+10.
- **No dunning** for unpaid renewal invoices (only trials get reminders).
- **No payment reconciliation.** Payments stuck in `INITIATED`/`PROCESSING` (browser closed, webhook missed) are never resolved.
- **No stale payment-link cleanup.** `createPaymentLink` persists an `INITIATED` payment before calling Razorpay; abandoned links/rows are never closed.
- **No billing audit events** for lock/unlock transitions.

---

# 3. Industry Benchmark Analysis

**How leading B2B SaaS / HRMS platforms handle non-payment:**

- **Stripe Billing (dunning):** invoice becomes `past_due`; Smart Retries over a window; configurable escalation; subscription moves to `unpaid`/`canceled` only after retries exhaust. Access is gated by the app, not by Stripe.
- **Zoho (One/People):** soft grace with banners and email nags first; **admin/owner billing screens stay reachable** so someone can pay even when the rest is locked; staged restriction of features.
- **freshworks / greytHR:** distinguish **admin lockout** (org cannot configure/run privileged actions like payroll) from **end-user lockout** (employees lose self-service) — admin is squeezed first because admins control the wallet.
- **Common pattern adopted here:** *grace → restrict the payers (admin) → restrict everyone (employees) → hard expire*, with instant reinstatement on payment and a generous reconciliation safety net for webhook gaps.

---

# 4. Goals & Non-Goals

## 4.1 Goals
1. Define the **full cron inventory** for Billing & Payment with schedules, idempotency, and ownership.
2. Implement a **grace period** measured from the bill **due date**.
3. **Lock the ADMIN web app at 5 days overdue** (billing/payment screens remain reachable).
4. **Lock the EMPLOYEE mobile app at 10 days overdue** (full tenant lockout).
5. **Instant unlock** on successful payment, from any stage.
6. Drive **dunning notifications** and **payment reconciliation** so the state machine is correct even when webhooks are missed.

## 4.2 Non-Goals
- Building a new payment gateway integration (Razorpay stays).
- Usage/seat metering changes (employee-count true-up is out of scope; noted in §13).
- Platform-admin / enterprise-level billing overrides (separate PRD).
- Frontend implementation of lock banners (contract defined; UI built by web/mobile teams).

---

# 5. Billing Lifecycle & Locking Timeline

`D0` = the unpaid renewal invoice's **`due_date`** (the "bill due" date). All "days overdue" are measured from `D0` in the org's billing timezone.

```
 Renewal invoice          Bill due        Admin lock         Employee lock / Expire
 generated (auto)           D0               D+5                    D+10
     │                       │                 │                       │
─────●───────────────────────●─────────────────●───────────────────────●────────────▶ time
     │   invoice PENDING      │  GRACE (soft)   │  ADMIN_LOCKED         │  FULL_LOCKED
     │                        │                 │                       │  (sub EXPIRED)
     ▼                        ▼                 ▼                       ▼
  notify "invoice         mark invoice      ADMIN app → billing      EMPLOYEE app also
  ready, due D0"          OVERDUE; start    routes only; EMPLOYEE    restricted; tenant
                          dunning           app still fully usable   fully locked
```

| Stage | Trigger | `sub_status` | `lock_level` | ADMIN web app | EMPLOYEE mobile app | Billing/Auth routes |
|---|---|---|---|---|---|---|
| **Active** | invoice paid | `ACTIVE` | `NONE` | ✅ full | ✅ full | ✅ |
| **Grace (soft)** | `D0 ≤ now < D+5` & unpaid | `GRACE` | `NONE` | ✅ full + banner | ✅ full + banner | ✅ |
| **Admin locked** | `now ≥ D+5` & unpaid | `GRACE` | `ADMIN` | 🔒 billing/payment only | ✅ full + banner | ✅ |
| **Full locked** | `now ≥ D+10` & unpaid | `EXPIRED` | `FULL` | 🔒 billing/payment only | 🔒 blocked (pay-to-restore screen) | ✅ |
| **Reinstated** | payment success | `ACTIVE` | `NONE` | ✅ full | ✅ full | ✅ |

**Notes & rules**
- **Thresholds are config-driven** (`ADMIN_LOCK_DAYS=5`, `FULL_LOCK_DAYS=10`), not hardcoded, so they can be tuned per environment.
- The existing flat `GRACE_PERIOD_DAYS` is **superseded** by `FULL_LOCK_DAYS` (the point at which the tenant becomes `EXPIRED`). The grace concept is preserved but now has an internal admin-lock milestone.
- **Always-allowed routes (any lock level):** auth/login/logout, the billing/payment surface (`billing/overview`, `subscription`, `invoice`, `payment`, billing webhooks), and a minimal "account status" endpoint. This guarantees an admin can always log in and pay to unlock.
- **Platform admins (`isPlatformAdmin`) are never locked.**
- **Cancelled subscriptions** (`CANCELLED`) follow their own path and are out of scope for overdue locking.

---

# 6. Cron Inventory (Complete Set)

| # | Cron | Schedule | Status | Responsibility |
|---|---|---|---|---|
| 1 | **Renewal Invoice** | Daily 02:00 | ✅ Exists | Generate invoice on `next_renewal_date`; apply pending plan/cycle |
| 2 | **Overdue Marker** | Daily 03:00 | 🆕 New (may fold into #3) | `PENDING` invoice past `due_date` → `OVERDUE`; stamp `D0` on subscription |
| 3 | **Billing Enforcement (Lock Stager)** | Daily 04:00 | 🆕 New | Compute days-overdue → set `lock_level` (`NONE`→`ADMIN`→`FULL`) & `sub_status` (`GRACE`→`EXPIRED`); emit audit events |
| 4 | **Dunning Reminder** | Daily 10:00 | 🆕 New | Escalating payment reminders for unpaid `OVERDUE` invoices (D0, D+2, D+5, D+8, D+10) |
| 5 | **Payment Reconciliation** | Every 30 min | 🆕 New | Poll Razorpay for `INITIATED`/`PROCESSING` payments older than 30 min; reconcile to `SUCCESS`/`FAILED`; catch missed webhooks |
| 6 | **Stale Payment-Link Cleanup** | Daily 01:30 | 🆕 New | Cancel expired Razorpay links; mark abandoned placeholder payments `FAILED` |
| 7 | **Trial Reminder** | Daily 09:00 | ✅ Exists | T-7/T-3/T-1 trial expiry reminders (wire notifications) |

> Crons #2 and #3 may be implemented as **one daily pass** ("Billing Enforcement") to keep the state transition atomic per subscription and avoid ordering races (marking overdue and then staging the lock in the same transaction). They are listed separately for clarity of responsibility.

---

# 7. Detailed Cron Specifications

### 7.1 Renewal Invoice — *(exists; unchanged)*
Reference only. On success the webhook/verify path renews the subscription and resets `lock_level = NONE`. See [renewal-invoice.cron.ts](../../src/modules/billing/crons/renewal-invoice.cron.ts).

### 7.2 Billing Enforcement (Lock Stager) — **NEW (core)**
- **Schedule:** Daily 04:00 server time (after renewal 02:00 & any overnight payments settle).
- **Selection:** subscriptions with an **unpaid** invoice (`invoice_status IN (PENDING, OVERDUE, FAILED)`) whose `due_date < now`, with `sub_status IN (ACTIVE, GRACE)` and not `CANCELLED`.
- **Per subscription logic (single transaction):**
  1. Resolve `D0` = the oldest unpaid invoice's `due_date`; persist `bill_due_at = D0` on the subscription if not set.
  2. `daysOverdue = floor((now - D0) / 1 day)` in billing timezone.
  3. If invoice still `PENDING` and `daysOverdue ≥ 0` → set invoice `OVERDUE`.
  4. **Stage transitions (monotonic — never downgrade a lock here):**
     - `daysOverdue ≥ FULL_LOCK_DAYS (10)` → `lock_level = FULL`, `sub_status = EXPIRED`, stamp `full_locked_at` (once).
     - `daysOverdue ≥ ADMIN_LOCK_DAYS (5)` → `lock_level = ADMIN`, `sub_status = GRACE`, stamp `admin_locked_at` (once).
     - `0 ≤ daysOverdue < 5` → `lock_level = NONE`, `sub_status = GRACE` (soft).
  5. On any **new** lock transition, emit a billing audit event and enqueue a notification (§10).
- **Idempotency:** transitions are derived purely from `daysOverdue` and current state; re-running the same day is a no-op. `*_locked_at` timestamps are set once (only when null).
- **Unlock is NOT done here** — unlock is event-driven from the payment success path (§7.6) so reinstatement is instant, not next-cron.

### 7.3 Dunning Reminder — **NEW**
- **Schedule:** Daily 10:00.
- **Selection:** unpaid `OVERDUE` invoices; compute `daysOverdue`.
- **Cadence (offsets from D0):** `0, 2, 5, 8, 10` → escalating copy ("payment due" → "admin access will be limited" → "admin access limited" → "final notice" → "service suspended"). Reuse the hosted payment link (`short_url`) so each reminder is one-click payable.
- **Recipients:** billing contact + org owner/admins (the `EMPLOYEE`-app population is **not** dunned).
- **Idempotency:** track `last_reminder_offset` (or a `(invoice_id, offset)` sent-ledger) to avoid duplicate sends if the cron reruns.

### 7.4 Payment Reconciliation — **NEW**
- **Schedule:** Every 30 minutes.
- **Selection:** `Payment` rows in `INITIATED`/`PROCESSING` older than 30 min with a `razorpay_order_id` or `razorpay_payment_link_id`.
- **Logic:** query Razorpay for the order/link/payment status and converge our row:
  - captured/paid → run the same success path as the webhook (`markPaid` + `renewSubscriptionForInvoice` + **unlock**), idempotently.
  - failed/expired → `FAILED` with reason; invoice `markFailed`.
- **Why:** webhooks get missed/delayed and users abandon Checkout after the order is created. This is the **money-correctness safety net** and prevents a paid org from staying locked.
- **Idempotency:** reuse existing `findByRazorpay*` lookups and the "already `SUCCESS` → skip" guard in [payment.service.ts](../../src/modules/billing/services/payment.service.ts).

### 7.5 Stale Payment-Link Cleanup — **NEW**
- **Schedule:** Daily 01:30.
- **Selection:** `INITIATED` payments with a `razorpay_payment_link_id` older than link TTL (e.g. 24h) and no successful sibling for the invoice.
- **Logic:** best-effort `razorpay.cancelPaymentLink()` (already exists), set payment `FAILED` (`failure_reason = 'link expired'`). Leaves the invoice payable via a fresh link.

### 7.6 Unlock (event-driven, not a cron) — **NEW behavior on existing path**
On payment success (`verify`, webhook, or reconciliation), after `markPaid` + `renewSubscriptionForInvoice`:
- set `lock_level = NONE`, clear `admin_locked_at` / `full_locked_at` / `bill_due_at`, `sub_status = ACTIVE`, recompute `end_date`/`next_renewal_date` (already done), emit `BILLING_UNLOCKED` audit event.

---

# 8. Data Model Changes

### 8.1 `organization_subscription` (new columns)
```ts
export enum BillingLockLevel {
  NONE = 'None',     // full access
  ADMIN = 'Admin',   // ADMIN web app restricted to billing; EMPLOYEE app open
  FULL = 'Full',     // both apps restricted; tenant suspended (sub EXPIRED)
}

@Column({ type: 'enum', enum: BillingLockLevel, default: BillingLockLevel.NONE })
lock_level: BillingLockLevel;

@Column({ type: 'timestamp', nullable: true })
bill_due_at: Date | null;        // D0 — due date of the oldest unpaid invoice

@Column({ type: 'timestamp', nullable: true })
admin_locked_at: Date | null;    // stamped once at D+5 transition

@Column({ type: 'timestamp', nullable: true })
full_locked_at: Date | null;     // stamped once at D+10 transition
```
> `grace_period_ends_at` is retained for backward compatibility; the effective expiry is now `bill_due_at + FULL_LOCK_DAYS`.

### 8.2 `invoice` — *(no schema change)*
`InvoiceStatus.OVERDUE` already exists; the enforcement cron finally sets it.

### 8.3 `payment` (optional, for dunning idempotency)
A small `(invoice_id, reminder_offset)` ledger table **or** a `last_reminder_offset` int on the invoice to dedupe dunning sends.

---

# 9. Access Control / Guard Changes

The lock is enforced in **`ActiveSubscriptionGuard`**, upgraded from binary-expiry to **lock-level + app aware**:

```
Resolve sub for req.user.organizationId.
If isPlatformAdmin → allow.
If route is in ALWAYS_ALLOWED (auth, billing/*, webhooks) → allow.
app = resolve(req.user.appId)  // 'ADMIN' | 'EMPLOYEE'

switch (sub.lock_level) {
  case NONE:  allow;
  case ADMIN: if (app === 'ADMIN')    → block(BILLING_ADMIN_LOCKED) else allow;
  case FULL:  block(SUBSCRIPTION_SUSPENDED);  // both apps
}
```

- **Apply globally** (the guard is already `APP_GUARD`) and rely on an **allow-list** of billing/auth routes rather than decorating every protected route — the inverse of today's unused `@RestrictedOnExpiry()`. (Optionally keep `@AllowOnLock()` as the escape hatch for the billing surface.)
- **Error contract** (extends the existing `SUBSCRIPTION_EXPIRED` shape):
  - `BILLING_ADMIN_LOCKED` → 403, message "Your subscription bill is overdue. Settle the outstanding invoice to restore admin access.", `pay_url`, `invoice_id`.
  - `SUBSCRIPTION_SUSPENDED` → 403, message "Service suspended for non-payment. Pay the outstanding invoice to restore access.", `pay_url`.
- **App resolution:** map `req.user.appId` → app name (`ADMIN`/`EMPLOYEE`). Cache the app-id→name lookup (it's static per environment) to avoid a per-request DB hit.

---

# 10. Notifications

| Event | Channel | Audience |
|---|---|---|
| Renewal invoice ready (D0) | Email + in-app | Billing contact, admins |
| Dunning D+2 / D+5 / D+8 / D+10 | Email + in-app | Billing contact, admins |
| Admin lock applied (D+5) | Email + in-app banner | Admins/owner |
| Full lock / suspended (D+10) | Email + in-app + mobile push | Admins; employees see a "service unavailable — contact admin" screen |
| Payment success / reinstated | Email + in-app | Billing contact, admins |

Reuse the existing `NotificationService` (the trial-reminder cron's `TODO` is wired as part of this work). Each message carries the hosted payment `short_url`.

---

# 11. Configuration

```
billing.ADMIN_LOCK_DAYS        = 5     # D+5 → ADMIN lock
billing.FULL_LOCK_DAYS         = 10    # D+10 → FULL lock / EXPIRED
billing.GRACE_PERIOD_DAYS      = 10    # aligned to FULL_LOCK_DAYS (kept for compat)
billing.RECONCILE_INTERVAL_MIN = 30
billing.PAYMENT_LINK_TTL_HOURS = 24
billing.DUNNING_OFFSETS_DAYS   = [0,2,5,8,10]
```
All thresholds are environment-overridable; **no day-count is hardcoded** in cron logic.

---

# 12. Edge Cases & Rules

1. **Payment during admin lock (D+6):** instant unlock to `ACTIVE`; `admin_locked_at` cleared. Never auto-skip to FULL just because the cron ran.
2. **Payment exactly at D+10 boundary:** event-driven unlock wins; if the enforcement cron and a payment race, the success path is authoritative (re-asserts `ACTIVE`/`NONE`).
3. **Partial/failed payment:** invoice stays `OVERDUE`; lock stage unchanged; dunning continues.
4. **Multiple unpaid invoices:** `D0` = the **oldest** unpaid `due_date` so the clock isn't reset by a newer invoice.
5. **Clock/timezone:** all day math in the org's billing timezone; cron runs once/day so a tenant can't be locked "early" by server-UTC drift.
6. **Plan downgrade pending at renewal:** unaffected — renewal cron already applies `pending_plan_id`; lock logic only cares about payment.
7. **Cancelled mid-grace:** `CANCELLED` exits the overdue pipeline; no further locking.
8. **Trial → never paid:** trials are handled by trial-reminder + expiry as today; overdue locking applies to **paid-tier renewals**, not trials (trials expire to a read-only/upgrade state, not "overdue").
9. **Re-run safety:** every cron is idempotent; `*_locked_at` set-once; dunning deduped by offset ledger.
10. **Platform admin & billing routes always reachable** so a locked tenant can self-serve recovery.

---

# 13. Audit & Observability

- **Billing audit events** (new enum values): `INVOICE_MARKED_OVERDUE`, `BILLING_ADMIN_LOCKED`, `BILLING_FULL_LOCKED`, `BILLING_UNLOCKED`, `PAYMENT_RECONCILED`, `PAYMENT_LINK_CANCELLED` — each with `organization_id`, `subscription_id`, `invoice_id`, `days_overdue`.
- **Structured cron logs** (already the pattern): per-run counts of `{markedOverdue, adminLocked, fullLocked, remindersSent, reconciled}`.
- **Metrics/alerts:** count of orgs in each lock stage; reconciliation mismatches (webhook missed) as a reliability signal; dunning send failures.
- **Out of scope (flagged for a future PRD):** seat/employee-count true-up at renewal (recompute billable headcount), invoice PDF backfill retries.

---

# 14. Rollout / Phasing

| Phase | Deliverable |
|---|---|
| **P1 — Foundations** | Schema: `lock_level`, `bill_due_at`, `admin_locked_at`, `full_locked_at`; config keys; Billing Enforcement cron sets state but guard runs in **log-only/shadow mode** |
| **P2 — Reliability** | Payment Reconciliation + Stale Link Cleanup crons; event-driven unlock on all success paths |
| **P3 — Enforcement** | Upgrade `ActiveSubscriptionGuard` to lock-level + app aware; flip from shadow to enforcing; ship error contracts |
| **P4 — Dunning** | Wire `NotificationService`; dunning cadence + lock/unlock notifications; mobile push for suspension |
| **P5 — Audit/Obs** | Audit events, dashboards, alerts |

Shadow mode in P1 lets us verify the staged transitions against real subscriptions before any customer is actually locked out.

---

# 15. Open Questions

1. **Billing timezone source** — per-organization setting, or a single platform timezone for all day-math? (Affects exact lock moment.)
2. **Admin-lock scope** — block *all* non-billing ADMIN routes, or allow read-only viewing (dashboards) and block only mutating/privileged actions like running payroll?
3. **Employee suspension UX** — hard block with a "contact your admin" screen, or read-only access to already-submitted data (payslips/attendance history)?
4. **Annual plans** — same 5/10-day cadence, or a longer grace given the larger invoice?
5. **Reinstatement window** — after `EXPIRED`, is paying the same invoice always sufficient to reinstate, or does a long lapse require a fresh subscription?
6. **Multiple admins** — dun all org admins or only the designated billing contact?

---

*Generated as a planning document. No code changes implied until phasing is approved.*
