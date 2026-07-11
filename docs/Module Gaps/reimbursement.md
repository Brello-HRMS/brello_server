# Module: Reimbursement

## 1. Purpose & Current Usage

- Backend module for employee expense reimbursement claims: employees submit a titled expense with amount, date, description, and required receipt attachments; admins review, approve/reject, and later mark claims as paid; payroll can fold approved-and-unpaid claims into a payroll run.
- Entry points, all guarded by `JwtAuthGuard`:
  - `POST /reimbursements` → `ReimbursementService.create` (`brello_server/src/modules/reimbursement/services/reimbursement.service.ts:24`)
  - `GET /reimbursements/me` → `ReimbursementService.findMine` (`reimbursement.service.ts:57`)
  - `PUT /reimbursements/:id` → `ReimbursementService.update` (`reimbursement.service.ts:80`)
  - `DELETE /reimbursements/:id` → `ReimbursementService.remove` (`reimbursement.service.ts:122`)
  - `GET /admin/reimbursements` → `AdminReimbursementService.findAll` (`admin-reimbursement.service.ts:23`)
  - `PATCH /admin/reimbursements/:id/status` → `AdminReimbursementService.updateStatus` (`admin-reimbursement.service.ts:70`)
  - `PATCH /admin/reimbursements/:id/mark-paid` → `AdminReimbursementService.markPaid` (`admin-reimbursement.service.ts:90`)
- `payroll` module reads/mutates the `Reimbursement` entity directly via its own `PayrollReimbursementRepository` (`brello_server/src/modules/payroll/repositories/payroll-reimbursement.repository.ts:1-72`) to pull approved, unprocessed claims into a run, stamp them with `processed_in_payroll_id`, and flip `is_paid` when the run locks — it never calls into `ReimbursementService`/`ReimbursementRepository`.
- **No frontend consumer exists today.** A full frontend PRD is checked in at `brello_server/docs/prd/reimbursement.md` (admin drawer + employee list/modal, `src/features/reimbursement/...`), but a repo-wide search of `brello_webapp/src` for "reimbursement" returns zero matches. The only real caller of this module right now is `payroll`; the employee/admin HTTP surface is unused by any built UI.
- Dead code: `ReimbursementRepository.getDocumentSignedUrls` (`reimbursement.repository.ts:228-236`) is never called anywhere in the codebase (controllers, services, or elsewhere) — it's unreferenced.

## 2. Intended / Ideal Usage

- Employee submits a claim with at least one receipt attachment, attachments are validated against the `document` module (ownership + tenant), claim goes to `PENDING`.
- Admin reviews and approves/rejects, optionally subject to an approval threshold/limit (e.g., multi-level sign-off above a configured amount).
- On approval, the employee is notified; on rejection, the employee is notified with the reason; once paid, the employee is notified with payout/payroll-run reference.
- `is_paid`/`paid_at`/`processed_in_payroll_id` accurately track whether a claim was paid standalone (admin mark-paid) or folded into a payroll run, without double-processing or double-notifying.
- All state transitions (create/update/approve/reject/pay) are captured in a single, consistent audit trail.

## 3. Cross-Module Connections

- **Depends on:**
  - `document` module — `Document` entity is imported directly into `TypeOrmModule.forFeature` (`reimbursement.module.ts:9,27`) and `ReimbursementRepository` queries it directly (`reimbursement.repository.ts:17-18, 228-236`) rather than going through `DocumentService`.
  - `global-search` module — `SearchIndexingService.indexReimbursement` / `removeReimbursement` are wired correctly from `ReimbursementService.create`/`update`/`remove` (`reimbursement.service.ts:53,114,133`; confirmed implemented at `global-search/services/search-indexing.service.ts:342-369`).
  - `audit` module (org-wide audit log, distinct from this module's own `ReimbursementAuditLog`) — `AuditContextService` is injected into `ReimbursementService` only (`reimbursement.service.ts:14,21`), not into `AdminReimbursementService`.
- **Depended on by:**
  - `payroll` module, directly and exclusively via `PayrollReimbursementRepository`, bypassing `ReimbursementRepository`/`ReimbursementService` entirely (`payroll/repositories/payroll-reimbursement.repository.ts:1-72`).
- **Missing/expected connections:**
  - `notification` module — zero references anywhere in the module. Confirmed: `grep -rn "NotificationService\|notification" src/modules/reimbursement/` returns no matches. Submit, approve/reject, and mark-paid all complete silently with no employee-facing notification.

## 4. Gaps

### Structural (architecture, module boundaries, coupling, missing abstractions, layering violations)

- **Payroll reaches directly into the Reimbursement entity instead of the reimbursement module's own repository/service.** `payroll/repositories/payroll-reimbursement.repository.ts:13-17` injects `Repository<Reimbursement>` directly and duplicates query/update logic that belongs behind `ReimbursementRepository`. This means any future invariant added to reimbursement writes (audit logging, status guards, versioning) silently doesn't apply to payroll's writes to the same table — e.g. `markPaidForRun` (`payroll-reimbursement.repository.ts:50-55`) flips `is_paid`/`paid_at` with zero `ReimbursementAuditLog` entry, unlike every other status mutation in the module.
- **Document attachments are stored without any validation against the `document` module.** `ReimbursementRepository.createWithAttachments` (`reimbursement.repository.ts:86-115`) and `updateWithAttachments` (`reimbursement.repository.ts:117-161`) create `ReimbursementAttachment` rows straight from client-supplied `document_ids` (`create-reimbursement.dto.ts:22-24`, `update-reimbursement.dto.ts:22-30`) with no check that the `Document` row exists, belongs to the submitting employee, or belongs to the same enterprise/org. Any authenticated user can attach an arbitrary UUID, including another employee's or another tenant's document.
- **Two parallel audit mechanisms with no reconciliation.** This module maintains its own `ReimbursementAuditLog` table written manually inside repository transactions (`reimbursement.repository.ts:106-111,151-157,169-175,198-204,216-222`), while controllers also use the org-wide `@AuditLog` decorator (`reimbursement.controller.ts:34,61,71`, `admin-reimbursement.controller.ts:43,54`) backed by a separate `AuditContextService`/interceptor. Two independently-maintained audit trails for the same actions is a maintenance and consistency risk (e.g. divergent old/new payloads).

### Coding (bugs, dead code, inconsistent patterns, missing validation/error handling)

- **No duplicate-submission prevention.** `ReimbursementService.create` (`reimbursement.service.ts:24-55`) has no check for an existing claim with the same employee/title/amount/expense_date; an employee can submit the identical expense any number of times, each indexed and persisted independently.
- **No approval threshold/limit.** `AdminReimbursementService.updateStatus` (`admin-reimbursement.service.ts:70-88`) lets any admin approve any amount with no tiering, multi-level sign-off, or maximum-amount check — matches the "ideal usage" gap called out in section 2.
- **`markPaid` status guard is correct but not race-safe.** The guard at `admin-reimbursement.service.ts:94-99` does correctly require `reimb_status === APPROVED` before allowing `is_paid`, and separately rejects an already-paid claim — logic is right. However, the entity is fetched via `findById` (`admin-reimbursement.service.ts:91`, outside any transaction) and then mutated in a separate transaction in `ReimbursementRepository.markPaid` (`reimbursement.repository.ts:210-226`) without re-checking status or using a pessimistic lock/optimistic version bump. Two concurrent `mark-paid` requests for the same claim can both pass the outer guard and both write `is_paid = true`, producing two `ReimbursementAuditLog` PAID entries for one payment. The same check-then-act pattern applies to `updateStatus` (`admin-reimbursement.service.ts:70-88`), which — unlike the employee `update()`/`remove()` paths (`reimbursement.service.ts:92-94`) — never checks `version`, so concurrent approve/reject calls aren't guarded by optimistic locking either.
- **Audit convention documented but not followed for approve/reject.** `audit/decorators/audit-log.decorator.ts:15-17` explicitly states the `@AuditLog` decorator should be used "ONLY for CREATE and DELETE" and that UPDATE/APPROVE/REJECT must call `auditService.log()` manually after `setPreValue()`. `AdminReimbursementController.updateStatus` uses the decorator with `AuditAction.APPROVE` (`admin-reimbursement.controller.ts:43-52`) anyway, and `AdminReimbursementService` never imports or calls `AuditContextService`/`setPreValue` (confirmed absent from `admin-reimbursement.service.ts`), so the org-wide audit entry for approve/reject is recorded with no old-value diff, contradicting the module's own documented pattern used correctly elsewhere in `ReimbursementService.update`/`remove` (`reimbursement.service.ts:95,131`).
- **Dead code:** `ReimbursementRepository.getDocumentSignedUrls` (`reimbursement.repository.ts:228-236`) is unreferenced anywhere, and even if it were called, it returns the raw `object_key` rather than an actual signed/viewable URL (contrast with `DocumentService.buildViewUrl`, `document/services/document.service.ts:56-69`, which correctly builds an S3 URL or HMAC-signed view path) — so it would produce broken links for DB-backed storage if ever wired up.

### Technical (performance, security, scalability, test coverage, observability/logging)

- **No notifications on any state transition.** Confirmed zero `NotificationService`/notification references in the module (`grep -rn "NotificationService\|notification" src/modules/reimbursement/` → no matches). Submit (`reimbursement.service.ts:24`), approve/reject (`admin-reimbursement.service.ts:70`), and mark-paid (`admin-reimbursement.service.ts:90`) all complete silently — an employee has no way to learn their claim's outcome except by polling `GET /reimbursements/me`.
- **IDOR risk on attachments** (security): as noted structurally, `document_ids` supplied by the client are never checked against the `document` table for existence or ownership before being linked (`reimbursement.repository.ts:96-104,141-149`), and there is no check anywhere in this module that a fetched `Document`'s `enterprise_id`/`organization_id` matches the reimbursement's tenant.
- **No test files.** `find brello_server/src/modules/reimbursement -name "*.spec.ts"` finds none — zero unit/integration test coverage for status-transition guards, transaction rollback behavior, or the payroll cross-module contract.
- **No structured logging.** Neither service nor the repository logs status transitions, approvals, or payment events (no `Logger` usage anywhere in the module), making production issues (e.g. the race conditions above) invisible without querying `ReimbursementAuditLog` directly.

## 5. Top 3 Priorities

1. **Add tenant/ownership validation for `document_ids` on create/update** (`reimbursement.repository.ts:86-115,117-161`) — this is a live IDOR: any authenticated user can currently attach another tenant's or another employee's document to their claim.
2. **Wire `NotificationService` into submit/approve/reject/mark-paid** (`reimbursement.service.ts:24`, `admin-reimbursement.service.ts:70,90`) — the module is functionally silent to the employee at every state change; this is the most user-visible gap and the one explicitly flagged going into this audit.
3. **Add optimistic/pessimistic concurrency control to `updateStatus` and `markPaid`** (`admin-reimbursement.service.ts:70-103`) — the check-then-act pattern without a version check or row lock allows double-approval or double-payment audit entries under concurrent admin requests, and is inconsistent with the version-guarded employee `update()` path in the same module.
