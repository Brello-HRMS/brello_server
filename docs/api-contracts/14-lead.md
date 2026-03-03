# Lead APIs

Base path: `/api/v1/leads`

---

## 1. Register Lead

Creates a new lead and sends a verification OTP to the provided email.

|            |                          |
| ---------- | ------------------------ |
| **Method** | `POST`                   |
| **URL**    | `/api/v1/leads/register` |
| **Auth**   | None                     |
| **Status** | `201 Created`            |

**Request Body:**

| Field        | Type   | Required | Validation                                                            | Description          |
| ------------ | ------ | -------- | --------------------------------------------------------------------- | -------------------- |
| `email`      | string | ✅       | Valid email format, unique                                            | Lead's email address |
| `first_name` | string | ✅       | 2–100 characters                                                      | First name           |
| `last_name`  | string | ✅       | 2–100 characters                                                      | Last name            |
| `phone`      | string | ✅       | E.164 format                                                          | Phone number         |
| `password`   | string | ✅       | Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special (`@$!%*?&`) | Password             |
| `source`     | string | ✅       | Must be `website`                                                     | Lead origin          |
| `location`   | string | ❌       | —                                                                     | Location             |
| `device`     | string | ❌       | —                                                                     | Device info          |

> **Note:** `lead_status` is always set to `NEW` server-side and is not accepted from the client.

```json
{
  "email": "samir@company.com",
  "first_name": "Mohd",
  "last_name": "Samir",
  "phone": "9876543210",
  "password": "StrongPass@123",
  "location": "India",
  "device": "MacOS - Chrome",
  "source": "website"
}
```

**Response:** No body (201 Created)

> **In dev mode:** Check the server console for the OTP log.

**Error Responses:**

| Status            | Condition                             |
| ----------------- | ------------------------------------- |
| `409 Conflict`    | Lead with this email already exists   |
| `400 Bad Request` | Validation failure (password, email…) |

---

## 2. Verify Lead OTP

Verifies the OTP sent during registration. On success, **transactionally** marks the lead as verified and creates a `User` record from the lead details. If anything fails, all changes are rolled back.

|            |                            |
| ---------- | -------------------------- |
| **Method** | `POST`                     |
| **URL**    | `/api/v1/leads/verify-otp` |
| **Auth**   | None                       |
| **Status** | `200 OK`                   |

**Request Body:**

| Field   | Type   | Required | Validation           | Description                    |
| ------- | ------ | -------- | -------------------- | ------------------------------ |
| `email` | string | ✅       | Valid email format   | The email used during register |
| `otp`   | string | ✅       | Exactly 6 characters | OTP received via email         |

```json
{
  "email": "samir@company.com",
  "otp": "482917"
}
```

**Response:** No body (200 OK)

**Side effects on success:**

- Lead record: `is_verified = true`
- New `User` created with: `first_name`, `last_name`, `email`, `phone`, `password_hash` from the lead

**Error Responses:**

| Status                      | Condition                                  |
| --------------------------- | ------------------------------------------ |
| `400 Bad Request`           | No lead found with this email              |
| `400 Bad Request`           | Lead is already verified                   |
| `400 Bad Request`           | Invalid or expired OTP                     |
| `400 Bad Request`           | Maximum OTP attempts exceeded (5 attempts) |
| `500 Internal Server Error` | Transaction failure (all changes reverted) |
