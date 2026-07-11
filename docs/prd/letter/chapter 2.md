# Brello HRMS

# Product Requirements & Technical Design Specification

# Letter Management Module

**Version:** V1.0 (Production Ready)

---

# Chapter 2 — Domain Model & System Architecture

---

# 2.1 Introduction

This chapter defines the core business entities, ownership boundaries, module architecture, and relationships within the Letter Management module.

The objective is to establish a domain model that is:

- Simple enough for V1
- Flexible enough for future expansion
- Consistent with Brello's modular architecture
- Easy to maintain over multiple releases

Rather than building employee-specific functionality, the module is designed around the concept of **issuing official organizational documents**. Employees are simply the first supported document recipient.

---

# 2.2 Domain Philosophy

The system consists of three distinct layers:

```text
Configuration

↓

Generation

↓

History
```

Each layer has different responsibilities and different rules.

---

## Layer 1 — Configuration

Configuration defines **how** letters should look.

Nothing in this layer belongs to any employee.

It includes:

- Categories
- Templates
- Signatories
- Settings

Configuration changes over time.

---

## Layer 2 — Generation

Generation combines

- employee information
- organization information
- payroll information
- template

into a finalized document.

Generation is transactional.

No history is modified during generation.

---

## Layer 3 — History

History stores issued letters.

History is immutable.

Once created:

- cannot edit
- cannot regenerate
- cannot update
- cannot replace

Only archive.

---

# 2.3 Module Architecture

```text
Letter Management

├── Categories
│
├── Templates
│
├── Variables
│
├── Signatories
│
├── Settings
│
├── Issued Letters
│
└── Shared
      │
      ├── Variable Resolver
      ├── Render Model Builder
      ├── PDF Builder
      └── Utilities
```

Every module owns its own business logic.

Shared services contain no business rules.

---

# 2.4 Bounded Contexts

The module intentionally does **not** own employee or payroll data.

Instead, it consumes them.

| Context          | Owner               |
| ---------------- | ------------------- |
| Employee         | Employee Module     |
| Payroll          | Payroll Module      |
| Organization     | Organization Module |
| Documents        | Document Module     |
| Notifications    | Notification Module |
| Audit Logs       | Audit Module        |
| Authentication   | Auth Module         |
| Permissions      | RBAC Module         |
| Letter Templates | Letter Module       |

This prevents duplicated business logic.

---

# 2.5 Core Business Entities

The module contains seven primary entities.

---

## 1. Letter Category

Represents the business purpose of a letter.

Examples

```text
Appointment

Experience

Promotion

Confirmation

Increment

Relieving
```

Categories organize templates.

Categories never contain employee data.

---

### Responsibilities

- Group templates
- Determine business classification
- Improve searching
- Drive reporting

---

### Rules

- Organization scoped
- Soft archived
- Name must be unique
- Unlimited templates

---

Relationship

```text
Category

↓

Templates
```

---

## 2. Letter Template

Represents a reusable document blueprint.

A template contains:

- Heading
- Paragraphs
- Bullet lists
- Salary section
- Signature configuration

A template never stores employee information.

Instead it stores placeholders.

Example

```text
Dear {{employee_name}}
```

---

Responsibilities

- Define content
- Define layout
- Define variables
- Define salary inclusion
- Define signature usage

---

Lifecycle

```text
Draft

↓

Published

↓

Archived
```

---

Rules

Only published templates may generate letters.

---

Relationship

```text
Category

↓

Templates

↓

Issued Letters
```

---

## 3. Variable Registry

Variables are first-class citizens.

Templates never invent variables.

Every variable must exist inside the registry.

Example

```text
employee_name

designation

department

doj

today_date
```

The registry defines

- label
- description
- category
- source
- nullable
- editable

The registry is read-only.

Developers extend it.

HR cannot create custom variables in V1.

---

# Why?

Without a registry,

people write

```text
{{joining}}

{{joiningDate}}

{{joining_date}}

{{dateOfJoining}}
```

which becomes impossible to support.

---

## 4. Signatory

Represents a person authorized to sign letters.

Contains

- Name
- Designation
- Signature Image

No employee relationship required.

Some organizations authorize external consultants.

---

Rules

Archive only.

Cannot hard delete while referenced.

---

Relationship

```text
Template

↓

Signatory

↓

Issued Letter
```

---

## 5. Letter Settings

One record per organization.

Contains organization-wide defaults.

Example

```text
Letter Prefix

Date Format

Default Signatory

Default Category

Letter Number Format
```

Future settings may be added without schema redesign.

---

## 6. Issued Letter

The most important entity.

Represents an immutable document issued by the organization.

Everything needed to reproduce the letter is stored.

Never depends on live data.

---

Contains

Employee Snapshot

↓

Template Snapshot

↓

Variable Snapshot

↓

Salary Snapshot

↓

Generated PDF

---

Responsibilities

- Historical record
- Download source
- Audit reference
- Compliance

---

Rules

Immutable.

No edits.

No regeneration.

No overwrite.

Only archive.

---

## 7. Letter Render Model

This is **not** a database table.

It exists only during generation.

Purpose

Convert business objects into a rendering model.

```text
Template

↓

Employee

↓

Payroll

↓

Organization

↓

Variables

↓

LetterRenderModel

↓

PDF
```

The renderer receives only

```text
LetterRenderModel
```

Nothing else.

This separation dramatically reduces coupling.

---

# 2.6 Entity Relationship Diagram

```text
Organization
      │
      │
      ├──────────────┐
      │              │
      ▼              ▼
Letter Category   Letter Settings
      │
      │
      ▼
Letter Template
      │
      ├───────────────┐
      │               │
      ▼               ▼
Signatory      Variable Registry
      │               │
      └──────┬────────┘
             │
             ▼
Variable Resolver
             │
             ▼
Render Model
             │
             ▼
PDF Builder
             │
             ▼
Issued Letter
             │
             ▼
Document Storage
```

---

# 2.7 Separation of Responsibilities

## Categories

Responsible only for grouping.

Never contain content.

---

## Templates

Responsible only for defining document structure.

Never resolve variables.

Never access employees.

---

## Variable Resolver

Responsible only for data collection.

Never builds PDFs.

Never stores documents.

---

## Render Model Builder

Responsible only for converting resolved business data into a renderable structure.

Never queries the database.

---

## PDF Builder

Responsible only for rendering.

Never queries repositories.

Never understands payroll.

Never understands employees.

Input

```text
LetterRenderModel
```

Output

```text
PDF Buffer
```

---

## Issued Letter Service

Coordinates everything.

Workflow

```text
Validate

↓

Resolve Variables

↓

Build Render Model

↓

Generate PDF

↓

Upload PDF

↓

Save Record

↓

Notify Employee

↓

Audit Log
```

No rendering logic lives here.

---

# 2.8 Future Extensibility

The architecture intentionally avoids employee-specific naming.

Today

```text
Employee

↓

Issued Letter
```

Tomorrow

```text
Candidate

↓

Issued Letter
```

Later

```text
Vendor

↓

Issued Letter
```

Even later

```text
Consultant

↓

Issued Letter
```

The only component that changes is

```text
Variable Resolver
```

Everything else remains identical.

---

# 2.9 Why This Architecture?

Many HRMS systems tightly couple:

Employee

↓

Template

↓

PDF

↓

Storage

As features grow, every document type duplicates rendering logic.

Brello instead uses a **pipeline architecture**.

```text
Configuration

↓

Resolver

↓

Render Model

↓

Renderer

↓

Storage

↓

History
```

Each stage has a single responsibility, making the module easier to test, maintain, and extend.

---

# 2.10 Chapter Summary

At the end of this chapter, the Letter Management module consists of:

### Configuration Layer

- Letter Categories
- Letter Templates
- Variable Registry
- Signatories
- Letter Settings

### Generation Layer

- Variable Resolver
- Render Model Builder
- PDF Builder

### History Layer

- Issued Letters
- PDF Documents
- Audit Logs

The next chapter will define the **complete database schema**, including every table, column, relationship, indexes, constraints, naming conventions, soft-delete strategy, and transactional considerations required for a production deployment.
