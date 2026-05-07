# Tech PRD — Reimbursement Management System (Server)

## Module: Payroll → Reimbursements

---

## Overview

Server-side implementation for the reimbursement management system. Enables employees to submit expense requests and admins to approve, reject, and mark reimbursements as paid.

---

## Tech Stack

- **Framework**: NestJS 11 (TypeORM 0.3, PostgreSQL)
- **Auth**: JWT via JwtAuthGuard + @CurrentUser() decorator
- **File Uploads**: Existing Document module (S3 presigned URLs)
- **Pattern**: Repository → Service → Controller (matches existing payroll module)

---

## Database Schema

### reimbursements

| Column                  | Type          | Notes                               |
|-------------------------|---------------|-------------------------------------|
| id                      | UUID PK       | Inherited from BaseEntity           |
| enterprise_id           | UUID          | Multi-tenant (BaseEntity)           |
| organization_id         | UUID          | Multi-tenant (BaseEntity)           |
| employee_id             | UUID NOT NULL | FK users.id                         |
| title                   | VARCHAR(255)  | Required                            |
| description             | TEXT          | Nullable                            |
| expense_date            | DATE          | Required, no future dates           |
| amount                  | DECIMAL(12,2) | Required, > 0                       |
| currency                | VARCHAR(10)   | DEFAULT 'INR'                       |
| reimb_status            | ENUM          | Pending/Approved/Rejected           |
| rejection_reason        | TEXT          | Nullable                            |
| approved_by             | UUID          | FK users.id, nullable               |
| approved_at             | TIMESTAMP     | Nullable                            |
| is_paid                 | BOOLEAN       | DEFAULT false                       |
| paid_at                 | TIMESTAMP     | Nullable                            |
| processed_in_payroll_id | UUID          | FK payroll_runs, nullable           |
| version                 | INTEGER       | DEFAULT 1, optimistic locking       |
| created_by              | UUID          | Who submitted                       |
| created_at              | TIMESTAMP     | BaseEntity                          |
| updated_at              | TIMESTAMP     | BaseEntity                          |
| deleted_at              | TIMESTAMP     | Soft delete (BaseEntity)            |
| deleted_by              | UUID          | Soft delete actor (BaseEntity)      |

### reimbursement_attachments

| Column           | Type      | Notes                  |
|------------------|-----------|------------------------|
| id               | UUID PK   |                        |
| reimbursement_id | UUID      | FK reimbursements.id   |
| document_id      | UUID      | FK documents.id        |
| created_at       | TIMESTAMP |                        |

### reimbursement_audit_logs

| Column           | Type      | Notes                                          |
|------------------|-----------|------------------------------------------------|
| id               | UUID PK   |                                                |
| reimbursement_id | UUID      | FK reimbursements.id                           |
| action           | ENUM      | Created/Updated/Approved/Rejected/Paid/Deleted |
| old_data         | JSONB     | Snapshot before change                         |
| new_data         | JSONB     | Snapshot after change                          |
| performed_by     | UUID      | User who performed action                      |
| created_at       | TIMESTAMP |                                                |

---

## API Endpoints

### Employee Routes (prefix: /reimbursements)

| Method | Path            | Description                   |
|--------|-----------------|-------------------------------|
| POST   | /               | Create reimbursement          |
| GET    | /me             | Get my reimbursements (paged) |
| PUT    | /:id            | Edit pending reimbursement    |
| DELETE | /:id            | Soft delete pending           |

### Admin Routes (prefix: /admin/reimbursements)

| Method | Path            | Description                   |
|--------|-----------------|-------------------------------|
| GET    | /               | Get all reimbursements        |
| PATCH  | /:id/status     | Approve or Reject             |
| PATCH  | /:id/mark-paid  | Mark as paid                  |

---

## Business Rules

- Only `Pending` reimbursements can be edited or deleted by employee
- Approval/Rejection is irreversible (no status revert)
- `mark-paid` requires status=Approved
- Every state change is audit logged
- Minimum 1 attachment required on create
- Idempotency via Idempotency-Key header on POST
- Optimistic locking via `version` column on PUT

---

## Module Structure

```
src/modules/reimbursement/
├── controllers/
│   ├── reimbursement.controller.ts       # Employee routes
│   └── admin-reimbursement.controller.ts # Admin routes
├── services/
│   ├── reimbursement.service.ts          # Employee logic
│   └── admin-reimbursement.service.ts    # Admin logic
├── repositories/
│   └── reimbursement.repository.ts
├── entities/
│   ├── reimbursement.entity.ts
│   ├── reimbursement-attachment.entity.ts
│   └── reimbursement-audit-log.entity.ts
├── dto/
│   ├── create-reimbursement.dto.ts
│   ├── update-reimbursement.dto.ts
│   ├── employee-query.dto.ts
│   ├── admin-query.dto.ts
│   └── update-status.dto.ts
├── enums/
│   └── reimbursement.enum.ts
└── reimbursement.module.ts
```
