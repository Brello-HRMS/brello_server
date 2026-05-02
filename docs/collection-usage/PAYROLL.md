# Payroll Collection Setup

Run the full payroll configuration end-to-end in the order below. Each step builds on the previous one.

---

## Prerequisites

Complete `GETTING_STARTED.md` first to have:
- `enterprise_id`, `organization_id`, `user_id` in your Postman variables
- A valid `access_token`

---

## Step-by-Step Flow

### 1. Payroll Settings

`PUT /api/v1/payroll/configurations`

Configure the organization's financial year, payout schedule, and attendance cutoff:

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

> `financial_end_month` and `financial_year_label` (e.g. "2025-26") are auto-derived from `financial_start_month`.

---

### 2. Statutory PF Config

`PUT /api/v1/payroll/statutory-pf-config`

Set provident fund rules. Each save creates a new version with an effective date — old configs are closed automatically.

```json
{
  "employee_contribution": 12.0,
  "employer_contribution": 12.0,
  "minimum_salary_threshold": 15000,
  "is_enabled": true,
  "effective_from": "2026-04-01"
}
```

---

### 3. Component Master

`GET /api/v1/payroll/component-master`

Call this first — it auto-seeds the five default components for your org:

| Component | Type | Calculation |
|-----------|------|-------------|
| CTC | EARNING | FIXED (virtual root) |
| Basic Salary | EARNING | 50% of CTC |
| PF Employee | DEDUCTION | 12% of Basic |
| PF Employer | DEDUCTION | 12% of Basic |
| Special Allowance | EARNING | Residual (CTC − all other earnings) |

To create a custom component:

`POST /api/v1/payroll/component-master`

```json
{
  "name": "HRA",
  "component_type": "earning",
  "category": "fixed",
  "calculation_type": "percentage",
  "calculate_from": "<basic-salary-component-uuid>",
  "value": 40,
  "is_taxable": false,
  "calculation_priority": 5
}
```

> **Rules:**
> - Default components (`is_default: true`) — only `value` and `calculation_priority` are editable; cannot be deleted.
> - Only **one** residual component is allowed per org.
> - A component referenced in any salary template cannot be deleted.

---

### 4. Salary Templates

`POST /api/v1/payroll/salary-templates`

Templates define which components form a salary structure. CTC, Basic Salary, and Special Allowance are auto-included.

```json
{
  "name": "Standard Software Engineer",
  "components": [
    { "component_id": "<hra-uuid>", "sort_order": 5 }
  ]
}
```

> The template only stores a reference. Employee salary stores a **snapshot** (copied values), so future template changes never affect assigned employees.

---

### 5. Dry Run (Preview)

`POST /api/v1/payroll/simulations/dry-run`

Simulate the full salary breakdown without saving anything — use this before assigning.

```json
{
  "template_id": "<template-uuid>",
  "ctc": 1200000,
  "bonus": 50000,
  "loan_emi": 5000,
  "lwp_days": 2
}
```

---

### 6. Assign Salary to Employee

`POST /api/v1/payroll/employee-salary-assignments`

Materializes the template into a versioned salary snapshot for the employee.

```json
{
  "user_id": "<employee-uuid>",
  "template_id": "<template-uuid>",
  "ctc": 1200000,
  "effective_from": "2026-04-01"
}
```

> Every assignment creates **version 1** (or increments to the next version if one exists). The previous version is automatically closed with `effective_to = effective_from − 1 day`.

---

### 7. Bulk Assign (Optional)

`POST /api/v1/payroll/employee-salary-assignments/bulk`

```json
{
  "user_ids": ["<uuid1>", "<uuid2>"],
  "template_id": "<template-uuid>",
  "ctc": 800000,
  "effective_from": "2026-04-01"
}
```

---

### 8. View / Update Employee Salary

- `GET /api/v1/payroll/employees/:userId/salary` — active version with full component breakdown
- `GET /api/v1/payroll/employees/:userId/salary/history` — all past versions
- `PUT /api/v1/payroll/employees/:userId/salary` — creates a new salary version with updated component values

```json
{
  "components": [
    { "component_name": "HRA", "value": 18000 }
  ],
  "effective_from": "2026-05-01"
}
```

> Updating salary always creates a **new version** — history is never mutated.

---

### 9. Change Propagation

When a component's value changes and you need to push it to existing employees:

**Preview impact:**

`GET /api/v1/payroll/propagation/preview?component_id=<uuid>`

```json
{
  "affected_templates": 3,
  "affected_employees": 12
}
```

**Apply:**

`POST /api/v1/payroll/propagation/apply`

```json
{
  "component_id": "<uuid>",
  "scope": "selected_employees",
  "employee_ids": ["<uuid1>", "<uuid2>"],
  "effective_from": "2026-05-01"
}
```

`scope` options:
- `future_only` — update master component only; no employee impact (safe default)
- `selected_employees` — create new salary versions for chosen employees

---

## Error Reference

| Scenario | HTTP | Message |
|----------|------|---------|
| Default component deleted | 400 | Default components cannot be deleted |
| Component used in template | 400 | Component is used in one or more salary templates |
| Two residual components | 400 | Only one residual component is allowed |
| PF effective_from ≤ current | 400 | effective_from must be after the current active config date |
| Propagation in the past | 400 | effective_from cannot be in the past |
| Circular dependency | 400 | Circular dependency detected |
| Missing template dependency | 400 | Dependency is not included in the template |
