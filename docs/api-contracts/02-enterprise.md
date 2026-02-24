# Enterprise APIs

Base path: `/api/v1/enterprises`

Manages top-level tenants (companies/enterprises).

---

## 1. Create Enterprise

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/enterprises` |
| **Auth** | None |
| **Status** | `201 Created` |

**Request Body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `name` | string | ✅ | 2–255 characters | Enterprise name |
| `domain` | string | ✅ | Non-empty | Domain (e.g., `example.com`) |

```json
{
  "name": "Acme Corporation",
  "domain": "acme.com"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corporation",
    "domain": "acme.com",
    "created_at": "2026-02-24T10:00:00.000Z",
    "updated_at": "2026-02-24T10:00:00.000Z"
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

---

## 2. Get All Enterprises

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/enterprises` |
| **Auth** | None |
| **Status** | `200 OK` |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-...",
      "name": "Acme Corporation",
      "domain": "acme.com",
      "created_at": "2026-02-24T10:00:00.000Z",
      "updated_at": "2026-02-24T10:00:00.000Z"
    }
  ],
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

---

## 3. Get Enterprise by ID

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `/api/v1/enterprises/:id` |
| **Auth** | None |
| **Status** | `200 OK` |

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | Enterprise ID |

**Response:** Same shape as Create Enterprise response.

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid UUID format |
| `404 Not Found` | Enterprise not found |

---

## 4. Update Enterprise

| | |
|---|---|
| **Method** | `PATCH` |
| **URL** | `/api/v1/enterprises/:id` |
| **Auth** | None |
| **Status** | `200 OK` |

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | Enterprise ID |

**Request Body:** (all fields optional)

| Field | Type | Validation | Description |
|---|---|---|---|
| `name` | string | 2–255 characters | Updated enterprise name |
| `domain` | string | Non-empty | Updated domain |

```json
{
  "name": "Acme Corp International"
}
```

**Response:** Updated enterprise object.

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid UUID format |
| `404 Not Found` | Enterprise not found |

---

## 5. Delete Enterprise

| | |
|---|---|
| **Method** | `DELETE` |
| **URL** | `/api/v1/enterprises/:id` |
| **Auth** | None |
| **Status** | `204 No Content` |

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | Enterprise ID |

**Response:** No body (204)

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid UUID format |
| `404 Not Found` | Enterprise not found |
