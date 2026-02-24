# User APIs

Base path: `/api/v1/users`

Manages system users. Users belong to an enterprise and organization.

---

## 1. Create User

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/users` |
| **Auth** | None |
| **Status** | `201 Created` |

**Request Body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `first_name` | string | ✅ | 2–100 characters | First name |
| `middle_name` | string | ❌ | 2–100 characters | Middle name |
| `last_name` | string | ✅ | 2–100 characters | Last name |
| `email` | string | ✅ | Valid email format | Email (must be unique) |
| `phone` | string | ✅ | E.164 format (e.g., `+919876543210`) | Phone (must be unique) |
| `password` | string | ✅ | Min 8 chars; must have uppercase, lowercase, digit, special char | Password |
| `enterprise_id` | string (UUID) | ✅ | Valid UUID v4 | Enterprise the user belongs to |
| `organization_id` | string (UUID) | ✅ | Valid UUID v4 | Organization the user belongs to |

**Password Rules:**
- Minimum 8 characters
- At least one uppercase letter (`A-Z`)
- At least one lowercase letter (`a-z`)
- At least one digit (`0-9`)
- At least one special character (`@$!%*?&`)

**Phone Format:** E.164 international format, e.g., `+919876543210`, `+14155552671`

```json
{
  "first_name": "John",
  "middle_name": "Michael",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+919876543210",
  "password": "SecurePass@123",
  "enterprise_id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "770e8400-e29b-41d4-a716-446655440002"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "first_name": "John",
    "middle_name": "Michael",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+919876543210",
    "enterprise_id": "550e8400-...",
    "organization_id": "770e8400-...",
    "status": "ACTIVE",
    "code": null,
    "description": null,
    "created_at": "2026-02-24T10:00:00.000Z",
    "updated_at": "2026-02-24T10:00:00.000Z",
    "modified_by": null
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

> **Note:** `password_hash` is never exposed in any response.

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Validation errors (invalid email, weak password, etc.) |
| `409 Conflict` | Email or phone already exists |
| `404 Not Found` | Enterprise or Organization ID doesn't exist |

---

## 2. Get All Users

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/users` |
| **Auth** | None |
| **Status** | `200 OK` |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "aa0e8400-...",
      "first_name": "John",
      "middle_name": "Michael",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+919876543210",
      "enterprise_id": "550e8400-...",
      "organization_id": "770e8400-...",
      "status": "ACTIVE",
      "code": null,
      "description": null,
      "created_at": "2026-02-24T10:00:00.000Z",
      "updated_at": "2026-02-24T10:00:00.000Z",
      "modified_by": null
    }
  ],
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

---

## 3. Get User by ID

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/users/:id` |
| **Auth** | None |
| **Status** | `200 OK` |

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | User ID |

**Response:** Same shape as a single item from Create User response.

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid UUID format |
| `404 Not Found` | User not found |

---

## 4. Update User

| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/users/:id` |
| **Auth** | None |
| **Status** | `200 OK` |

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | User ID |

**Request Body:** (all fields optional, **password excluded** — use auth endpoints)

| Field | Type | Validation | Description |
|---|---|---|---|
| `first_name` | string | 2–100 characters | Updated first name |
| `middle_name` | string | 2–100 characters | Updated middle name |
| `last_name` | string | 2–100 characters | Updated last name |
| `email` | string | Valid email format | Updated email |
| `phone` | string | E.164 format | Updated phone |
| `enterprise_id` | string (UUID) | Valid UUID v4 | Move to different enterprise |
| `organization_id` | string (UUID) | Valid UUID v4 | Move to different organization |

```json
{
  "first_name": "Jonathan",
  "phone": "+919876543211"
}
```

**Response:** Updated user object (same shape as Create User response).

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid UUID format or validation errors |
| `404 Not Found` | User not found |
| `409 Conflict` | Updated email or phone already exists |

---

## 5. Delete User (Soft Delete)

Sets the user's status to `DELETED`. The record is not physically removed.

| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/users/:id` |
| **Auth** | None |
| **Status** | `204 No Content` |

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | User ID |

**Response:** No body (204)

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid UUID format |
| `404 Not Found` | User not found |
