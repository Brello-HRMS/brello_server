# Brello HRMS

# Product Requirements & Technical Design Specification

# Letter Management Module

**Version:** V1.0 (Production Ready)

---

# Chapter 5 — Variable System & Template Engine

---

# 5.1 Overview

The Variable System is the foundation of the Letter Management module.

Its responsibility is to transform reusable templates into finalized letters by replacing placeholders with real business data.

A well-designed variable system ensures:

- No manual retyping
- Consistent document generation
- Accurate employee information
- Easy template authoring
- Future extensibility

Unlike many document systems, Brello does **not** allow arbitrary variables. Every variable is predefined, validated, and resolved through a centralized registry.

---

# 5.2 Design Goals

The variable system must:

- Be predictable
- Be strongly validated
- Be easy for HR users
- Require zero technical knowledge
- Prevent invalid placeholders
- Support future document types
- Avoid duplicate implementations

---

# 5.3 Architecture

```text
Letter Template

↓

Extract Variables

↓

Validate Variables

↓

Variable Registry

↓

Variable Resolver

↓

Resolved Variable Map

↓

Render Model

↓

PDF
```

Variables never go directly into the PDF Builder.

---

# 5.4 Placeholder Syntax

Variables use Mustache-style placeholders.

```text
{{employee_name}}

{{designation}}

{{department}}

{{today_date}}
```

Rules:

- Case-sensitive
- No nested variables
- No expressions
- No functions
- No calculations
- No conditional statements

Allowed:

```text
{{employee_name}}
```

Not Allowed:

```text
{{employee.name}}

{{employee_name || "Unknown"}}

{{salary + hra}}

{{#if employee}}
```

Keeping placeholders simple keeps the renderer deterministic and secure.

---

# 5.5 Variable Registry

The Variable Registry is the single source of truth for all supported variables.

It is implemented in code, not as a database table.

Every variable defines:

| Property    | Description                     |
| ----------- | ------------------------------- |
| Key         | Unique identifier               |
| Label       | UI display name                 |
| Category    | Logical grouping                |
| Description | Help text                       |
| Source      | Origin of data                  |
| Nullable    | Can resolve to null             |
| Editable    | Can HR provide value if missing |
| Formatter   | Formatting strategy             |

Example:

```text
Key:
employee_name

Label:
Employee Name

Category:
Employee

Source:
User.full_name

Nullable:
No

Editable:
No
```

---

# 5.6 Variable Categories

Variables are grouped for better usability.

## Employee

Examples

```text
employee_name

employee_code

email

phone

dob

doj
```

---

## Employment

```text
designation

department

employment_type

work_location

reporting_manager
```

---

## Payroll

```text
ctc
```

Individual salary components are **not** exposed as variables in V1.

Salary components are rendered only through the Salary Table section.

---

## Organization

```text
organization_name

organization_address

organization_website

organization_registration_number
```

---

## System

```text
today_date

letter_number
```

System variables are generated during letter generation.

---

## Signatory

```text
signatory_name

signatory_designation
```

---

# 5.7 Variable Metadata

Each variable has metadata used by both frontend and backend.

Example:

```typescript
{
  key: "employee_name",
  label: "Employee Name",
  category: "Employee",
  nullable: false,
  editable: false,
  formatter: "text"
}
```

This metadata drives:

- Insert Variable UI
- Validation
- Preview
- Resolver
- Documentation

---

# 5.8 Variable Extraction

Whenever a template is saved or published:

1. Read heading.
2. Read paragraphs.
3. Read bullet list.
4. Extract placeholders using regex.
5. Remove duplicates.
6. Validate registry.
7. Store extracted variable list.

Example

Template

```text
Dear {{employee_name}}

Welcome to {{organization_name}}

Your designation is {{designation}}
```

Extracted

```text
employee_name

organization_name

designation
```

Stored as metadata.

---

# 5.9 Validation

Every extracted variable must exist in the registry.

Example

```text
{{joining}}
```

Validation

```text
Unknown Variable

joining

Did you mean

doj?
```

Publishing is blocked until resolved.

---

# 5.10 Required vs Optional Variables

Variables belong to two groups.

## Required

Must always resolve.

Examples

```text
employee_name

designation

organization_name
```

Generation fails if missing.

---

## Optional

May resolve to null.

Example

```text
reporting_manager
```

If null

↓

Empty string

or

HR input (if editable).

---

# 5.11 Editable Variables

Some variables cannot be sourced automatically.

Example

Visa Reference Number

Embassy Name

Reference ID

These are editable.

Metadata

```text
Editable

Yes
```

Generation screen prompts HR.

Example

```text
Reference Number

__________
```

Entered value becomes part of the snapshot.

---

# 5.12 Variable Resolution

Input

```text
Employee

Organization

Payroll

Signatory
```

↓

Resolver

↓

Output

```json
{
  "employee_name": "John Doe",
  "designation": "Software Engineer",
  "organization_name": "ABC Pvt Ltd"
}
```

The resolver always returns a flat key-value map.

---

# 5.13 Missing Values

Resolver also returns missing variables.

Example

```json
{
  "values":{...},
  "missing":[
      "visa_reference"
  ]
}
```

Frontend highlights required inputs before generation.

---

# 5.14 Formatting

Formatting happens inside the resolver.

Not inside the PDF Builder.

Examples

Date

```text
2026-07-05

↓

05 Jul 2026
```

Currency

```text
720000

↓

₹7,20,000
```

Phone

```text
919999999999

↓

+91 99999 99999
```

The renderer receives only formatted strings.

---

# 5.15 Variable Cache

The extracted variable list stored on the template is considered a cache.

Source of truth

↓

Template content.

Whenever template content changes:

```text
Parse

↓

Extract

↓

Replace Cache
```

No manual editing.

---

# 5.16 Variable Search API

The frontend needs searchable variables.

Endpoint

```http
GET /letter-management/variables
```

Response

```json
[
  {
    "category": "Employee",
    "variables": []
  },
  {
    "category": "Organization",
    "variables": []
  }
]
```

Used for the Insert Variable dropdown.

---

# 5.17 Insert Variable UX

Instead of typing placeholders,

HR clicks

```text
Insert Variable
```

Dropdown

```text
Employee

Employee Name

Employee Code

Department

Designation
```

Selecting inserts

```text
{{employee_name}}
```

at the cursor position.

Reduces template errors.

---

# 5.18 Salary Table

Salary is intentionally excluded from variables.

Not allowed

```text
{{basic}}

{{hra}}

{{pf}}
```

Instead

```text
Include Salary Table

✓
```

Automatically renders

| Component | Amount  |
| --------- | ------- |
| Basic     | ₹25,000 |
| HRA       | ₹15,000 |

This prevents manual salary mistakes.

---

# 5.19 Security

Variables never execute code.

No scripting.

No JavaScript.

No expressions.

Only literal replacement.

This completely eliminates template injection risks.

---

# 5.20 Future Extensibility

Adding a new variable requires:

1. Register variable.
2. Add resolver mapping.
3. Add formatter (if needed).

No changes required in:

- PDF Builder
- Templates
- UI
- Render Model

---

# 5.21 Variable Naming Convention

Keys use lowercase snake_case.

Examples

```text
employee_name

organization_name

today_date

employment_type
```

Never use:

```text
EmployeeName

employeeName

Employee_Name
```

Consistency simplifies parsing and documentation.

---

# 5.22 Template Content Rules

A template consists of:

- One heading (optional but recommended)
- Ordered paragraphs
- Optional bullet lists
- Optional salary table
- Optional signatory

No HTML, Markdown, or rich text is stored. Content is plain text with placeholders.

---

# 5.23 Template Preview

The editor includes a live preview using sample data.

Example:

```text
John Doe
Software Engineer
01 Jan 2026
ABC Pvt Ltd
```

This preview validates structure and layout without requiring an employee selection.

---

# 5.24 Validation Summary

A template cannot be published if:

- It contains unknown variables.
- It has no body content.
- It references an archived signatory.
- Required configuration is incomplete.

Warnings (non-blocking):

- No heading.
- No signatory selected.
- No variables used (fully static letter).

---

# 5.25 Chapter Summary

The Variable System is intentionally strict. Templates are simple text documents containing validated placeholders. A centralized Variable Registry guarantees consistency, the Variable Resolver provides formatted values, and the PDF Builder receives only resolved content.

This separation ensures that template authors never need technical knowledge while the backend remains deterministic, secure, and easy to extend.

---

## **Architecture Review & One Recommended Improvement**

At this point, I would make one enhancement over the original design:

Instead of hardcoding variable categories inside the frontend, expose the **Variable Registry** through the backend as the authoritative source. Each variable should include:

- Category
- Display label
- Description
- Example value
- Editable flag
- Required flag
- Supported document sources (Employee today; Candidate in V2)

This keeps the UI and backend synchronized and allows future expansion (e.g., Offer Letters) without frontend code changes. It also enables contextual help and richer template editing with virtually no additional maintenance cost.
