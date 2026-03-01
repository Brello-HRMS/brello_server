# App Module APIs

Base path: `/api/v1/app-modules`, `/api/v1/actions`, `/api/v1/module-accesses`

This module manages the permission taxonomy of the system (the hierarchical structure of what actions are available in which modules) and maps them to application roles.

---

## Part A: App Modules

Base path: `/api/v1/app-modules`

### 1. Create App Module

**Method:** `POST` `/api/v1/app-modules`  
**Status:** `201 Created`

**Request Body:**
| Field | Type | Validation | Description |
|---|---|---|---|
| `name` | string | 2–100 chars | Name of the module (e.g., Leave Management) |
| `wbs_code` | string | Required | Work breakdown structure code for hierarchy |
| `type` | string | `module` or `submodule` | The hierarchical type |

### 2. Get All App Modules

**Method:** `GET` `/api/v1/app-modules`  
**Status:** `200 OK`

### 3. Get App Module by ID

**Method:** `GET` `/api/v1/app-modules/:id`  
**Status:** `200 OK`

### 4. Update App Module

**Method:** `PATCH` `/api/v1/app-modules/:id`  
**Status:** `200 OK`

### 5. Delete App Module

**Method:** `DELETE` `/api/v1/app-modules/:id`  
**Status:** `204 No Content`

---

## Part B: Actions

Base path: `/api/v1/actions`

Defines generic actions that can be performed, e.g., 'view', 'create', 'approve'.

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

Base path: `/api/v1/module-accesses`

Associates an Action to an App Module, granting that right to a specific Role.

### 1. Create Module Access

**Method:** `POST` `/api/v1/module-accesses`

**Request Body:**
| Field | Type | Description |
|---|---|---|
| `role_id` | UUID | Role gaining the access |
| `module_id` | UUID | Module being accessed |
| `action_id` | UUID | Action allowed |
| `access_flag` | boolean | Enabled/disabled |

### 2. Get All Module Access Definitions

**Method:** `GET` `/api/v1/module-accesses`

### 3. Get Module Access by Role

**Method:** `GET` `/api/v1/module-accesses/role/:roleId`

### 4. Delete Module Access

**Method:** `DELETE` `/api/v1/module-accesses/:id`
