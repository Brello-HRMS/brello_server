# Module: Payroll

## 1. Purpose & Current Usage

`brello_server/src/modules/payroll/` implements Brello's full payroll pipeline:

- **Salary structure master data**: `PayrollComponent`, `SalaryTemplate`/`SalaryTemplateComponent`, `PfConfig` (component-master.service.ts, salary-template.service.ts, pf-config.service.ts).
- **Per-employee salary**: versioned `EmployeeSalary`/`EmployeeSalaryComponent` snapshots, assignment, bulk-assignment, update, and template-driven propagation (employee-salary.service.ts, change-propagation.service.ts).
- **Payroll run lifecycle**: Draft → Prepare → Validate → Process → Lock → Disburse, one run per (org, month, year) (payroll-run.service.ts, payroll-preparation.service.ts, payroll-processing.service.ts).
- **Calculation**: LOP-adjusted earnings, bonus/deduction adjustments, reimbursement fold-in, statutory PF (payroll-calculation.service.ts).
- **Payslips**: JSON payslip/report assembly and PDF rendering/storage (payslip.service.ts, payslip-pdf.service.ts).
- **Crons**: `PayrollAutoRunCron` (monthly Draft-run creation) and `PayrollReminderCron` (pre-payout readiness warnings).
- **Audit**: a dedicated `PayrollAuditService`/`PayrollAuditLog` trail for run/item/adjustment mutations.

**Who calls in today** (confirmed via grep across `brello_server/src`):
- `brello_server/src/modules/payroll/controllers/payroll-run.controller.ts`, `payroll.controller.ts`, `payroll-payslip.controller.ts` — the only HTTP surface, all gated by `JwtAuthGuard`/`AccessGuard`/`RequirePermission` (e.g. `PAY_PROCESS`, `PAY_PAYSLIP`, `PAY_LISTING`).
- `brello_server/src/modules/user/services/employee.service.ts:624` (`updatePayrollInformation`) — writes payroll-related employee fields, logs `UPDATE_PAYROLL_INFO`.
- `brello_server/src/modules/org-setup/org-setup.service.ts:38-75` — counts `PayrollComponent`/`SalaryTemplate` rows to report org-setup completion (`PAYROLL` checklist flag); read-only, no functional coupling.
- Module exports (`PayrollService`, `EmployeeSalaryEngine`, `PayrollCalculationEngine`, `EmployeeSalaryRepository`, `ChangePropagationService`) are declared in `payroll.module.ts:109-115` but no other module currently imports `PayrollModule` or injects these exports — they are exported defensively, not consumed yet.

**Dead/unused**: nothing structurally dead — every service/controller is wired. The exported providers above are unused externally, which is fine as a boundary but means the "exports" list is currently speculative.

## 2. Intended / Ideal Usage

A correct payroll processing pipeline for this shape of module should have:
- **Idempotency/locking** on run-level state transitions so two concurrent "Process" or "Lock" requests for the same run can't both proceed and double-write totals/reimbursements.
- **Graceful partial-failure handling** per employee — one employee's calculation blowing up should not corrupt the whole run's state machine; the run should still resolve to a legitimate terminal status with a clear per-item error trail.
- **A failure path at the run level** (`FAILED`/similar), not just employee-item-level `ERROR`, so an aborted `process()` doesn't leave the run permanently stuck.
- **Transactional writes** across dependent multi-table mutations (e.g., deactivating an old salary version and activating the new one) so a crash mid-write can't leave an employee with zero or two active salary records.
- **Notification hooks** on every financially significant state change (payslip ready, salary revised, run failed, reminder due) so HR/employees are informed without polling the UI.
- **Audit trail on every transition** — this module already does this well via `PayrollAuditService`.

## 3. Cross-Module Connections

**Depends on** (read-only, via `PayrollSourceRepository` and direct `TypeOrmModule.forFeature` imports in `payroll.module.ts:47-52,69-74`):
- `attendance` (`AttendanceRecord`) — for LOP/working-days snapshot (`payroll-source.repository.ts:129-167`) and pending-approval/pending-correction gating (`:89-127`).
- `leave-request` (`LeaveRequest`) — paid/unpaid leave overlap days (`payroll-source.repository.ts:174-227`).
- `reimbursement` (`Reimbursement`) — approved claims folded into net pay and stamped/paid (`payroll-reimbursement.repository.ts`).
- `document` (`DocumentModule`/`StorageService`) — payslip PDF storage (`payslip-pdf.service.ts:1-29`).
- `user`/`departments` — roster and org-chart data for eligibility and listings.
- `rbac` (`RbacModule`) — permission enforcement on all controllers.
- `audit` (`AuditContextService`) — pre-value snapshotting for diff-style audit entries.

**Depends on it**: `user/services/employee.service.ts` (payroll info updates) and `org-setup` (setup-completion checklist), as above. No other module consumes the exported engines/services yet.

**Missing/expected connections**:
- **NotificationService**: zero references anywhere in `brello_server/src/modules/payroll/` (confirmed via `grep -rln "NotificationService\|notification"`, only match is the TODO comment in `payroll-reminder.cron.ts`). Payslip lock (`payroll-processing.service.ts:165` `lock()`), salary revision (`employee-salary.service.ts` `assignSalary`/`updateEmployeeSalaryStructure`/`bulkAssignSalary`), and any run failure all complete silently with no employee/HR-facing notification.
- **`payroll-reminder.cron.ts:19-21`** has an explicit `TODO(notification): dispatch these warnings ... via NotificationService once recipient resolution (RBAC role lookup) is wired` — it currently only calls `this.logger.warn(...)` (line ~74-79), so pre-payout readiness issues are invisible outside server logs.
- **No `payroll_run.status = FAILED`/similar path**: `PayrollRunStatus` enum (`enums/payroll.enum.ts:73-78`) has only `DRAFT | PROCESSING | COMPLETED | LOCKED` — there is no failure state at all.

## 4. Gaps

### Structural (architecture, module boundaries, coupling, missing abstractions, layering violations)

- **No run-level `FAILED` status exists.** `enums/payroll.enum.ts:73-78` defines only `DRAFT, PROCESSING, COMPLETED, LOCKED`. Combined with the uncaught-exception gap below, a run that fails mid-processing has nowhere to go — it's stuck at `PROCESSING` forever with no documented recovery path. Matters because there is no way to represent "this month's payroll blew up" as queryable state, which blocks both UI messaging and the missing notification hook.
- **Salary versioning writes are not transactional.** `employee-salary.repository.ts:79-124` (`createNewVersion`) deactivates the existing `EmployeeSalary` row (`save`, line 91) and then creates + saves the new salary and its components (lines 95-122) as separate, unwrapped `await` calls — no `queryRunner`/`manager.transaction` anywhere in the module (confirmed via `grep -rn "transaction\|QueryRunner"` returning zero hits in the whole module). A crash between the two saves leaves an employee with **no active salary row**, which will later surface as a false "No active salary structure assigned" error during payroll processing (`payroll-processing.service.ts:279`). This is the kind of bug that only shows up in production under load/restarts.

### Coding (bugs, dead code, inconsistent patterns, missing validation/error handling)

- **`process()` has no per-item try/catch, so an unexpected error aborts the whole run mid-flight, leaving it stuck in `PROCESSING`.** `payroll-processing.service.ts:72-81`: the run is saved with `run_status = PROCESSING` (line 73) *before* the per-employee loop; each `computeItem` call (line 78) is awaited with no surrounding `try/catch`. `computeItem` only handles the "no salary" case explicitly (`:273-282`) — any other failure (e.g. `calcEngine.calculate` throwing, a DB blip in `salaryRepo`/`adjustmentRepo`/`reimbursementRepo`) propagates out of `process()` uncaught. Because there is no `FAILED` state and the `ConflictException` guard at line 59-63 only unblocks re-entry when status is *not* `PROCESSING`, a crashed run can never be re-processed through the normal API — it requires a manual DB fix. This directly confirms the "partial failure not handled gracefully" concern: unlike `payslip-pdf.service.ts:36-44`, which explicitly wraps per-item work in try/catch specifically so "a single bad payslip must not abort the lock," `payroll-processing.service.ts` has no equivalent guard for the actual money calculation.
- **Double-processing guard is a TOCTOU race, not an atomic lock.** `payroll-processing.service.ts:59-63` reads `run.run_status` and throws if `PROCESSING`, then separately sets `PROCESSING` and saves (`:72-73`) — there is no `SELECT ... FOR UPDATE`, no optimistic-lock `@VersionColumn`, and no DB transaction wrapping the check-then-set (confirmed no `VersionColumn`/`transaction` usage anywhere in the module). Two concurrent `POST /payroll/runs/:id/process` requests (e.g. a double-click or a retry after a slow response) can both pass the guard before either write lands, causing both to loop over and mutate the same `PayrollRunItem` rows and reimbursement stamps concurrently. This matters because it's real money being calculated twice under a race that the existing test suite (`payroll-processing.service.spec.ts:190-200`, "refuses to process a run that is already processing") only exercises sequentially, not concurrently, so it gives false confidence.
- **`PayrollReminderCron`'s pending-leave check is unscoped to the pay period.** `payroll-reminder.cron.ts` counts `this.leaveRepo.count({ where: { organization_id, request_status: PENDING } })` with no date filter, unlike the attendance/correction checks which are scoped to `fromDate`/`toDate` in the same method. This means the reminder can perpetually warn (in logs only, per the gap above) about ancient unrelated pending leave requests, diluting the signal for the one thing this cron is supposed to flag.

### Technical (performance, security, scalability, test coverage, observability)

- **Sequential per-employee N+1 queries in both prepare and process, with no batching or concurrency.** `payroll-preparation.service.ts:86-152` loops over every eligible employee and, per employee, awaits `itemRepo.findByRunAndUser`, `sourceRepo.getAttendanceSummary`, `sourceRepo.getLeaveSummary`, and `salaryRepo.findActiveSalary` — 4+ round trips per employee, fully serialized. `payroll-processing.service.ts:77-81` (`process()`) does the same for `computeItem`, which itself issues `findActiveSalary`, `findSalaryWithComponents`, `adjustmentRepo.sumForUser`, `findActiveStatutoryOverride`, and `reimbursementRepo.findIncludable`/`stampProcessed` — another 5+ queries per employee, all serialized in a `for...of` loop with no `Promise.all`/batching. For an organization with hundreds/thousands of employees this is O(n) sequential DB round trips (easily 1000+ queries for a 200-person org), which will make "Process" and "Prepare" slow and increasingly fragile as headcount grows — this is the most likely place the module will fall over first under real load.
- **Zero notification integration anywhere in the module** (see Cross-Module Connections above) — payslip lock, salary revision, and payroll-run failure all complete silently, and the one place that already computes what *should* be notified (`payroll-reminder.cron.ts`) explicitly stops short with a TODO and a `logger.warn`.
- **Test coverage does not exercise concurrency or mid-loop exceptions.** `payroll-processing.service.spec.ts` (307 lines) covers the happy paths and single-shot guard checks (locked run, already-processing, no items, lock preconditions, disburse preconditions) but has no test that simulates `computeItem` throwing partway through a multi-employee run, and no test simulating two concurrent `process()` calls actually racing (only a sequential re-entry check, `:190-200`). This means the exact failure modes described above are unverified by the suite that exists.

## 5. Top 3 Priorities

1. **Add a run-level `FAILED` status plus a try/catch around the per-item loop in `process()`** (`payroll-processing.service.ts:77-81`) so an unexpected calculation error resolves to a recoverable, queryable state instead of leaving the run wedged in `PROCESSING` forever with no way back through the API.
2. **Wrap `createNewVersion`** (`employee-salary.repository.ts:79-124`) **and the process/lock state transitions in real DB transactions** (or add optimistic locking via a version column) to close both the salary-versioning crash-consistency gap and the double-processing TOCTOU race — both are correctness bugs on compensation data, not just style issues.
3. **Wire `NotificationService` into payslip lock, salary revision, and (once it exists) run failure, and finish the `payroll-reminder.cron.ts` TODO** — right now every financially significant event in this module is silent outside of server logs, which is the single most user-visible gap for HR/employees.
