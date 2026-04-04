# Payroll Configuration APIs

## 1. Payroll Settings

### PUT /api/v1/payroll/configurations

Updates the organizational payroll cycle settings.

**Request Body:**

```json
{
  "frequency": "monthly",
  "start_date": "2026-04-01",
  "cutoff_day": 25,
  "payout_day": 1,
  "payslip_release_day": 2
}
```

## 2. Component Master

### POST /api/v1/payroll/component-master

Creates a reusable component.

```json
{
  "name": "Basic",
  "type": "earning",
  "calculation_type": "percentage",
  "calculation_value": { "base": "CTC", "value": 40 },
  "is_taxable": true,
  "is_system_defined": true,
  "is_active": true
}
```

## 3. Statutory (PF) Config

### PUT /api/v1/payroll/statutory-pf-config

Updates provident fund config.

```json
{
  "employee_contribution": 12.0,
  "employer_contribution": 12.0,
  "min_salary_threshold": 15000,
  "salary_ceiling_enabled": true,
  "wage_ceiling": 15000
}
```

## 4. Salary Templates

### POST /api/v1/payroll/salary-templates

Creates a reproducible salary template structure.

```json
{
  "name": "Standard Software Engineer Package",
  "components": [
    {
      "component_id": "uuid-for-basic",
      "sort_order": 1
    },
    {
      "component_id": "uuid-for-pf",
      "sort_order": 10
    }
  ]
}
```

## 5. Employee Salary Assignment

### POST /api/v1/payroll/employee-salary-assignments

Assigns template and materialized structure to the user.

```json
{
  "user_id": "uuid-user",
  "template_id": "uuid-template",
  "ctc": 1200000,
  "effective_from": "2026-04-01",
  "overrides": {
    "Basic": { "value": 50 }
  }
}
```

## 6. Dry Run Simulation

### POST /api/v1/payroll/simulations/dry-run

Simulates the actual payload without saving.

```json
{
  "template_id": "uuid-template",
  "ctc": 1200000,
  "bonus": 50000,
  "loan_emi": 5000,
  "lwp_days": 2
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "gross": 100000,
    "deductions_total": 12000,
    "net": 88000,
    "employer_contribution": 1800,
    "earnings": [],
    "deductions": [],
    "warnings": []
  }
}
```

## 7. Employee Salary Listing and Updates

### GET /api/v1/payroll/employees

Returns a paginated list of employees with their mapped payroll department.

**Query Params:**

- `search`: string (Optional)
- `department_id`: uuid (Optional)
- `page`: int (Default: 1)
- `limit`: int (Default: 10)

### GET /api/v1/payroll/employees/{id}/salary

Fetches the structured salary breakdown for a specific employee, including component editability status.

**Response:**

```json
{
  "employee": {
    "name": "John Doe",
    "employee_code": "EMP001"
  },
  "components": [
    {
      "code": "BASIC",
      "name": "Basic",
      "type": "EARNING",
      "value": 30000,
      "is_editable": false
    },
    {
      "code": "HRA",
      "name": "House Rent Allowance",
      "type": "EARNING",
      "value": 15000,
      "is_editable": true
    }
  ]
}
```

### PUT /api/v1/payroll/employees/{id}/salary

Updates the specific editable salary components individually (local employee override).

**Request:**

```json
{
  "components": [
    {
      "code": "HRA",
      "value": 16000
    }
  ]
}
```

**Response:**

```json
{
  "message": "Salary updated successfully"
}
```
