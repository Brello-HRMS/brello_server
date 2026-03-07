# Industry Type APIs

Base path: `/api/v1/industry-types`

A simple master lookup table for cataloging various industry types (`IT`, `Manufacturing`, `Retail`) to be assigned globally across enterprises.

---

## 1. Create Industry Type

|            |                          |
| ---------- | ------------------------ |
| **Method** | `POST`                   |
| **URL**    | `/api/v1/industry-types` |
| **Auth**   | Required                 |
| **Status** | `201 Created`            |

**Request Body:**

| Field  | Type   | Required | Validation       | Description          |
| ------ | ------ | -------- | ---------------- | -------------------- |
| `name` | string | ✅       | 2–255 characters | Unique Industry Name |

**Response:** standard wrapper over entity.

---

## 2. Standard CRUD

- `GET /api/v1/industry-types`: List all
- `GET /api/v1/industry-types/:id`: Get one
- `PATCH /api/v1/industry-types/:id`: Standard modification
- `DELETE /api/v1/industry-types/:id`: Soft delete
