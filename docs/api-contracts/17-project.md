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

## 7. Link Contract

`POST /projects/:id/contract`

Links an already uploaded document as a project contract.

### Request Body

```json
{
  "documentId": "uuid"
}
```

### Response (201 Created)

```json
{
  "id": "uuid",
  "file_name": "contract.pdf",
  "file_url": "https://...",
  "file_type": "application/pdf"
}
```

---

## 8. Get Project Team

`GET /projects/:id/team`

Returns the list of members assigned to a project, including roles and user details.

### Response (200 OK)

```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "user_id": "uuid",
    "role": "Project Manager",
    "user": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    },
    "assigned_at": "timestamp"
  }
]
```

---

## 9. Get Project Contracts

`GET /projects/:id/contracts`

Returns the list of contract documents uploaded for the project.

### Response (200 OK)

```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "file_name": "contract.pdf",
    "file_url": "https://...",
    "file_type": "application/pdf",
    "uploaded_at": "timestamp"
  }
]
```

---

## 10. Remove Team Member

`DELETE /projects/:id/team/:userId`

Removes a single member from the project team.

### Response (200 OK)

```json
{
  "success": true
}
```

## 11. Delete Contract

`DELETE /projects/:id/contracts/:contractId`

Removes a contract from the project and automatically deletes the associated document record from the system.

### Response (200 OK)

```json
{
  "success": true
}
```
