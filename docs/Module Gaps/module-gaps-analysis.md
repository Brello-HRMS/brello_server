# Brello Platform — Module Gap Analysis

**Prepared as:** cross-repo product review (server + webapp)
**Date:** 2026-07-09
**Scope:** all 28 server modules (`brello_server/src/modules`) and all webapp features/pages (`brello_webapp/src/{features,pages}`)
**Method:** code-level review (entities, services, controllers, DTOs, guards, hooks, pages) — every claim below is grounded in a specific file; nothing is inferred from naming alone. This document is mirrored verbatim in both repos (`brello_server/docs/Module Gaps/` and `brello_webapp/docs/Module Gaps/`) so it's visible regardless of which repo someone opens first.

---

## 1. Executive summary

Brello is materially more built than a typical "MVP HRMS" — payroll, billing/subscriptions, RBAC-with-plan-entitlements, letter generation, notifications infrastructure, global search, and audit logging are all **real, working systems**, not stubs. The gaps are not "features don't exist," they're **wiring gaps**: strong infrastructure that most modules don't actually plug into.

Five systemic issues account for the majority of findings across all 28 modules:

1. **RBAC is half-enforced.** A sophisticated permission-resolution engine exists (`rbac/services/permission-resolver.service.ts`), but roughly a third of server modules only check `JwtAuthGuard` (any logged-in user) and never call `AccessGuard`/`@RequirePermission` — so their fine-grained role/plan permissions are decorative, not enforced.
2. **Notification triggers are almost entirely missing.** The notification platform (BullMQ, SSE, email, push) is genuinely complete, but Leave, Payroll, Reimbursement, Holiday, Company Policy, and Announcement never call it. A user can have a leave request approved, a reimbursement paid, or a payslip generated and receive zero notification.
3. **No shared approval-workflow engine.** Leave, attendance corrections, attendance remote-approvals, and reimbursement each hand-roll their own approve/reject state machine. Timesheet has the enum for one but never implemented it. Manager hierarchy (`reports_to_id`) exists on `User` but no approval flow actually routes through it.
4. **Audit logging is inconsistent despite excellent infrastructure.** The `@AuditLog` decorator + `AuditInterceptor` + `AuditContextService` pattern is a genuinely good, broadly-adopted design — but Payroll, Attendance, and Reimbursement each still dual-write to their own legacy audit tables alongside it, and Timesheet has no audit logging at all.
5. **Test coverage is close to zero across both repos.** Outside a handful of spec files (payroll: 4, employee offboarding cron: 1, letter starter-content: 1), no module has meaningful unit test coverage. This is a risk multiplier for everything else in this document.

Two modules are effectively vaporware: **`enterprise-admin`** (empty stub, dead scaffolding in both repos) and **offer-letters/candidate-portal** (folder names only, zero implementation, correctly matching its own PRD's stated status).

---

## 2. Cross-cutting systemic gaps (read this section first)

### 2.1 RBAC enforcement gap

`PermissionResolverService` computes effective permissions as **role grants ∩ plan entitlements**, with WBS-code parent/child propagation — this is well-engineered. But it only matters where a controller actually calls `AccessGuard`/`@RequirePermission`.

**Guarded (enforces role + plan permissions):** attendance (7/8 controllers), leave-request, leave-config, leave-balance, payroll, letter-management, company-policy, holiday, feedback, role, rbac.

**Not guarded (JwtAuthGuard only — any authenticated user can call):** billing, organization, plan, user, departments, designations, industry-type, lead, enterprise, client, app, document, notification, org-setup, timesheet, project, reimbursement.

This means anyone with a valid JWT — regardless of their role's configured `module_access` — can currently hit billing, plan, organization, user, document, project, timesheet, and reimbursement endpoints. This is the single highest-leverage fix in the whole codebase: the engine exists, it just needs to be applied.

### 2.2 Notification triggers gap

**Wired (real `NotificationService.send()` calls):** letter-management (generate/view/download/acknowledge), feedback (create/comment/status-change), attendance (auto-checkout only), employee (invite email only), billing (trial reminders only).

**Not wired (confirmed via grep, zero call sites):** leave-request, leave-balance, leave-config, payroll (only a `Logger.warn` + TODO in `payroll-reminder.cron.ts`), reimbursement, company-policy, holiday, announcement (despite `send_push`/`send_email` fields existing on the entity), project, client, timesheet, document.

Concretely: an employee's leave gets approved/rejected, a reimbursement gets paid, a payslip gets locked, a company policy changes, a new holiday is added — none of these notify anyone today.

### 2.3 No shared approval-workflow engine

Four independent, hand-rolled state machines exist for conceptually the same problem:
- Leave-request: DRAFT/PENDING/APPROVED/REJECTED/CANCELLED, hardcoded in `LeaveRequestService.approve()`/`reject()`.
- Attendance correction-requests: PENDING/APPROVED/REJECTED/CLOSED.
- Attendance remote-approvals: a third, separate PENDING/APPROVED/REJECTED enum.
- Reimbursement: its own `updateStatus`/`markPaid`, independently implemented.
- Timesheet: `TimesheetSubmissionStatus` enum (SUBMITTED/PENDING_APPROVAL/APPROVED/REJECTED) is defined and commented "reserved for the future approval workflow" — but **no service or controller path ever transitions the status**. Every timesheet entry is permanently DRAFT.

None of these route through `reports_to_id` (the manager-hierarchy FK that already exists on `User`) — approver is always a bare `approved_by`/`approver_comment` string field, decided ad hoc per module rather than derived from org structure.

**Recommendation:** extract a generic approval-workflow module (state machine + reviewer resolution + comment capture + audit/notification hooks) and migrate these four/five call sites onto it, then use it to finally implement timesheet approval.

### 2.4 Audit logging: good infra, inconsistent adoption

The `@AuditLog` decorator + global `AuditInterceptor` + `AuditContextService` (pre-value capture) is genuinely well-built and broadly adopted — attendance, organization, leave-balance, rbac, holiday, role, enterprise, plan, platform, departments/designations, user/employee, document, project/client, company-policy, letter-management, leave-config, announcement, leave-request, client, reimbursement, and auth all use it correctly.

Remaining problems:
- **Payroll and Reimbursement dual-write**: both still maintain legacy module-local audit tables (`payroll_audit_logs` via `PayrollAuditService`, `reimbursement_audit_log`) in parallel with the centralized `system_audit_logs` — meaning historical events live in two places and nothing consolidates them.
- **Attendance** also keeps a redundant local `attendance-audit-log.entity.ts` alongside the centralized system.
- **Timesheet has zero audit logging** — no `@AuditLog` usage anywhere in the module.
- **Feedback has no audit-log integration** — only a module-local `feedback_status_logs` table, disconnected from `system_audit_logs`.
- **Billing** is audited only on `SubscriptionController` (change-plan, cancel) — invoice generation, payment events, and billing-profile updates are not audited.
- No CSV/XLSX export endpoint despite this being a stated Phase-1 requirement in the audit PRD, and no DB-level immutability (enforced only at the application layer).

### 2.5 Global search coverage gap

**Indexed:** employee, department, designation, client, project, announcement, company-policy, role, holiday, reimbursement.

**Not indexed:** leave-request, leave-balance/leave-config, payroll, feedback, letter-management, document, attendance, timesheet, billing, lead, notification, audit.

There are ~10 nearly-identical `index*`/`remove*` method pairs in `search-indexing.service.ts` — a config-driven `@Searchable()` pattern (extending the existing `config/searchable-modules.ts`) would prevent modules from being "forgotten," which has already happened repeatedly. Separately, the `permissions` column on the search-document entity is **never applied as a query filter** — a real RBAC-leak risk where search results could surface entities a user's role shouldn't see.

### 2.6 Billing/plan entitlement enforcement has a dead code path

`ActiveSubscriptionGuard` + `@RestrictedOnExpiry()` are fully built and registered globally via `APP_GUARD` — but a full-repo grep found **zero usages of `@RestrictedOnExpiry`** on any route. The guard always passes. The entitlement enforcement that *does* work in practice is a different mechanism entirely: `PermissionResolverService.applyPlanRestrictions()`, which intersects role permissions with `plan_module`/`plan_module_action` rows. So module/action-level plan gating works, but a fully-expired subscription doesn't hard-lock the org at the route level the way the billing module's own purpose-built guard was designed to. This is a low-effort, high-value fix (wire the existing decorator onto routes).

Related: **no seat/employee-cap enforcement** — `Plan` has no numeric limit fields, and `employee-count.service.ts` only counts employees for pricing, not to block hiring past a plan's intended headcount.

### 2.7 Document module is the intended single source of truth, but adoption is partial

`document/services/document.service.ts` is a well-built generic file-storage abstraction (S3 presigned URLs or DB-blob, checksums, versioning, folder-type templating). Project contracts correctly reuse it. **Company Policy does not** — policy content is stored as raw markdown text directly in the DB column, with no `FolderType` entry and no `document_id` reference, so policy attachments/PDFs can't use the shared storage service at all. Reimbursement, feedback, and letter modules have dedicated `FolderType` entries suggesting intended reuse (not independently re-verified at the call-site level in this pass).

### 2.8 Employee data layer duplication in the webapp

Two parallel employee data-access layers exist: `features/users` (older, thinner) and `features/employee` (richer — bank/gov/payroll/leave/assets cards, multi-step wizard). The Department detail page uses the older `features/users` layer while the Employee directory/profile pages use `features/employee`. This is a straightforward consolidation opportunity, not a missing feature.

### 2.9 Manager hierarchy exists but nothing uses it

`User.reports_to_id` is populated but a repo-wide grep shows it's referenced **only inside the `user` module itself**. No approval flow (leave, reimbursement, timesheet) derives an approver from it — every approval is a flat admin/permission-gated action instead of "goes to your manager."

### 2.10 Test coverage

Outside `payroll` (4 spec files), `user/offboarding-cron.service.spec.ts`, and `letter-management/shared/seed/starter-letter-content.spec.ts`, there is **no unit test coverage anywhere** in either repo — including on business-logic-critical services like `permission-resolver.service.ts`, `payroll-calculation.service.ts`, and the entire billing/subscription state machine (which is cron-driven and therefore especially risky without tests).

---

## 3. Per-module findings

### 3.1 Identity, Access & Platform Admin

**auth** — Full password + OTP login, forgot/reset, refresh, logout, switch-app, plus a fully separate platform-admin auth flow. Real audit-event emission on login/logout (a good example other modules should copy). Gaps: `refreshToken()` generates the new token via `Math.random().toString(36)` — non-cryptographic randomness for a security-critical token; no rate-limiting/`@Throttle` on login/OTP endpoints (brute-force risk); `Session` entity has no `ip_address`/`user_agent` columns despite that context being available; no MFA/SSO/SAML; no session-management UI. `AuthService` and `RBAC`'s `PermissionResolverService` each independently compute "which apps/roles does this user have" — a duplication risk.

**rbac** — The best-engineered module in the codebase (see §2.1). `hasPermission()` re-runs the full multi-repository resolution pipeline for a single boolean check with no caching. No field-level permissions, no permission-change audit diff, no delegated/scoped admin.

**role** — Full CRUD with system-role protection, plus a parallel platform-template-role system with app associations. `Role` entity has no `description` column despite the DTO/UI collecting one (unverified whether it's silently dropped). No role clone/duplicate action in the UI.

**platform** — Narrower than its name suggests: only covers default department/designation catalog CRUD (`is_default: true` seed data for org-setup). The much larger "Platform Admin" webapp surface (apps, modules, plans, enterprises, leads, roles) is backed by other modules (`app`, `plan`, `enterprise`, `lead`, `organization`), not `platform/` itself. No org-level feature-toggle escape hatch exists outside the plan/entitlement system.

**enterprise-admin** — **Empty stub in both repos.** Dead scaffolding, superseded by `platform`/`enterprise`. Recommend deleting rather than treating as in-progress.

### 3.2 Organization Structure

**organization** — `setupCompany()` is a large, well-built onboarding transaction (enterprise + org + profile + cloned roles + trial subscription + default payroll component + departments/designations + starter letter templates). Gaps: `debugUser`/`repairEnterpriseIds` are hardcoded-email debug/remediation methods left in the service — verify they're not reachable via an unguarded route. `OrganizationProfile.parent_id` (org hierarchy) is written but never read anywhere — no tree endpoint, no UI consumer, effectively dead.

**org-setup** — `getSetupStatus()` computes a 7-step onboarding checklist by counting rows. **`OrgSetupCron` is a scheduled no-op** — registered `@Cron(EVERY_DAY_AT_MIDNIGHT)` but its body is entirely a comment describing "future implementation." The checklist also never tracks Leave/Attendance config as seeded, so it can show incomplete indefinitely with no automated remediation path.

**departments** — Solid CRUD, org-scoped uniqueness, soft delete, search-indexed. Explicit `// TODO (Phase 2): Block deletion if active employees are assigned` — deletion currently proceeds even with employees still mapped, an orphaning risk. Flat single-level only, no sub-department hierarchy, no department head/owner field. Webapp: `DepartmentDetailPage.tsx`'s Export button has no click handler; the page uses the older `features/users` data layer instead of `features/employee` (see §2.8); leftover hardcoded `DUMMY_EMPLOYEES` fixture worth a dead-code check.

**designations** — Good CRUD parity with departments, including immutable code-on-update. `department_id` is a bare UUID column with no `@ManyToOne` relation object (inconsistent with how `User → Department` is modeled), so it can't be eager-loaded the same way. `level`/seniority is free text, no structured career-ladder concept.

**industry-type** — Minimal, intentionally so. Actually has a better-designed delete guard (`countOrgsUsing()`) than Departments does. No gaps found.

**enterprise** — Platform-admin-only tenant model with transactional creation and app-entitlement mapping. Performs a **live DNS resolution** (`dns.promises.resolve`) synchronously during creation — a real external-network call in a request path with no retry/fallback; creation fails if DNS is transiently unreachable.

**user / employee** — The richest module in the codebase: full employee lifecycle including onboarding invite, activation, education/experience/assets/documents, emergency contacts, and a genuine offboarding flow (the one module with an actual test file). Gaps: `reports_to_id` unused elsewhere (§2.9); no bulk import/export anywhere in org-structure features (confirmed via grep); `OffboardedEmployeeProfile.tsx` has a hardcoded `"18 LPA"` placeholder in a real screen, not gated behind test data.

**Missing across this domain:** org-chart/hierarchy visualization (zero grep hits anywhere), department/designation manager assignment, multi-location/branch support (`OrganizationProfile` has exactly one address), bulk import/export.

### 3.3 Attendance, Leave & Time

**attendance** — Comprehensive backend: geo-fenced check-in/out, shift/weekly-off/rule management, remote clock-in approval, correction-request disputes, and a daily materialization/auto-checkout cron engine. Real notification and audit integration. Gaps: `overtime_multiplier` is defined but never consumed in calculation logic (dead field); the standalone geo-fence `/validate` preview endpoint omits `departmentId` while the real check-in path includes it, producing possible preview/actual mismatches; no unassign/delete endpoint for rule assignment. **Frontend is severely behind the backend**: `EmployeeProfilePage.tsx` renders a hardcoded mock attendance log instead of calling the working history endpoint; `GeoFencingPage.tsx` is a literal "Under Development" placeholder despite a fully working backend; remote-approvals and correction-requests have **no frontend at all**; several list-page buttons (filter/sort/export) have no click handlers.

**leave-request** — Most complete leave module: full create/submit/approve/reject/cancel lifecycle with billable-day computation (weekends, holidays, sandwich rule, half-days), synced into attendance materialization. Biggest gap: **no employee self-service "apply for leave" UI exists at all** — `employeeRoutes.tsx` has zero leave routes; the backend fully supports employee-initiated requests but only admin routes are registered. Inline approve/reject in the list view sends hardcoded comment strings instead of a real reason. A page hardcodes "You have 7 Pending Leave Requests" regardless of actual count.

**leave-balance** — Initialize/adjust/recompute/ledger all implemented. Carry-forward exists as a mechanism but has **no scheduled year-end trigger** — it's a manual admin action, not automated policy. Accrual-type enum mismatch between backend (`'none' | 'monthly'`) and a frontend type that also allows `'yearly'`.

**leave-config** — Draft→activate lifecycle with validation; the most "finished" of the three leave modules.

**holiday** — Mature: calendar CRUD with activate/clone lifecycle, real push into attendance materialization, correctly excludes holidays from leave-request billable days. No region/location field, so multi-region calendars aren't structurally possible. Webapp never calls the backend's edit-holiday/deactivate-calendar/clone-calendar endpoints — reachable capability stuck behind a missing UI.

**timesheet** — Weakest-integrated module of the six: entries are permanently DRAFT (no approval workflow despite full enum scaffolding, see §2.3), zero audit logging, zero notification hits, zero references from payroll/reimbursement/billing (confirmed via grep), no timer/clock feature, no task-level tracking. Also uses `user_id` as its FK where attendance/leave use `employee_id` on the same underlying entity — an inconsistent convention. Lives under `features/project/`/`pages/project/timesheet/` rather than a standalone feature area, and its calendar UI pulls in a separate third-party library rather than reusing internal date components.

**Missing across this domain:** shift-swap requests, overtime approval workflow, comp-off (leave and attendance both lack it), leave encashment, team leave/attendance calendar views, biometric integration (only an unused enum value exists for it).

### 3.4 Payroll & Finance

**payroll** — A genuinely complete, working engine, not a migration-in-progress: versioned salary structures with auto-balancing residual components, Draft→Processing→Completed→Locked payroll runs (one per org/month/year, DB-enforced), real payslip PDFs to S3. Statutory compliance is **PF-only** — ESI, TDS/income tax, and Professional Tax are entirely absent (zero grep hits). Confirmed real cross-module integration: attendance/leave feed LOP calculation directly, approved reimbursements are folded into net pay and marked paid on lock. Gaps: reminder cron only logs a warning instead of notifying (explicit TODO); thin test coverage on the core calculation engine; dual audit-logging (legacy `PayrollAuditService` + centralized system); hardcoded `currency: 'INR'`.

**reimbursement** — Single-step submit → admin approve/reject/pay flow with optimistic locking and correct reuse of the shared Document module for receipts. Admin endpoints are RBAC-unguarded (JwtAuthGuard only — see §2.1). No expense categories at all, no multi-level approval matrix, no spend limits/policies.

**billing** — Surprisingly complete: GST-aware invoicing, Razorpay integration (orders, hosted payment links, idempotent webhook handling), sequential invoice numbering, PDF generation, and real trial-reminder notifications (T-7/T-3/T-1). The subscription-expiry hard-lock guard is dead code (§2.6). No dunning/payment-retry flow, no multi-currency, no proration on mid-cycle upgrades, no notifications for invoice/payment events beyond trial reminders, audit coverage limited to subscription change/cancel only.

**plan** — Entitlement model (role ∩ plan) is genuinely well-designed and is the mechanism that actually enforces plan-based access (see §2.6). No seat/employee-cap enforcement, no structured/typed feature-flag schema (`feature: string[]` is free text), no plan versioning — editing a live plan mutates it in place, retroactively affecting all current subscribers.

**Missing across this domain:** ESI/TDS/PT statutory compliance, tax-regime selection, multi-currency payroll, statutory filing exports, Full & Final settlement, gratuity calculation, expense categories, multi-level reimbursement approval, dunning/payment-failure retry, seat-based plan limits.

### 3.5 Letters & Recruitment

**letter-management** — A solid, mostly-complete v1 that correctly respects its documented architectural boundary: `IssuedLetter` stores fully-materialized snapshots with no direct entity relation to `User` (verified via grep), and generation events genuinely fire both notifications and audit logs — this module is the best cross-module-wiring example in the codebase. Gaps: variable registry only implements ~12 of the ~20 variables specified in its own PRD (missing `reporting_manager`, `PAN`, `work_location`, etc. — blocks accurate relieving/experience letters); the "admin fills in missing fields" UI flow from the PRD was never built (generation is simply disabled instead of showing an override form, even though the DTO/type support it); template preview uses a separate hardcoded sample-value path instead of the real render pipeline, so preview and actual generation can silently drift.

**lead** — Not a recruitment pipeline — this is a **SaaS product-signup/sales-lead** module (someone signing up for a Brello tenant), unrelated to hiring. Converting a lead to a user creates a bare `User` account with no employee/org-membership record. A `TODO: Remove OTP logging before production` currently leaks OTPs to logs in all environments. No UI counterpart found in the webapp.

**offer-letters / candidate-portal** — **0% implemented.** No backend module exists at all (confirmed via grep across the entire server). The webapp's `features/offer-letters/` and `pages/candidate-portal/` are empty directory trees — component folder names only (`WizardLayout`, `RevisionDialog`, `ActivityTimeline`, etc.), matching the module's own PRD, which explicitly documents this as unbuilt-beyond-scaffolding. One tangential, disconnected item: the employee onboarding wizard has a static "OFFER_LETTER" document-upload slot with no relation to any generation/e-signature flow — worth reconciling once the real module is built to avoid duplication.

### 3.6 Communication, Search & Audit

**announcement** — Full CRUD, targeting types (ALL/DEPARTMENT/LOCATION/EMPLOYEE), read tracking. `findDueScheduled()` exists but nothing ever calls it — scheduled announcements never auto-publish. `LOCATION`-targeted announcements are never actually matched in the employee-facing query, making them invisible. No notification dispatch on publish despite `send_push`/`send_email` fields existing. No targeting-picker UI (department/location/employee) — non-ALL targeting is unusable from the UI. No HTML sanitization on rich-text content.

**notification** — The platform itself (BullMQ, SSE, email/push workers, DLQ) is genuinely complete and well-built. The gap is entirely about adoption by other modules (§2.2). Only ~19 event types exist vs. ~40+ in its own PRD; a dev-only test endpoint still has a "remove before production" TODO; no digest/batching.

**feedback** — Largely matches its PRD: dual-track feedback/issue-report ticketing with status transitions, attachments, internal notes. Notifications are wired (a positive example), but audit logging is **not** — only a module-local status log, disconnected from the centralized system. Admin notification routing is a single hardcoded env var, not real team routing. A naming mismatch exists between backend permission code (`FEEDBACK_REPORT`) and frontend module codes (`SUPPORT_FEEDBACK`/`SUPPORT_REPORT`) that don't appear in any RBAC seed.

**global-search** — More complete than its own PRD status table suggests (Postgres FTS/trigram, working Cmd+K UI), but indexing is synchronous fire-and-forget rather than the BullMQ design the PRD specifies (a documented, deliberate deviation). See §2.5 for the RBAC-leak risk and coverage gaps. Employee reindexing only triggers on name change, not department/designation reassignment, so subtitles go stale.

**audit** — Real, implemented system (not just a PRD on paper) with a genuinely reusable decorator/interceptor pattern. See §2.4 for adoption gaps. No export/compliance reporting, no retention/partitioning, no DB-level immutability enforcement (app-layer only), and the legacy payroll/attendance/reimbursement audit tables were never consolidated/backfilled into the new system as originally planned.

### 3.7 Projects, Clients & Documents

**project** — Full CRUD, team assignment, and contract uploads that correctly reuse the Document module (a good proof that the intended reuse pattern works when adopted). No budget/rate/cost fields anywhere — no cost tracking at all. No resource-allocation/utilization concept (team membership has no allocation percentage).

**client** — Simple directory CRUD. No billing/invoicing fields at all (no currency, payment terms, contract value), no client portal/external access.

**Project/Client → Billing gap (significant):** the `billing` module is entirely SaaS-subscription billing for Brello's own tenants — there is **no time-to-invoice pipeline** at all. Timesheet entries are never converted into billable line items against a client/project invoice, despite the product having both project/client management and a billing engine.

**company-policy** — Full CRUD with typed categories and search indexing. Content is stored as raw markdown text directly in the DB, not through the Document module (§2.7) — so policy PDFs/attachments can't use shared storage. No version history (updates overwrite in place). **No acknowledgment/read-receipt tracking at all** — an acknowledgment pattern already exists in the codebase (letter-management's delivery-status concept) but isn't reused here. No onboarding linkage — new hires aren't shown or required to accept policies.

**document** — Well-built generic storage abstraction (S3 or DB-blob, checksums, folder-type templating, HMAC-signed view URLs). `version` column exists but nothing increments it or exposes version history — a dead field. No expiry/renewal concept despite being a natural fit for contracts.

**queue** — A thin BullMQ producer-registration layer that, in practice, is entirely notification-delivery infrastructure — it processes no project/client/policy/document jobs. No job exists for contract-expiry reminders, policy-acknowledgment nudges, or timesheet-submission reminders, even though the queue infrastructure to support them already exists and is idle.

**Missing across this domain:** client/project → invoice pipeline, timesheet approval (see §2.3), policy version history + acknowledgment tracking, client portal, document expiry/renewal reminders, project resource-utilization reporting.

---

## 4. Reuse opportunities (prioritized)

1. **Generic approval-workflow engine.** Replace four/five duplicated state machines (leave-request, attendance corrections, attendance remote-approvals, reimbursement, and the never-implemented timesheet one) with one shared module: state machine + reviewer resolution (ideally via `reports_to_id`) + comment capture + audit/notification hooks built in. Immediately unblocks timesheet approval.
2. **Domain-event fan-out pattern.** Right now, any module that wants to notify + audit-log + search-index a business event has to manually call three separate services (and most only call one, if any). A lightweight "emit domain event → fan out to notification/audit/search" pattern (the codebase already uses `EventEmitter2` internally for SSE) would turn "we forgot to wire notifications for X" from a recurring bug into a structural non-issue.
3. **Document module as universal storage.** Extend `FolderType` to cover Company Policy (and confirm/complete it for reimbursement/feedback/letters), so there's exactly one file-storage code path instead of ad hoc raw-content columns.
4. **Generic acknowledgment/read-receipt entity.** Letter-management already has a delivery/acknowledgment concept; extracting it into a shared `Acknowledgment` entity (subject type + subject id + user id + timestamp) would serve Company Policy and Announcements consistently instead of leaving both without any tracking.
5. **Apply the RBAC engine everywhere (§2.1).** The permission-resolution engine is built; it just needs `AccessGuard`/`@RequirePermission` added to the ~17 currently-unguarded controllers. This is the highest security-value, lowest-effort item in this entire review.
6. **Wire the existing `@RestrictedOnExpiry` guard (§2.6).** Already built, already registered globally, currently unused anywhere.
7. **Consolidate the webapp's two employee data layers** (`features/users` vs `features/employee`) so every screen (including Department detail) uses the richer, canonical one.

---

## 5. Suggested priority roadmap

**P0 — security & correctness (low effort, high impact):**
- Apply `AccessGuard`/`@RequirePermission` to the ~17 unguarded controllers (billing, plan, organization, user, document, project, timesheet, reimbursement, etc.).
- Fix `refreshToken()`'s non-cryptographic randomness; add rate-limiting to auth/OTP endpoints; remove the OTP-logging TODO in `lead.service.ts`.
- Wire `@RestrictedOnExpiry()` onto routes so expired subscriptions actually lock out.
- Filter global-search results by the existing `permissions` column.
- Fix the department-deletion orphaning gap (block delete while employees are assigned) and the announcement `LOCATION`-targeting matching bug.

**P1 — close the notification/audit/approval gaps:**
- Wire notifications for leave approve/reject, reimbursement approve/pay, payroll lock, holiday changes, and company-policy changes.
- Build the generic approval-workflow engine and migrate leave/attendance/reimbursement onto it; use it to finally implement timesheet approval.
- Consolidate legacy payroll/attendance/reimbursement audit tables into `system_audit_logs`; add audit logging to timesheet and feedback.
- Build the missing employee-facing leave "apply for leave" UI (backend already supports it).

**P2 — complete high-value half-built features:**
- Complete letter-management's variable registry and missing-field override UI.
- Build a timesheet → invoice pipeline connecting project/client/billing.
- Add ESI/TDS/PT to payroll's statutory compliance.
- Add company-policy version history + acknowledgment tracking + onboarding linkage.
- Decide the fate of `enterprise-admin` (delete) and offer-letters/candidate-portal (build per its existing PRD, or explicitly deprioritize).

**P3 — foundational hygiene:**
- Start unit-testing the highest-risk business logic first: `permission-resolver.service.ts`, `payroll-calculation.service.ts`, and the billing/subscription cron state machine.
- Consolidate `features/users`/`features/employee` in the webapp.
- Add org-chart visualization, bulk import/export, and multi-location support to the org-structure domain.

---

## 6. Module status matrix

| Module | Backend maturity | RBAC-guarded | Notification-wired | Audit-wired | Search-indexed | Tests |
|---|---|---|---|---|---|---|
| auth | High | n/a (own guards) | n/a | Yes | n/a | No |
| rbac | High | Yes (is the engine) | n/a | Partial | n/a | No |
| role | High | Yes | No | Yes | Yes | No |
| platform | Medium (narrow scope) | Platform-admin only | No | Yes | n/a | No |
| enterprise-admin | **None (empty stub)** | n/a | n/a | n/a | n/a | n/a |
| organization | High | **No** | No | Yes | n/a | No |
| org-setup | Medium (cron is no-op) | **No** | No | n/a | n/a | No |
| departments | High | **No** | No | Yes | Yes | No |
| designations | High | **No** | No | Yes | Yes | No |
| industry-type | High (minimal scope) | **No** | No | n/a | n/a | No |
| enterprise | High | Platform-admin only | No | Yes | n/a | No |
| user/employee | High | **No** | Partial (invite only) | Yes | Yes | Partial (offboarding) |
| attendance | High (backend) / Low (frontend) | Yes (mostly) | Partial | Yes (+legacy dup) | No | No |
| leave-request | High | Yes | **No** | Yes | No | No |
| leave-balance | High | Yes | No | Yes | No | No |
| leave-config | High | Yes | No | Yes | No | No |
| holiday | High | Yes | No | Yes | Yes | No |
| timesheet | Medium (no approval flow) | **No** | **No** | **No** | No | No |
| payroll | High | Yes | No (TODO only) | Yes (+legacy dup) | No | Partial (4 specs) |
| reimbursement | Medium | **No** | No | Yes (+legacy dup) | Yes | No |
| billing | High | Yes | Partial (trial only) | Partial | No | No |
| plan | High | Yes | n/a | Yes | n/a | No |
| letter-management | High | Yes | Yes | Yes | No | Partial (1 spec) |
| lead | Medium (security TODO) | Platform-admin only | No | n/a | No | No |
| offer-letters/candidate-portal | **None (scaffolding only)** | n/a | n/a | n/a | n/a | n/a |
| announcement | High | n/a | **No** | Yes | Yes | No |
| notification | High (platform itself) | n/a | n/a (is the engine) | n/a | No | No |
| feedback | High | n/a | Yes | **No** | No | No |
| global-search | Medium (RBAC-leak risk) | n/a | n/a | n/a | n/a (is the engine) | No |
| audit | High | n/a | n/a | n/a (is the engine) | No | No |
| project | High | **No** | No | Yes | Yes | No |
| client | Medium | **No** | No | Yes | Yes | No |
| company-policy | Medium (no versioning/ack) | Yes | No | Yes | Yes | No |
| document | High | **No** | n/a | Yes | No | No |
| queue | Low (single-purpose only) | n/a | n/a | n/a | n/a | No |

**Bold** = confirmed gap worth prioritizing.
