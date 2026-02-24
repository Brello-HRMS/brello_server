# Auth APIs

Base path: `/api/v1/auth`

---

## 1. Login

Authenticates a user and returns JWT tokens along with available applications.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/login` |
| **Auth** | None |
| **Status** | `200 OK` |

**Request Body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `email` | string | ✅ | Valid email format | User's email address |
| `password` | string | ✅ | Non-empty | User's password |
| `device_fingerprint` | string | ❌ | — | Device identifier for session tracking |

```json
{
  "email": "john@example.com",
  "password": "SecurePass@123",
  "device_fingerprint": "browser-chrome-mac"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "enterprise_id": "660e8400-e29b-41d4-a716-446655440001",
      "organization_id": "770e8400-e29b-41d4-a716-446655440002"
    },
    "expires_in": 900,
    "defaultAppId": "880e8400-e29b-41d4-a716-446655440003",
    "availableApps": [
      { "id": "880e8400-...", "name": "HRMS", "priority": 1 },
      { "id": "990e8400-...", "name": "CRM", "priority": 2 }
    ]
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Invalid email or password |
| `401 Unauthorized` | Account is inactive |
| `403 Forbidden` | No active roles assigned |

---

## 2. Switch App

Issues a new access token scoped to a different application. The user must have at least one active role in the target app.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/switch-app` |
| **Auth** | Bearer `<access_token>` |
| **Status** | `200 OK` |

**Request Body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `appId` | string (UUID) | ✅ | Valid UUID | Target application ID |

```json
{
  "appId": "990e8400-e29b-41d4-a716-446655440004"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "appId": "990e8400-e29b-41d4-a716-446655440004",
    "expires_in": 900
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Invalid or expired access token |
| `403 Forbidden` | No roles in the requested application |

---

## 3. Logout

Invalidates the current session.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/logout` |
| **Auth** | Bearer `<access_token>` |
| **Status** | `204 No Content` |

**Request Body:** None

**Response:** No body (204)

**Error Responses:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Invalid or expired access token |
| `404 Not Found` | Session not found |

---

## 4. Refresh Token

Gets a new access token using a refresh token. Implements **token rotation** — the old refresh token is invalidated and a new one is issued.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/refresh` |
| **Auth** | Bearer `<refresh_token>` |
| **Status** | `200 OK` |

**Request Body:** None

**Response:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Invalid refresh token |
| `401 Unauthorized` | Session has been logged out |
| `401 Unauthorized` | Session has expired |

---

## 5. Update Password

Changes the authenticated user's password. **Invalidates all active sessions** (forces re-login).

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/update-password` |
| **Auth** | Bearer `<access_token>` |
| **Status** | `204 No Content` |

**Request Body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `old_password` | string | ✅ | Non-empty | Current password |
| `new_password` | string | ✅ | Min 8 chars, must contain: uppercase, lowercase, digit, special char (`@$!%*?&`) | New password |

```json
{
  "old_password": "OldSecurePass@123",
  "new_password": "NewSecurePass@456"
}
```

**Response:** No body (204)

**Error Responses:**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Current password is incorrect |
| `400 Bad Request` | New password doesn't meet complexity requirements |

---

## 6. Forgot Password (Request OTP)

Initiates the password reset flow by generating an OTP. For security, this endpoint **always returns 204** even if the email doesn't exist.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/forgot-password` |
| **Auth** | None |
| **Status** | `204 No Content` |

**Request Body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `email` | string | ✅ | Valid email format | User's registered email |

```json
{
  "email": "john@example.com"
}
```

**Response:** No body (204)

> **Note:** In development, the OTP is logged to the server console. In production, it will be sent via SMTP.

---

## 7. Verify OTP & Reset Password

Verifies the OTP and sets a new password. **Invalidates all active sessions.**

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `/api/v1/auth/verify-otp` |
| **Auth** | None |
| **Status** | `204 No Content` |

**Request Body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `email` | string | ✅ | Valid email format | User's registered email |
| `otp` | string | ✅ | Exactly 6 characters | The OTP received |
| `new_password` | string | ✅ | Min 8 chars | New password |

```json
{
  "email": "john@example.com",
  "otp": "482917",
  "new_password": "NewSecurePass@789"
}
```

**Response:** No body (204)

**Error Responses:**

| Status | Condition |
|---|---|
| `400 Bad Request` | Invalid or expired OTP |
| `400 Bad Request` | Maximum OTP attempts exceeded (5 attempts) |
| `404 Not Found` | User not found |
