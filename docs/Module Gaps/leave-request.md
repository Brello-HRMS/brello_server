# Module: Leave Request

## 1. Purpose & Current Usage

- The module implements the employee-facing leave lifecycle: create/draft leave requests, submit for approval, edit drafts/pending requests, cancel (self or admin), and the approver-facing approve/reject flow. It computes billable days (weekends, public holidays, sandwich rule, half-day), holds/releases/consumes leave balance, and keeps an append-only status-transition history.
- Core files:
  - Entity: `brello_server/src/modules/leave-request/entities/leave-request.entity.ts`
  - History entity: `brello_server/src/modules/leave-request/entities/leave-request-history.entity.ts`
  - Service (all business logic): `brello_server/src/modules/leave-request/services/leave-request.service.ts`
  - Controller: `brello_server/src/modules/leave-request/controllers/leave-request.controller.ts`
  - Repositories: `brello_server/src/modules/leave-request/repositories/leave-request.repository.ts`, `.../repositories/leave-request-history.repository.ts`
- Callers today:
  - `LeaveRequestController` (`brello_server/src/modules/leave-request/controllers/leave-request.controller.ts:32-193`) exposes `POST /leave-requests`, `POST /validate`, `GET /me`, `GET /pending-approval`, `GET`, `GET /:id`, `GET /:id/history`, `PATCH /:id`, `POST /:id/submit`, `POST /:id/cancel`, `DELETE /:id`, `POST /:id/approve`, `POST /:id/reject`, `POST /:id/admin-cancel`. All are wired into `AuditLog` decorators for audit trail.
  - `LeaveRequestModule` is registered in `app.module.ts`; no other backend module imports `LeaveRequestService` — confirmed via repo-wide grep, only `app.module.ts` references it.
  - Two other modules read the `leave_requests` table directly (bypassing the service): `AttendanceMaterializationService` (`brello_server/src/modules/attendance/services/attendance-materialization.service.ts:65-66,258,322`) injects the `LeaveRequest` repository directly to sync/reverse `ON_LEAVE` attendance status; `payroll-source.repository.ts` (`brello_server/src/modules/payroll/repositories/payroll-source.repository.ts:57-58,186`) queries `LeaveRequest` with `status: APPROVED` directly for LOP-source data.
- Dead/unused code: in `approve()` (`leave-request.service.ts:632-654`), `projected`/`projectedAfterMove` are computed and then explicitly discarded with `void projectedAfterMove;` (line 654) — the real balance check uses a separately-computed `newAvailableAfterApprove`. The first computation is inert.

## 2. Intended / Ideal Usage

- Approver resolution should route a pending request to the employee's actual chain of authority (direct manager, then HR/escalation) so only the relevant people can act on it; approve/reject today authorize purely on a flat RBAC permission (`LEAVE_REQUESTS:approve`), with no concept of "is this approver responsible for this employee."
- Every state transition (submit, approve, reject, cancel, admin-cancel) should notify the relevant parties (employee on approve/reject/admin-cancel, approver/HR on submit) via the existing `NotificationService` pattern already used elsewhere in the codebase (e.g. `modules/feedback/services/feedback.service.ts`, `modules/attendance/services/auto-checkout.service.ts`, `modules/auth/services/auth.service.ts`).
- Cancelling an approved leave should restore only the balance actually not yet consumed — i.e., distinguish "future, unconsumed" approved leave from leave that has partially or fully elapsed — rather than blindly crediting back the full `total_days`.
- Half-day requests on the same calendar date but opposite slots (`FIRST_HALF` + `SECOND_HALF`) should be permitted to coexist, since together they represent a normal full working day split across two requests/leave types.

## 3. Cross-Module Connections

- Depends on:
  - `LeaveBalanceService` (`leave-balance` module) — hold/release/consume balance and ledger writes (`leave-request.service.ts:67, 926-1028`).
  - `leave-config` module entities `LeaveType`, `LeaveConfig`, `LeaveRules` — policy source for half-day rules, backdating limits, max-per-month, sandwich rule (`leave-request.service.ts:14-16, 1032-1078`).
  - `User` entity (`user` module) — approver/employee name lookups only, no manager/hierarchy field exists on `User` at all (confirmed via grep: no `manager_id`/`reporting_manager_id` field in `modules/user/entities/user.entity.ts`).
  - `Holiday`/calendar (`holiday` module) — public-holiday dates for billable-day computation (`leave-request.service.ts:1081-1096`).
  - `AttendanceMaterializationService` (`attendance` module) — post-commit, best-effort sync/reverse of `ON_LEAVE` attendance status on approve/cancel (`leave-request.service.ts:726-732, 910-921`).
  - `AuditContextService` — pre-value snapshotting for audit diffing on update/delete (`leave-request.service.ts:248, 416`).
- Depended on by:
  - Nothing imports `LeaveRequestService` itself outside `app.module.ts`. `attendance-materialization.service.ts` and `payroll-source.repository.ts` both read the `LeaveRequest` entity/table directly rather than going through the service — a direct-entity coupling across module boundaries rather than a service-level dependency.
- Missing/expected connections:
  - **No `NotificationService` reference anywhere in the module** — confirmed via `grep -rn "NotificationService\|notification" modules/leave-request/` returning zero matches. Submit, approve, reject, cancel, and admin-cancel all complete silently with no notification to the employee, approver, or HR.

## 4. Gaps

### Structural
- No approver/manager-hierarchy abstraction: approve/reject authorization is a single flat RBAC permission (`LEAVE_REQUESTS:approve`, checked in `AccessGuard` via `core/guards/access.guard.ts:44-77`) with no scoping to the requester's team or reporting line — evidenced by the absence of any manager field on `User` and by `approve()`/`reject()` in `leave-request.service.ts:596-799` only checking `request.employee_id === user.userId` (self-approval) and org match, never a manager relationship. This means any org-wide holder of the approve permission can act on any employee's leave, with no delegation/escalation model.
- Cross-module coupling via direct entity access instead of a service API: `AttendanceMaterializationService` and `PayrollSourceRepository` both inject the `LeaveRequest` TypeORM repository directly (`attendance-materialization.service.ts:65-66`, `payroll-source.repository.ts:57-58`) rather than calling a read method on `LeaveRequestService`/`LeaveRequestRepository`, so any future change to `LeaveRequest`'s shape or status semantics must be replicated in three places.

### Coding
- **Zero notifications on any state change** — confirmed: `grep -rn "NotificationService\|notification" modules/leave-request/` returns nothing. `create` (submit), `approve` (`leave-request.service.ts:596-735`), `reject` (`:737-799`), and `cancelInternal`/`adminCancel` (`:801-924`) all commit their transactions and return with no notification dispatched to the employee or approver. This means employees are never told their leave was approved/rejected, and approvers are never told a new request needs action, unless the frontend polls and re-fetches.
- **Admin-cancel of an approved leave restores the full `total_days` even if the leave has already partially or fully elapsed.** `cancelInternal` only blocks self-cancel of an approved leave whose start date has passed (`leave-request.service.ts:840-848`, guarded by `!isAdmin`), but for `isAdmin === true` there is no such check, and `releaseApproved` (`:996-1028`) unconditionally credits back `Number(request.total_days)` to `used_days`. An HR admin cancelling a 10-day approved leave on day 8 (or after it has fully ended) restores all 10 days to the balance even though most/all were already consumed — balance inflation.
- **Overlap validation ignores half-day slots.** `findOverlapping` (`leave-request.repository.ts:62-83`) matches purely on date-range intersection (`from_date <= toDate AND to_date >= fromDate`) with no consideration of `is_half_day`/`half_day_slot`, so a legitimate `FIRST_HALF` request and a `SECOND_HALF` request on the same date are rejected as `OVERLAPPING_REQUEST` (`leave-request.service.ts:1140-1151`) even though together they don't exceed one full day.
- Dead computation in `approve()`: `projected`/`projectedAfterMove` (`leave-request.service.ts:633-635, 654`) are computed then explicitly voided and never used in the actual insufficient-balance check, which instead relies on a separately derived `newAvailableAfterApprove` (`:640-648`) — confusing and redundant, increases risk of the two calculations silently diverging on future edits.

### Technical
- No test files exist under `brello_server/src/modules/leave-request/` (confirmed via the initial directory listing — no `*.spec.ts` present), despite the service containing the module's entire balance-arithmetic and date-computation logic (holiday/weekend/sandwich-rule billable-day math, balance hold/release/consume across four transition paths).
- All logging in the service is limited to three `this.logger.log(...)` success-path lines (create, approve, reject — `leave-request.service.ts:167-169, 711, 789`) and one `logger.error` on best-effort attendance sync failure (`:729-730, 915-919`); there is no structured logging around rejected validation paths (insufficient balance, overlap, backdating limits) that would help diagnose support tickets.

## 5. Top 3 Priorities

1. **Wire in `NotificationService` for submit/approve/reject/cancel/admin-cancel.** This is the single biggest gap — the entire approval workflow is currently silent, meaning employees and approvers only learn of state changes by manually checking the UI, defeating the purpose of an approval workflow.
2. **Fix admin-cancel balance restoration to account for already-elapsed days** (`releaseApproved` in `leave-request.service.ts:996-1028`), since as written it lets an admin credit back leave days an employee has already taken, directly corrupting the leave balance ledger.
3. **Introduce an actual approver-resolution/manager-hierarchy check** before allowing approve/reject, since a flat organization-wide permission with no team scoping means the current model cannot express "only this employee's manager (or HR) may approve this request," which is a basic expectation of any leave-approval system.
