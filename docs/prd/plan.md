# Implementation Plan — Reimbursement Module

## Overview

Full-stack reimbursement management feature for Brello HRMS.
Two views: Admin (manage all) + Employee (manage own).

---

## Phase 1: Server (NestJS)

### 1.1 Document Enum Update
- Add `REIMBURSEMENT_DOCUMENT` to `FolderType` enum in `document.enum.ts`

### 1.2 Reimbursement Entities
**Files to create:**
- `reimbursement.entity.ts` — main table with optimistic locking
- `reimbursement-attachment.entity.ts` — links reimbursements to documents
- `reimbursement-audit-log.entity.ts` — audit trail

**Key fields:** employee_id, title, description, expense_date, amount, currency, reimb_status (separate from BaseEntity.status), rejection_reason, approved_by, approved_at, is_paid, paid_at, version

### 1.3 Enums
- `ReimbursementStatus`: Pending | Approved | Rejected
- `AuditAction`: Created | Updated | Approved | Rejected | Paid | Deleted

### 1.4 DTOs
- `CreateReimbursementDto` — title, description, expense_date, amount, document_ids[]
- `UpdateReimbursementDto` — same fields, plus version for optimistic lock
- `EmployeeQueryDto` — status, is_paid, from_date, to_date, sort, page, limit
- `AdminQueryDto` — above + employee_id filter
- `UpdateStatusDto` — status (Approved|Rejected), rejection_reason (required if Rejected)

### 1.5 Repository
- `findByEmployee(userId, query)` — paginated employee view
- `findAll(enterpriseId, orgId, query)` — paginated admin view
- `findById(id)` — with attachments joined
- `createWithAttachments(data, documentIds)` — transaction
- `updateWithAttachments(id, data)` — with optimistic lock check
- `softDelete(id, deletedBy)` — sets deleted_at / deleted_by

### 1.6 Services

**ReimbursementService (Employee):**
- `create(userId, enterpriseId, orgId, dto)` — validates, creates, audits
- `findMine(userId, query)` — paginated
- `update(userId, id, dto)` — validates ownership + status=Pending + version
- `delete(userId, id)` — soft delete, validates ownership + status=Pending

**AdminReimbursementService:**
- `findAll(enterpriseId, orgId, query)` — paginated with employee info
- `updateStatus(id, dto, adminId)` — Approve/Reject, validates Pending→only
- `markPaid(id, adminId)` — validates Approved, sets is_paid + paid_at

### 1.7 Controllers
- `ReimbursementController` — prefix `/reimbursements`, employee CRUD
- `AdminReimbursementController` — prefix `/admin/reimbursements`

### 1.8 Module + App Registration
- `ReimbursementModule` with TypeORM entities + service/controller providers
- Import into `AppModule`

---

## Phase 2: Webapp (React)

### 2.1 Types (`reimbursementTypes.ts`)
```typescript
ReimbursementStatus = 'Pending' | 'Approved' | 'Rejected'
Reimbursement — full entity type
ReimbursementAttachment — { document_id, url, original_name }
CreateReimbursementPayload — form fields + document_ids
AdminUpdateStatusPayload — status + rejection_reason
PaginatedResponse<T> — items[], pagination
```

### 2.2 API (`reimbursementApi.ts`)
- Employee: createReimbursement, getMyReimbursements, updateReimbursement, deleteReimbursement
- Admin: getAllReimbursements, updateReimbursementStatus, markReimbursementPaid

### 2.3 Hooks
- `useReimbursement.ts` (employee): useMyReimbursements, useCreateReimbursement, useUpdateReimbursement, useDeleteReimbursement
- `useAdminReimbursement.ts` (admin): useAllReimbursements, useUpdateStatus, useMarkPaid

### 2.4 Columns
- `adminReimbursementColumns.tsx` — Employee, Title, Date, Deductions, Status badge, Paid toggle, Edit action
- `employeeReimbursementColumns.tsx` — Title, Amount, Date, Attachments count, Status badge, Actions (edit/delete)

### 2.5 Components

**AddReimbursementModal** (employee create + edit):
- Dialog position=center, maxWidth=540px
- Fields: Title (Input), Description (TextArea), Date (DatePicker), Amount (Input), Attachments (file upload)
- File upload: call uploadDocumentUrl → uploadDocumentData, collect document_ids
- Zod validation

**EditReimbursementDrawer** (admin):
- Dialog position=right, maxWidth=480px
- Top: employee avatar, name, title, department
- Read-only: Title, Description, Expense date, Amount, Attachments (download links)
- Editable: Request Status (Select), Rejection Reason (Textarea, conditional), Mark as Paid (toggle)
- Cancel + Save buttons

### 2.6 Pages

**ReimbursementPage** (admin, `/payroll/reimbursements`):
- PageHeader "All Reimbursements" + Export button
- ListControls: search + date range filter
- DataTable with admin columns
- EditReimbursementDrawer for status management

**EmployeeReimbursementPage** (employee, `/payroll/reimbursements/me`):
- Empty state with illustration + Add button
- DataTable with employee columns
- AddReimbursementModal for create + edit

### 2.7 Routes + Sidebar
- Add routes to `routes/index.tsx`
- Add "Reimbursement" sub-items to Payroll in sidebar config

---

## File Checklist

### Server
- [ ] `src/modules/document/enums/document.enum.ts` (update)
- [ ] `src/modules/reimbursement/enums/reimbursement.enum.ts`
- [ ] `src/modules/reimbursement/entities/reimbursement.entity.ts`
- [ ] `src/modules/reimbursement/entities/reimbursement-attachment.entity.ts`
- [ ] `src/modules/reimbursement/entities/reimbursement-audit-log.entity.ts`
- [ ] `src/modules/reimbursement/dto/create-reimbursement.dto.ts`
- [ ] `src/modules/reimbursement/dto/update-reimbursement.dto.ts`
- [ ] `src/modules/reimbursement/dto/employee-query.dto.ts`
- [ ] `src/modules/reimbursement/dto/admin-query.dto.ts`
- [ ] `src/modules/reimbursement/dto/update-status.dto.ts`
- [ ] `src/modules/reimbursement/repositories/reimbursement.repository.ts`
- [ ] `src/modules/reimbursement/services/reimbursement.service.ts`
- [ ] `src/modules/reimbursement/services/admin-reimbursement.service.ts`
- [ ] `src/modules/reimbursement/controllers/reimbursement.controller.ts`
- [ ] `src/modules/reimbursement/controllers/admin-reimbursement.controller.ts`
- [ ] `src/modules/reimbursement/reimbursement.module.ts`
- [ ] `src/app.module.ts` (update)

### Webapp
- [ ] `src/features/reimbursement/types/reimbursementTypes.ts`
- [ ] `src/features/reimbursement/api/reimbursementApi.ts`
- [ ] `src/features/reimbursement/hooks/useReimbursement.ts`
- [ ] `src/features/reimbursement/hooks/useAdminReimbursement.ts`
- [ ] `src/features/reimbursement/validation/reimbursementSchema.ts`
- [ ] `src/features/reimbursement/columns/adminReimbursementColumns.tsx`
- [ ] `src/features/reimbursement/columns/employeeReimbursementColumns.tsx`
- [ ] `src/features/reimbursement/components/AddReimbursementModal/AddReimbursementModal.tsx`
- [ ] `src/features/reimbursement/components/AddReimbursementModal/AddReimbursementModal.module.scss`
- [ ] `src/features/reimbursement/components/EditReimbursementDrawer/EditReimbursementDrawer.tsx`
- [ ] `src/features/reimbursement/components/EditReimbursementDrawer/EditReimbursementDrawer.module.scss`
- [ ] `src/pages/reimbursement/ReimbursementPage.tsx`
- [ ] `src/pages/reimbursement/ReimbursementPage.module.scss`
- [ ] `src/pages/reimbursement/EmployeeReimbursementPage.tsx`
- [ ] `src/pages/reimbursement/EmployeeReimbursementPage.module.scss`
- [ ] `src/routes/index.tsx` (update)
