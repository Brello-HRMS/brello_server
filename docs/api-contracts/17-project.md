# Project Module — API Contracts

## 1. Create Project

`POST /clients/:clientId/projects`

Creates a new project under a specific client.

### Request Body

```json
{
  "name": "Website Redesign",
  "description": "Full overhaul of the corporate site",
  "project_type": "FIXED_PRICE",
  "status": "DRAFT",
  "priority": "HIGH",
  "start_date": "2024-04-01",
  "end_date": "2024-06-30"
}
```

### Response (201 Created)

```json
{
  "id": "uuid",
  "name": "Website Redesign",
  "client_id": "uuid",
  "project_status": "DRAFT",
  "priority": "HIGH",
  "created_at": "timestamp"
}
```

---

## 2. List Projects by Client

`GET /clients/:clientId/projects`

### Query Parameters

- `page`, `limit`, `search`
- `status`: Filter by project status
- `priority`: Filter by priority

### Response (200 OK)

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Website Redesign",
      "project_status": "DRAFT",
      "priority": "HIGH"
    }
  ],
  "meta": { ... }
}
```

---

## 3. Get Project Details

`GET /projects/:id`

### Response (200 OK)

```json
{
  "id": "uuid",
  "name": "Website Redesign",
  "team": [],
  "contracts": []
}
```

---

## 4. Update Project

`PUT /projects/:id`

### Request Body

```json
{
  "status": "IN_PROGRESS",
  "priority": "URGENT"
}
```

---

## 5. Delete Project

`DELETE /projects/:id`

Soft deletes the project.

---

## 6. Assign Team

`POST /projects/:id/team`

Assigns or replaces the project team members and their roles.

### Request Body

```json
{
  "members": [
    {
      "user_id": "uuid-1",
      "role": "Project Manager"
    },
    {
      "user_id": "uuid-2",
      "role": "Lead Developer"
    }
  ]
}
```

### Response (200 OK)

```json
{
  "success": true
}
```

---

## 7. Upload Contract

`POST /projects/:id/contract`

Uploads a project contract file (multipart/form-data).

### Form Data

- `file`: The contract file (PDF, DOCX, etc.)

### Response (201 Created)

```json
{
  "id": "uuid",
  "file_name": "contract.pdf",
  "file_url": "https://...",
  "file_type": "application/pdf"
}
```
