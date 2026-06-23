# Tech PRD — Feedback & Report Module

## Module: Feedback & Report

---

## Overview

In-app channel that allows **org users (RBAC-gated)** to submit product feedback and report product issues directly to the Brello team. **Platform admins** (Brello internal team) receive, triage, respond to, and track resolution of all submissions across all organisations.

Two submission tracks:
- **Feedback** — Feature requests, suggestions, praise about the Brello product
- **Issue Report** — Bugs, UI/UX problems, performance issues, data inaccuracies

---

## Tech Stack

- **Framework**: NestJS 11 (TypeORM 0.3, PostgreSQL)
- **Auth**: JWT via `JwtAuthGuard` + `@CurrentUser()` decorator
- **Org access**: `AccessGuard` + `@RequirePermission()` — RBAC-gated, no hardcoded role
- **Platform access**: `PlatformAdminGuard` — Brello internal team only
- **Notifications**: Existing `notification` module (in-app, V1 only)
- **File Uploads**: Existing `Document` module (S3 presigned URLs)
- **Pattern**: Repository → Service → Controller (matches existing modules)

---

## Scope

### In Scope (V1)

- Org users submit feedback or issue reports with optional attachments
- Org users view all tickets submitted by their organisation
- Org users add follow-up comments on their own tickets
- Platform admin views all tickets across all orgs with full filter support
- Platform admin updates ticket status and priority
- Platform admin adds public replies (visible to org user) or internal notes (platform-only)
- In-app notifications for status changes and new comments

### Out of Scope (V1)

- Email notifications (in-app only)
- Public roadmap or upvoting between organisations
- SLA timers or escalation rules
- Email-to-ticket ingestion
- Duplicate detection / AI triage
- Mobile push notifications

---

## User Roles & Access

| Actor | Access Mechanism | Capabilities |
|---|---|---|
| **Org User** (any role with permission) | `JwtAuthGuard` + `AccessGuard` (`FEEDBACK_REPORT` module permission) | Submit tickets, view org tickets, add follow-up comments, receive notifications |
| **Platform Admin** | `JwtAuthGuard` + `PlatformAdminGuard` | View all org tickets, update status/priority, add public replies or internal notes, view stats dashboard |

> Access on the org side is purely RBAC-driven. Any user whose role grants permission to the `Feedback & Report` module can use all org-facing features. There are no further sub-permissions in V1.

---

## Ticket Types & Categories

### Type: FEEDBACK

| Category | Description |
|---|---|
| `FEATURE_REQUEST` | Request for a new feature or capability |
| `SUGGESTION` | General product improvement idea |
| `PRAISE` | Positive feedback about the product |

### Type: ISSUE_REPORT

| Category | Description |
|---|---|
| `BUG` | Incorrect or broken functionality |
| `UI_UX` | Visual or interaction problem |
| `PERFORMANCE` | Slow response, lag, or timeout |
| `DATA_ISSUE` | Incorrect, missing, or corrupted data |

---

## Ticket Lifecycle

### Feedback Lifecycle

```
SUBMITTED → UNDER_REVIEW → PLANNED
                         → DECLINED
                         → RELEASED
```

### Issue Report Lifecycle

```
SUBMITTED → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED
```

### State Transition Rules

| From | To | Who can trigger |
|---|---|---|
| `SUBMITTED` | `UNDER_REVIEW` | Platform Admin |
| `SUBMITTED` | `ACKNOWLEDGED` | Platform Admin |
| `UNDER_REVIEW` | `PLANNED` | Platform Admin |
| `UNDER_REVIEW` | `DECLINED` | Platform Admin |
| `PLANNED` | `RELEASED` | Platform Admin |
| `ACKNOWLEDGED` | `IN_PROGRESS` | Platform Admin |
| `IN_PROGRESS` | `RESOLVED` | Platform Admin |
| `RESOLVED` | `CLOSED` | Platform Admin |

> Org users cannot change ticket status. All state transitions are Platform Admin actions.

---

## Priority Levels

| Priority | Used For |
|---|---|
| `LOW` | Minor suggestions, cosmetic issues |
| `MEDIUM` | Standard bugs and feature requests (default) |
| `HIGH` | Significant workflow blockers |
| `CRITICAL` | Data loss, security concerns, complete feature outage |

Priority is set and updated only by Platform Admin.

---

## Notifications

| Trigger | Recipient | Channel |
|---|---|---|
| New ticket submitted by any org | Platform Admin | In-app |
| Platform Admin adds a public reply (comment) | Ticket submitter | In-app |
| Ticket status changes | Ticket submitter | In-app |
| Ticket marked `RESOLVED` or `CLOSED` | Ticket submitter | In-app |
| Org user adds a follow-up comment | Platform Admin | In-app |

> Notifications use the existing `notification` module. No email in V1.

---

## Database Schema

### feedback_tickets

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | BaseEntity |
| enterprise_id | UUID | Multi-tenant (BaseEntity) |
| organization_id | UUID | Multi-tenant (BaseEntity) |
| submitted_by | UUID NOT NULL | FK users.id — who created the ticket |
| type | ENUM NOT NULL | `FEEDBACK` \| `ISSUE_REPORT` |
| category | ENUM NOT NULL | See categories above |
| title | VARCHAR(255) NOT NULL | Short summary |
| description | TEXT NOT NULL | Full details |
| status | ENUM NOT NULL | Lifecycle status, DEFAULT `SUBMITTED` |
| priority | ENUM NOT NULL | DEFAULT `MEDIUM`, set by Platform Admin |
| affected_module | VARCHAR(100) | Optional — which app module is affected |
| attachments | JSONB | Array of document references (id, name, url) |
| resolved_at | TIMESTAMP | Set when status → `RESOLVED` |
| closed_at | TIMESTAMP | Set when status → `CLOSED` |
| created_by | UUID | BaseEntity audit field |
| updated_by | UUID | BaseEntity audit field |
| created_at | TIMESTAMP | BaseEntity |
| updated_at | TIMESTAMP | BaseEntity |
| deleted_at | TIMESTAMP | Soft delete (BaseEntity) |
| deleted_by | UUID | Soft delete actor (BaseEntity) |

**Indexes:**
- `(organization_id, status)` — org ticket list queries
- `(enterprise_id, type, status)` — platform admin cross-org queries
- `(submitted_by)` — user's own ticket history
- `(created_at DESC)` — chronological listing

---

### feedback_comments

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| ticket_id | UUID NOT NULL | FK feedback_tickets.id |
| author_id | UUID NOT NULL | FK users.id |
| body | TEXT NOT NULL | Comment content |
| is_internal | BOOLEAN NOT NULL | DEFAULT false — true = Platform Admin internal note, never exposed to org |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |
| deleted_by | UUID | |

**Indexes:**
- `(ticket_id, is_internal, created_at)` — comment thread per ticket

---

### feedback_status_logs

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| ticket_id | UUID NOT NULL | FK feedback_tickets.id |
| changed_by | UUID NOT NULL | FK users.id (Platform Admin) |
| old_status | ENUM NOT NULL | Previous status |
| new_status | ENUM NOT NULL | New status |
| note | TEXT | Optional reason for transition |
| created_at | TIMESTAMP | |

**Indexes:**
- `(ticket_id, created_at)` — status history per ticket

---

## API Endpoints

### Org-Facing Routes (prefix: `/feedback-tickets`)

Auth: `JwtAuthGuard` + `AccessGuard` (`FEEDBACK_REPORT` module permission)

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Submit a new feedback ticket |
| `GET` | `/` | List all tickets for own organisation (paginated, filterable) |
| `GET` | `/:id` | Get ticket detail (org-scoped) |
| `POST` | `/:id/comments` | Add a follow-up comment on own org's ticket |

#### `POST /feedback-tickets` — Request Body

```json
{
  "type": "FEEDBACK | ISSUE_REPORT",
  "category": "FEATURE_REQUEST | SUGGESTION | PRAISE | BUG | UI_UX | PERFORMANCE | DATA_ISSUE",
  "title": "string (max 255)",
  "description": "string",
  "affected_module": "string (optional)",
  "attachments": [
    { "document_id": "uuid", "name": "screenshot.png" }
  ]
}
```

#### `GET /feedback-tickets` — Query Params

| Param | Type | Notes |
|---|---|---|
| `type` | ENUM | Filter by FEEDBACK or ISSUE_REPORT |
| `category` | ENUM | Filter by category |
| `status` | ENUM | Filter by status |
| `page` | number | Default 1 |
| `limit` | number | Default 20 |

---

### Platform Admin Routes (prefix: `/platform/feedback-tickets`)

Auth: `JwtAuthGuard` + `PlatformAdminGuard`

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List all tickets across all orgs (paginated, filterable) |
| `GET` | `/:id` | Get full ticket detail including internal comments |
| `PATCH` | `/:id` | Update status and/or priority |
| `POST` | `/:id/comments` | Add public reply or internal note |
| `GET` | `/stats` | Summary counts dashboard |

#### `GET /platform/feedback-tickets` — Query Params

| Param | Type | Notes |
|---|---|---|
| `organization_id` | UUID | Filter by specific org |
| `enterprise_id` | UUID | Filter by enterprise |
| `type` | ENUM | FEEDBACK or ISSUE_REPORT |
| `category` | ENUM | |
| `status` | ENUM | |
| `priority` | ENUM | |
| `affected_module` | string | |
| `from_date` | DATE | Created after |
| `to_date` | DATE | Created before |
| `page` | number | Default 1 |
| `limit` | number | Default 20 |

#### `PATCH /platform/feedback-tickets/:id` — Request Body

```json
{
  "status": "ACKNOWLEDGED | IN_PROGRESS | RESOLVED | CLOSED | UNDER_REVIEW | PLANNED | DECLINED | RELEASED",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "note": "string (optional — reason for status change)"
}
```

#### `POST /platform/feedback-tickets/:id/comments` — Request Body

```json
{
  "body": "string",
  "is_internal": false
}
```

> `is_internal: true` — note is stored in `feedback_comments` but never returned in org-facing API responses.

#### `GET /platform/feedback-tickets/stats` — Response

```json
{
  "total": 120,
  "by_status": {
    "SUBMITTED": 30,
    "ACKNOWLEDGED": 15,
    "IN_PROGRESS": 20,
    "RESOLVED": 40,
    "CLOSED": 15
  },
  "by_type": {
    "FEEDBACK": 60,
    "ISSUE_REPORT": 60
  },
  "by_priority": {
    "LOW": 20,
    "MEDIUM": 65,
    "HIGH": 30,
    "CRITICAL": 5
  }
}
```

---

## Business Rules

1. **Org scoping** — org-facing endpoints only return tickets where `organization_id` matches the current user's org. No cross-org visibility.
2. **Comment visibility** — `is_internal: true` comments are never returned to org users. Org-facing comment queries always filter `is_internal = false`.
3. **Status transitions** — only Platform Admin can change ticket status. Any invalid transition (e.g., `CLOSED → IN_PROGRESS`) returns `400 Bad Request`.
4. **Type-category consistency** — `FEATURE_REQUEST`, `SUGGESTION`, `PRAISE` are only valid when `type = FEEDBACK`. `BUG`, `UI_UX`, `PERFORMANCE`, `DATA_ISSUE` are only valid when `type = ISSUE_REPORT`. Validated at DTO level.
5. **Attachments** — stored as JSONB references to existing `documents` table records. The document upload flow uses the existing Document module before ticket creation.
6. **Soft delete** — tickets use soft delete (`deleted_at`). Comments use soft delete. Deleted tickets are excluded from all listing queries.
7. **Status log** — every status change by Platform Admin writes a row to `feedback_status_logs` automatically in the service layer.
8. **Notifications** — fired in the service layer after each triggering action using the existing notification module. Failures are non-blocking (fire-and-forget).

---

## Module Structure

```
src/modules/feedback/
├── controllers/
│   ├── feedback.controller.ts              # Org-facing routes (RBAC-gated)
│   └── platform-feedback.controller.ts     # Platform admin routes
├── services/
│   ├── feedback.service.ts                 # Org-facing logic
│   └── platform-feedback.service.ts        # Platform admin logic
├── repositories/
│   ├── feedback-ticket.repository.ts
│   ├── feedback-comment.repository.ts
│   └── feedback-status-log.repository.ts
├── entities/
│   ├── feedback-ticket.entity.ts
│   ├── feedback-comment.entity.ts
│   └── feedback-status-log.entity.ts
├── dto/
│   ├── create-feedback-ticket.dto.ts
│   ├── org-query-feedback.dto.ts
│   ├── add-comment.dto.ts
│   ├── platform-query-feedback.dto.ts
│   ├── update-ticket.dto.ts
│   └── platform-add-comment.dto.ts
├── enums/
│   ├── feedback-type.enum.ts
│   ├── feedback-category.enum.ts
│   ├── feedback-status.enum.ts
│   └── feedback-priority.enum.ts
└── feedback.module.ts
```

---

## Frontend Structure

### Org Side

**Routes:**
- `/feedback` — Ticket list page
- `/feedback/new` — Submit new ticket (or modal)
- `/feedback/:id` — Ticket detail + comment thread

**Components:**
- `FeedbackListPage` — DataTable with filters (type, status), pagination, "New Ticket" button
- `CreateFeedbackModal` — Form: type selector → category → title → description → affected module → attachments
- `FeedbackDetailPage` — Ticket info header (status badge, priority, category) + comment thread + follow-up input
- `TicketStatusBadge` — colour-coded status chip

**API / Hooks pattern:**
```
features/feedback/
├── types.ts
├── api.ts
├── hooks.ts
└── components/
    ├── FeedbackListPage.tsx
    ├── CreateFeedbackModal.tsx
    ├── FeedbackDetailPage.tsx
    └── TicketStatusBadge.tsx
```

---

### Platform Admin Side

**Routes:**
- `/platform/feedback` — All-orgs ticket management table
- `/platform/feedback/:id` — Ticket detail with reply + internal note + status/priority controls
- `/platform/feedback/stats` — Summary dashboard cards

**Components:**
- `PlatformFeedbackListPage` — Full-filter table (org, type, category, status, priority, date range)
- `PlatformFeedbackDetailPage` — Ticket info + full comment thread (internal notes visually distinguished) + status update panel + priority selector
- `InternalNoteToggle` — Checkbox on comment compose to mark as internal
- `StatsCards` — Count cards by status, type, priority

---

## Key Design Decisions

1. **RBAC on org side, not hardcoded roles** — Any user whose role grants `FEEDBACK_REPORT` module access can submit and view tickets. Brello can grant this permission to any role via the existing RBAC system without code changes.

2. **`is_internal` flag on comments** — A single `feedback_comments` table serves both public replies and internal platform notes. The `is_internal` flag is filtered at the service layer. Org-facing responses always filter `is_internal = false`. This avoids a separate table while keeping notes completely hidden from org users.

3. **JSONB for attachments** — Attachments are stored as a JSONB array of document references on the ticket rather than a separate join table. Tickets typically have 0–3 attachments and they are read-only after submission. JSONB avoids the join overhead for listing endpoints.

4. **Status log as append-only audit trail** — `feedback_status_logs` is insert-only; no updates or deletes. Provides full audit history of every status transition with actor and optional note.

5. **Notifications are fire-and-forget** — Notification calls in the service layer are not awaited and do not affect the main response. A notification failure must never block a ticket action.

6. **Platform stats are query-time aggregates** — The `/stats` endpoint runs live aggregate queries rather than maintaining a cached counter table. Acceptable for V1 at expected ticket volumes. Can be moved to a materialized view or cron-cached table if volume grows.
