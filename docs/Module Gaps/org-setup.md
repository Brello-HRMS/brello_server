# Module: Org Setup

## 1. Purpose & Current Usage

- **Files**: `org-setup.module.ts`, `org-setup.controller.ts`, `org-setup.service.ts`, `org-setup.cron.ts`. No entities, DTOs, or repositories of its own — it is a thin read-only aggregator over seven *other* modules' repositories (`Department`, `Designation`, `CompanyPolicy`, `PayrollComponent`, `SalaryTemplate`, `LeaveConfig`, `AttendanceRule`, `User`, `Organization`), injected via `TypeOrmModule.forFeature([...])` in `org-setup.module.ts:19-29`.
- Despite the name "org-setup," this module does **not** seed or bootstrap anything. `OrgSetupService.getSetupStatus()` (`org-setup.service.ts:50-91`) runs seven parallel `.count()` queries against org-scoped tables and returns a `{ totalSteps, completedSteps, completionPercentage, steps }` checklist (`DEPARTMENTS`, `DESIGNATIONS`, `COMPANY_POLICIES`, `PAYROLL`, `LEAVE`, `ATTENDANCE`, `EMPLOYEES`).
- The only entry point is `GET /organization/setup-status`, exposed by `OrgSetupController` (`org-setup.controller.ts:12-18`), guarded by `JwtAuthGuard`, scoped to `user.organizationId`.
- **Callers — this is load-bearing, not just a decorative widget:**
  - `brello_webapp/src/features/dashboard/api/orgSetup.ts:19` — `fetchOrgSetupStatus()` calls the endpoint directly.
  - `brello_webapp/src/features/dashboard/hooks/useOrgSetupStatus.ts:7-16` — wraps it in a React Query hook (`ORG_SETUP_STATUS_QUERY_KEY`, 5-min `staleTime`).
  - `brello_webapp/src/features/dashboard/components/SetupGuide/SetupGuide.tsx:5,10,32-33` — dashboard checklist widget that hides itself once `completionPercentage === 100`.
  - `brello_webapp/src/features/dashboard/components/ClockInCard/ClockInCard.tsx:6,39,46` — disables the clock-in button while setup is incomplete and status is still loading.
  - `brello_webapp/src/features/sidebar/Sidebar.tsx:20,123,126-129` — computes `isSetupIncomplete` to alter sidebar behavior for admin users.
  - `brello_webapp/src/components/common/SetupGuard/SetupGuard.tsx:5,27,33,44-46` — **route gate**: if `isAdmin && completionPercentage < 100` and the current path isn't in the `SETUP_FREE_PATHS` allowlist (`SetupGuard.tsx:11-21`), it renders `SetupRequiredBlocker` instead of the requested page. This means the entire admin app's navigation is gated on this endpoint's response, not merely a dashboard decoration.
- **Dead part**: `OrgSetupCron` (`org-setup.cron.ts:9-34`) is registered as a provider (`org-setup.module.ts:32`) and runs `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` (`org-setup.cron.ts:22`), but `checkOrgSetupProgress()` only logs two lines (`org-setup.cron.ts:24,32`) and does nothing else — confirmed still true.

## 2. Intended / Ideal Usage

The TODO comment block in `org-setup.cron.ts:26-30` spells out the intended behavior verbatim:

```
// Future implementation:
// 1. Fetch organizations created within the last 14 days.
// 2. Loop through and call getSetupStatus(org.id)
// 3. If completionPercentage < 100 and created > 3 days ago, emit nudge event.
// 4. E.g. if (!steps.EMPLOYEES) -> NotificationQueue.ADD_EMPLOYEE_NUDGE
```

So the cron was meant to be a lifecycle nudge job: find recently-created orgs (within 14 days) whose setup checklist is still incomplete after a 3-day grace period, then emit a per-missing-step notification (e.g., "you haven't added employees yet") through some `NotificationQueue`. The docstring above the method (`org-setup.cron.ts:18-21`) says the same thing: "check for organizations that haven't completed their setup or haven't added employees after 3 days."

## 3. Cross-Module Connections

**Depends on (read-only, via TypeORM repos registered in `org-setup.module.ts:19-29`):**
- `departments` (`Department` entity)
- `designations` (`Designation` entity)
- `company-policy` (`CompanyPolicy` entity)
- `payroll` (`PayrollComponent`, `SalaryTemplate` entities)
- `leave-config` (`LeaveConfig` entity)
- `attendance` (`AttendanceRule` entity)
- `user` (`User` entity, for employee count)
- `organization` (`Organization` entity — only used by the cron, and even there it's injected but never queried; see Gaps)

**Depended on by:**
- `brello_webapp` dashboard/sidebar/route-guard components listed in §1 (via `GET /organization/setup-status`).
- No other backend module imports `OrgSetupService` beyond its own controller/cron; `org-setup.module.ts:33` exports it but nothing in `app.module.ts` besides `OrgSetupModule` itself consumes the export.

**Missing/expected connections:**
- `notification` module exists at `brello_server/src/modules/notification/notification.module.ts` but `OrgSetupCron` never imports or injects anything from it — the TODO's "emit nudge event" / `NotificationQueue.ADD_EMPLOYEE_NUDGE" has no corresponding queue, event, or notification-module wiring anywhere in the codebase.
- The cron injects `Organization` repo (`org-setup.cron.ts:14-15`) presumably to do step 1 of the TODO ("fetch organizations created within the last 14 days") but never calls `this.orgRepo.find(...)` — the dependency is dead weight.
- There's no mechanism to notify org **admins** (as opposed to nudging the org as a whole) — no `User`/admin-role join is present anywhere in this module, so even a completed cron implementation would need new code to resolve "who is the admin to email."

## 4. Gaps

### Structural

- **No module boundary of its own; it's a cross-cutting read aggregator with a `Module` wrapper.** `org-setup.module.ts:19-29` pulls in 8 entities from 7 different feature modules directly rather than depending on those modules' own services — a layering violation where `org-setup` reaches past service boundaries straight into other modules' repositories. This matters because any schema change in departments/designations/payroll/etc. (e.g., renaming `is_deleted` or `is_active`) silently breaks this module with no compile-time link back to the owning module's public API.
- **Hardcoded `totalSteps = 7`** (`org-setup.service.ts:81`) is decoupled from the actual `steps` object shape (`org-setup.service.ts:71-79`); adding/removing a checklist item requires remembering to update this constant in two places. Low risk today but a latent inconsistency bug waiting to happen.

### Coding

- **The cron is entirely inert dead code.** `org-setup.cron.ts:22-33` — `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` fires daily but `checkOrgSetupProgress()` does nothing but log; both injected dependencies (`orgSetupService`, `orgRepo`) are unused inside the method body. This matters because it silently gives the impression (to anyone reading provider lists or logs) that org lifecycle nudging is live, when it isn't — a false sense of completeness plus a genuinely wasted daily cron tick.
- **Unused `orgRepo` injection is uncaught dead code** — `org-setup.cron.ts:14-15` injects `Repository<Organization>` that is never referenced in the class body, which a stricter lint/`noUnusedLocals`-style check would normally catch; it went unnoticed because it's a constructor param, not a local variable.
- **No error handling in the cron** — `checkOrgSetupProgress()` has no try/catch; since it currently does nothing this is moot, but it's the kind of gap that gets forgotten once the TODO is implemented and iterates over N organizations (one bad org shouldn't kill the whole cron run).

### Technical

- **No test coverage.** There is no `org-setup.service.spec.ts`, `org-setup.controller.spec.ts`, or cron spec anywhere under `brello_server/src/modules/org-setup/` — confirmed by the `find` listing in §investigation showing only the four source files, no `*.spec.ts`. Given this endpoint gates route access app-wide (via `SetupGuard.tsx`), a regression here (e.g., a miscounted step) could lock admins out of legitimate pages with zero test safety net.
- **No caching/memoization on `getSetupStatus`** — `org-setup.service.ts:50-69` fires 7 separate `COUNT` queries on every call; the webapp calls this from four different components (Sidebar, ClockInCard, SetupGuide, SetupGuard) simultaneously on page load, all of which share the same React Query key so client-side dedup helps, but repeated navigations still re-trigger 7 counts server-side with no server-side caching. At current scale this is likely fine, but it's the module's only real read path and is now on the hot path for every admin page load.
- **No structured logging/observability beyond two static log lines** — `org-setup.cron.ts:24,32` — there's no metric or log of *how many* organizations were checked, how many were nudged, or any outcome, so once implemented there would be no operational visibility into whether the nudge job is actually doing anything.

## 5. Top 3 Priorities

1. **Decide the cron's fate: implement it or remove it.** It's been sitting as a no-op daily cron with a fully-specified TODO (`org-setup.cron.ts:26-30`) and an unused `Organization` repo injection — either wire it to the `notification` module to deliver the "add employee" nudge it was designed for, or delete the cron/provider to stop misleading future readers and stop the pointless daily invocation.
2. **Add test coverage for `getSetupStatus`, especially the `steps` boolean logic.** Because `SetupGuard.tsx` uses `completionPercentage < 100` to block navigation across the entire admin app, any bug in the count queries or the hardcoded `totalSteps = 7` (`org-setup.service.ts:81`) has an outsized blast radius — locking real users out of the product — yet there isn't a single spec file for this module.
3. **Break the direct repository coupling to 7 other modules.** `org-setup.module.ts:19-29` bypasses each owning module's service layer; introducing a small "setup check" method exported from each owning module (or an event/query-bus pattern) would decouple schema changes in departments/payroll/etc. from silently breaking this aggregator.
