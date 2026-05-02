# Payroll Configuration APIs

> All endpoints require `Authorization: Bearer <access_token>` header.
> Base URL: `http://localhost:8000/api/v1`

---

## 1. Payroll Settings

### PUT /payroll/configurations

Create or update the organization's payroll cycle settings. `financial_end_month` and `financial_year_label` are derived automatically.

**Request Body:**

```json
{
  "financial_start_month": "apr",
  "payout_type": "custom",
  "payout_date": 1,
  "payout_day_shift": "next",
  "consider_holidays": true,
  "attendance_cutoff_type": "days_before_month_end",
  "attendance_cutoff_value": 4
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| financial_start_month | `FinancialMonth` enum | ✅ | jan–dec |
| payout_type | `PayoutType` enum | ✅ | last_working_day / first_working_day / custom |
| payout_date | int (1–31) | only if custom | |
| payout_day_shift | `PayoutDayShift` enum | ❌ | previous / next |
| consider_holidays | boolean | ❌ | default: true |
| attendance_cutoff_type | `AttendanceCutoffType` enum | ✅ | days_before_month_end / fixed_date |
| attendance_cutoff_value | int (1–31) | ✅ | |

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "financial_start_month": "apr",
    "financial_end_month": "mar",
    "financial_year_label": "2025-26",
    "payout_type": "custom",
    "payout_date": 1,
    "payout_day_shift": "next",
    "consider_holidays": true,
    "attendance_cutoff_type": "days_before_month_end",
    "attendance_cutoff_value": 4
  }
}
```

---

### GET /payroll/configurations

Returns the current payroll settings for the organization.

**Response:** `200 OK` — same shape as above, or `null` if not configured.

---

## 2. Component Master

### POST /payroll/component-master

Creates a custom salary component. Default components (CTC, Basic Salary, PF Employee, PF Employer, Special Allowance) are auto-seeded and cannot be created via this endpoint.

**Request Body:**

```json
{
  "name": "HRA",
  "component_type": "earning",
  "category": "fixed",
  "calculation_type": "percentage",
  "calculate_from": "<basic-salary-component-uuid>",
  "value": 40,
  "is_taxable": false,
  "is_residual": false,
  "calculation_priority": 5
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | ✅ | |
| component_type | `ComponentType` enum | ✅ | earning / deduction / bonus |
| category | `ComponentCategory` enum | ✅ | fixed / variable / statutory |
| calculation_type | `CalculationType` enum | ✅ | fixed / percentage / residual |
| calculate_from | UUID | ❌ | UUID of parent component; required for percentage type |
| value | number | ❌ | fixed amount or percentage value |
| is_taxable | boolean | ❌ | |
| is_residual | boolean | ❌ | only one allowed per org |
| calculation_priority | int | ❌ | lower = calculated first |

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "HRA",
    "component_type": "earning",
    "category": "fixed",
    "calculation_type": "percentage",
    "calculate_from": "uuid-of-basic",
    "value": "40.0000",
    "is_taxable": false,
    "is_residual": false,
    "is_default": false,
    "is_editable": true,
    "calculation_priority": 5
  }
}
```

**Errors:**

| Condition | Code |
|-----------|------|
| `is_residual: true` when one already exists | `400` |
| `calculation_type: residual` when one already exists | `400` |

---

### GET /payroll/component-master

Returns all active components for the organization. Auto-seeds defaults on first call.

**Response:** `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "CTC",
      "code": "CTC",
      "component_type": "earning",
      "category": "fixed",
      "calculation_type": "fixed",
      "value": "0.0000",
      "is_default": true,
      "is_editable": false,
      "calculation_priority": 0
    },
    {
      "id": "uuid",
      "name": "Basic Salary",
      "component_type": "earning",
      "category": "fixed",
      "calculation_type": "percentage",
      "calculate_from": "<ctc-uuid>",
      "value": "50.0000",
      "is_default": true,
      "is_editable": true,
      "calculation_priority": 1
    }
  ]
}
```

---

### PUT /payroll/component-master/:id

Updates a component. For default components (`is_default: true`), only `value` and `calculation_priority` can be changed.

**Request Body:**

```json
{
  "value": 45,
  "calculation_priority": 1,
  "is_active": true,
  "is_taxable": true
}
```

**Errors:**

| Condition | Code |
|-----------|------|
| Component not found | `404` |

---

### DELETE /payroll/component-master/:id

Deletes a custom component.

**Errors:**

| Condition | Code |
|-----------|------|
| Component is a default | `400` — Default components cannot be deleted |
| Component is in use in a template | `400` — Component is used in one or more salary templates |

---

## 3. Statutory PF Config

### PUT /payroll/statutory-pf-config

Creates a new PF config version. The current active config (where `effective_to` is null) is automatically closed with `effective_to = effective_from − 1 day`.

**Request Body:**

```json
{
  "employee_contribution": 12.0,
  "employer_contribution": 12.0,
  "minimum_salary_threshold": 15000,
  "is_enabled": true,
  "effective_from": "2026-04-01"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employee_contribution | number | ✅ | percentage |
| employer_contribution | number | ✅ | percentage |
| minimum_salary_threshold | number | ✅ | Basic salary must exceed this for PF to apply |
| is_enabled | boolean | ❌ | default: true |
| effective_from | date string | ✅ | must be after current active config's effective_from |

**Errors:**

| Condition | Code |
|-----------|------|
| `effective_from` ≤ current active config date | `400` |

---

### GET /payroll/statutory-pf-config

Returns the currently active PF config (where `effective_to` is null).

---

### GET /payroll/statutory-pf-config/history

Returns all PF config versions ordered by `effective_from DESC`.

---

## 4. Salary Templates

### POST /payroll/salary-templates

Creates a salary template. CTC, Basic Salary, and Special Allowance are auto-included even if not listed in `components`.

**Request Body:**

```json
{
  "name": "Standard Software Engineer",
  "description": "For mid-level engineers",
  "components": [
    { "component_id": "<hra-uuid>", "sort_order": 5 }
  ]
}
```

**Validation:**

- Circular dependencies are rejected (DAG check)
- Each component's dependency must be included in the template
- If a component depends on another, its `sort_order` must be higher

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Standard Software Engineer",
    "is_active": true,
    "components": [
      { "component_id": "<ctc-uuid>", "sort_order": 0 },
      { "component_id": "<basic-uuid>", "sort_order": 1 },
      { "component_id": "<hra-uuid>", "sort_order": 5 },
      { "component_id": "<special-allowance-uuid>", "sort_order": 99 }
    ]
  }
}
```

---

### GET /payroll/salary-templates

Returns all templates for the organization with their components.

---

### GET /payroll/salary-templates/:id

Returns a single template with full component + base_component relations.

---

## 5. Dry Run Simulation

### POST /payroll/simulations/dry-run

Simulates the full salary calculation without saving anything. Uses the same engine as actual assignment.

**Request Body:**

```json
{
  "template_id": "uuid",
  "ctc": 1200000,
  "bonus": 50000,
  "loan_emi": 5000,
  "lwp_days": 2,
  "other_deductions": 1000
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "gross": 100000,
    "deductions_total": 14000,
    "net": 86000,
    "employer_contribution": 1800,
    "earnings": [
      { "name": "Basic Salary", "type": "earning", "value": 50000, "calculated_value": 46667 },
      { "name": "HRA", "type": "earning", "value": 20000, "calculated_value": 18667 },
      { "name": "Special Allowance", "type": "earning", "value": 30000, "calculated_value": 28000 },
      { "name": "Bonus", "type": "dynamic", "value": 50000, "calculated_value": 50000 }
    ],
    "deductions": [
      { "name": "PF", "type": "statutory", "value": 6000, "calculated_value": 6000 },
      { "name": "Loan EMI", "type": "dynamic", "value": 5000, "calculated_value": 5000 },
      { "name": "Other Deductions", "type": "dynamic", "value": 1000, "calculated_value": 1000 }
    ],
    "warnings": [],
    "metadata": {
      "template_name": "Standard Software Engineer",
      "simulated_at": "2026-04-27T10:00:00.000Z",
      "currency": "INR",
      "sample_period": "April 2026"
    }
  }
}
```

---

## 6. Employee Salary Assignment

### POST /payroll/employee-salary-assignments

Assigns a salary template to an employee. Creates version 1, or increments to the next version if a salary already exists. Previous version is automatically closed.

**Request Body:**

```json
{
  "user_id": "uuid",
  "template_id": "uuid",
  "ctc": 1200000,
  "effective_from": "2026-04-01"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "version_number": 1,
    "ctc": "1200000.00",
    "effective_from": "2026-04-01",
    "effective_to": null,
    "is_active": true
  }
}
```

---

### POST /payroll/employee-salary-assignments/bulk

Assigns the same template and CTC to multiple employees.

**Request Body:**

```json
{
  "user_ids": ["uuid1", "uuid2", "uuid3"],
  "template_id": "uuid",
  "ctc": 800000,
  "effective_from": "2026-04-01"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "assigned": 3,
    "failed": []
  }
}
```

---

## 7. Employee Salary

### GET /payroll/employees

Paginated list of employees with department info.

**Query Params:**

| Param | Type | Default |
|-------|------|---------|
| page | int | 1 |
| limit | int | 10 |
| search | string | — |
| department_id | UUID | — |

---

### GET /payroll/employees/:userId/salary

Returns the active salary version with full component breakdown.

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "employee": {
      "name": "Jane Doe",
      "employee_code": "EMP001",
      "department": "Engineering"
    },
    "ctc": "1200000.00",
    "version": 2,
    "effective_from": "2026-05-01",
    "components": [
      {
        "component_name": "Basic Salary",
        "component_type": "earning",
        "value": "50000.00",
        "calculation_type": "percentage",
        "is_residual": false,
        "calculation_priority": 1
      },
      {
        "component_name": "Special Allowance",
        "component_type": "earning",
        "value": "28000.00",
        "calculation_type": "residual",
        "is_residual": true,
        "calculation_priority": 99
      }
    ]
  }
}
```

---

### GET /payroll/employees/:userId/salary/history

Returns all salary versions ordered by version number descending.

---

### PUT /payroll/employees/:userId/salary

Creates a new salary version with updated component values. Residual component is recalculated automatically.

**Request Body:**

```json
{
  "components": [
    { "component_name": "HRA", "value": 18000 }
  ],
  "effective_from": "2026-05-01"
}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "data": { "message": "Salary updated successfully." }
}
```

---

## 8. Change Propagation

### GET /payroll/propagation/preview?component_id=:uuid

Returns the number of templates and active employee salaries that would be affected if the component's value changes.

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "affected_templates": 3,
    "affected_employees": 12
  }
}
```

---

### POST /payroll/propagation/apply

Pushes an updated component value to selected employees by creating new salary versions.

**Request Body:**

```json
{
  "component_id": "uuid",
  "scope": "selected_employees",
  "employee_ids": ["uuid1", "uuid2"],
  "effective_from": "2026-05-01"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| component_id | UUID | ✅ | |
| scope | `PropagationScope` enum | ✅ | future_only / selected_employees |
| employee_ids | UUID[] | ❌ | required when scope = selected_employees |
| effective_from | date string | ✅ | must not be in the past |

**Response:** `200 OK`

```json
{
  "success": true,
  "data": {
    "updated": 2,
    "skipped": 0
  }
}
```

**Errors:**

| Condition | Code |
|-----------|------|
| `effective_from` is in the past | `400` |
| Component not found | `404` |
