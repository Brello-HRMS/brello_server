# Organization APIs

Base path: `/api/v1/organizations`

Manages organizations (business units / branches within an enterprise).

---

## 1. Create Organization

|            |                         |
| ---------- | ----------------------- |
| **Method** | `POST`                  |
| **URL**    | `/api/v1/organizations` |
| **Auth**   | None                    |
| **Status** | `201 Created`           |

**Request Body:**

| Field           | Type          | Required | Validation       | Description          |
| --------------- | ------------- | -------- | ---------------- | -------------------- |
| `name`          | string        | ✅       | 2–255 characters | Organization name    |
| `enterprise_id` | string (UUID) | ✅       | Valid UUID v4    | Parent enterprise ID |

```json
{
  "name": "Acme India Branch",
  "enterprise_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "Acme India Branch",
    "enterprise_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-02-24T10:00:00.000Z",
    "updated_at": "2026-02-24T10:00:00.000Z"
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

**Error Responses:**

| Status          | Condition                   |
| --------------- | --------------------------- |
| `404 Not Found` | Enterprise ID doesn't exist |

---

## 2. Get All Organizations

|            |                         |
| ---------- | ----------------------- |
| **Method** | `GET`                   |
| **URL**    | `/api/v1/organizations` |
| **Auth**   | None                    |
| **Status** | `200 OK`                |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "770e8400-...",
      "name": "Acme India Branch",
      "enterprise_id": "550e8400-...",
      "created_at": "2026-02-24T10:00:00.000Z",
      "updated_at": "2026-02-24T10:00:00.000Z"
    }
  ],
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

---

## 3. Get Organization by ID

|            |                             |
| ---------- | --------------------------- |
| **Method** | `GET`                       |
| **URL**    | `/api/v1/organizations/:id` |
| **Auth**   | None                        |
| **Status** | `200 OK`                    |

**Path Parameters:**

| Parameter | Type | Description     |
| --------- | ---- | --------------- |
| `id`      | UUID | Organization ID |

**Response:** Same shape as Create Organization response.

**Error Responses:**

| Status            | Condition              |
| ----------------- | ---------------------- |
| `400 Bad Request` | Invalid UUID format    |
| `404 Not Found`   | Organization not found |

---

## 4. Get Organizations by Enterprise

Returns all organizations belonging to a specific enterprise.

|            |                                                  |
| ---------- | ------------------------------------------------ |
| **Method** | `GET`                                            |
| **URL**    | `/api/v1/organizations/enterprise/:enterpriseId` |
| **Auth**   | None                                             |
| **Status** | `200 OK`                                         |

**Path Parameters:**

| Parameter      | Type | Description                |
| -------------- | ---- | -------------------------- |
| `enterpriseId` | UUID | Enterprise ID to filter by |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "770e8400-...",
      "name": "Acme India Branch",
      "enterprise_id": "550e8400-...",
      "created_at": "2026-02-24T10:00:00.000Z",
      "updated_at": "2026-02-24T10:00:00.000Z"
    }
  ],
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

---

## 5. Update Organization

|            |                             |
| ---------- | --------------------------- |
| **Method** | `PATCH`                     |
| **URL**    | `/api/v1/organizations/:id` |
| **Auth**   | None                        |
| **Status** | `200 OK`                    |

**Path Parameters:**

| Parameter | Type | Description     |
| --------- | ---- | --------------- |
| `id`      | UUID | Organization ID |

**Request Body:** (all fields optional)

| Field           | Type          | Validation       | Description                  |
| --------------- | ------------- | ---------------- | ---------------------------- |
| `name`          | string        | 2–255 characters | Updated name                 |
| `enterprise_id` | string (UUID) | Valid UUID v4    | Move to different enterprise |

```json
{
  "name": "Acme Mumbai HQ"
}
```

**Response:** Updated organization object.

**Error Responses:**

| Status            | Condition              |
| ----------------- | ---------------------- |
| `400 Bad Request` | Invalid UUID format    |
| `404 Not Found`   | Organization not found |

---

## 6. Delete Organization

|            |                             |
| ---------- | --------------------------- |
| **Method** | `DELETE`                    |
| **URL**    | `/api/v1/organizations/:id` |
| **Auth**   | None                        |
| **Status** | `204 No Content`            |

**Path Parameters:**

| Parameter | Type | Description     |
| --------- | ---- | --------------- |
| `id`      | UUID | Organization ID |

**Response:** No body (204)

**Error Responses:**

| Status            | Condition              |
| ----------------- | ---------------------- |
| `400 Bad Request` | Invalid UUID format    |
| `404 Not Found`   | Organization not found |

---

## 7. Create Organization Profile

|            |                                 |
| ---------- | ------------------------------- |
| **Method** | `POST`                          |
| **URL**    | `/api/v1/organizations/profile` |
| **Auth**   | None                            |
| **Status** | `201 Created`                   |

**Request Body:**

| Field              | Type   | Required | Validation             | Description               |
| ------------------ | ------ | -------- | ---------------------- | ------------------------- |
| `name`             | string | ✅       | 2–255 characters       | Legal Profile Name        |
| `email`            | string | ✅       | email                  | Unique contact email      |
| `phone`            | string | ✅       | E.164 phone            | Unique contact phone      |
| `gst_no`           | string | ✅       | 15 chars               | GST Identification        |
| `registration_no`  | string | ✅       | Registration Format    | Company Registry No       |
| `domain`           | string | ❌       | URL                    | Website domain            |
| `logo_id`          | UUID   | ❌       | Valid Document ID      | Link to document module   |
| `industry_type_id` | UUID   | ❌       | Valid Industry Type ID | Relational mapping        |
| `parent_id`        | UUID   | ❌       | Valid Organization ID  | Relational mapping        |
| `organization_id`  | UUID   | ✅       | Valid UUID v4          | Organization pointer      |
| `enterprise_id`    | UUID   | ✅       | Valid UUID v4          | Parent enterprise pointer |

---

## 8. Get Organization Profile

|            |                                     |
| ---------- | ----------------------------------- |
| **Method** | `GET`                               |
| **URL**    | `/api/v1/organizations/profile/:id` |
| **Auth**   | None                                |
| **Status** | `200 OK`                            |

Retrieve standard profile details.

---

## 9. Update Organization Profile

|            |                                     |
| ---------- | ----------------------------------- |
| **Method** | `PATCH`                             |
| **URL**    | `/api/v1/organizations/profile/:id` |
| **Auth**   | None                                |
| **Status** | `200 OK`                            |

Accepts partial modifications of the payload from creation.
