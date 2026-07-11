# Brello HRMS

# Product Requirements & Technical Design Specification

# Letter Management Module

**Version:** V1.0 (Production Ready)

---

# Chapter 3 — Database Design

---

# 3.1 Database Philosophy

The database is designed around one fundamental principle:

> **A generated letter is a legal record and must remain immutable forever.**

Everything else—templates, employees, salaries, organization information—may change over time.

Generated letters must not.

Therefore the database separates data into three groups:

```text
Configuration Data
(Changeable)

↓

Operational Data
(Generation)

↓

Historical Data
(Immutable)
```

---

# 3.2 Entity Overview

| Entity         | Purpose               | Mutable |
| -------------- | --------------------- | ------- |
| LetterCategory | Business grouping     | Yes     |
| LetterTemplate | Letter blueprint      | Yes     |
| Signatory      | Authorized signer     | Yes     |
| LetterSettings | Organization defaults | Yes     |
| IssuedLetter   | Generated letter      | No      |
| Document       | PDF Storage           | No      |

---

# 3.3 Database Schema

```text
Organization
│
├── LetterSettings
│
├── LetterCategory
│      │
│      └── LetterTemplate
│                │
│                └── IssuedLetter
│
├── Signatory
│      │
│      └── IssuedLetter
│
└── Document
        │
        ├── Signature
        └── Letter PDF
```

---

# 3.4 Table — letter_categories

Purpose

Groups templates.

Example

```text
Appointment

Experience

Promotion

Increment
```

---

## Columns

| Column          | Type                   |
| --------------- | ---------------------- |
| id              | UUID                   |
| organization_id | UUID                   |
| name            | VARCHAR(100)           |
| description     | TEXT NULL              |
| sort_order      | INT                    |
| is_system       | BOOLEAN                |
| status          | ENUM(ACTIVE, ARCHIVED) |
| created_by      | UUID                   |
| updated_by      | UUID                   |
| created_at      | TIMESTAMP              |
| updated_at      | TIMESTAMP              |

---

## Constraints

Unique

```sql
organization_id + lower(name)
```

---

## Rules

Categories cannot be deleted.

Only archived.

Archived categories disappear from dropdowns.

Historical letters remain valid.

---

# 3.5 Table — letter_templates

Purpose

Stores reusable templates.

---

## Columns

| Column               | Type                           |
| -------------------- | ------------------------------ |
| id                   | UUID                           |
| organization_id      | UUID                           |
| category_id          | UUID                           |
| name                 | VARCHAR(150)                   |
| description          | TEXT                           |
| heading              | TEXT                           |
| paragraphs           | JSONB                          |
| bullet_list          | JSONB                          |
| include_salary_table | BOOLEAN                        |
| signatory_id         | UUID NULL                      |
| variables            | JSONB                          |
| version              | INT                            |
| status               | ENUM(DRAFT,PUBLISHED,ARCHIVED) |
| created_by           | UUID                           |
| updated_by           | UUID                           |
| published_at         | TIMESTAMP                      |
| created_at           | TIMESTAMP                      |
| updated_at           | TIMESTAMP                      |

---

## Example JSON

Paragraphs

```json
[
  "Dear {{employee_name}},",
  "We are pleased to appoint you as {{designation}}.",
  "Your joining date is {{doj}}."
]
```

---

Variables

```json
["employee_name", "designation", "doj"]
```

---

Rules

Only Published templates are available during generation.

---

# 3.6 Why JSON Instead of Separate Tables?

Alternatives considered:

```text
Paragraph Table

↓

TemplateParagraph

↓

Sort Order
```

Rejected.

Reason

Templates rarely exceed

10–15 paragraphs.

JSON is

- simpler
- faster
- easier to version
- easier to snapshot

---

# 3.7 Table — signatories

Purpose

Stores authorized signatures.

---

Columns

| Column                | Type                  |
| --------------------- | --------------------- |
| id                    | UUID                  |
| organization_id       | UUID                  |
| name                  | VARCHAR(120)          |
| designation           | VARCHAR(120)          |
| signature_document_id | UUID                  |
| is_default            | BOOLEAN               |
| status                | ENUM(ACTIVE,ARCHIVED) |
| created_at            | TIMESTAMP             |
| updated_at            | TIMESTAMP             |

---

Rules

Cannot archive if used as organization default until another default is assigned.

Generated letters store a snapshot, so archiving does not affect history.

---

# 3.8 Table — letter_settings

Exactly one row per organization.

---

Columns

| Column               | Type        |
| -------------------- | ----------- |
| organization_id      | UUID PK     |
| letter_prefix        | VARCHAR(20) |
| current_year         | INT         |
| last_sequence        | INT         |
| default_signatory_id | UUID        |
| date_format          | VARCHAR(30) |
| created_at           | TIMESTAMP   |
| updated_at           | TIMESTAMP   |

---

Example

```text
Prefix

BRLO

Date Format

DD MMM YYYY

Current Year

2026

Last Sequence

145
```

---

## Number Generation

If year changes

```text
2026

↓

2027
```

Sequence resets.

Example

```text
BRLO-2027-000001
```

---

# 3.9 Table — issued_letters

This is the heart of the module.

One row equals one issued legal document.

Never modified.

---

Columns

| Column              | Type           |
| ------------------- | -------------- |
| id                  | UUID           |
| organization_id     | UUID           |
| employee_id         | UUID           |
| template_id         | UUID           |
| template_version    | INT            |
| category_id         | UUID           |
| letter_number       | VARCHAR(40)    |
| title               | VARCHAR(200)   |
| variable_snapshot   | JSONB          |
| heading_snapshot    | TEXT           |
| paragraphs_snapshot | JSONB          |
| bullets_snapshot    | JSONB          |
| salary_snapshot     | JSONB          |
| signatory_snapshot  | JSONB          |
| pdf_document_id     | UUID           |
| generated_by        | UUID           |
| generated_at        | TIMESTAMP      |
| archived_at         | TIMESTAMP NULL |

---

## Why Snapshot Everything?

Suppose

```text
Salary

₹60,000
```

Later

```text
₹75,000
```

Experience Letter must still show

```text
₹60,000
```

Snapshots solve this permanently.

---

# 3.10 Snapshot Structures

Variable Snapshot

```json
{
  "employee_name": "John Doe",
  "designation": "Software Engineer",
  "department": "Engineering",
  "doj": "01 Jan 2025"
}
```

---

Salary Snapshot

```json
{
  "components": [
    {
      "name": "Basic",
      "amount": 25000
    },
    {
      "name": "HRA",
      "amount": 15000
    }
  ],
  "total": 480000
}
```

---

Signatory Snapshot

```json
{
  "name": "Sarah Thomas",
  "designation": "HR Manager"
}
```

Never read from Signatory again.

---

# 3.11 Why Store Snapshots?

Without snapshots

```text
Employee

↓

Department Change

↓

Generated Letter changes
```

Legally unacceptable.

---

With snapshots

```text
Employee

↓

Department Change

↓

Old Letter unchanged
```

---

# 3.12 Document Table

Reuse existing Document module.

Folder Type

```text
LETTER_DOCUMENT
```

Storage

```text
letters/

organization-id/

employee-id/

issued-letter-id.pdf
```

Document stores

- storage path
- mime
- checksum
- size

Letter module stores only

```text
pdf_document_id
```

---

# 3.13 Indexes

Categories

```sql
organization_id
status
```

---

Templates

```sql
organization_id
category_id
status
```

---

Issued Letters

```sql
organization_id
employee_id
generated_at DESC
```

---

Letter Number

Unique

```sql
organization_id

letter_number
```

---

Generated By

Index

```sql
generated_by
```

---

Template

Index

```sql
template_id
```

---

Category

Index

```sql
category_id
```

---

# 3.14 Foreign Keys

```text
Category

↓

Template

ON DELETE RESTRICT
```

---

Template

↓

Issued Letter

```text
RESTRICT
```

---

Signatory

↓

Template

```text
SET NULL
```

The template may choose another signatory later.

---

Issued Letter

↓

Document

```text
RESTRICT
```

Never orphan PDFs.

---

# 3.15 Archive Strategy

Nothing is physically deleted.

Instead

```text
ACTIVE

↓

ARCHIVED
```

Applies to

- Categories
- Templates
- Signatories

Issued Letters

Never deleted.

---

# 3.16 Transactions

Generating a letter is one database transaction.

```text
Lock Settings

↓

Increment Number

↓

Resolve Variables

↓

Create Snapshots

↓

Create PDF

↓

Upload Document

↓

Insert Issued Letter

↓

Commit
```

If any step fails

Rollback.

No partial letters.

---

# 3.17 Concurrency

Problem

Two HR users generate simultaneously.

Without locking

```text
000145

000145
```

Duplicate numbers.

Solution

```sql
SELECT ...

FOR UPDATE
```

on

Letter Settings.

Only one sequence increment at a time.

---

# 3.18 Soft Delete vs Archive

The module uses **archive**, not soft delete.

Reason:

"Archived" is a business state visible to administrators, whereas "soft deleted" is an implementation detail. Templates, categories, and signatories can be archived and restored if needed, while issued letters remain permanently available.

---

# 3.19 Data Retention

Generated letters are retained indefinitely unless organizational retention policies require otherwise. Archiving hides records from routine operational views but does not remove them from audit history.

---

# 3.20 Chapter Summary

The database design separates mutable configuration from immutable historical records. Configuration entities (categories, templates, signatories, and settings) can evolve over time, while every issued letter captures complete snapshots of all relevant information, ensuring legal integrity and reproducibility.

The next chapter will build on this schema by defining the **backend architecture**, including NestJS modules, services, repositories, the variable resolution engine, the rendering pipeline, transaction orchestration, and service responsibilities. This chapter will explain how the data model is translated into production-ready application logic.
