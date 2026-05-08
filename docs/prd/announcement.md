# Tech PRD — Announcement Management System

## Module: Announcements

---

## Overview

Enable organizations to create, schedule, publish, and manage company-wide announcements across Web App, Mobile App, and Employee Dashboard. Supports instant/scheduled publishing, priority tagging, rich text formatting, targeted visibility, read tracking, and push/email/in-app delivery.

---

## Tech Stack

- **Framework**: NestJS (TypeORM, PostgreSQL)
- **Auth**: JWT via JwtAuthGuard + @LoggedInUser() decorator
- **Pattern**: Repository → Service → Controller (matches existing payroll/reimbursement modules)
- **Background Jobs**: Cron-based scheduler worker + queue-based notification worker

---

## Scope

### In Scope (V1)

**Admin / HR**
- Create announcement (rich text, priority, audience targeting)
- Publish instantly or schedule
- Edit draft/scheduled announcements
- Cancel scheduled → archive
- Archive published announcements
- Delete draft announcements
- Announcement analytics (read count, recipients)

**Employee**
- View published announcements
- Read/unread tracking
- Priority badge visibility
- Mobile push notifications

### Out of Scope (V1)

- Reactions/emojis, comments/replies
- Announcement acknowledgement workflow
- Multi-language translation
- Attachments > 25MB, video hosting

---

## User Roles

| Role        | Access                      |
|-------------|------------------------------|
| Super Admin | Full access                  |
| HR Admin    | Create/manage announcements  |
| Manager     | Optional permission          |
| Employee    | View only                    |

---

## Announcement Lifecycle

```
DRAFT → SCHEDULED → PUBLISHED → ARCHIVED
```

---

## Database Schema

### announcements

| Column           | Type                                         | Notes                           |
|------------------|----------------------------------------------|---------------------------------|
| id               | UUID PK                                      | Inherited from BaseEntity       |
| enterprise_id    | UUID NOT NULL                                | Multi-tenant (BaseEntity)       |
| organization_id  | UUID NOT NULL                                | Multi-tenant (BaseEntity)       |
| title            | VARCHAR(255) NOT NULL                        |                                 |
| description_html | LONGTEXT NOT NULL                            | Sanitized rich text / markdown  |
| priority         | ENUM('NORMAL','IMPORTANT','URGENT')          | DEFAULT 'NORMAL'                |
| status           | ENUM('DRAFT','SCHEDULED','PUBLISHED','ARCHIVED') | NOT NULL, DEFAULT 'DRAFT'   |
| publish_type     | ENUM('INSTANT','SCHEDULED')                  | NOT NULL                        |
| scheduled_at     | DATETIME NULL                                | Required when publish_type=SCHEDULED |
| published_at     | DATETIME NULL                                |                                 |
| archived_at      | DATETIME NULL                                |                                 |
| send_push        | BOOLEAN DEFAULT true                         |                                 |
| send_email       | BOOLEAN DEFAULT true                         |                                 |
| created_by       | UUID NOT NULL                                | FK users.id                     |
| updated_by       | UUID NULL                                    | FK users.id                     |
| created_at       | DATETIME NOT NULL                            | BaseEntity                      |
| updated_at       | DATETIME NOT NULL                            | BaseEntity                      |
| deleted_at       | DATETIME NULL                                | Soft delete (BaseEntity)        |
| deleted_by       | UUID NULL                                    | Soft delete actor (BaseEntity)  |

**Indexes**: idx_company_status (enterprise_id, organization_id, status), idx_publish_time (scheduled_at), idx_published_at (published_at)

### announcement_targets

| Column          | Type                                    | Notes                         |
|-----------------|-----------------------------------------|-------------------------------|
| id              | UUID PK                                 |                               |
| announcement_id | UUID NOT NULL                           | FK announcements.id           |
| target_type     | ENUM('ALL','DEPARTMENT','LOCATION','EMPLOYEE') | NOT NULL               |
| target_id       | UUID NULL                               | Null when target_type = ALL   |
| created_at      | DATETIME NOT NULL                       |                               |

**Indexes**: idx_announcement (announcement_id), idx_target (target_type, target_id)

### announcement_reads

| Column               | Type          | Notes                           |
|----------------------|---------------|---------------------------------|
| id                   | UUID PK       |                                 |
| announcement_id      | UUID NOT NULL | FK announcements.id             |
| employee_id          | UUID NOT NULL | FK users.id                     |
| viewed_at            | DATETIME NOT NULL |                             |
| notification_clicked | BOOLEAN DEFAULT false |                          |
| created_at           | DATETIME NOT NULL |                             |

**Unique**: (announcement_id, employee_id)  
**Index**: idx_employee (employee_id)

### announcement_attachments

| Column          | Type           | Notes                   |
|-----------------|----------------|-------------------------|
| id              | UUID PK        |                         |
| announcement_id | UUID NOT NULL  | FK announcements.id     |
| file_name       | VARCHAR(255)   |                         |
| file_url        | TEXT           |                         |
| file_size       | BIGINT         |                         |
| mime_type       | VARCHAR(100)   |                         |
| created_at      | DATETIME NOT NULL |                      |

---

## API Endpoints

### Admin Routes (prefix: /api/v1/announcements)

| Method | Path              | Description                              | Permission            |
|--------|-------------------|------------------------------------------|-----------------------|
| POST   | /                 | Create announcement                      | announcement.create   |
| GET    | /                 | List announcements (paginated, filtered) | announcement.view     |
| GET    | /:id              | Get announcement detail + analytics      | announcement.view     |
| PUT    | /:id              | Update draft/scheduled announcement      | announcement.edit     |
| DELETE | /:id              | Delete draft announcement                | announcement.delete   |
| POST   | /:id/publish      | Publish draft or scheduled immediately   | announcement.publish  |
| POST   | /:id/archive      | Archive published announcement           | announcement.archive  |

### Employee Routes (prefix: /api/v1/employee/announcements)

| Method | Path     | Description                            |
|--------|----------|----------------------------------------|
| GET    | /        | Get visible announcements for employee |
| POST   | /:id/read | Mark announcement as read             |

---

## Request/Response Contracts

### POST /api/v1/announcements — Create

**Request**
```json
{
  "title": "Office Closed for Holi",
  "description_html": "<p>Office will remain closed on Friday.</p>",
  "priority": "IMPORTANT",
  "publish_type": "SCHEDULED",
  "scheduled_at": "2026-03-18T09:00:00Z",
  "audience": {
    "type": "DEPARTMENTS",
    "department_ids": [1, 2]
  },
  "send_push": true,
  "send_email": true,
  "attachments": [
    { "file_url": "https://cdn.company.com/holiday-policy.pdf", "file_name": "holiday-policy.pdf" }
  ]
}
```

**Response**
```json
{
  "success": true,
  "message": "Announcement created successfully",
  "data": { "id": "uuid", "status": "SCHEDULED" }
}
```

### GET /api/v1/announcements — List

**Query Params**: status, priority, search, page, limit

**Response**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Office Closed for Holi",
        "priority": "IMPORTANT",
        "status": "PUBLISHED",
        "published_at": "2026-03-18T09:00:00Z",
        "created_by_name": "HR Admin",
        "read_count": 241
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 54 }
  }
}
```

### GET /api/v1/announcements/:id — Detail

**Response**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Office Closed for Holi",
    "description_html": "<p>Office closed on Friday</p>",
    "priority": "IMPORTANT",
    "status": "PUBLISHED",
    "publish_type": "SCHEDULED",
    "scheduled_at": "2026-03-18T09:00:00Z",
    "published_at": "2026-03-18T09:00:00Z",
    "send_push": true,
    "send_email": true,
    "audience": { "type": "DEPARTMENTS", "department_ids": [1, 2] },
    "attachments": [],
    "analytics": {
      "total_recipients": 350,
      "read_count": 241,
      "unread_count": 109
    }
  }
}
```

### GET /api/v1/employee/announcements — Employee Feed

**Query Params**: page, limit

**Response**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Office Closed for Holi",
        "description_html": "<p>...</p>",
        "priority": "IMPORTANT",
        "published_at": "2026-03-18T09:00:00Z",
        "is_read": false
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 10 }
  }
}
```

---

## Module Structure

```
src/modules/announcement/
├── controllers/
│   ├── announcement.controller.ts          # Admin routes
│   └── employee-announcement.controller.ts # Employee routes
├── services/
│   ├── announcement.service.ts             # Admin logic (CRUD, publish, archive)
│   ├── announcement-query.service.ts       # Listing, filtering, analytics
│   └── announcement-scheduler.service.ts  # Cron worker
├── repositories/
│   └── announcement.repository.ts
├── entities/
│   ├── announcement.entity.ts
│   ├── announcement-target.entity.ts
│   ├── announcement-read.entity.ts
│   └── announcement-attachment.entity.ts
├── dto/
│   ├── create-announcement.dto.ts
│   ├── update-announcement.dto.ts
│   ├── admin-query.dto.ts
│   └── employee-query.dto.ts
├── enums/
│   └── announcement.enum.ts
└── announcement.module.ts
```

---

## Enums

```typescript
export enum AnnouncementStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum AnnouncementPriority {
  NORMAL = 'NORMAL',
  IMPORTANT = 'IMPORTANT',
  URGENT = 'URGENT',
}

export enum AnnouncementPublishType {
  INSTANT = 'INSTANT',
  SCHEDULED = 'SCHEDULED',
}

export enum AnnouncementAudienceType {
  ALL = 'ALL',
  DEPARTMENTS = 'DEPARTMENTS',
  LOCATIONS = 'LOCATIONS',
  EMPLOYEES = 'EMPLOYEES',
}
```

---

## Business Rules

- `scheduled_at` is mandatory when `publish_type = SCHEDULED`; must be a future datetime
- Only DRAFT and SCHEDULED announcements can be edited
- ARCHIVED announcements cannot be modified
- Deleting is only allowed for DRAFT status
- Publish action: DRAFT → PUBLISHED (instant), SCHEDULED → PUBLISHED (immediate override)
- Archive action: PUBLISHED → ARCHIVED
- Scheduler runs every minute: finds SCHEDULED where `scheduled_at <= now()`, publishes + sends notifications
- Employee visibility: only sees PUBLISHED announcements matching their department, location, or employee ID (or ALL type)
- Read tracking is upserted (idempotent): re-marking read is a no-op
- Title max 255 chars; description_html must be sanitized (XSS, inline script, iframe stripped)
- Attachments: max 10 per announcement, 25MB each

---

## Permissions

| Permission                  | Description           |
|-----------------------------|-----------------------|
| announcement.create         | Create announcement   |
| announcement.view           | View announcements    |
| announcement.edit           | Edit announcement     |
| announcement.delete         | Delete announcement   |
| announcement.publish        | Publish announcement  |
| announcement.archive        | Archive announcement  |
| announcement.view.analytics | View read stats       |

---

## Background Jobs

### Scheduler (every 1 minute)

```
SELECT * FROM announcements
WHERE status = 'SCHEDULED' AND scheduled_at <= NOW()
  AND deleted_at IS NULL
```

For each: update status to PUBLISHED, set published_at, enqueue notification job.

### Notification Worker (queue-based)

Supports push notifications, email, and in-app notifications.

---

## Security Considerations

### Rich Text Sanitization

- Allowed tags: bold, italic, underline, lists, links, alignment, headings
- Strip: `<script>`, `<iframe>`, `on*` event attributes, `javascript:` hrefs
- Use a server-side HTML sanitizer (e.g., DOMPurify equivalent for Node or sanitize-html)

---

## Scalability Design

- Redis caching for employee announcement feed (TTL: 5 minutes)
- Pagination on all list endpoints
- Async notification dispatch via queue
- CDN delivery for attachments
- Read tracking batch writes (flush every 30s)

---

## Validation Rules

| Field            | Rule                             |
|------------------|----------------------------------|
| title            | required, max 255 chars          |
| description_html | required, sanitized              |
| priority         | enum: NORMAL, IMPORTANT, URGENT  |
| publish_type     | enum: INSTANT, SCHEDULED         |
| scheduled_at     | required if SCHEDULED, future    |
| audience.type    | enum: ALL, DEPARTMENTS, LOCATIONS, EMPLOYEES |
| attachments      | max 10 items, 25MB each          |

---

## Future Enhancements (V2)

- Reactions, comments, polls
- Mandatory acknowledgement workflow
- Multi-language announcements
- Recurring announcements
- AI-generated summaries
- Announcement expiration
- Slack/Teams integration
- Email open tracking
