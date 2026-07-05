# Brello HRMS

# Product Requirements & Technical Design Specification

# Letter Management Module

**Version:** V1.0 (Production Ready)

---

# Chapter 4 — Backend Architecture & Business Logic

---

# 4.1 Overview

The backend architecture follows Brello's existing modular NestJS architecture.

The Letter Management module is responsible only for:

- Letter configuration
- Letter generation
- Letter storage
- Letter retrieval

It **does not own** employee, payroll, organization, authentication, RBAC, notification, or document logic.

Instead, it orchestrates these modules.

---

# 4.2 Module Structure

```
src/modules/letter-management/

├── categories/
│   ├── controller/
│   ├── service/
│   ├── repository/
│   ├── dto/
│   ├── entities/
│   └── validators/
│
├── templates/
│   ├── controller/
│   ├── service/
│   ├── repository/
│   ├── dto/
│   ├── entities/
│   └── validators/
│
├── signatories/
│
├── settings/
│
├── issued-letters/
│
├── shared/
│
│   ├── variable-registry/
│   ├── variable-resolver/
│   ├── render-model-builder/
│   ├── pdf-builder/
│   ├── numbering/
│   ├── validators/
│   ├── mappers/
│   └── interfaces/
│
└── letter-management.module.ts
```

Each module owns its business logic.

Shared contains reusable infrastructure.

---

# 4.3 Service Responsibilities

The biggest mistake in document systems is creating one massive service.

Instead, responsibilities are divided.

```
Controller

↓

Application Service

↓

Domain Services

↓

Repositories

↓

Infrastructure
```

Every service should have **one responsibility**.

---

# 4.4 Controllers

Controllers should contain **no business logic**.

Responsibilities

- Validate DTO
- Authentication
- Authorization
- Call service
- Return response

Never

- Generate PDFs
- Resolve variables
- Query payroll
- Build documents

---

# 4.5 Category Service

Responsible for

- Create category
- Update category
- Archive category
- List categories

Validation

- Duplicate name
- Organization ownership
- Published template dependency

Business Rules

Cannot archive category if published templates exist.

---

# 4.6 Template Service

Responsible for

- Create template
- Edit template
- Publish
- Archive
- Duplicate
- Preview

Validation

- Valid variables
- Heading exists
- Paragraphs exist
- Valid signatory

Publishing performs

```
Validate Variables

↓

Validate Structure

↓

Extract Variables

↓

Increment Version

↓

Publish
```

---

# 4.7 Variable Registry Service

This service contains every supported variable.

Example

```
employee_name

department

designation

today_date

organization_name
```

Responsibilities

- Return catalog
- Validate template variables
- Categorize variables

No database.

Pure code.

---

# 4.8 Variable Resolver Service

Purpose

Convert

```
Employee

+

Payroll

+

Organization

↓

Flat Variable Map
```

Example

```
{
employee_name:"John Doe",
designation:"Software Engineer",
department:"Engineering",
doj:"01 Jan 2025"
}
```

---

Responsibilities

- Fetch required data
- Resolve variables
- Apply formatting
- Detect missing values

Never

- Build PDFs
- Save letters

---

# 4.9 Resolver Strategy

Instead of

```
if(variable=="employee_name")
```

hundreds of times,

use a registry.

Example

```
employee_name

↓

User.full_name
```

Every variable defines

- key
- label
- source
- formatter
- nullable

Adding a new variable becomes configuration instead of code changes throughout the module.

---

# 4.10 Data Loading Strategy

Avoid N+1 queries.

Instead of

```
User

↓

Department

↓

Designation

↓

Manager

↓

Payroll

↓

Organization
```

perform a single optimized query (or a minimal number of joins) that loads all required data into a **LetterVariableContext** object.

```
LetterVariableContext

Employee

Department

Designation

Payroll

Organization

Manager
```

Resolver operates entirely on this object.

---

# 4.11 Render Model Builder

Input

```
Template

+

Variables

+

Salary Snapshot

+

Signatory

↓

LetterRenderModel
```

Output

```
LetterRenderModel
```

No database.

No repositories.

Pure transformation.

---

Example

```
Title

Body

Bullets

Salary Table

Footer

Metadata
```

---

# 4.12 Why Render Model?

Without it

```
PDF Builder

↓

Reads Employee

↓

Reads Payroll

↓

Reads Database
```

Impossible to reuse.

With Render Model

```
PDF Builder

↓

Render Model

↓

PDF
```

Renderer becomes reusable forever.

---

# 4.13 PDF Builder

Input

```
LetterRenderModel
```

Output

```
Buffer
```

Responsibilities

- Render logo
- Render title
- Render paragraphs
- Render salary table
- Render signature
- Footer
- Page breaks

Nothing else.

---

PDF Builder never knows

- Employee
- Organization
- Payroll
- Templates

---

# 4.14 Number Generator

Separate service.

Responsibilities

```
Acquire Lock

↓

Read Settings

↓

Increment

↓

Reset Year

↓

Generate Number
```

Output

```
BRLO-2026-000145
```

No knowledge of letters.

---

# 4.15 Issued Letter Service

This is the orchestration service.

Responsibilities

- Generate letters
- Download letters
- List letters
- Archive letters

It coordinates every other service.

---

Generation Pipeline

```
Validate Request

↓

Load Template

↓

Resolve Variables

↓

Validate Missing Values

↓

Build Snapshots

↓

Build Render Model

↓

Generate PDF

↓

Upload Document

↓

Generate Letter Number

↓

Persist Issued Letter

↓

Send Notification

↓

Audit Log

↓

Return Response
```

Only this service coordinates the entire flow.

---

# 4.16 Why Orchestration?

Without orchestration

Every service starts calling every other service.

Dependencies become

```
Template

↓

PDF

↓

Payroll

↓

Notification

↓

Documents
```

Eventually impossible to maintain.

Instead

```
Issued Letter Service

↓

Coordinates Everything
```

Dependencies stay clean.

---

# 4.17 Notification Service Integration

Letter module never sends emails directly.

Instead

```
NotificationService.send()
```

Fire-and-forget.

Failures never rollback generation.

---

# 4.18 Document Module Integration

After PDF generation

```
Buffer

↓

StorageService

↓

Document

↓

Document ID
```

Letter module stores only

```
pdf_document_id
```

Storage remains centralized.

---

# 4.19 Audit Module Integration

Every action records an audit event.

Events include

- Category Created
- Category Updated
- Category Archived
- Template Created
- Template Published
- Template Archived
- Signatory Created
- Signatory Updated
- Letter Generated
- Letter Downloaded (optional, configurable)
- Settings Updated

Audit payload includes:

- User ID
- Organization ID
- Entity ID
- Before values (where applicable)
- After values
- Timestamp
- IP/User Agent (if your audit module already captures these)

---

# 4.20 Error Handling Strategy

Business errors should be predictable and meaningful.

Examples:

| Scenario                  | Response                  |
| ------------------------- | ------------------------- |
| Template archived         | 409 Conflict              |
| Unknown variable          | 422 Unprocessable Entity  |
| Missing required variable | 422 Unprocessable Entity  |
| Employee not found        | 404 Not Found             |
| No permission             | 403 Forbidden             |
| Duplicate category name   | 409 Conflict              |
| PDF generation failed     | 500 Internal Server Error |
| Storage upload failed     | 500 Internal Server Error |

Never expose stack traces to clients.

---

# 4.21 Transactions

Only the orchestration service starts a database transaction.

Transaction scope:

```
BEGIN

↓

Reserve Letter Number

↓

Create Snapshots

↓

Persist Issued Letter

↓

COMMIT
```

The PDF should be generated before the transaction is committed. If document upload fails, the transaction rolls back to prevent an issued letter without an associated PDF.

Notification dispatch occurs **after** the transaction commits.

---

# 4.22 Dependency Graph

```text
Category Service

Template Service

Signatory Service

Settings Service

        │
        ▼

Issued Letter Service
        │
        ├──────────────┐
        │              │
        ▼              ▼
Variable Resolver   Number Generator
        │              │
        ▼              ▼
Render Model Builder
        │
        ▼
PDF Builder
        │
        ▼
Document Module
```

This dependency direction prevents circular references and keeps each service focused on a single responsibility.

---

# 4.23 Design Principles

Every backend component must follow these rules:

- Controllers never contain business logic.
- Services own business rules.
- Repositories only access the database.
- Shared utilities never depend on repositories.
- PDF Builder is stateless.
- Variable Resolver is deterministic.
- Generated letters are immutable.
- Cross-module communication happens through well-defined service interfaces.

---

# 4.24 Chapter Summary

The backend architecture is built around a clear orchestration pipeline:

**Configuration → Variable Resolution → Render Model → PDF Generation → Storage → Immutable History**

This separation keeps the codebase modular, testable, and extensible. New document types in the future (such as offer letters or contractor letters) will require only a new variable resolver while reusing the same rendering, storage, and history infrastructure.

---

### Review Note

Before moving to **Chapter 5 (Variable System & Template Engine)**, I would make one improvement to the current design compared to the earlier draft:

Instead of storing `variables` as a JSON array on the template and trusting it to stay in sync with the content, treat it as **derived metadata**. On every template save or publish:

1. Parse all placeholders from the heading, paragraphs, and bullet list.
2. Validate them against the Variable Registry.
3. Store the extracted list for faster searching and preview generation.

The template content remains the single source of truth, while the stored variable list acts as an indexed cache. This avoids inconsistencies and simplifies validation.
