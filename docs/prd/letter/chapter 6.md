# Brello HRMS

# Product Requirements & Technical Design Specification

# Letter Management Module

**Version:** V1.0 (Production Ready)

---

# Chapter 6 — Letter Generation Workflow & Business Rules

---

# 6.1 Overview

Letter generation is the primary business capability of the module.

The objective is to allow HR to generate an official organization letter in under one minute while ensuring:

- Data accuracy
- Consistency
- Auditability
- Immutability
- Compliance

Generation is treated as an atomic business transaction. Either the entire letter is successfully generated and stored, or nothing is created.

---

# 6.2 Generation Workflow

```text
HR

↓

Select Employee

↓

Select Template

↓

Resolve Variables

↓

Validate

↓

Preview

↓

Generate

↓

Create PDF

↓

Upload PDF

↓

Create Issued Letter

↓

Notify Employee

↓

Audit Log
```

Every step has clearly defined responsibilities.

---

# 6.3 Generation Entry Points

V1 supports only one entry point.

### Admin Portal

```
Letter Management

↓

Generate Letter
```

Future versions may support:

- Employee-requested generation
- Scheduled generation
- Workflow-based generation
- API generation

These are intentionally excluded from V1.

---

# 6.4 Step 1 — Employee Selection

The first step is selecting the recipient.

Search supports

- Employee Name
- Employee Code
- Email

Search is asynchronous.

Requirements

- Minimum 2 characters
- 300ms debounce
- Server-side pagination
- Organization scoped

Returned information

```
Photo

Employee Name

Employee Code

Department

Designation

Employment Status
```

Inactive employees are still searchable if the organization chooses to issue historical documents.

---

# 6.5 Employee Eligibility

Before proceeding, the system validates:

- Employee belongs to organization
- Employee record exists
- Employee is not deleted
- Employee has permission to receive letters (future extension)

Failures return descriptive validation messages.

---

# 6.6 Step 2 — Template Selection

After employee selection:

Only **Published** templates appear.

Grouped by category.

Example

```
Appointment

• Standard
• Consultant
• Internship

Experience

• Standard

Promotion

• Standard
```

Default template is automatically selected if configured.

---

# 6.7 Template Validation

Before generation

System validates

- Published
- Not archived
- Organization ownership
- Category active

If validation fails

Generation stops.

---

# 6.8 Step 3 — Variable Resolution

System loads

- Employee
- Payroll
- Organization
- Signatory
- Settings

Resolver produces

```
Resolved Values

+

Missing Values
```

Example

```
Employee Name

John Doe

Department

Engineering

Designation

Software Engineer
```

---

# 6.9 Missing Variables

Two types exist.

## Automatic

Resolved automatically.

No user interaction.

---

## Manual

Require HR input.

Example

```
Visa Number

Embassy Name

Reference Number
```

These appear as required inputs.

Generation remains disabled until completed.

---

# 6.10 Override Rules

V1 intentionally restricts overrides.

Allowed

Manual variables.

Not Allowed

```
Employee Name

Salary

Department

Designation

Joining Date
```

Reason

Generated letters must match system records.

---

# 6.11 Validation Before Preview

Before preview

System validates

✓ Employee exists

✓ Template exists

✓ Published

✓ Variables resolved

✓ Required manual values entered

✓ Signatory available

✓ Salary available (if enabled)

Only then

Preview becomes available.

---

# 6.12 Preview

Preview uses the exact Render Model that will generate the PDF.

No second rendering logic.

This guarantees

Preview == PDF

Always.

---

# 6.13 Preview Contents

Preview displays

- Organization Header
- Heading
- Paragraphs
- Bullet Lists
- Salary Table
- Signature
- Footer

Exactly as PDF.

No approximations.

---

# 6.14 Generate Action

When HR clicks

```
Generate Letter
```

Backend starts transaction.

Workflow

```
Validate

↓

Reserve Letter Number

↓

Create Snapshots

↓

Build Render Model

↓

Generate PDF

↓

Upload PDF

↓

Insert Issued Letter

↓

Commit

↓

Notify

↓

Audit
```

---

# 6.15 Number Reservation

Letter number is reserved before persistence.

Example

```
BRLO-2026-000145
```

Guarantees uniqueness.

If transaction fails

Number is **not reused**.

This avoids duplicate issuance and keeps audit trails simple. Gaps in numbering are acceptable and common in regulated systems.

---

# 6.16 Snapshot Creation

Before PDF generation

Snapshots are created.

Includes

Employee Snapshot

Organization Snapshot

Template Snapshot

Variable Snapshot

Salary Snapshot

Signatory Snapshot

Snapshots become immutable.

---

# 6.17 Render Model Creation

Render Model Builder receives

```
Template

Resolved Variables

Snapshots
```

Returns

```
LetterRenderModel
```

No database calls.

Pure transformation.

---

# 6.18 PDF Generation

Renderer receives only

```
LetterRenderModel
```

Returns

```
PDF Buffer
```

No repositories.

No ORM.

No services.

Stateless.

---

# 6.19 Storage

Generated PDF

↓

Document Module

↓

Storage Provider

↓

Document Record

↓

Document ID

Only Document ID is stored inside Issued Letter.

---

# 6.20 Issued Letter Creation

After upload

Issued Letter record is created.

Contains

- Metadata
- Snapshots
- Letter Number
- Document Reference

Generation timestamp is always server-generated.

---

# 6.21 Transaction Commit

Only after

- PDF uploaded
- Database saved

does transaction commit.

Everything before this point is atomic.

---

# 6.22 Notification

After successful commit

Notification Service invoked.

Channels

- In-App
- Email

Notification contains

```
Title

Experience Letter Generated

Message

Your Experience Letter is available for download.
```

Notification failures never rollback generation.

---

# 6.23 Audit Log

Audit event

```
Letter Generated
```

Captured data

- User
- Organization
- Employee
- Letter Number
- Template
- Category
- Timestamp

No document contents stored in audit logs.

---

# 6.24 Duplicate Generation

Generating the same template twice

is allowed.

Each generation produces

- New Letter Number
- New Snapshot
- New PDF

No deduplication.

Reason

Organizations may intentionally issue multiple letters.

---

# 6.25 Regeneration

Generated letters

Cannot be regenerated.

If HR needs a corrected letter

↓

Generate a new one.

Old letter remains part of history.

---

# 6.26 Download Rules

Admin

Can download every issued letter within organization.

Employee

Can download only their own letters.

Authorization checked server-side.

Presigned URLs should be short-lived (recommended: **5–15 minutes**) and generated on demand.

---

# 6.27 Archive Rules

Issued letters cannot be deleted.

They may only be archived.

Archive

- Hides from default list
- Keeps audit history
- Keeps download available (subject to organization policy)

---

# 6.28 Failure Recovery

If PDF generation fails

↓

Rollback

If upload fails

↓

Rollback

If database fails

↓

Rollback

If notification fails

↓

Ignore

Log failure.

---

# 6.29 Business Rules Summary

Generation allowed only when

- Employee exists
- Template published
- Variables valid
- Required inputs complete
- Signatory valid
- User has permission

Generation prohibited when

- Template archived
- Category archived
- Employee outside organization
- Missing required values
- PDF generation fails

---

# 6.30 Sequence Diagram

```text
HR
 │
 │ Select Employee
 ▼
Letter Service
 │
 │ Load Template
 ▼
Variable Resolver
 │
 │ Resolve Variables
 ▼
Render Model Builder
 │
 │ Build Model
 ▼
PDF Builder
 │
 │ Generate Buffer
 ▼
Document Module
 │
 │ Upload
 ▼
Issued Letter Repository
 │
 │ Save
 ▼
Notification Module
 │
 ▼
Employee
```

---

# 6.31 Idempotency & Double Submission

To prevent accidental duplicate generation caused by double-clicking or network retries:

- The frontend disables the **Generate Letter** button immediately after submission.
- The backend accepts an optional **Idempotency-Key** header.
- If the same authenticated user submits the same request with the same key within a configurable time window (recommended: 5 minutes), the backend returns the previously generated response instead of creating a second letter.
- Requests with different idempotency keys are treated as new generation requests.

This protects against duplicate letters while still allowing HR to intentionally generate multiple copies at different times.

---

# 6.32 Performance Targets

The generation pipeline should meet the following targets under normal operating conditions:

| Operation                  | Target      |
| -------------------------- | ----------- |
| Employee search            | < 300 ms    |
| Variable resolution        | < 500 ms    |
| Preview generation         | < 1 second  |
| PDF generation             | < 2 seconds |
| Complete letter generation | < 5 seconds |

These are service-level objectives rather than strict guarantees and should be monitored in production.

---

# 6.33 Observability

Every generation request should emit structured logs and metrics, including:

- Organization ID
- Template ID
- Category ID
- Generation duration
- PDF generation duration
- Storage upload duration
- Success/Failure status
- Failure reason (if applicable)

This enables operational monitoring and troubleshooting without exposing sensitive document contents.

---

# 6.34 Chapter Summary

The generation workflow is intentionally designed as a deterministic, transactional pipeline. Configuration is validated, variables are resolved, immutable snapshots are captured, and a PDF is generated from a render model before being stored and recorded as an issued letter. Once committed, the letter becomes a permanent historical record that is never modified.

---

## Architecture Review & Improvement

Compared to the earlier design, one important production enhancement is the addition of **idempotency support**. Without it, network retries or accidental double-clicks can create duplicate issued letters. By supporting an `Idempotency-Key` and returning the original result for repeated submissions, the module becomes significantly more resilient in real-world deployments while preserving the ability to intentionally issue multiple letters when required.
