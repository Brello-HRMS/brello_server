# Brello HRMS

# Product Requirements & Technical Design Specification

# Letter Management Module

**Version:** V1.0 (Production Ready)

---

# Chapter 7 — REST API Contracts

---

# 7.1 Overview

The Letter Management module exposes REST APIs for:

- Configuration Management
- Letter Generation
- Letter Retrieval
- Employee Self-Service

All APIs follow Brello's existing standards:

- JWT Authentication
- Organization Isolation
- RBAC Authorization
- Standard API Response
- Pagination
- Validation
- Audit Logging

Every request is organization-scoped.

No endpoint accepts `organization_id` from the client.

The authenticated user's organization determines the data scope.

---

# 7.2 API Principles

## Stateless

Every request contains sufficient authentication.

No server-side sessions.

---

## Predictable

Resources follow REST conventions.

```text
GET

POST

PATCH

DELETE (Archive)
```

---

## Consistent Response

Every successful response

```json
{
  "success": true,
  "message": "Letter generated successfully.",
  "data": {}
}
```

Every error

```json
{
  "success": false,
  "message": "Template is archived.",
  "errors": []
}
```

---

# 7.3 Authentication

Every endpoint requires

```http
Authorization: Bearer <JWT>
```

Except future public Offer Letter APIs.

---

# 7.4 Authorization

Permissions

```text
LETTERS_VIEW

LETTERS_GENERATE

LETTERS_TEMPLATE_MANAGE

LETTERS_SIGNATORY_MANAGE

LETTERS_SETTINGS_MANAGE

LETTERS_CATEGORY_MANAGE
```

Employee endpoints require authentication only.

---

# 7.5 Categories

---

## List Categories

```http
GET /letter-management/categories
```

Query

```text
status

search

page

limit
```

Response

```json
[
  {
    "id": "",
    "name": "Appointment",
    "templateCount": 4,
    "status": "ACTIVE"
  }
]
```

---

## Create Category

```http
POST /letter-management/categories
```

Request

```json
{
  "name": "Promotion",
  "description": "Promotion related letters"
}
```

Validation

- unique
- max length
- organization scoped

---

## Update Category

```http
PATCH /letter-management/categories/:id
```

---

## Archive Category

```http
DELETE /letter-management/categories/:id
```

Behavior

Archives.

Never deletes.

Returns

409

if published templates exist.

---

# 7.6 Templates

---

## List Templates

```http
GET /letter-management/templates
```

Filters

```text
category

status

search

page

limit
```

---

Response

```json
[
  {
    "name": "Appointment",
    "status": "PUBLISHED",
    "version": 3
  }
]
```

---

## Create Template

```http
POST /letter-management/templates
```

Request

```json
{
  "categoryId": "",
  "name": "Standard Appointment",
  "heading": "Appointment Letter",
  "paragraphs": ["Dear {{employee_name}}"],
  "bulletList": [],
  "includeSalaryTable": true,
  "signatoryId": ""
}
```

Server automatically

- extracts variables
- validates registry
- stores variable cache

Template is created as

```text
DRAFT
```

---

## Update Template

```http
PATCH /letter-management/templates/:id
```

Only Draft and Published templates can be edited. Editing a published template increments its version automatically.

---

## Publish Template

```http
POST /letter-management/templates/:id/publish
```

Server validates

- variables
- signatory
- content
- category

Status becomes

```text
PUBLISHED
```

---

## Archive Template

```http
DELETE /letter-management/templates/:id
```

Archives.

Never deletes.

---

## Duplicate Template

```http
POST /letter-management/templates/:id/duplicate
```

Creates

```text
Appointment Letter (Copy)
```

Status

```text
DRAFT
```

---

## Preview Template

```http
POST /letter-management/templates/preview
```

Uses mock data.

Returns HTML-compatible render model for frontend preview (the frontend should render the preview using the same layout rules as the PDF where practical).

---

# 7.7 Variable APIs

---

## Variable Catalog

```http
GET /letter-management/variables
```

Response

```json
[
  {
    "category": "Employee",
    "variables": []
  }
]
```

Contains

- key
- label
- example
- description
- editable
- required

---

# 7.8 Signatories

---

## List

```http
GET /letter-management/signatories
```

---

## Create

```http
POST /letter-management/signatories
```

Multipart

Fields

```text
Name

Designation

Signature
```

Returns created signatory.

---

## Update

```http
PATCH /letter-management/signatories/:id
```

---

## Archive

```http
DELETE /letter-management/signatories/:id
```

Cannot archive if configured as the organization default until another default is assigned.

---

# 7.9 Settings

---

## Get Settings

```http
GET /letter-management/settings
```

---

## Update

```http
PATCH /letter-management/settings
```

Request

```json
{
  "letterPrefix": "BRLO",
  "defaultSignatoryId": "",
  "dateFormat": "DD MMM YYYY"
}
```

---

# 7.10 Employee Search

Generation requires employee search.

```http
GET /letter-management/employees/search
```

Query

```text
q

page

limit
```

Returns lightweight employee summary only.

Avoid loading payroll.

---

# 7.11 Resolve Variables

Purpose

Allows frontend preview before generation.

```http
POST /letter-management/issued-letters/resolve
```

Request

```json
{
  "employeeId": "",
  "templateId": ""
}
```

Response

```json
{
  "values": {},
  "missing": [],
  "preview": {}
}
```

Nothing persisted.

---

# 7.12 Generate Letter

```http
POST /letter-management/issued-letters
```

Headers

```text
Idempotency-Key
```

Request

```json
{
  "employeeId": "",
  "templateId": "",
  "manualValues": {
    "visa_reference": "12345"
  }
}
```

Returns

```json
{
  "letterId": "",
  "letterNumber": "BRLO-2026-000145",
  "downloadUrl": "..."
}
```

---

# 7.13 Issued Letters

---

## List

```http
GET /letter-management/issued-letters
```

Filters

```text
Employee

Category

Template

Generated By

Letter Number

Date Range

Page

Limit
```

Server-side pagination mandatory.

---

## Detail

```http
GET /letter-management/issued-letters/:id
```

Returns

Metadata

Snapshots

Download URL

---

## Download

```http
GET /letter-management/issued-letters/:id/download
```

Returns

Temporary presigned URL.

---

# 7.14 Employee APIs

---

## My Letters

```http
GET /letter-management/me
```

Returns only current user's letters.

---

## My Letter Detail

```http
GET /letter-management/me/:id
```

Authorization

Employee owns letter.

---

## Download

```http
GET /letter-management/me/:id/download
```

Returns

Presigned URL.

---

# 7.15 Pagination Standard

All listing APIs use:

```text
page

limit

search

sortBy

sortOrder
```

Response

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "pages": 8
  }
}
```

---

# 7.16 Sorting

Supported

Templates

```text
Name

Updated

Version
```

Categories

```text
Name

Created
```

Issued Letters

```text
Generated Date

Letter Number

Employee

Template
```

---

# 7.17 Error Codes

| Code | Meaning               |
| ---- | --------------------- |
| 400  | Validation            |
| 401  | Unauthenticated       |
| 403  | Unauthorized          |
| 404  | Not Found             |
| 409  | Business Conflict     |
| 422  | Invalid Business Data |
| 500  | Unexpected Error      |

---

# 7.18 Rate Limiting

Configuration APIs

Normal.

Generation API

Recommended

```text
30 requests

per minute

per user
```

Protects accidental abuse while remaining generous for HR operations.

---

# 7.19 API Versioning

All APIs should be exposed under the platform version namespace, for example:

```text
/api/v1/letter-management/...
```

Future breaking changes should be introduced through `/api/v2` rather than modifying existing contracts.

---

# 7.20 Idempotency

Generate endpoint accepts

```text
Idempotency-Key
```

Repeated request

↓

Returns original response.

No duplicate generation.

---

# 7.21 OpenAPI Documentation

Every endpoint must include:

- Summary
- Description
- Request DTO
- Response DTO
- Error Responses
- Required Permissions
- Example Payloads

This ensures the module is fully documented in Swagger/OpenAPI and easy to consume by frontend and third-party integrations.

---

# 7.22 DTO Design Principles

Separate DTOs should be created for:

- Create
- Update
- Response
- List Item
- Detail
- Search

Avoid reusing entities as API responses. Response DTOs should expose only the fields required by clients and hide internal implementation details.

---

# 7.23 API Security

All endpoints must enforce:

- Organization scoping
- RBAC permissions (where applicable)
- Input validation
- UUID validation for path parameters
- Request payload sanitization
- Short-lived presigned download URLs

The backend must never trust client-provided identifiers without verifying ownership within the authenticated organization.

---

# 7.24 Chapter Summary

The Letter Management API is organized into five logical areas:

- Configuration (Categories, Templates, Signatories, Settings)
- Variable Services
- Letter Generation
- Issued Letter Management
- Employee Self-Service

The API follows consistent REST conventions, standardized responses, strong validation, and organization isolation. Combined with idempotency, pagination, and versioning, it provides a stable contract suitable for both the Brello web application and future external integrations.

---

## Architecture Review & Recommended Improvements

Before moving to the frontend chapters, I'd make three production-oriented refinements:

1. **Support ETags for configuration resources** (templates, categories, settings) to enable optimistic concurrency and prevent one admin from unintentionally overwriting another admin's changes.

2. **Standardize error codes** by introducing business-specific error identifiers (e.g., `LETTER_TEMPLATE_ARCHIVED`, `UNKNOWN_TEMPLATE_VARIABLE`) alongside HTTP status codes. This gives the frontend stable error handling regardless of localized messages.

3. **Keep preview and generation contracts aligned**. Both `/resolve` and `/issued-letters` should internally use the same `LetterRenderModel` builder to guarantee that what HR previews is exactly what is generated and stored.
