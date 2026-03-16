# Department APIs

Base path: `/api/v1/departments`

Manages departments within an organization.

---

## 1. Create Department

|            |                       |
| ---------- | --------------------- |
| **Method** | `POST`                |
| **URL**    | `/api/v1/departments` |
| **Auth**   | JWT                   |
| **Status** | `201 Created`         |

**Request Body:**

| Field         | Type   | Required | Validation                                     | Description                  |
| ------------- | ------ | -------- | ---------------------------------------------- | ---------------------------- |
| `code`        | string | ✅       | 1–50 characters, Uppercase Alphanumeric (- \_) | Unique department identifier |
| `name`        | string | ✅       | 2–255 characters                               | Department name              |
| `description` | string | ❌       |                                                | Optional description         |
| `icon`        | string | ❌       |                                                | Optional icon identifier     |
| `status`      | enum   | ❌       | `ACTIVE`, `INACTIVE`                           | Initial status               |

```json
{
  "code": "ENG-01",
  "name": "Engineering",
  "description": "Software development and infrastructure",
  "status": "ACTIVE"
}
```

**Response:**

```json
{
  "id": "uuid-v4",
  "organization_id": "org-uuid",
  "enterprise_id": "ent-uuid",
  "code": "ENG-01",
  "name": "Engineering",
  "status": "ACTIVE",
  "description": "Software development and infrastructure",
  "icon": null,
  "modified_by": "user-uuid",
  "created_at": "2026-03-14T10:00:00.000Z",
  "updated_at": "2026-03-14T10:00:00.000Z"
}
```

**Error Responses:**

| Status            | Condition                                          |
| ----------------- | -------------------------------------------------- |
| `409 Conflict`    | Department code already exists in the organization |
| `400 Bad Request` | User not associated with an organization           |

---

## 2. List Departments

|            |                       |
| ---------- | --------------------- |
| **Method** | `GET`                 |
| **URL**    | `/api/v1/departments` |
| **Auth**   | JWT                   |
| **Status** | `200 OK`              |

**Query Parameters:**

| Parameter    | Type   | Description                              |
| ------------ | ------ | ---------------------------------------- |
| `status`     | enum   | Filter by `ACTIVE` or `INACTIVE`         |
| `search`     | string | Search by name or code                   |
| `sort_by`    | string | `name` or `created_at` (default: `name`) |
| `sort_order` | string | `ASC` or `DESC` (default: `ASC`)         |

**Response:**

```json
[
  {
    "id": "uuid-v4",
    "code": "ENG-01",
    "name": "Engineering",
    "status": "ACTIVE",
    "created_at": "..."
  }
]
```

---

## 3. Get Department by ID

|            |                           |
| ---------- | ------------------------- |
| **Method** | `GET`                     |
| **URL**    | `/api/v1/departments/:id` |
| **Auth**   | JWT                       |
| **Status** | `200 OK`                  |

**Path Parameters:**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `id`      | UUID | Department ID |

**Response:** Same shape as Create Department response.

---

## 4. Update Department

|            |                           |
| ---------- | ------------------------- |
| **Method** | `PATCH`                   |
| **URL**    | `/api/v1/departments/:id` |
| **Auth**   | JWT                       |
| **Status** | `200 OK`                  |

**Path Parameters:**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `id`      | UUID | Department ID |

**Request Body:** (all fields optional)

| Field         | Type   | Validation           | Description         |
| ------------- | ------ | -------------------- | ------------------- |
| `name`        | string | 2–255 characters     | Updated name        |
| `status`      | enum   | `ACTIVE`, `INACTIVE` | Updated status      |
| `description` | string |                      | Updated description |
| `icon`        | string |                      | Updated icon        |

**Response:** Updated department object.

---

## 5. Delete Department

|            |                           |
| ---------- | ------------------------- |
| **Method** | `DELETE`                  |
| **URL**    | `/api/v1/departments/:id` |
| **Auth**   | JWT                       |
| **Status** | `204 No Content`          |

**Path Parameters:**

| Parameter | Type | Description   |
| --------- | ---- | ------------- |
| `id`      | UUID | Department ID |

**Note:** This is a soft-delete operation. It sets `is_deleted` to `true` and `status` to `INACTIVE`.
