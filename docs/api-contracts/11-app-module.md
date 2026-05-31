# App Module APIs

Base path: `/api/v1/app-modules`, `/api/v1/actions`, `/api/v1/module-access`

This module manages the permission taxonomy of the system — the hierarchical structure of what features are available within each app — and maps them to application roles.

---

## Part A: App Modules

Base path: `/api/v1/app-modules`

All endpoints require `JwtAuthGuard`.

`AppModule` represents a navigable feature inside an App (e.g., Leave Management, Attendance, Payroll).  
Modules form a two-level tree using a `parent_id` self-reference:

- **MOD** (`type: 'mod'`) — top-level module (no parent)
- **SUBMOD** (`type: 'submod'`) — sub-module (has a parent_id pointing to a MOD)

WBS codes (`wbs_code`) use dot-notation for hierarchy and ordering: `1`, `1.1`, `1.2`, `2`, `2.1`.

---

### 1. Create App Module

|            |                       |
| ---------- | --------------------- |
| **Method** | `POST`                |
| **URL**    | `/api/v1/app-modules` |
| **Auth**   | Bearer Token (JWT)    |
| **Status** | `201 Created`         |

**Request Body:**

| Field       | Type          | Required | Validation    | Description                                                       |
| ----------- | ------------- | -------- | ------------- | ----------------------------------------------------------------- |
| `name`      | string        | ✅       | 2–150 chars   | Display name (e.g., Leave Management)                             |
| `code`      | string        | ✅       | 2–100 chars   | Stable permission code, unique per app (e.g., LEAVE_MGMT)        |
| `app_id`    | string (UUID) | ✅       | Valid UUID v4 | The app this module belongs to                                    |
| `wbs_code`  | string        | ✅       | 1–50 chars    | Hierarchical ordering code (e.g., `1`, `1.1`)                    |
| `parent_id` | string (UUID) | ❌       | Valid UUID v4 | Parent module ID — omit for top-level modules (MOD)              |
| `type`      | string (enum) | ❌       | `mod`/`submod`| Defaults to `mod` if no parent, `submod` if parent_id is present |
| `icon`      | string        | ❌       | 1–50 chars    | Lucide icon name (e.g., CalendarDays, LayoutDashboard)            |
| `path`      | string        | ❌       | 1–150 chars   | Navigation path (e.g., /leave/balance)                            |

```json
{
  "name": "Leave Management",
  "code": "LEAVE_MGMT",
  "app_id": "880e8400-e29b-41d4-a716-446655440003",
  "wbs_code": "3",
  "type": "mod",
  "icon": "CalendarDays",
  "path": "/leave"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440010",
    "name": "Leave Management",
    "code": "LEAVE_MGMT",
    "app_id": "880e8400-e29b-41d4-a716-446655440003",
    "wbs_code": "3",
    "parent_id": null,
    "type": "mod",
    "icon": "CalendarDays",
    "path": "/leave",
    "status": "ACTIVE",
    "created_at": "2026-05-28T10:00:00.000Z",
    "updated_at": "2026-05-28T10:00:00.000Z"
  },
  "timestamp": "2026-05-28T10:00:00.000Z"
}
```

**Creating a Sub-Module:**

```json
{
  "name": "Leave Balance",
  "code": "LEAVE_BALANCE",
  "app_id": "880e8400-e29b-41d4-a716-446655440003",
  "wbs_code": "3.1",
  "parent_id": "aa0e8400-e29b-41d4-a716-446655440010",
  "type": "submod",
  "path": "/leave/balance"
}
```

---

### 2. Get All App Modules

|            |                       |
| ---------- | --------------------- |
| **Method** | `GET`                 |
| **URL**    | `/api/v1/app-modules` |
| **Auth**   | Bearer Token (JWT)    |
| **Status** | `200 OK`              |

**Query Parameters:**

| Parameter | Type   | Required | Description                                        |
| --------- | ------ | -------- | -------------------------------------------------- |
| `app_id`  | string | ❌       | Filter by app ID — returns only modules for that app |

> Always pass `?app_id=<uuid>` in practice. Without it, all modules across all apps are returned.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "aa0e8400-...",
      "name": "Leave Management",
      "code": "LEAVE_MGMT",
      "app_id": "880e8400-...",
      "wbs_code": "3",
      "parent_id": null,
      "type": "mod",
      "icon": "CalendarDays",
      "path": "/leave",
      "status": "ACTIVE",
      "created_at": "...",
      "updated_at": "..."
    },
    {
      "id": "bb0e8400-...",
      "name": "Leave Balance",
      "code": "LEAVE_BALANCE",
      "app_id": "880e8400-...",
      "wbs_code": "3.1",
      "parent_id": "aa0e8400-...",
      "type": "submod",
      "icon": null,
      "path": "/leave/balance",
      "status": "ACTIVE",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "timestamp": "..."
}
```

---

### 3. Get App Module by ID

|            |                          |
| ---------- | ------------------------ |
| **Method** | `GET`                    |
| **URL**    | `/api/v1/app-modules/:id`|
| **Auth**   | Bearer Token (JWT)       |
| **Status** | `200 OK`                 |

**Error Responses:**

| Status          | Condition            |
| --------------- | -------------------- |
| `404 Not Found` | Module not found     |

---

### 4. Update App Module

|            |                          |
| ---------- | ------------------------ |
| **Method** | `PATCH`                  |
| **URL**    | `/api/v1/app-modules/:id`|
| **Auth**   | Bearer Token (JWT)       |
| **Status** | `200 OK`                 |

**Request Body:** (all fields optional)

| Field      | Type          | Validation     | Description                    |
| ---------- | ------------- | -------------- | ------------------------------ |
| `name`     | string        | 2–150 chars    | Updated display name           |
| `code`     | string        | 2–100 chars    | Updated permission code        |
| `wbs_code` | string        | 1–50 chars     | Updated WBS code               |
| `type`     | string (enum) | `mod`/`submod` | Updated module type            |
| `icon`     | string        | 1–50 chars     | Updated icon name              |
| `path`     | string        | 1–150 chars    | Updated navigation path        |

> Note: `app_id` and `parent_id` cannot be changed via update — they are set at creation time.

---

### 5. Delete App Module

|            |                          |
| ---------- | ------------------------ |
| **Method** | `DELETE`                 |
| **URL**    | `/api/v1/app-modules/:id`|
| **Auth**   | Bearer Token (JWT)       |
| **Status** | `204 No Content`         |

> Soft-deletes the module (sets `status = 'DELETED'`). Sub-modules of a deleted MOD remain but become orphaned — delete sub-modules before deleting the parent module to avoid orphans.

---

## WBS Code Conventions

| WBS Code | Level       | Example                    |
| -------- | ----------- | -------------------------- |
| `1`      | Root module | Dashboard                  |
| `1.1`    | Sub-module  | Dashboard → Daily Overview |
| `1.2`    | Sub-module  | Dashboard → Analytics      |
| `2`      | Root module | Leave Management           |
| `2.1`    | Sub-module  | Leave Management → Balance |

**Auto-computation (frontend):** The `ModuleFormModal` computes the next WBS code client-side using `computeNextWbs(allModules, parentId?)`:
- Root module: `max(existing root wbs codes) + 1`
- Sub-module: `parent.wbs_code + '.' + (max(sibling last segments) + 1)`

The computed value is editable — users can override before saving. Uniqueness is validated against existing module WBS codes in the same request.

---

## Part B: Actions

Base path: `/api/v1/actions`

Defines generic actions that can be performed: `view`, `create`, `update`, `delete`, `approve`, `export`.

### 1. Create Action

**Method:** `POST` `/api/v1/actions`  
**Request Body:** `{ "name": "approve" }`

### 2. Get All Actions

**Method:** `GET` `/api/v1/actions`

### 3. Get Action by ID

**Method:** `GET` `/api/v1/actions/:id`

### 4. Update Action

**Method:** `PATCH` `/api/v1/actions/:id`

### 5. Delete Action

**Method:** `DELETE` `/api/v1/actions/:id`

---

## Part C: Module Access

Base path: `/api/v1/module-access`

Associates an Action to an App Module, granting that right to a specific Role.

### 1. Create Module Access

**Method:** `POST` `/api/v1/module-access`

**Request Body:**

| Field         | Type    | Description             |
| ------------- | ------- | ----------------------- |
| `role_id`     | UUID    | Role gaining the access |
| `module_id`   | UUID    | Module being accessed   |
| `action_id`   | UUID    | Action allowed          |
| `access_flag` | boolean | Enabled/disabled        |

### 2. Get All Module Access Definitions

**Method:** `GET` `/api/v1/module-access`

### 3. Get Module Access by Role

**Method:** `GET` `/api/v1/module-access/role/:roleId`

### 4. Get Module Access by ID

**Method:** `GET` `/api/v1/module-access/:id`

### 5. Update Module Access

**Method:** `PATCH` `/api/v1/module-access/:id`

**Request Body:** Partial update of creation payload.

### 6. Delete Module Access

**Method:** `DELETE` `/api/v1/module-access/:id`

### 7. Get Role Permissions List

**Method:** `GET` `/api/v1/module-access/role/:roleId/permissions-list`

Returns a flat list of all permissions (AppModule + Action combinations) available to a role, filtered by the organization's plan, with their `checked` status indicating if they are currently assigned to the role.

### 8. Update Role Permissions List

**Method:** `PUT` `/api/v1/module-access/role/:roleId/permissions-list`

Bulk updates the permissions for a role. Unchecked permissions omitted from the payload or sent as `checked: false` are removed, while new ones are created.

**Request Body:**
```json
{
  "permissions": [
    {
      "module_id": "uuid",
      "action_id": "uuid",
      "checked": true
    }
  ]
}
```
