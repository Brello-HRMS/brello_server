# Role & User-Role-Map APIs

---

## Part A: Role APIs

Base path: `/api/v1/roles`

Manages roles scoped to applications. Each role belongs to exactly one app.

---

### 1. Create Role

|            |                 |
| ---------- | --------------- |
| **Method** | `POST`          |
| **URL**    | `/api/v1/roles` |
| **Auth**   | None            |
| **Status** | `201 Created`   |

**Request Body:**

| Field               | Type          | Required | Validation                   | Description                      |
| ------------------- | ------------- | -------- | ---------------------------- | -------------------------------- |
| `name`              | string        | ✅       | 2–100 characters             | Role name (e.g., Admin, Viewer)  |
| `app_id`            | string (UUID) | ✅       | Valid UUID v4                | App this role belongs to         |
| `context`           | enum          | ✅       | `Owner`, `Admin`, `Employee` | The context level of this role   |
| `enterprise_id`     | string (UUID) | ✅       | Valid UUID v4                | Enterprise scope                 |
| `organization_id`   | string (UUID) | ✅       | Valid UUID v4                | Organization scope               |
| `is_system_defined` | boolean       | ❌       | Default: false               | Mark as non-editable system role |

```json
{
  "name": "Admin",
  "context": "Admin",
  "app_id": "880e8400-e29b-41d4-a716-446655440003",
  "enterprise_id": "550e8400-...",
  "organization_id": "770e8400-..."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "rr0e8400-e29b-41d4-a716-446655440010",
    "name": "Admin",
    "app_id": "880e8400-...",
    "is_system_defined": false,
    "enterprise_id": "550e8400-...",
    "organization_id": "770e8400-...",
    "status": "ACTIVE",
    "created_at": "2026-02-24T10:00:00.000Z",
    "updated_at": "2026-02-24T10:00:00.000Z"
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

---

### 2. Get All Roles

|            |                 |
| ---------- | --------------- |
| **Method** | `GET`           |
| **URL**    | `/api/v1/roles` |
| **Auth**   | None            |
| **Status** | `200 OK`        |

Returns all roles with their associated `app` relation included.

---

### 3. Get Role by ID

|            |                     |
| ---------- | ------------------- |
| **Method** | `GET`               |
| **URL**    | `/api/v1/roles/:id` |
| **Auth**   | None                |
| **Status** | `200 OK`            |

---

### 4. Get Roles by App

|            |                            |
| ---------- | -------------------------- |
| **Method** | `GET`                      |
| **URL**    | `/api/v1/roles/app/:appId` |
| **Auth**   | None                       |
| **Status** | `200 OK`                   |

**Path Parameters:**

| Parameter | Type | Description            |
| --------- | ---- | ---------------------- |
| `appId`   | UUID | Filter roles by app ID |

---

### 5. Update Role

|            |                     |
| ---------- | ------------------- |
| **Method** | `PATCH`             |
| **URL**    | `/api/v1/roles/:id` |
| **Auth**   | None                |
| **Status** | `200 OK`            |

**Request Body:** (all fields optional)

| Field  | Type   | Validation       | Description       |
| ------ | ------ | ---------------- | ----------------- |
| `name` | string | 2–100 characters | Updated role name |

---

### 6. Delete Role

|            |                     |
| ---------- | ------------------- |
| **Method** | `DELETE`            |
| **URL**    | `/api/v1/roles/:id` |
| **Auth**   | None                |
| **Status** | `204 No Content`    |

> ⚠️ Deleting a role cascades to its user-role-maps.

---

## Part B: User-Role-Map APIs

Base path: `/api/v1/user-role-maps`

Assigns roles to users within a specific organization. **A user must have at least one role to login.**

---

### 7. Assign Role to User

|            |                          |
| ---------- | ------------------------ |
| **Method** | `POST`                   |
| **URL**    | `/api/v1/user-role-maps` |
| **Auth**   | None                     |
| **Status** | `201 Created`            |

**Request Body:**

| Field             | Type          | Required | Validation    | Description                            |
| ----------------- | ------------- | -------- | ------------- | -------------------------------------- |
| `user_id`         | string (UUID) | ✅       | Valid UUID v4 | User to assign the role to             |
| `role_id`         | string (UUID) | ✅       | Valid UUID v4 | Role to assign                         |
| `organization_id` | string (UUID) | ✅       | Valid UUID v4 | Organization scope for this assignment |

```json
{
  "user_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "role_id": "rr0e8400-e29b-41d4-a716-446655440010",
  "organization_id": "770e8400-e29b-41d4-a716-446655440002"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "mm0e8400-e29b-41d4-a716-446655440020",
    "user_id": "aa0e8400-...",
    "role_id": "rr0e8400-...",
    "organization_id": "770e8400-...",
    "created_at": "2026-02-24T10:00:00.000Z"
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

**Error Responses:**

| Status         | Condition                                                      |
| -------------- | -------------------------------------------------------------- |
| `409 Conflict` | This role is already assigned to the user in this organization |

---

### 8. Get All User-Role Assignments

|            |                          |
| ---------- | ------------------------ |
| **Method** | `GET`                    |
| **URL**    | `/api/v1/user-role-maps` |
| **Auth**   | None                     |
| **Status** | `200 OK`                 |

Returns all assignments with `role` and `role.app` relations.

---

### 9. Get Roles by User

|            |                                       |
| ---------- | ------------------------------------- |
| **Method** | `GET`                                 |
| **URL**    | `/api/v1/user-role-maps/user/:userId` |
| **Auth**   | None                                  |
| **Status** | `200 OK`                              |

**Path Parameters:**

| Parameter | Type | Description          |
| --------- | ---- | -------------------- |
| `userId`  | UUID | User ID to filter by |

---

### 10. Get Assignment by ID

|            |                              |
| ---------- | ---------------------------- |
| **Method** | `GET`                        |
| **URL**    | `/api/v1/user-role-maps/:id` |
| **Auth**   | None                         |
| **Status** | `200 OK`                     |

---

### 11. Remove Role from User

|            |                              |
| ---------- | ---------------------------- |
| **Method** | `DELETE`                     |
| **URL**    | `/api/v1/user-role-maps/:id` |
| **Auth**   | None                         |
| **Status** | `204 No Content`             |
