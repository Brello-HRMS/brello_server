# Payroll Configuration — Implementation Plan (v3 Final)

## Overview

This document maps the Payroll Configuration PRD (v3) to concrete backend changes in the
`brello_server` NestJS/TypeORM codebase. It covers what exists, what changes, and why.

---

## 1. Module Location

```
src/modules/payroll/
├── controllers/
│   └── payroll.controller.ts
├── dto/
│   ├── dry-run.dto.ts
│   ├── employee-listing.dto.ts
│   ├── employee-salary.dto.ts       ← updated (versioning + propagation)
│   ├── payroll-component.dto.ts     ← updated
│   ├── payroll-setting.dto.ts       ← updated (full revamp)
│   └── pf-config.dto.ts             ← updated (versioning fields)
├── entities/
│   ├── employee-salary-component.entity.ts  ← NEW
│   ├── employee-salary.entity.ts            ← updated (versioned)
│   ├── employee-statutory-override.entity.ts ← NEW
│   ├── payroll-audit-log.entity.ts          ← NEW
│   ├── payroll-component.entity.ts          ← updated
│   ├── payroll-setting.entity.ts            ← updated (full revamp)
│   ├── pf-config.entity.ts                  ← updated (versioned)
│   ├── salary-template-component.entity.ts
│   └── salary-template.entity.ts
├── enums/
│   └── payroll.enum.ts              ← updated (many new enums)
├── repositories/
│   └── employee-salary.repository.ts ← updated
├── services/
│   ├── change-propagation.service.ts ← NEW
│   ├── component-master.service.ts   ← updated
│   ├── dry-run.service.ts
│   ├── employee-salary.service.ts    ← updated (versioning)
│   ├── payroll-calculation.service.ts
│   ├── payroll-reminder.cron.ts
│   ├── payroll.service.ts            ← updated
│   └── pf-config.service.ts          ← updated (versioning)
├── utils/
│   └── salary-structure-builder.util.ts ← updated (UUID-based)
└── payroll.module.ts                 ← updated
```

---

## 2. Database Schema Changes

### 2.1 `payroll_settings` (was: frequency, start_date, cutoff_day, payout_day, payslip_release_day)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | from BaseEntity |
| enterprise_id | UUID | multi-tenant |
| organization_id | UUID | multi-tenant |
| frequency | ENUM(monthly) | locked |
| financial_start_month | ENUM(jan–dec) | e.g. 'apr' |
| financial_end_month | ENUM(jan–dec) | derived, stored |
| financial_year_label | VARCHAR(10) | e.g. '2025-26' |
| payout_type | ENUM | last_working_day / first_working_day / custom |
| payout_date | INT nullable | 1–31 (only if custom) |
| payout_day_shift | ENUM nullable | previous / next |
| consider_holidays | BOOLEAN | default true |
| attendance_cutoff_type | ENUM | days_before_month_end / fixed_date |
| attendance_cutoff_value | INT | e.g. 4 or 26 |

**Removed columns:** `start_date`, `cutoff_day`, `payout_day`, `payslip_release_day`

### 2.2 `pf_config`

| Column | Type | Notes |
|--------|------|-------|
| employee_contribution | DECIMAL(5,2) | % |
| employer_contribution | DECIMAL(5,2) | % |
| minimum_salary_threshold | DECIMAL(10,2) | renamed from min_salary_threshold |
| wage_ceiling | DECIMAL(10,2) nullable | |
| is_wage_ceiling_enabled | BOOLEAN | renamed from salary_ceiling_enabled |
| is_enabled | BOOLEAN | NEW — toggle PF on/off |
| effective_from | DATE | NEW — versioning |
| effective_to | DATE nullable | NEW — versioning |

### 2.3 `payroll_components`

| Column | Type | Notes |
|--------|------|-------|
| name | VARCHAR(255) | |
| component_type | ENUM(earning, deduction, bonus) | renamed from `type`; added bonus |
| category | ENUM(fixed, variable, statutory) | NEW |
| calculation_type | ENUM(fixed, percentage, residual) | |
| calculate_from | UUID nullable | NEW — self-ref FK to another component |
| value | DECIMAL(12,4) nullable | NEW — explicit value/pct field |
| is_taxable | BOOLEAN | |
| is_residual | BOOLEAN | NEW — only one allowed |
| is_default | BOOLEAN | renamed from is_system_defined |
| is_editable | BOOLEAN | |
| is_active | BOOLEAN | |
| calculation_priority | INT | NEW — sort order for engine |

**Removed columns:** `calculation_value` (JSONB) — replaced by explicit `calculate_from` + `value`

**Default components auto-created per org:**
1. CTC — EARNING / FIXED, code='CTC', is_default=true, priority=0
2. Basic Salary — EARNING / PERCENTAGE, calculate_from=CTC, value=50, is_default=true, priority=1
3. PF Employee — DEDUCTION / STATUTORY / PERCENTAGE, calculate_from=Basic, value=12, is_default=true, priority=2
4. PF Employer — DEDUCTION / STATUTORY / PERCENTAGE, calculate_from=Basic, value=12, is_default=true, priority=3
5. Special Allowance — EARNING / RESIDUAL, is_residual=true, is_default=true, priority=99

**Business rules:**
- `is_default=true` → only `value` and `calculation_priority` editable, cannot delete
- `is_residual=true` → only ONE allowed per org
- Cannot delete if used in any salary template

### 2.4 `employee_salary` (was: user_id, template_id, ctc, salary_structure JSONB, effective_from)

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID | FK → users |
| version_number | INT | starts at 1, auto-increments |
| ctc | DECIMAL(12,2) | |
| effective_from | DATE | |
| effective_to | DATE nullable | set when closed |
| is_active | BOOLEAN | only one active per user |

**Removed:** `template_id`, `salary_structure` (JSONB)

**Versioning logic on update:**
```
old_salary.effective_to = new_effective_from - 1 day
old_salary.is_active    = false
new_salary.version_number = old_salary.version_number + 1
```

### 2.5 `employee_salary_components` (NEW)

Snapshot of each component at time of assignment. Self-contained — no FK to master components.

| Column | Type |
|--------|------|
| employee_salary_id | UUID FK |
| component_name | VARCHAR(255) |
| component_type | ENUM(earning, deduction, bonus) |
| value | DECIMAL(12,2) |
| calculation_type | ENUM |
| calculate_from | VARCHAR(255) nullable (name-based for readability) |
| is_residual | BOOLEAN |
| calculation_priority | INT |

### 2.6 `employee_statutory_overrides` (NEW)

Per-employee PF override.

| Column | Type |
|--------|------|
| employee_id | UUID FK → users |
| pf_applicable | BOOLEAN |
| pf_override_salary | DECIMAL(12,2) nullable |
| effective_from | DATE |

### 2.7 `payroll_audit_logs` (NEW)

| Column | Type |
|--------|------|
| entity_type | VARCHAR(100) |
| entity_id | UUID |
| action | ENUM(create, update, delete) |
| before_data | JSONB nullable |
| after_data | JSONB nullable |
| changed_by | UUID |

---

## 3. Enums Added

```
ComponentType    + bonus
ComponentCategory: fixed, variable, statutory
PayoutType:        last_working_day, first_working_day, custom
PayoutDayShift:    previous, next
AttendanceCutoffType: days_before_month_end, fixed_date
FinancialMonth:    jan | feb | mar | apr | may | jun | jul | aug | sep | oct | nov | dec
PropagationScope:  future_only, selected_employees
AuditAction:       create, update, delete
```

---

## 4. Service Logic Changes

### 4.1 PayrollService — financial year derivation

```
financial_end_month = month before financial_start_month
financial_year_label:
  if start=apr, current_year=2025 → "2025-26"
  if start=jan, current_year=2025 → "2025"
```

### 4.2 ComponentMasterService — default seeding

`ensureDefaultComponents()` creates all 5 defaults in priority order. Runs before every `getAllComponents()` call.

Update rules:
- `is_default=true` → only value/priority editable
- `is_residual=true` → only ONE allowed; validated on create
- Cannot delete if template references component

### 4.3 PfConfigService — versioning

On `upsertConfig`:
1. Find current config where `effective_to IS NULL`
2. Set `effective_to = new.effective_from - 1 day`
3. Create new record with `effective_to = null`

### 4.4 SalaryTemplateEngine — defaults enforcement

On `createTemplate`:
1. Auto-include CTC, Basic, Special Allowance if missing
2. Block removal of default components
3. Validate DAG using component UUIDs (not name strings)

### 4.5 EmployeeSalaryEngine — full versioning

On `assignSalary` (new or update):
1. Find existing active salary for user
2. If exists: set `effective_to = effective_from - 1`, `is_active = false`
3. Create new `employee_salary` with `version_number = prev + 1`
4. Snapshot all template components into `employee_salary_components`

On `updateSalaryComponents`:
1. Same versioning flow — creates a new version
2. Copies existing components, applies updates, stores new version

### 4.6 ChangePropagationService (NEW)

Triggered when a payroll component or PF config changes.

`previewImpact(componentId)` → returns affected template count + employee count

`applyPropagation(dto: PropagationApplyDto)`:
- scope = `future_only`: update master only, no employee impact
- scope = `selected_employees`: for each employee, create new salary version with updated component value

---

## 5. API Endpoints (new/changed)

```
# Payroll Settings
PUT  /payroll/configurations                   ← new field structure
GET  /payroll/configurations

# PF Config (versioned)
PUT  /payroll/statutory-pf-config             ← creates new version
GET  /payroll/statutory-pf-config             ← returns active config

# Component Master
POST   /payroll/component-master
GET    /payroll/component-master
PUT    /payroll/component-master/:id
DELETE /payroll/component-master/:id

# Salary Templates
POST /payroll/salary-templates
GET  /payroll/salary-templates
GET  /payroll/salary-templates/:id

# Employee Salary (versioned)
POST /payroll/employee-salary-assignments      ← creates v1 or new version
GET  /payroll/employees/:userId/salary         ← returns active version
PUT  /payroll/employees/:userId/salary         ← creates new version
GET  /payroll/employees/:userId/salary/history ← all versions

# Change Propagation (NEW)
GET  /payroll/propagation/preview?component_id=  ← impact preview
POST /payroll/propagation/apply                  ← apply to employees

# Employee Statutory Override (NEW)
PUT  /payroll/employees/:userId/statutory-override

# Dry Run (unchanged)
POST /payroll/simulations/dry-run

# Employees listing (unchanged)
GET  /payroll/employees
```

---

## 6. Calculation Engine — SalaryStructureBuilder

### New flow (UUID-based, priority-sorted)

```
1. Load all components from template (sorted by calculation_priority)
2. Add CTC to context: context[ctc_component.id] = input_ctc
3. For each component (skip CTC):
   - FIXED:      value = component.value
   - PERCENTAGE: base = context[component.calculate_from]
                 value = (base * component.value) / 100
   - RESIDUAL:   value = ctc - sum(all earnings computed so far)
4. Build earnings[] and deductions[] arrays
5. Store each as EmployeeSalaryComponent row (snapshot)
```

---

## 7. Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| Mid-month change | Default effective_from = next payroll start |
| Circular dependency | DAG validation in SalaryTemplateEngine |
| Multiple residual components | Blocked on create |
| is_default component edit | Only value/priority allowed |
| PF toggle | employee_statutory_override takes precedence |
| Future salary exists | Warn + ask scope in propagation |
| Template change | No employee impact (copy-on-assign) |
| Retroactive change | Blocked — effective_from must be >= today |

---

## 8. Design Principles (from PRD)

| Principle | How |
|-----------|-----|
| No retroactive mutation | Version records, never mutate history |
| Template isolation | Components copied to employee_salary_components on assign |
| Single residual | Enforced at service layer |
| Auditability | payroll_audit_logs table |
| Propagation safety | Preview step required; default scope = future_only |

---

## 9. Implementation Status (Frontend — brello_webapp)

### Routes
| Path | Component | Notes |
|------|-----------|-------|
| `organisation/payroll` | `PayrollConfigPage` | Cycle setup, PF, components, templates |
| `payroll/listing` | `PayrollEmployeesPage` | Employee list with salary summary |
| `payroll/listing/:employeeId` | `PayrollEmployeeDetailPage` | Salary structure + assign/edit |

### API Changes vs Original Plan
| Endpoint | Status | Change |
|----------|--------|--------|
| `DELETE /payroll/salary-templates/:id` | **Added** | Not in original plan |
| `GET /payroll/employees` | **Enriched** | Now returns `annual_ctc, monthly_ctc, gross, deductions, take_home` per employee |

### Frontend Field Mapping (Old → New)
| Section | Old | New |
|---------|-----|-----|
| PayrollCycleConfig | `frequency, start_date, cutoff_day, payout_day, payslip_release_day` | `financial_start_month, payout_type, payout_date?, payout_day_shift?, consider_holidays, attendance_cutoff_type, attendance_cutoff_value` |
| StatutoryPFConfig | `min_salary_threshold, wage_ceiling, salary_ceiling_enabled` | `minimum_salary_threshold, is_enabled, effective_from` (versioned) |
| SalaryComponent | `type, calculation_value(JSONB), is_system_defined` | `component_type, category, value, calculate_from(UUID), is_default, is_residual, is_editable, calculation_priority` |

### Key Frontend Files
```
brello_webapp/src/
├── features/payroll/
│   ├── types/payrollConfigTypes.ts         ← all types updated
│   ├── api/payrollApi.ts                    ← new: employee list, assign, dry run, delete template
│   ├── hooks/
│   │   ├── usePayrollConfig.ts              ← deleteTemplate added to useSalaryTemplates
│   │   └── useEmployeePayroll.ts            ← NEW: useEmployeeList, useAssignSalary, useDryRun
│   ├── columns/
│   │   ├── salaryComponentColumns.tsx       ← component_type, is_default, UUID base lookup
│   │   └── employeePayrollColumns.tsx       ← avatar, financial columns, eye action
│   ├── components/
│   │   ├── PayrollCycleSetup/              ← full rewrite (7 new fields)
│   │   ├── StatutorySetupPF/               ← is_enabled, effective_from, renamed threshold
│   │   ├── AddComponentModal/              ← component_type, category, is_default guards
│   │   ├── CreateSalaryTemplateModal/      ← UUID-based dependency resolution
│   │   ├── SalaryTemplates/                ← delete button added
│   │   ├── AssignSalaryModal/              ← NEW: template + CTC + inline dry run
│   │   └── DryRunModal/                    ← NEW: standalone preview with optional fields
│   └── validation/payrollSchema.ts         ← updated + assignSalarySchema + dryRunSchema
└── pages/payroll/
    ├── PayrollConfigPage.tsx               ← updated handlers + template delete modal
    ├── PayrollEmployeesPage.tsx            ← redesigned (avatar, financial cols, eye→detail)
    └── PayrollEmployeeDetailPage.tsx       ← NEW: profile + salary breakdown + inline assign
```
