# PRD — Audit Log System (v1)

**Author:** PM + Engineering Lead  
**Status:** Draft  
**Last Updated:** 2026-06-20

---

## 1. Overview

An org admin today has no way to answer: *"Who changed Ravi's salary last Tuesday?"* or *"Which HR approved this leave after it was already rejected?"* Every important state change in Brello happens silently, with no record of who did it, what the previous value was, or when it happened.

This PRD defines a **production-grade, centralized, immutable audit log system** — a tamper-proof chain of every action performed inside Brello, queryable by Org Admins for their organization and by Platform Admins across all organizations.

---

## 2. Problem Statement

### Current State

There are **4 isolated, inconsistent audit implementations** in the codebase:

| Module | Table | Has API Endpoint | Consistent Schema |
|---|---|---|---|
| `user` | `audit_log` | ❌ No | ❌ Different field names |
| `attendance` | `attendance_audit_logs` | ✅ Yes (org only) | — |
| `payroll` | `payroll_audit_logs` | ❌ No | — |
| `reimbursement` | `reimbursement_audit_log` | ❌ No | — |
| **22 other modules** | — | ❌ — | ❌ — |

**Field naming is inconsistent across the 4 existing implementations:**

| Concept | `user` | `attendance` | `payroll` | `reimbursement` |
|---|---|---|---|---|
| Who acted | `actor_id` | `performed_by` | `changed_by` | `performed_by` |
| Previous state | `old_value` | `old_value` | `before_data` | `old_data` |
| New state | `new_value` | `new_value` | `after_data` | `new_data` |
| What happened | `action` (free string) | `event_type` (enum) | `action` (enum) | `action` (enum) |
| Target record | `target_id` + `target_type` | `attendance_record_id` | `entity_id` + `entity_type` | `reimbursement_id` |

**There is no UI** — the webapp has zero audit log pages (only static placeholders).

### What Admins Cannot Do Today
- See all changes made by a specific employee across the system
- Know what a salary / leave balance / role was *before* it was changed
- Export change history for compliance/HR audits
- Know who logged in from an unusual location
- Know who granted or revoked permissions for a user
- See a complete timeline of any individual record (who created it, who changed it, when, to what)

---

## 3. Goals

1. **Complete coverage** — every meaningful state change across all 26 modules is captured.
2. **Unified schema** — one table, one API, one UI. No module-specific audit silos.
3. **Immutability** — no UPDATE or DELETE ever runs on audit log records. Append-only.
4. **Rich context** — captures WHO (actor identity snapshot), WHAT (old+new values, changed fields), WHEN (timestamp), WHERE (IP, device), and WHICH MODULE.
5. **Queryable** — filter by date, actor, module, action, entity; full-text search; paginated.
6. **Exportable** — CSV/Excel export for compliance reporting.
7. **Fast** — p99 query time < 200ms on 5M rows with correct indexes.
8. **Safe** — sensitive fields (passwords, OTP hashes, tokens) are **never** stored.

---

## 4. Non-Goals

- Real-time streaming of audit events to external SIEM systems (Phase 2)
- Audit log retention policies and archival to cold storage (Phase 2)
- Self-service audit log access for individual employees (view their own activity) — Phase 2
- Automated anomaly detection on audit logs — Phase 2
- Git-style rollback from audit history — not in scope

---

## 5. Who Can See Audit Logs

| Role | Scope | Module Access |
|---|---|---|
| **Org Admin** | Own organization only | `/audit-logs` — all modules within org |
| **Platform Admin** | All organizations | `/platform/audit-logs` — all orgs, all modules with org filter |
| **HR Admin** | Own organization | Specific modules only (EMPLOYEE, LEAVE, ATTENDANCE) — configurable via RBAC |
| **Regular Employee** | ❌ None | No access to audit logs |

Module-level access for HR Admin is controlled via the existing `RequirePermission('AUDIT_LOG', 'view')` RBAC gate.

---

## 6. Centralized Data Model

### 6.1 Primary Table: `system_audit_logs`

```sql
CREATE TABLE system_audit_logs (
  -- Identity
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenancy
  enterprise_id         UUID          NOT NULL,
  organization_id       UUID,                      -- NULL for platform-level actions

  -- Actor (identity snapshot at time of action — user names/emails change over time)
  actor_id              UUID          NOT NULL,
  actor_name            VARCHAR(300)  NOT NULL,     -- "Rohan Mehta"
  actor_email           VARCHAR(255)  NOT NULL,     -- "rohan@acme.com"
  actor_role_label      VARCHAR(150),               -- "HR Admin", "Platform Admin", "Employee"
  is_platform_admin     BOOLEAN       NOT NULL DEFAULT false,

  -- What changed
  module                VARCHAR(100)  NOT NULL,     -- see Module enum below
  sub_module            VARCHAR(100),               -- finer grain within module
  action                VARCHAR(100)  NOT NULL,     -- see Action enum below
  entity_type           VARCHAR(100)  NOT NULL,     -- DB entity name e.g. "leave_request"
  entity_id             UUID          NOT NULL,     -- PK of the affected record
  entity_display_name   VARCHAR(500),               -- human readable: "Casual Leave – Jun 25-27 (John)"
  description           TEXT,                       -- human-readable summary: "Changed status from Pending to Approved"

  -- Change data (JSONB — strip sensitive fields before writing)
  old_value             JSONB,
  new_value             JSONB,
  changed_fields        TEXT[],                     -- ["status", "salary", "department_id"] — computed diff

  -- Request context
  ip_address            VARCHAR(45),                -- IPv4 or IPv6
  user_agent            TEXT,
  device                VARCHAR(150),               -- "Chrome 124 / macOS"
  request_id            VARCHAR(100),               -- trace ID for correlation

  -- Timestamp (append-only — no updated_at, no deleted_at)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
```

### 6.2 Indexes

```sql
-- Primary list query: org + time desc
CREATE INDEX idx_sal_org_time
  ON system_audit_logs (organization_id, created_at DESC);

-- Filter by module within org
CREATE INDEX idx_sal_org_module_time
  ON system_audit_logs (organization_id, module, created_at DESC);

-- Filter by actor (who did what)
CREATE INDEX idx_sal_org_actor_time
  ON system_audit_logs (organization_id, actor_id, created_at DESC);

-- Entity history (all changes to a specific record)
CREATE INDEX idx_sal_entity
  ON system_audit_logs (organization_id, entity_type, entity_id, created_at DESC);

-- Action type filter
CREATE INDEX idx_sal_org_action
  ON system_audit_logs (organization_id, action, created_at DESC);

-- Platform admin cross-org view
CREATE INDEX idx_sal_enterprise_time
  ON system_audit_logs (enterprise_id, created_at DESC);

-- Full-text search on display name + description
CREATE INDEX idx_sal_search
  ON system_audit_logs USING GIN (
    to_tsvector('english', coalesce(entity_display_name,'') || ' ' || coalesce(description,'') || ' ' || actor_name)
  );

-- changed_fields array search
CREATE INDEX idx_sal_changed_fields
  ON system_audit_logs USING GIN (changed_fields);
```

### 6.3 Module Enum

```typescript
export enum AuditModule {
  // Security
  AUTH                = 'AUTH',
  SESSION             = 'SESSION',

  // People
  EMPLOYEE            = 'EMPLOYEE',
  ORGANIZATION        = 'ORGANIZATION',
  DEPARTMENT          = 'DEPARTMENT',
  DESIGNATION         = 'DESIGNATION',

  // Access Control
  ROLE                = 'ROLE',
  PERMISSION          = 'PERMISSION',
  USER_ROLE           = 'USER_ROLE',

  // Leave
  LEAVE_CONFIG        = 'LEAVE_CONFIG',
  LEAVE_REQUEST       = 'LEAVE_REQUEST',
  LEAVE_BALANCE       = 'LEAVE_BALANCE',

  // Attendance
  ATTENDANCE          = 'ATTENDANCE',
  SHIFT               = 'SHIFT',

  // Payroll
  PAYROLL             = 'PAYROLL',
  SALARY              = 'SALARY',

  // Reimbursement
  REIMBURSEMENT       = 'REIMBURSEMENT',

  // HR
  ANNOUNCEMENT        = 'ANNOUNCEMENT',
  COMPANY_POLICY      = 'COMPANY_POLICY',
  HOLIDAY             = 'HOLIDAY',
  HR_TEMPLATE         = 'HR_TEMPLATE',
  DOCUMENT            = 'DOCUMENT',

  // Project
  PROJECT             = 'PROJECT',
  CLIENT              = 'CLIENT',

  // Billing
  BILLING             = 'BILLING',
  SUBSCRIPTION        = 'SUBSCRIPTION',

  // Platform
  PLATFORM_ENTERPRISE = 'PLATFORM_ENTERPRISE',
  PLATFORM_PLAN       = 'PLATFORM_PLAN',
  PLATFORM_SETUP      = 'PLATFORM_SETUP',
}
```

### 6.4 Action Enum

```typescript
export enum AuditAction {
  // CRUD
  CREATE              = 'CREATE',
  UPDATE              = 'UPDATE',
  DELETE              = 'DELETE',
  RESTORE             = 'RESTORE',

  // State transitions
  ACTIVATE            = 'ACTIVATE',
  DEACTIVATE          = 'DEACTIVATE',
  PUBLISH             = 'PUBLISH',
  ARCHIVE             = 'ARCHIVE',

  // Workflow
  SUBMIT              = 'SUBMIT',
  APPROVE             = 'APPROVE',
  REJECT              = 'REJECT',
  CANCEL              = 'CANCEL',
  WITHDRAW            = 'WITHDRAW',

  // Payroll lifecycle
  PROCESS             = 'PROCESS',
  LOCK                = 'LOCK',
  DISBURSE            = 'DISBURSE',
  REGENERATE          = 'REGENERATE',

  // Auth & access
  LOGIN               = 'LOGIN',
  LOGOUT              = 'LOGOUT',
  LOGIN_FAILED        = 'LOGIN_FAILED',
  GRANT               = 'GRANT',
  REVOKE              = 'REVOKE',
  ASSIGN              = 'ASSIGN',
  UNASSIGN            = 'UNASSIGN',

  // Data ops
  EXPORT              = 'EXPORT',
  IMPORT              = 'IMPORT',
  ADJUST              = 'ADJUST',           // leave balance manual adjustment
  ACCRUE              = 'ACCRUE',           // leave accrual
  PAY                 = 'PAY',              // reimbursement paid out
}
```

---

## 7. Complete Events Catalog

### 7.1 Auth & Security

| Event | Action | Entity Type | Old Value | New Value | Notes |
|---|---|---|---|---|---|
| User logged in successfully | `LOGIN` | `session` | — | `{ app_id, ip, device }` | Always logged |
| OTP login failed (wrong code) | `LOGIN_FAILED` | `user` | — | `{ reason: 'invalid_otp', attempts }` | Security |
| User logged out | `LOGOUT` | `session` | `{ login_time }` | `{ logout_time }` | |
| Session expired | `DEACTIVATE` | `session` | `{ status: 'active' }` | `{ status: 'expired' }` | |
| Login from new device/IP | `LOGIN` | `session` | — | `{ ip, device, is_new_device: true }` | Flag in display_name |
| Password changed | `UPDATE` | `user` | `{ has_password: true }` | `{ has_password: true }` | Never store hash |

### 7.2 Employee Lifecycle

| Event | Sub-Module | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|---|
| New employee created (invited) | EMPLOYEE | `CREATE` | `user` | — | `{ name, email, department_id, designation_id }` |
| Personal info updated | EMPLOYEE | `UPDATE` | `user_profile` | `{ phone, address, ... }` | Changed fields only |
| Employment details updated | EMPLOYEE | `UPDATE` | `user` | `{ department_id, designation_id, reports_to }` | Changed fields only |
| Bank info updated | EMPLOYEE | `UPDATE` | `user_bank_info` | `{ bank_name, account_last4 }` | Strip full account number |
| Government ID updated | EMPLOYEE | `UPDATE` | `user_gov_info` | `{ pan_masked, aadhar_masked }` | Mask sensitive values |
| Emergency contact added | EMPLOYEE | `CREATE` | `user_emergency_person` | — | `{ name, relation, phone }` |
| Emergency contact updated | EMPLOYEE | `UPDATE` | `user_emergency_person` | old state | new state |
| Education record added | EMPLOYEE | `CREATE` | `user_education` | — | full record |
| Experience record added | EMPLOYEE | `CREATE` | `user_experience` | — | full record |
| Asset assigned to employee | EMPLOYEE | `ASSIGN` | `user_assets` | — | `{ asset_name, asset_type, assigned_date }` |
| Asset returned | EMPLOYEE | `UNASSIGN` | `user_assets` | `{ assigned_to }` | `{ returned_at }` |
| Document uploaded | EMPLOYEE | `CREATE` | `user_document` | — | `{ doc_type, file_name }` |
| Document deleted | EMPLOYEE | `DELETE` | `user_document` | `{ doc_type, file_name }` | — |
| Employee activated | EMPLOYEE | `ACTIVATE` | `user` | `{ status: 'INACTIVE' }` | `{ status: 'ACTIVE' }` |
| Employee deactivated | EMPLOYEE | `DEACTIVATE` | `user` | `{ status: 'ACTIVE' }` | `{ status: 'INACTIVE' }` |
| Offboarding initiated | EMPLOYEE | `UPDATE` | `employee_offboarding` | — | `{ last_working_day, reason }` |

### 7.3 Organization Settings

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Org name changed | `UPDATE` | `organization` | `{ name: old }` | `{ name: new }` |
| Org logo updated | `UPDATE` | `organization` | `{ logo_url: old }` | `{ logo_url: new }` |
| Org domain updated | `UPDATE` | `organization` | `{ domain: old }` | `{ domain: new }` |
| Org GST/tax info updated | `UPDATE` | `organization` | masked old | masked new |
| Org address updated | `UPDATE` | `organization` | old address | new address |

### 7.4 Departments & Designations

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Department created | `CREATE` | `department` | — | `{ name, description }` |
| Department name updated | `UPDATE` | `department` | `{ name: old }` | `{ name: new }` |
| Department deactivated | `DEACTIVATE` | `department` | `{ status: 'ACTIVE' }` | `{ status: 'INACTIVE' }` |
| Department deleted | `DELETE` | `department` | `{ name }` | — |
| Designation created | `CREATE` | `designation` | — | `{ name, level }` |
| Designation updated | `UPDATE` | `designation` | old state | new state |
| Designation deactivated | `DEACTIVATE` | `designation` | — | — |

### 7.5 Roles & Permissions

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Role created | `CREATE` | `role` | — | `{ name, app_id }` |
| Role name updated | `UPDATE` | `role` | `{ name: old }` | `{ name: new }` |
| Role deleted | `DELETE` | `role` | `{ name }` | — |
| Permission granted to role | `GRANT` | `module_access` | `{ access_flag: false }` | `{ module, action, access_flag: true }` |
| Permission revoked from role | `REVOKE` | `module_access` | `{ module, action, access_flag: true }` | `{ access_flag: false }` |
| Role assigned to user | `ASSIGN` | `user_role_map` | — | `{ user_id, role_id, role_name }` |
| Role revoked from user | `REVOKE` | `user_role_map` | `{ role_name }` | — |

> **Critical:** Permission and role changes are the most sensitive audit events. They must be logged atomically within the DB transaction that mutates the permission table.

### 7.6 Leave Configuration

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Leave type created | `CREATE` | `leave_type` | — | `{ name, days_allowed, accrual_type }` |
| Leave type updated | `UPDATE` | `leave_type` | old config | new config (diff only) |
| Leave type deactivated | `DEACTIVATE` | `leave_type` | `{ status: 'ACTIVE' }` | `{ status: 'INACTIVE' }` |
| Accrual rule updated | `UPDATE` | `leave_accrual_rule` | old rule | new rule |
| Leave policy assigned to employee | `ASSIGN` | `leave_config` | previous policy | new policy |

### 7.7 Leave Requests

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Leave request submitted | `SUBMIT` | `leave_request` | `{ status: 'DRAFT' }` | `{ status: 'SUBMITTED', from_date, to_date, total_days, leave_type }` |
| Leave approved | `APPROVE` | `leave_request` | `{ status: 'SUBMITTED' }` | `{ status: 'APPROVED', approved_by, approved_at }` |
| Leave rejected | `REJECT` | `leave_request` | `{ status: 'SUBMITTED' }` | `{ status: 'REJECTED', rejected_by, rejection_reason }` |
| Leave cancelled by employee | `CANCEL` | `leave_request` | `{ status: prev }` | `{ status: 'CANCELLED', cancellation_reason }` |
| Leave cancelled by admin | `CANCEL` | `leave_request` | `{ status: prev }` | `{ status: 'CANCELLED', cancelled_by_admin: true, reason }` |

### 7.8 Leave Balance

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Balance manually adjusted by admin | `ADJUST` | `leave_balance` | `{ balance: X }` | `{ balance: Y, adjustment: ±Z, reason }` |
| Balance auto-accrued (cron) | `ACCRUE` | `leave_balance` | `{ balance: X }` | `{ balance: Y, accrual_amount, period }` |
| Balance reset (new year) | `UPDATE` | `leave_balance` | `{ balance: old }` | `{ balance: 0, carry_forward: N }` |

### 7.9 Attendance

| Event | Action | Entity Type | Old Value | New Value | Notes |
|---|---|---|---|---|---|
| Clock-in (office) | `CREATE` | `attendance_session` | — | `{ type: 'OFFICE', time, location }` | |
| Clock-in (remote) | `CREATE` | `attendance_session` | — | `{ type: 'REMOTE', time, geo }` | |
| Clock-out | `UPDATE` | `attendance_session` | `{ end_time: null }` | `{ end_time }` | |
| Geo-fence rejected | `REJECT` | `attendance_session` | — | `{ reason: 'GEO_OUT_OF_RANGE', distance_m }` | |
| Manual attendance created by admin | `CREATE` | `attendance_record` | — | full record | |
| Manual attendance updated by admin | `UPDATE` | `attendance_record` | old state | new state | |
| Manual attendance deleted | `DELETE` | `attendance_record` | full record | — | |
| Remote work request submitted | `SUBMIT` | `remote_approval` | — | `{ date, reason }` | |
| Remote work approved | `APPROVE` | `remote_approval` | `{ status: 'PENDING' }` | `{ status: 'APPROVED', approved_by }` | |
| Remote work rejected | `REJECT` | `remote_approval` | `{ status: 'PENDING' }` | `{ status: 'REJECTED', reason }` | |
| Shift assigned | `ASSIGN` | `rule_assignment` | prev shift | `{ shift_id, shift_name, effective_from }` | |
| Shift changed | `UPDATE` | `rule_assignment` | old shift | new shift | |
| Status override by admin | `UPDATE` | `attendance_record` | `{ status: old }` | `{ status: new }` | |

### 7.10 Payroll

| Event | Sub-Module | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|---|
| Salary component created | PAYROLL_COMPONENT | `CREATE` | `payroll_component` | — | `{ name, type, calc_type }` |
| Salary component updated | PAYROLL_COMPONENT | `UPDATE` | `payroll_component` | old config | new config |
| Salary template created | SALARY | `CREATE` | `salary_template` | — | `{ name, components }` |
| Salary template updated | SALARY | `UPDATE` | `salary_template` | old | new |
| Employee salary assigned | SALARY | `ASSIGN` | `employee_salary` | — | `{ ctc, effective_date, template }` |
| Employee salary revised | SALARY | `UPDATE` | `employee_salary` | `{ ctc: old, components: old }` | `{ ctc: new, effective_date }` |
| Payroll run created | PAYROLL | `CREATE` | `payroll_run` | — | `{ month, year, employee_count }` |
| Payroll run processed | PAYROLL | `PROCESS` | `payroll_run` | `{ status: 'DRAFT' }` | `{ status: 'PROCESSED', total_net }` |
| Payroll run locked | PAYROLL | `LOCK` | `payroll_run` | `{ status: 'PROCESSED' }` | `{ status: 'LOCKED' }` |
| Payroll disbursed | PAYROLL | `DISBURSE` | `payroll_run` | `{ is_disbursed: false }` | `{ is_disbursed: true, disbursed_at }` |
| Payslip regenerated | PAYROLL | `REGENERATE` | `payroll_run_item` | — | `{ employee_id, reason }` |
| Payroll adjustment added | PAYROLL | `CREATE` | `payroll_run_adjustment` | — | `{ type, amount, reason }` |

### 7.11 Reimbursement

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Request submitted | `SUBMIT` | `reimbursement` | — | `{ title, amount, category, expense_date }` |
| Request updated | `UPDATE` | `reimbursement` | old state | new state |
| Request approved | `APPROVE` | `reimbursement` | `{ status: 'PENDING' }` | `{ status: 'APPROVED', approved_by }` |
| Request rejected | `REJECT` | `reimbursement` | `{ status: 'PENDING' }` | `{ status: 'REJECTED', reason }` |
| Request paid | `PAY` | `reimbursement` | `{ is_paid: false }` | `{ is_paid: true, paid_at }` |
| Request deleted | `DELETE` | `reimbursement` | `{ title, amount, status }` | — |

### 7.12 Announcements

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Announcement created (draft) | `CREATE` | `announcement` | — | `{ title, target }` |
| Announcement published | `PUBLISH` | `announcement` | `{ status: 'DRAFT' }` | `{ status: 'PUBLISHED', published_at }` |
| Announcement updated | `UPDATE` | `announcement` | old content | new content |
| Announcement archived | `ARCHIVE` | `announcement` | `{ status: 'PUBLISHED' }` | `{ status: 'ARCHIVED' }` |
| Announcement deleted | `DELETE` | `announcement` | `{ title }` | — |

### 7.13 Projects & Clients

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Client created | `CREATE` | `client` | — | `{ name, contact }` |
| Client updated | `UPDATE` | `client` | old state | new state |
| Project created | `CREATE` | `project` | — | `{ name, client, type, priority, dates }` |
| Project status changed | `UPDATE` | `project` | `{ status: old }` | `{ status: new }` |
| Project dates updated | `UPDATE` | `project` | `{ start_date, end_date: old }` | `{ start_date, end_date: new }` |
| Team member added to project | `ASSIGN` | `project_team` | — | `{ user_id, employee_name, role }` |
| Team member removed | `UNASSIGN` | `project_team` | `{ employee_name }` | — |

### 7.14 Company Policies & HR Templates

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Policy created | `CREATE` | `company_policy` | — | `{ title, type }` |
| Policy updated | `UPDATE` | `company_policy` | `{ title, version }` | new content |
| Policy archived | `ARCHIVE` | `company_policy` | active state | archived state |
| Policy deleted | `DELETE` | `company_policy` | `{ title }` | — |
| Letter template created | `CREATE` | `hr_template` | — | `{ name, type }` |
| Letter template updated | `UPDATE` | `hr_template` | old | new |

### 7.15 Holidays

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Holiday created | `CREATE` | `holiday` | — | `{ name, date, type }` |
| Holiday updated | `UPDATE` | `holiday` | old state | new state |
| Holiday deleted | `DELETE` | `holiday` | `{ name, date }` | — |

### 7.16 Billing & Subscriptions

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| Trial activated | `ACTIVATE` | `organization_subscription` | — | `{ plan, trial_end }` |
| Subscription plan upgraded | `UPDATE` | `organization_subscription` | `{ plan_id: old }` | `{ plan_id: new, billing_cycle }` |
| Subscription plan downgraded | `UPDATE` | `organization_subscription` | `{ plan_id: old }` | `{ plan_id: new }` |
| Subscription cancelled | `CANCEL` | `organization_subscription` | `{ status: 'ACTIVE' }` | `{ status: 'CANCELLED' }` |
| Payment successful | `CREATE` | `payment` | — | `{ amount, method, invoice_id }` |
| Payment failed | `CREATE` | `payment` | — | `{ amount, failure_reason }` |
| Invoice generated | `CREATE` | `invoice` | — | `{ invoice_number, amount, period }` |

### 7.17 Platform Admin Actions (Platform Admin view only)

| Event | Action | Entity Type | Old Value | New Value |
|---|---|---|---|---|
| New enterprise registered | `CREATE` | `enterprise` | — | `{ name, domain }` |
| Enterprise activated | `ACTIVATE` | `enterprise` | `{ status: 'INACTIVE' }` | `{ status: 'ACTIVE' }` |
| Enterprise deactivated | `DEACTIVATE` | `enterprise` | `{ status: 'ACTIVE' }` | `{ status: 'INACTIVE' }` |
| Organization created | `CREATE` | `organization` | — | `{ name, enterprise_id }` |
| Org subscription overridden by platform | `UPDATE` | `organization_subscription` | old plan | new plan |
| Industry type created | `CREATE` | `industry_type` | — | `{ name, is_default }` |
| Industry type updated | `UPDATE` | `industry_type` | old | new |
| Industry type deleted | `DELETE` | `industry_type` | `{ name }` | — |
| Default department created | `CREATE` | `platform_department` | — | `{ name, is_default }` |
| Default designation created | `CREATE` | `platform_designation` | — | `{ name, is_default }` |
| Plan created | `CREATE` | `plan` | — | `{ name, price, tier }` |
| Plan updated | `UPDATE` | `plan` | old pricing | new pricing |

---

## 8. Technical Architecture

### 8.1 Unified `AuditModule`

Create a new shared module: `src/modules/audit/`

```
src/modules/audit/
├── audit.module.ts
├── audit.service.ts              # central writer
├── audit.controller.ts           # GET /audit-logs
├── audit.entity.ts               # system_audit_logs table
├── audit.repository.ts           # query builder
├── dto/
│   ├── create-audit-log.dto.ts   # internal use by services
│   └── audit-log-query.dto.ts    # request params
├── enums/
│   ├── audit-module.enum.ts
│   └── audit-action.enum.ts
└── utils/
    └── diff.util.ts              # compute changed_fields from old+new
```

### 8.2 AuditService Interface

```typescript
@Injectable()
export class AuditService {
  /**
   * Primary log method. Call this from any service after any state-changing operation.
   * Always fire-and-forget: void this.auditService.log(...).catch(this.logger.error)
   */
  async log(dto: CreateAuditLogDto): Promise<void>

  /**
   * Batch log — for bulk operations (e.g. announcement broadcast, bulk salary assign)
   */
  async logBatch(dtos: CreateAuditLogDto[]): Promise<void>
}
```

### 8.3 CreateAuditLogDto

```typescript
export class CreateAuditLogDto {
  // Required context (from LoggedInUser + request)
  actor_id: string;
  actor_name: string;         // "Rohan Mehta" — resolve via UserService at call site
  actor_email: string;
  actor_role_label?: string;
  is_platform_admin: boolean;
  enterprise_id: string;
  organization_id?: string;

  // What
  module: AuditModule;
  sub_module?: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  entity_display_name?: string;
  description?: string;

  // Change data
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  // changed_fields is COMPUTED by AuditService internally using diff.util.ts

  // Request context (optional, passed from controller → service layer)
  ip_address?: string;
  user_agent?: string;
  device?: string;
  request_id?: string;
}
```

### 8.4 Diff Utility

```typescript
// src/modules/audit/utils/diff.util.ts

/**
 * Returns array of top-level keys that changed between old and new objects.
 * Example: diff({ name: 'A', status: 'X' }, { name: 'B', status: 'X' }) → ['name']
 */
export function computeChangedFields(
  oldVal: Record<string, any> | null | undefined,
  newVal: Record<string, any> | null | undefined,
): string[] {
  if (!oldVal || !newVal) return [];
  const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
  return [...allKeys].filter(
    (key) => JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key]),
  );
}
```

### 8.5 Sensitive Field Sanitization

Before any value is stored in `old_value` / `new_value`, strip sensitive fields:

```typescript
const SENSITIVE_FIELDS = [
  'password', 'password_hash', 'otp', 'otp_hash',
  'access_token', 'refresh_token', 'refresh_token_hash',
  'secret', 'token', 'api_key', 'aadhar_number', 'pan_number',
  'account_number', 'ifsc_code', // bank info — store masked versions only
];

export function sanitizeForAudit(obj: Record<string, any>): Record<string, any> {
  if (!obj) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      SENSITIVE_FIELDS.some((f) => k.toLowerCase().includes(f)) ? '[REDACTED]' : v,
    ]),
  );
}
```

### 8.6 Request Context Propagation

Add `ip_address`, `user_agent`, and `request_id` to the request object via a middleware:

```typescript
// src/common/middleware/request-context.middleware.ts
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _: Response, next: NextFunction) {
    req['requestId'] = uuid();
    req['ipAddress'] = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket.remoteAddress;
    req['userAgent'] = req.headers['user-agent'] ?? '';
    next();
  }
}
```

Controllers extract these and pass down to service layer. Services pass to `auditService.log()`.

Alternative (simpler): Pass the raw `Request` object to `AuditService.log()` and let it extract context internally. Pick whichever reduces boilerplate — option B is cleaner.

### 8.7 Transaction Safety

**Rule:** Audit log writes should be inside the same DB transaction as the primary operation wherever the primary operation uses `dataSource.transaction()`. If the primary operation does NOT use a transaction, write the audit log as fire-and-forget after the primary succeeds.

```typescript
// Pattern A: Within a transaction (preferred for critical operations)
await this.dataSource.transaction(async (manager) => {
  const saved = await manager.save(LeaveRequest, entity);
  await manager.save(SystemAuditLog, {
    ...auditPayload,
    entity_id: saved.id,
  });
});

// Pattern B: Fire-and-forget after successful operation (for non-critical)
const saved = await this.repo.save(entity);
void this.auditService.log({ ...payload, entity_id: saved.id }).catch(this.logger.error);
```

**Non-negotiable:** Audit writes must **never throw and crash the calling service**. Always wrap in try-catch at the `AuditService` level.

### 8.8 Migration Strategy for Existing Audit Tables

The 4 existing module-specific audit tables (`audit_log`, `attendance_audit_logs`, `payroll_audit_logs`, `reimbursement_audit_log`) are NOT deleted — they remain as-is. A one-time SQL migration backfills their data into `system_audit_logs` with normalized field mapping.

New events going forward write ONLY to `system_audit_logs`. The old tables become read-only archives.

```sql
-- Migration: backfill payroll_audit_logs → system_audit_logs
INSERT INTO system_audit_logs (
  enterprise_id, organization_id, actor_id, actor_name, actor_email,
  module, action, entity_type, entity_id, old_value, new_value, created_at
)
SELECT
  p.enterprise_id,
  p.organization_id,
  p.changed_by AS actor_id,
  COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') AS actor_name,
  COALESCE(u.email, 'unknown') AS actor_email,
  'PAYROLL' AS module,
  UPPER(p.action) AS action,
  p.entity_type,
  p.entity_id,
  p.before_data AS old_value,
  p.after_data AS new_value,
  p.created_at
FROM payroll_audit_logs p
LEFT JOIN users u ON u.id = p.changed_by;

-- Repeat for attendance_audit_logs, reimbursement_audit_log, audit_log
```

---

## 9. API Contracts

### 9.1 List Audit Logs (Org Admin)

```
GET /audit-logs
Authorization: Bearer {token}
Required permission: AUDIT_LOG / view
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Records per page (max: 100) |
| `date_from` | ISO date | — | Filter from date (inclusive) |
| `date_to` | ISO date | — | Filter to date (inclusive). Max range: 90 days |
| `module` | AuditModule | — | Filter by module |
| `action` | AuditAction | — | Filter by action type |
| `actor_id` | UUID | — | Filter by who performed the action |
| `entity_type` | string | — | Filter by entity type |
| `entity_id` | UUID | — | Full history of a specific record |
| `search` | string | — | FTS on actor_name, entity_display_name, description |
| `sort_by` | string | `created_at` | Options: `created_at`, `actor_name`, `module` |
| `sort_order` | `ASC`/`DESC` | `DESC` | Sort direction |
| `changed_field` | string | — | Filter logs where this field changed |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "created_at": "2026-06-18T14:32:11.000Z",
        "actor": {
          "id": "uuid",
          "name": "Rohan Mehta",
          "email": "rohan@acme.com",
          "role_label": "HR Admin"
        },
        "module": "LEAVE_REQUEST",
        "sub_module": null,
        "action": "APPROVE",
        "entity": {
          "type": "leave_request",
          "id": "uuid",
          "display_name": "Casual Leave – Jun 25–27 (Priya Sharma)"
        },
        "description": "Changed status from Submitted to Approved",
        "changed_fields": ["request_status", "approved_by", "approved_at"],
        "old_value": {
          "request_status": "SUBMITTED"
        },
        "new_value": {
          "request_status": "APPROVED",
          "approved_by": "uuid",
          "approved_at": "2026-06-18T14:32:11.000Z"
        },
        "context": {
          "ip_address": "103.21.84.12",
          "device": "Chrome 124 / macOS",
          "user_agent": "Mozilla/5.0 ..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 847,
      "total_pages": 43
    }
  }
}
```

### 9.2 Entity History

```
GET /audit-logs/entity/:entityType/:entityId
```

Returns complete chronological history of all changes to a specific record. No pagination (capped at 500 entries — if a record has more, surface a warning).

### 9.3 Audit Log Stats (for Dashboard Widget)

```
GET /audit-logs/stats?date_from=2026-06-01&date_to=2026-06-20
```

```json
{
  "data": {
    "total_events": 1284,
    "by_module": [
      { "module": "LEAVE_REQUEST", "count": 342 },
      { "module": "ATTENDANCE", "count": 289 },
      { "module": "EMPLOYEE", "count": 156 }
    ],
    "by_action": [
      { "action": "UPDATE", "count": 621 },
      { "action": "APPROVE", "count": 198 },
      { "action": "CREATE", "count": 187 }
    ],
    "top_actors": [
      { "actor_id": "uuid", "actor_name": "Rohan Mehta", "count": 87 }
    ]
  }
}
```

### 9.4 Export

```
GET /audit-logs/export?date_from=2026-06-01&date_to=2026-06-20&format=csv
```

- Supports `csv` and `xlsx` formats.
- Max export range: 90 days.
- Max 50,000 rows per export.
- Returns a file download (Content-Disposition: attachment).
- Runs as a background job for large exports (> 5,000 rows) — returns a download URL via polling or email.

### 9.5 Platform Admin List (Cross-Org)

```
GET /platform/audit-logs
```

Same params as 9.1 plus:

| Param | Type | Description |
|---|---|---|
| `organization_id` | UUID | Filter to a specific org |
| `enterprise_id` | UUID | Filter to a specific enterprise |

---

## 10. Frontend Requirements

### 10.1 Routes

| Route | Access | Description |
|---|---|---|
| `/audit-logs` | Org Admin, HR Admin (RBAC) | Organization audit log |
| `/platform/audit-logs` | Platform Admin | Cross-organization audit log |

### 10.2 Audit Log List Page

**Layout:** Full-width page with a filter sidebar (collapsible on mobile) + main table.

**Filter Panel (left sidebar or top bar):**
- Date Range Picker (`date_from` → `date_to`, max 90 days, default: last 30 days)
- Module multi-select dropdown (shows `AuditModule` labels)
- Action type multi-select dropdown
- Actor search (type-to-search employee name or email)
- Changed Field input (optional — for power users)
- Search box (full-text, debounced 300ms)
- Clear All Filters button

**Table Columns:**

| Column | Content | Sortable |
|---|---|---|
| **When** | Relative time ("2h ago") with absolute on hover | ✅ |
| **Who** | Avatar + Name + Role label (e.g. "HR Admin") | ✅ |
| **Module** | Badge chip (color-coded per module) | ✅ |
| **Action** | Badge: CREATE (green), UPDATE (blue), DELETE (red), APPROVE (teal), REJECT (orange) | — |
| **What Changed** | `entity_display_name` — e.g. "Casual Leave – Jun 25–27 (Priya)" | — |
| **Changed Fields** | Comma-separated field names: "status, approved_by" | — |
| **IP / Device** | "103.21.x.x · Chrome / macOS" (truncated) | — |

**Row Click → Detail Drawer:**
- Opens right-side drawer (not modal — keeps list visible)
- Full detail panel with:
  - Actor card (name, email, role, IP, device, timestamp)
  - Module / Action / Entity info
  - **Diff viewer:**
    - Two-column layout: Old Value (left, red background) | New Value (right, green background)
    - Field-by-field comparison
    - Unchanged fields shown in neutral gray (toggle to hide)
    - Complex JSONB values pretty-printed, with collapsible nested keys
  - "View all changes to this record" link → filters list to entity_id

**Pagination:** Standard Brello DataTable pagination (page size options: 20, 50, 100).

**Export Button:**
- Top-right: "Export CSV" / "Export Excel" dropdown
- Exports current filter set
- Shows a spinner + "Generating export..." for large datasets

### 10.3 Entity History View

Embedded in entity detail pages (e.g. Employee Profile, Leave Request detail, Payroll Run detail):

```
[Timeline component]
• Jun 18, 14:32  — Rohan Mehta (HR Admin) — APPROVED — status: Submitted → Approved
• Jun 17, 09:15  — Priya Sharma (Employee) — SUBMITTED — Leave request created
```

- Chronological, oldest → newest (timeline direction)
- Each item expandable to show full old/new diff
- "View in Audit Log" link opens the full audit log filtered to this entity

### 10.4 Diff Viewer Component

A standalone `<AuditDiffViewer oldValue={...} newValue={...} changedFields={[...]} />` component.

Behavior:
- Show only changed fields by default (with toggle "Show all fields")
- Old value: red-tinted row with strikethrough text
- New value: green-tinted row
- Handle nested JSONB with collapse/expand (max 2 levels deep, "..." for deeper)
- Handle arrays: show added items (green) + removed items (red)
- Handle null→value and value→null cases gracefully
- Format dates as human-readable ("Jun 25, 2026")
- Format UUIDs as "ID: abc...xyz" (truncated with copy button)

### 10.5 Platform Admin View

Same page as `/audit-logs` with one additional filter: **Organization** (searchable dropdown of all orgs in the enterprise). Defaults to "All Organizations".

---

## 11. Filtering Logic (Backend)

```typescript
// audit.repository.ts
async findAll(organizationId: string, filters: AuditLogQueryDto): Promise<{ items: SystemAuditLog[]; total: number }> {
  const qb = this.repo.createQueryBuilder('log')
    .where('log.organization_id = :organizationId', { organizationId });

  if (filters.date_from) qb.andWhere('log.created_at >= :from', { from: filters.date_from });
  if (filters.date_to)   qb.andWhere('log.created_at <= :to', { to: endOfDay(filters.date_to) });
  if (filters.module)    qb.andWhere('log.module = :module', { module: filters.module });
  if (filters.action)    qb.andWhere('log.action = :action', { action: filters.action });
  if (filters.actor_id)  qb.andWhere('log.actor_id = :actorId', { actorId: filters.actor_id });
  if (filters.entity_type) qb.andWhere('log.entity_type = :et', { et: filters.entity_type });
  if (filters.entity_id)   qb.andWhere('log.entity_id = :eid', { eid: filters.entity_id });

  if (filters.changed_field) {
    qb.andWhere(':field = ANY(log.changed_fields)', { field: filters.changed_field });
  }

  if (filters.search) {
    qb.andWhere(
      `to_tsvector('english', coalesce(log.entity_display_name,'') || ' ' || coalesce(log.description,'') || ' ' || log.actor_name) @@ plainto_tsquery('english', :search)`,
      { search: filters.search }
    );
  }

  const total = await qb.getCount();

  qb.orderBy(`log.${filters.sort_by ?? 'created_at'}`, filters.sort_order ?? 'DESC')
    .skip((filters.page - 1) * filters.limit)
    .take(filters.limit);

  const items = await qb.getMany();
  return { items, total };
}
```

**Date range enforcement:** Max 90-day range enforced in validation pipe. If `date_to - date_from > 90 days`, throw `400 Bad Request: "Date range cannot exceed 90 days"`. Rationale: prevents accidental full-table scans. For compliance exports beyond 90 days, use the export endpoint which runs as a background job.

---

## 12. Immutability & Security

### 12.1 Database-Level Enforcement

```sql
-- Revoke UPDATE and DELETE on this table from the application DB role
REVOKE UPDATE, DELETE ON system_audit_logs FROM brello_app_user;

-- Optional: Row-level security (if using pg RLS)
ALTER TABLE system_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_delete ON system_audit_logs AS RESTRICTIVE FOR DELETE USING (false);
CREATE POLICY no_update ON system_audit_logs AS RESTRICTIVE FOR UPDATE USING (false);
```

### 12.2 Application-Level Enforcement

`AuditModule` exposes **no update or delete endpoints**. The only operation is `INSERT` via `AuditService.log()`. Any attempt to add an update/delete endpoint must go through a security review.

### 12.3 Platform Admin Cannot Delete Audit Logs

Even platform admins cannot delete audit records. This is by design — the audit log is the source of truth for compliance. If a regulatory authority requests records, they must be available.

### 12.4 Sensitive Data Rules

| Data | Policy |
|---|---|
| `password_hash`, `otp_hash` | Never stored — REDACTED at `sanitizeForAudit()` |
| Full Aadhar number | Mask as `XXXX-XXXX-1234` |
| Full bank account number | Mask as `XXXXXX1234` |
| Access/Refresh tokens | Never stored |
| PAN number | Store as `ABCDE1234F` (full — not sensitive by classification) |
| Salary / CTC | Store as-is — authorized admins can see this |

---

## 13. RBAC Integration

New module code: `AUDIT_LOG`

| Role | Action | Scope |
|---|---|---|
| Platform Admin | `view`, `export` | All orgs |
| Org Admin | `view`, `export` | Own org only |
| HR Admin | `view` (configurable) | Own org — modules: EMPLOYEE, LEAVE, ATTENDANCE |
| All others | No access | — |

Add `AUDIT_LOG` to the app modules seeder with `wbs_code`, `path: '/audit-logs'`, `icon: 'ClipboardList'`.

---

## 14. Performance Requirements

| Scenario | Target |
|---|---|
| List query (30-day window, no filters) | p99 < 200ms |
| List query (with 3+ filters) | p99 < 150ms |
| Entity history (single record) | p99 < 100ms |
| Stats endpoint (30-day) | p99 < 300ms |
| Export 5,000 rows as CSV | < 5s |
| Export 50,000 rows (background job) | < 60s |

Achieved via:
- Composite indexes defined in Section 6.2
- `date_from` / `date_to` always required (no unbounded queries)
- `LIMIT` enforced server-side (max 100 per page)
- Stats endpoint: optional Redis cache with 60s TTL
- Large exports: run in a background job via Bull queue (Phase 2) or Node.js stream with chunked writes

---

## 15. Data Retention

| Tier | Policy |
|---|---|
| Active data | Keep in `system_audit_logs` for 12 months |
| Archive | After 12 months → move to `system_audit_logs_archive` (identical schema, partitioned by year) — Phase 2 |
| Deletion | Never deleted; archived data remains accessible to Platform Admin |

For now (Phase 1): No archival. Keep all records in one table. Revisit when row count exceeds 10M.

Use PostgreSQL **table partitioning by range on `created_at`** from day one to make future archival a partition-detach operation rather than a costly DELETE/INSERT.

```sql
CREATE TABLE system_audit_logs (
  -- same schema as above
) PARTITION BY RANGE (created_at);

CREATE TABLE system_audit_logs_2026
  PARTITION OF system_audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE system_audit_logs_2027
  PARTITION OF system_audit_logs
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
```

---

## 16. Delivery Phases

### Phase 1 — Foundation + Core Modules (5 weeks)

**Week 1: Infrastructure**
- [ ] Create `AuditModule`, `AuditService`, `SystemAuditLog` entity
- [ ] Define `AuditModule` enum, `AuditAction` enum
- [ ] `sanitizeForAudit()` utility
- [ ] `computeChangedFields()` diff utility
- [ ] `RequestContextMiddleware` (IP, user-agent, request-id)
- [ ] DB: `system_audit_logs` table with partitioning + all indexes
- [ ] `GET /audit-logs` controller with all filter params
- [ ] `GET /platform/audit-logs` controller (platform admin)
- [ ] Unit tests for diff utility and sanitizer

**Week 2: Migrate + Wire Existing Audit Logs**
- [ ] SQL migration: backfill `payroll_audit_logs` → `system_audit_logs`
- [ ] SQL migration: backfill `attendance_audit_logs` → `system_audit_logs`
- [ ] SQL migration: backfill `reimbursement_audit_log` → `system_audit_logs`
- [ ] SQL migration: backfill `audit_log` (user module) → `system_audit_logs`
- [ ] Replace `PayrollAuditService.record()` to write to `AuditService`
- [ ] Replace `AttendanceAuditLog` creation to write to `AuditService`
- [ ] Replace `ReimbursementAuditLog` creation to write to `AuditService`
- [ ] Replace `EmployeeService.createAuditLog()` to write to `AuditService`

**Week 3: Wire All Missing Modules**
- [ ] Auth module: login, logout, login_failed
- [ ] Department / Designation: CRUD
- [ ] Role / Permission / UserRoleMap: CRUD + grant/revoke
- [ ] Leave Request: submit, approve, reject, cancel
- [ ] Leave Balance: adjust, accrue
- [ ] Leave Config: create, update, deactivate
- [ ] Holiday: CRUD
- [ ] Announcement: create, publish, update, archive, delete
- [ ] Company Policy: CRUD
- [ ] Organization settings: update

**Week 4: Wire Remaining Modules + Export**
- [ ] Project + Client: CRUD, team assignment
- [ ] HR Template / Letter Template: CRUD
- [ ] Billing: plan change, payment, invoice
- [ ] Subscription: activate, cancel, expire
- [ ] Platform: enterprise/org CRUD, industry types, default depts/designations
- [ ] `GET /audit-logs/stats` endpoint
- [ ] `GET /audit-logs/export?format=csv` endpoint (streamed response)
- [ ] `GET /audit-logs/export?format=xlsx` endpoint
- [ ] `GET /audit-logs/entity/:type/:id` endpoint

**Week 5: Frontend**
- [ ] Route `/audit-logs` + `/platform/audit-logs`
- [ ] Filter panel (date range, module, action, actor, search)
- [ ] Audit Log table with all columns
- [ ] Row click → Detail drawer
- [ ] `AuditDiffViewer` component (old/new field diff)
- [ ] Entity history timeline component (for embedding in entity pages)
- [ ] Embed entity history in: Employee Profile, Leave Request detail, Payroll Run detail, Reimbursement detail
- [ ] Export button (CSV + XLSX)
- [ ] RBAC gate (`RequireAccess` + `PermissionGate` on action buttons)
- [ ] Audit Log stats widget on dashboard (top 3 modules by event count)

### Phase 2 (Future)
- [ ] Individual employee self-service: "My Activity" page (own actions only)
- [ ] Table partitioning automation (yearly partition creation cron)
- [ ] Archive old partitions to cold storage (S3 / Glacier)
- [ ] Anomaly detection: alert on unusual spike in DELETE actions or permission changes
- [ ] SIEM webhook: stream events to Splunk / ELK (Webhook on `AuditService.log()`)
- [ ] Large export background job with email delivery

---

## 17. Open Questions

| # | Question | Owner | Needed By |
|---|---|---|---|
| 1 | Is 90-day max filter range acceptable for org admins? Some may need quarterly reviews (up to 3 months = fine). | PM | Week 1 |
| 2 | Should HR Admin have access to ROLE/PERMISSION audit logs? Or only Org Admin? | PM | Week 1 |
| 3 | Do we partition by year (simple) or by org + month (complex but better for large multi-tenant scale)? | Infra | Week 1 |
| 4 | Should login_failed events be throttled from audit storage (could be high volume during brute force)? | Security | Week 3 |
| 5 | For salary-related old/new values — is it OK for HR Admin to see exact CTC figures in audit logs? | PM + Legal | Week 3 |
| 6 | Should audit log export be gated behind a specific permission action (`export`) separate from `view`? | PM | Week 4 |
| 7 | Do we need a "Reason / Comment" field on audit entries for manual admin actions (e.g. manual salary adjustment reason)? | PM | Week 3 |

---

## 18. Success Metrics (Post-Launch)

| Metric | Target |
|---|---|
| Audit coverage (% of state-changing operations tracked) | > 95% |
| p99 list query time | < 200ms |
| False-positive sensitive data leaks (passwords/tokens in audit values) | 0 |
| Support tickets: "Who changed X?" resolved via audit log | > 80% resolved without engineering involvement |
| Admin satisfaction score on audit log feature | > 4.2/5 in product survey |
| Compliance audit time for HR audits | Reduced by > 60% |
