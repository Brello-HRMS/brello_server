# Module: Attendance

## 1. Purpose & Current Usage

The `attendance` module (`brello_server/src/modules/attendance/`) owns the full attendance domain:

- **Shift & rule setup**: `Shift`, `AttendanceRule`, `WeeklyOff`, `GeoFence`, `RuleAssignment` entities with CRUD services (`shift.service.ts`, `attendance-rule.service.ts`, `weekly-off.service.ts`, `rule-assignment.service.ts`) and a resolver (`attendance-rule-resolver.service.ts`) that picks the effective rule/shift/geo-fence for an employee (employee-level assignment beats department-level, `attendance-rule-resolver.service.ts:42-46`).
- **Check-in/out**: `attendance.service.ts` — `checkIn()` (geo-fencing, remote detection, multi-session support, PENDING_APPROVAL gating) and `checkOut()`, both writing to `AttendanceRecord` + `AttendanceSession`.
- **Remote-work approval**: `remote-approval.service.ts` — HR approve/reject of `RemoteApproval` rows created when a remote check-in requires approval.
- **Correction requests**: `correction-request.service.ts` — employee disputes an auto-checkout time; HR approves (recomputes via `applyCheckout`) or rejects.
- **Admin overrides**: `admin-attendance.service.ts` — manual entry, edit, delete, daily preview, employee history, audit-log listing.
- **Materialization**: `attendance-materialization.service.ts` — daily absent/weekly-off/holiday/leave stamping, plus event-driven sync (`syncLeaveToAttendance`, `syncHolidayToAttendance`, and their reverse counterparts) and correction-window finalization.
- **Auto-checkout**: `auto-checkout.service.ts` — closes forgotten open sessions and sends the pre-checkout + post-auto-checkout notifications.
- **Crons**: all four `@Cron` jobs live in `attendance-cron.service.ts` (daily absent marking 01:00, correction-window finalization 02:00, pre-checkout reminder every 30 min) plus one in `auto-checkout.service.ts:47` (auto-checkout scan every 15 min). No cron endpoints/controllers exist — these are purely time-driven.

**Callers today** (concrete references):
- `brello_webapp` — `brello_webapp/src/features/attendance/api/attendanceApi.ts`, `brello_webapp/src/features/dashboard/components/ClockInCard/ClockInCard.tsx`, `DailyAttendanceReport`, `AttendanceSetupPage`, `GeoFencingPage`, `AddManualEntryModal.tsx` etc. drive check-in/out, admin daily preview, setup (shifts/rules/weekly-offs/assignments), and correction requests.
- `modules/holiday/services/holiday.service.ts:28,48,97` injects `AttendanceMaterializationService` to stamp/revert HOLIDAY attendance on holiday create/delete.
- `modules/leave-request/services/leave-request.service.ts:78,727,916` injects the same service to stamp/revert ON_LEAVE attendance on leave approval/cancellation.
- `modules/org-setup/org-setup.service.ts:44-77` injects the `AttendanceRule` entity directly (via `@InjectRepository`) just to count rules for setup-completion checks — not going through any attendance service.
- `modules/payroll/repositories/payroll-source.repository.ts` and `payroll.module.ts:50,72` inject the `AttendanceRecord` entity directly (via `TypeOrmModule.forFeature`) to build LOP/summary queries — payroll never calls into `AttendanceService`/`AttendanceRecordRepository`, it queries the table itself.

**Dead/unused parts:**
- `AttendanceMaterializationService.isProtected()` (`services/attendance-materialization.service.ts:580-582`) is defined but never called anywhere in the codebase — the `PROTECTED_STATUSES` checks it wraps are done with inline `!==`/`===` comparisons instead (e.g. line 291, 342, 408).
- `GeoValidationService.calculateHaversineDistance()` (`services/geo-validation.service.ts:97-118`) duplicates `haversineDistance()` already exported from `services/attendance-calc.util.ts:10-24` — the two implementations are functionally identical but maintained separately.

## 2. Intended / Ideal Usage

Three PRD docs describe intended behavior beyond what's implemented:

- `docs/prd/checkin-checkout.md:736-758` documents a full notification matrix, including **"Remote attendance → Notify manager"** under Admin Notifications — not implemented anywhere in `attendance.service.ts` or `remote-approval.service.ts`.
- `docs/prd/attendance-daily-cron.md:20-21,328-396` documents Job 5 (pre-checkout reminder) and Job 6 (post-auto-checkout notification) as "Must" priority — both **are** implemented, in `auto-checkout.service.ts:150-197` and `:199-226` respectively, and are in fact the only working notification path in the module.
- `docs/prd/auto-checkout.md:1062` lists **"Email/push notification on correction status change"** as a "Should" (not yet built) — matches the observed gap that `CorrectionRequestService.approve()`/`.reject()` never notify the employee.

The doc comment on `attendance.service.ts:388-393` states `applyCheckout()` intentionally omits audit/notify because "the caller owns those, since the event/source differ." In practice:
- `AttendanceService.checkOut()` (the only non-auto caller in `attendance.service.ts`) writes an audit entry (`:362-372`) but sends **no notification**.
- `CorrectionRequestService.approve()` (`services/correction-request.service.ts:165-198`) writes an audit entry but **no notification** to the employee whose correction was just approved (their worked hours/status just changed).
- Only `AutoCheckoutService.processOpenSessions()` (`services/auto-checkout.service.ts:106-133`) fulfills both halves of the contract — audit (`:116-130`) and notify (`:132`, via `notifyEmployee()`).

So the "caller owns audit+notify" contract is honored for audit in all three callers, but for notification only in the one auto-checkout caller.

## 3. Cross-Module Connections

**Depends on** (imports/injects):
- `modules/user` — `User`, `UserProfile` entities (rule resolution, materialization roster).
- `modules/holiday` — `Holiday` entity (materialization's holiday lookups).
- `modules/leave-request` — `LeaveRequest` entity + `LeaveRequestStatus` (materialization's leave lookups).
- `modules/notification` — `NotificationModule`/`NotificationService`, imported in `attendance.module.ts:17,72` but only actually injected into `AutoCheckoutService` (`services/auto-checkout.service.ts:5,44`).
- `modules/audit` — `AuditContextService` (attendance.module doesn't import an AuditModule; `AuditContextService` is injected directly into `attendance.service.ts`, `shift.service.ts`, `admin-attendance.service.ts` to stash pre-values for a separate, generic `@AuditLog()` decorator/interceptor system).
- `modules/rbac` — `RbacModule` for permission guards.

**Depends on this module:**
- `modules/holiday/services/holiday.service.ts` and `modules/leave-request/services/leave-request.service.ts` — both call `AttendanceMaterializationService` for event-driven sync (proper service-level coupling, exported from `attendance.module.ts:109-117`).
- `modules/payroll` — reads `AttendanceRecord` for LOP/summary calculation (`payroll-source.repository.ts`), but bypasses the module boundary entirely by importing the entity + building its own TypeORM queries instead of depending on an exported attendance service/DTO.
- `modules/org-setup` — reads `AttendanceRule` directly the same way, purely for a setup-completion boolean.

**Missing/expected connections:**
- No notification on shift assignment (`rule-assignment.service.ts` — assigning a rule/shift to an employee changes their working hours/geo requirements with zero employee-facing signal).
- No notification on remote-work approval/rejection (`remote-approval.service.ts:62-182` — employee whose remote check-in was pending never learns the outcome except by re-opening the app).
- No notification on correction request submit/approve/reject (`correction-request.service.ts` — same gap, contradicts the PRD's own "Should" item).
- No notification on admin manual create/update/delete of an attendance record (`admin-attendance.service.ts:95-317` — HR silently changing an employee's attendance status/hours with no employee-facing trail beyond the internal audit log).

## 4. Gaps

### Structural
- **Two independent audit trails with inconsistent coverage.** `attendance.module.ts` writes to its own `AttendanceAuditLog` table via `AttendanceAuditLogRepository` (event-type-rich, used by `attendance.service.ts`, `admin-attendance.service.ts`, `remote-approval.service.ts`, `correction-request.service.ts`, `attendance-materialization.service.ts`, `auto-checkout.service.ts`) *and* a separate generic `@AuditLog()` decorator (system-wide audit log) applied inconsistently at the controller layer: present on `attendance.controller.ts:29,51`, `admin-attendance.controller.ts:60,71,83,105,116`, `attendance-rule.controller.ts:34,55,67,79`, `shift.controller.ts:34,55,67,79`, but **absent** from `correction-request.controller.ts` (submit/approve/reject) and `rule-assignment.controller.ts` (assign departments/employees) and `weekly-off.controller.ts`. This means correction requests and rule assignments never appear in the org-wide audit log UI even though every other admin attendance action does. Matters because whoever built the platform-wide audit trail (per the Audit Log System PRD) will have blind spots specifically for these actions.
- **Payroll and org-setup bypass the attendance module boundary.** `modules/payroll/payroll.module.ts:50,72` and `modules/payroll/repositories/payroll-source.repository.ts` inject `AttendanceRecord` directly via `TypeOrmModule.forFeature` rather than depending on `AttendanceService`/`AttendanceRecordRepository`; `modules/org-setup/org-setup.service.ts:44-45` does the same for `AttendanceRule`. Matters because any future change to attendance's internal schema/statuses (e.g. adding a new `AttendanceStatus`) risks silently breaking payroll LOP calculations with no compiler-enforced contract.

### Coding
- **Fake audit logging via `Logger.log('[AUDIT] ...')`.** `rule-assignment.service.ts:37-39,60-62` and `weekly-off.service.ts:155-157,173-175` log a string prefixed `[AUDIT]` to the application logger — this is not persisted to `AttendanceAuditLog` or the system audit log, just console/file output that disappears with log rotation. Matters because it gives a false impression of auditability for rule/shift assignment and weekly-off lifecycle changes, which directly affect employee working hours.
- **`checkOut()` and correction-approval never notify despite the shared contract's premise.** `attendance.service.ts:388-393` explicitly documents "the caller owns audit+notify," but of the three callers of `applyCheckout()` (`attendance.service.ts:349` in `checkOut()`, `auto-checkout.service.ts:106` in `processOpenSessions()`, `correction-request.service.ts:165` in `approve()`), only the auto-checkout caller sends a notification (`auto-checkout.service.ts:132`, `notifyEmployee()` at `:199-226`). `checkOut()` and correction `approve()` write only an audit row. Matters because it means the one caller that most needs *no* extra notification (an employee's own voluntary checkout) has the same audit-only behavior as the one that arguably most needs it (HR approving a correction and recomputing the employee's hours).
- **Duplicated Haversine implementation.** `geo-validation.service.ts:97-118` (`calculateHaversineDistance`) duplicates `attendance-calc.util.ts:10-24` (`haversineDistance`), which `attendance.service.ts` already imports and uses. Matters because a future precision/edge-case fix (e.g. antimeridian handling) would need to be applied twice and will likely be missed in one place.
- **Dead code.** `AttendanceMaterializationService.isProtected()` (`attendance-materialization.service.ts:580-582`) is never called; the `PROTECTED_STATUSES` array it wraps is checked ad hoc elsewhere instead. Low severity but signals the sync logic wasn't refactored to use its own helper.

### Technical
- **Zero automated test coverage.** No `*.spec.ts`/`*.test.ts` files exist anywhere under `src/modules/attendance/` (confirmed via `find`), despite ~4,280 lines across services/controllers and 4 cron jobs performing date/status/hours computations (`attendance-calc.util.ts`, `applyCheckout`, materialization upgrade logic) that are easy to silently regress. Matters most for the cron jobs, which run unattended and only surface failures via `Logger.error` (e.g. `attendance-cron.service.ts:29-31,44-46`, `auto-checkout.service.ts:56-58`) — no alerting, no tests catching a bad recompute before it reaches payroll.
- **Best-effort audit writes swallow failures silently.** `attendance.service.ts:692-694` catches audit-write errors and only does `this.logger.warn(...)` — an audit log failure for check-in/check-out is invisible to any monitoring beyond log scraping, and the attendance action still succeeds, so the audit trail can silently have holes.
- **No manager-facing notification for remote/geo-exception check-ins**, per the PRD gap noted in §2 — managers only ever discover a remote check-in by proactively visiting the `remote-approvals` admin list (`admin-attendance.controller.ts:94-103`), which relies on RBAC + habit rather than a push.

## 5. Top 3 Priorities

1. **Wire `NotificationService` into `RemoteApprovalService.approve/reject`, `CorrectionRequestService.approve/reject`, and `AttendanceService.checkOut()`'s auto-checkout-adjacent paths.** These are the highest-frequency HR-employee interactions in the module where the employee currently has no signal that their status/hours changed — directly contradicts the PRD's own notification matrix and the pattern already proven correct in `auto-checkout.service.ts`.
2. **Replace the fake `[AUDIT]` log-line pattern in `rule-assignment.service.ts` and `weekly-off.service.ts` with real persisted audit entries** (either `AttendanceAuditLogRepository` or the `@AuditLog()` decorator, consistent with every other controller in this module) — shift/rule assignment changes an employee's working hours and geo-fencing requirements and currently leaves no durable trail.
3. **Add test coverage for `attendance-calc.util.ts`, `applyCheckout()`, and the materialization/auto-checkout cron logic** before further changes — these are unattended, financially-adjacent (payroll reads `AttendanceRecord` directly) computations with zero regression safety net today.
