# App APIs

Base path: `/api/v1/apps`

Manages application definitions in the multi-app architecture (e.g., HRMS, CRM, LMS).

---

## 1. Create App

|            |                               |
| ---------- | ----------------------------- |
| **Method** | `POST`                        |
| **URL**    | `/api/v1/apps`                |
| **Auth**   | Bearer Token (Platform Admin) |
| **Status** | `201 Created`                 |

**Request Body:**

| Field             | Type          | Required | Validation        | Description                                               |
| ----------------- | ------------- | -------- | ----------------- | --------------------------------------------------------- |
| `name`            | string        | ✅       | 2–100 characters  | App name (must be unique)                                 |
| `priority`        | integer       | ❌       | ≥ 1, default: 999 | Lower = higher priority (determines default app on login) |
| `enterprise_id`   | string (UUID) | ✅       | Valid UUID v4     | Enterprise this app belongs to                            |
| `organization_id` | string (UUID) | ✅       | Valid UUID v4     | Organization this app belongs to                          |

```json
{
  "name": "HRMS",
  "priority": 1,
  "enterprise_id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "770e8400-e29b-41d4-a716-446655440002"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "name": "HRMS",
    "priority": 1,
    "enterprise_id": "550e8400-...",
    "organization_id": "770e8400-...",
    "status": "ACTIVE",
    "created_at": "2026-02-24T10:00:00.000Z",
    "updated_at": "2026-02-24T10:00:00.000Z"
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

**Error Responses:**

| Status         | Condition                             |
| -------------- | ------------------------------------- |
| `409 Conflict` | App with the same name already exists |

---

## 2. Get All Apps

|            |                               |
| ---------- | ----------------------------- |
| **Method** | `GET`                         |
| **URL**    | `/api/v1/apps`                |
| **Auth**   | Bearer Token (Platform Admin) |
| **Status** | `200 OK`                      |

Returns all apps, sorted by `priority` ascending.

---

## 3. Get App by ID

|            |                               |
| ---------- | ----------------------------- |
| **Method** | `GET`                         |
| **URL**    | `/api/v1/apps/:id`            |
| **Auth**   | Bearer Token (Platform Admin) |
| **Status** | `200 OK`                      |

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `id`      | UUID | App ID      |

**Error Responses:**

| Status          | Condition     |
| --------------- | ------------- |
| `404 Not Found` | App not found |

---

## 4. Update App

|            |                               |
| ---------- | ----------------------------- |
| **Method** | `PATCH`                       |
| **URL**    | `/api/v1/apps/:id`            |
| **Auth**   | Bearer Token (Platform Admin) |
| **Status** | `200 OK`                      |

**Request Body:** (all fields optional)

| Field      | Type    | Validation       | Description      |
| ---------- | ------- | ---------------- | ---------------- |
| `name`     | string  | 2–100 characters | Updated app name |
| `priority` | integer | ≥ 1              | Updated priority |

```json
{
  "name": "HRMS Pro",
  "priority": 1
}
```

---

## 5. Delete App

|            |                               |
| ---------- | ----------------------------- |
| **Method** | `DELETE`                      |
| **URL**    | `/api/v1/apps/:id`            |
| **Auth**   | Bearer Token (Platform Admin) |
| **Status** | `204 No Content`              |

> ⚠️ Deleting an app cascades to its roles and user-role-maps.
