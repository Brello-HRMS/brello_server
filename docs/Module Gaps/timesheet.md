# Module: Timesheet

## 1. Purpose & Current Usage

- Lets an employee log blocks of worked time against a project they're assigned to. Core pieces:
  - Entity: `TimesheetEntry` (`src/modules/timesheet/entities/timesheet-entry.entity.ts:22-89`) — one row per (user, project, date, start_time) block, with `worked_minutes` computed server-side, a `submission_status` lifecycle column, and a soft-delete flag (`is_deleted`) mirroring the attendance module's pattern.
  - Service: `TimesheetService` (`src/modules/timesheet/services/timesheet.service.ts`) — create/update/delete of entries, a monthly calendar view, and a dashboard (weekly/monthly hours + assigned project list).
  - Controller: `TimesheetController` (`src/modules/timesheet/controllers/timesheet.controller.ts:23-111`) — 6 routes: `GET /timesheet/dashboard`, `GET /timesheet/projects`, `GET /timesheet/calendar`, `POST /timesheet`, `PATCH /timesheet/:id`, `DELETE /timesheet/:id`.
  - Repository: `TimesheetRepository` (`src/modules/timesheet/repositories/timesheet.repository.ts`) — raw query-builder access to `timesheet_entries` plus reads into `ProjectTeam` for assignment checks.
- Who calls into it today: exclusively the Brello webapp's own timesheet UI. `brello_webapp/src/features/project/api/timesheet.ts:13-45` maps 1:1 onto the 6 controller routes; consumed by `brello_webapp/src/pages/project/timesheet/TimesheetPage.tsx` and its child components (calendar, entry modal, dashboard cards, project hours table, Excel export). The Excel export (`brello_webapp/src/pages/project/timesheet/components/ExportMenu.tsx:27-47`) is done entirely client-side against already-fetched calendar data — there is no server export endpoint.
- No other backend module imports `TimesheetService`/`TimesheetRepository`/`TimesheetEntry` — confirmed via repo-wide grep; the only references outside `src/modules/timesheet/` are the module registration in `src/app.module.ts:37,92` and a sidebar-nav seed row in `src/seeds/seed-brello-v2-base.ts:107`.
- Dead/unused parts: `TimesheetSubmissionStatus.SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, and `REJECTED` (`src/modules/timesheet/enums/timesheet-submission-status.enum.ts:8-23`) are never assigned anywhere in the service — every entry is created with `DRAFT` (`timesheet.service.ts:59`) and stays there forever, since no code path ever writes a different value. The frontend has matching unused CSS hooks (`.approved`, `.pending` in `TimesheetPage.module.scss:681,686`) with no UI wired to them.

## 2. Intended / Ideal Usage

- An approval workflow where an employee submits DRAFT entries (individually or as a weekly batch), a manager/PM reviews and approves or rejects them, and only APPROVED entries are locked from further edits — the entity/enum comments explicitly say this schema was built "from day one" to support that without migration (`timesheet-entry.entity.ts:18-20`, `timesheet-submission-status.enum.ts:1-6`).
- Payroll should be able to read approved billable/worked hours per employee per pay period for wage or invoice computation, and client-facing invoicing should be able to roll up approved project hours for billing.
- Attendance and timesheet should cross-validate — e.g. flag or block logging timesheet hours on a day with no attendance check-in, or reconcile total logged project hours against clocked attendance hours for the same day.
- A manager/admin-facing surface to view a team's or project's timesheet entries (not just "my own"), since none of the 6 existing routes expose any cross-user view.

## 3. Cross-Module Connections

- Depends on:
  - `Project` / `ProjectTeam` (`src/modules/project/entities/project.entity.ts`, `project-team.entity.ts`) — `project_id` FK on `TimesheetEntry`, and `ProjectTeam` is the sole source of truth for "is this user allowed to log time on this project" (`timesheet.repository.ts:105-119`).
  - `User` (`src/modules/user/entities/user.entity.ts`) — `user_id` FK, no further user-module interaction (e.g. no employment-status check to block ex-employees from logging time).
- Depended on by: nothing. Grep across `src/modules` confirms no other module (payroll, project, attendance, invoicing) reads from `timesheet_entries`, `TimesheetService`, or the repository.
- Missing/expected connections: payroll → timesheet (for billable-hours-based pay/invoicing), project → timesheet (a "logged hours vs. estimated hours" summary on the project detail page would be a natural read), attendance → timesheet (cross-validation of logged hours against actual clock-in/out). All three are entirely absent today.

## 4. Gaps

### Structural (architecture, module boundaries, coupling, missing abstractions, layering violations)
- The approval workflow is schema-only: `submission_status` exists and is exposed in every response DTO (`timesheet.service.ts:168, 332`) but there is no service method, controller route, or state-transition guard that ever moves an entry out of `DRAFT`. This matters because the module is effectively an unenforced personal time-log, not the "submit → approve" workflow its own doc comments promise; any downstream consumer (e.g. payroll) that expected to filter on `APPROVED` would find the value never occurs.
- No manager/admin-facing endpoint exists anywhere in `TimesheetController` — all 6 routes implicitly scope to the calling user's own `user_id` (see `findOwnedEntryOrFail`, `timesheet.service.ts:305-322`, and the dashboard/calendar queries which always take `user.userId`). This matters because without a way for anyone but the entry owner to even *see* entries, an approval workflow can't be bolted on later without a new read surface.
- Zero cross-module consumption (Section 3): payroll, invoicing, and project modules have no wiring to timesheet data at all, so hours logged here have no downstream financial or reporting effect — the module is currently an isolated data silo.

### Coding (bugs, dead code, inconsistent patterns, missing validation/error handling)
- Overlapping time ranges are not prevented. The uniqueness guard (`guardDuplicate`, `timesheet.service.ts:278-300`, backed by `findDuplicate` in `timesheet.repository.ts:73-97` and the DB `uq_timesheet_entry` constraint on `(organization_id, user_id, project_id, entry_date, start_time)`) only rejects an exact duplicate `start_time` for the same project/date — a second entry with a different `start_time` that overlaps the first (e.g. 09:00–17:00 and 10:00–12:00), or an entry on a *different* project at the identical time window, is accepted without complaint. This matters because a user's total logged hours per day can silently exceed 24h with no detection, undermining any hours-based reporting or payroll use.
- No future-date guard: `CreateTimesheetDto.entry_date` only validates `@IsDateString()` (`create-timesheet.dto.ts:19-22`) with no upper bound, and `TimesheetService.createEntry`/`updateEntry` never check `entry_date` against "today." This matters because employees can log (and dashboards will count) hours for dates that haven't happened yet, corrupting weekly/monthly totals.
- Entries spanning midnight are silently unsupported: `isEndAfterStart`/`calcWorkedMinutes` (`timesheet-calc.util.ts:21-31`) require `end_time > start_time` as plain HH:MM minute comparisons, so an overnight shift (e.g. 22:00–02:00) is rejected as invalid input rather than handled — acceptable for office timesheets but undocumented as a constraint.
- `BaseEntity.status` (Status enum, `src/common/entities/base.entity.ts:20-24`) is inherited but never read or written by the timesheet module, which instead uses its own `is_deleted` boolean for soft-delete (as the entity comment at `timesheet-entry.entity.ts:16-17` acknowledges) — a harmless but confusing dual-lifecycle-flag pattern inherited from `BaseEntity` that every new entity must consciously ignore.

### Technical (performance, security, scalability, test coverage, observability/logging)
- No automated tests exist for the module: a repo-wide search for `*timesheet*spec*`/`*timesheet*test*` returns nothing, versus sibling modules (e.g. attendance) that have dedicated services under test elsewhere in the codebase. This matters because the duplicate/overlap/time-range logic in `timesheet-calc.util.ts` and `timesheet.service.ts` guards data integrity but has zero regression coverage.
- No audit trail: unlike the attendance module, which has a dedicated `AttendanceAuditLog` entity capturing before/after values for every mutation (`src/modules/attendance/entities/attendance-audit-log.entity.ts`), timesheet entries are updated/soft-deleted with only a `Logger.log` line (`timesheet.service.ts:73, 123`) and no persisted history of what changed. This matters once an approval workflow exists — approvers and payroll need an immutable record of edits to approved/submitted hours.
- `findForCalendar` (`timesheet.repository.ts:128-159`) does `EXTRACT(YEAR/MONTH FROM t.entry_date::date)` per row rather than a sargable `BETWEEN`/range comparison on the indexed `entry_date` column, which prevents the existing `idx_timesheet_user_date` index from being used efficiently for the calendar query as data grows.

## 5. Top 3 Priorities

1. **Finish or remove the approval workflow.** The `submission_status` enum, doc comments, and response payloads all advertise a submit/approve/reject flow that has zero implementation — either build the missing submit/approve/reject endpoints and manager-facing read surface, or simplify the schema to stop implying a feature that doesn't exist.
2. **Add overlap and future-date validation.** The current duplicate check only catches identical `start_time` collisions, so overlapping or day-exceeding time entries and future-dated entries pass through silently — this is the most direct data-integrity risk given the module's job is to produce trustworthy hour totals.
3. **Wire timesheet data into at least one downstream consumer (payroll or project reporting).** Right now the module is a fully isolated silo — no other module reads `timesheet_entries`, so all the validation and lifecycle work has no business impact until something consumes it.
