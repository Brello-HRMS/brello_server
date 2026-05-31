# Auth APIs

Base path: `/api/v1/auth`

---

## 1. Login

Authenticates a user and returns JWT tokens along with available applications.

|            |                      |
| ---------- | -------------------- |
| **Method** | `POST`               |
| **URL**    | `/api/v1/auth/login` |
| **Auth**   | None                 |
| **Status** | `200 OK`             |

**Request Body:**

| Field                | Type   | Required | Validation         | Description                            |
| -------------------- | ------ | -------- | ------------------ | -------------------------------------- |
| `email`              | string | ✅       | Valid email format | User's email address                   |
| `password`           | string | ✅       | Non-empty          | User's password                        |
| `device_fingerprint` | string | ❌       | —                  | Device identifier for session tracking |

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
      "organization_id": "770e8400-e29b-41d4-a716-446655440002",
      "is_platform_admin": false
    },
    "expires_in": 900,
    "defaultAppId": "880e8400-e29b-41d4-a716-446655440003",
    "availableApps": [
      { "id": "880e8400-...", "name": "HRMS", "priority": 1 },
      { "id": "990e8400-...", "name": "CRM", "priority": 2 }
    ]
  },
  "timestamp": "2026-05-28T10:00:00.000Z"
}
```

**Error Responses:**

| Status             | Condition                 |
| ------------------ | ------------------------- |
| `401 Unauthorized` | Invalid email or password |
| `401 Unauthorized` | Account is inactive       |
| `403 Forbidden`    | No active roles assigned  |

---

## 1a. Login — Send OTP

Initiates the OTP-based (passwordless) login. Sends a 6-digit OTP to the provided email address.

**Works for both regular users and platform admins.** All OTPs issued through this endpoint use the `LOGIN` purpose — platform admin detection happens at token-generation time, not at OTP-storage time. The caller never needs to distinguish between user types.

|            |                                  |
| ---------- | -------------------------------- |
| **Method** | `POST`                           |
| **URL**    | `/api/v1/auth/login/send-otp`    |
| **Auth**   | None                             |
| **Status** | `204 No Content`                 |

**Request Body:**

| Field   | Type   | Required | Validation         | Description             |
| ------- | ------ | -------- | ------------------ | ----------------------- |
| `email` | string | ✅       | Valid email format | User's registered email |

```json
{
  "email": "john@example.com"
}
```

**Response:** No body (204)

> **Dev mode:** OTP is printed to the server console.

**Error Responses:**

| Status             | Condition                              |
| ------------------ | -------------------------------------- |
| `401 Unauthorized` | Email not found or account is inactive |

---

## 1b. Login — Verify OTP

Verifies the OTP and issues JWT tokens. This endpoint handles both regular users and platform admins.

After a successful response, the client should inspect `data.user.is_platform_admin`:
- `true` → redirect to `/platform/dashboard`
- `false` / absent → follow the regular `setup_required` / `/dashboard` flow

|            |                                   |
| ---------- | --------------------------------- |
| **Method** | `POST`                            |
| **URL**    | `/api/v1/auth/login/verify-otp`   |
| **Auth**   | None                              |
| **Status** | `200 OK`                          |

**Request Body:**

| Field                | Type   | Required | Validation           | Description                            |
| -------------------- | ------ | -------- | -------------------- | -------------------------------------- |
| `email`              | string | ✅       | Valid email format   | User's registered email                |
| `otp`                | string | ✅       | Exactly 6 characters | The OTP received                       |
| `device_fingerprint` | string | ❌       | —                    | Device identifier for session tracking |

```json
{
  "email": "john@example.com",
  "otp": "482917",
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
      "organization_id": "770e8400-e29b-41d4-a716-446655440002",
      "is_platform_admin": false
    },
    "expires_in": 900,
    "defaultAppId": "880e8400-e29b-41d4-a716-446655440003",
    "availableApps": [
      { "id": "880e8400-...", "name": "HRMS", "priority": 1 }
    ],
    "setup_required": false
  },
  "timestamp": "2026-05-28T10:00:00.000Z"
}
```

> **Platform Admin response:** `is_platform_admin: true`, `defaultAppId: ""`, `availableApps: []`, `setup_required` absent.

**OTP rules:**

| Rule         | Value                                  |
| ------------ | -------------------------------------- |
| Max attempts | 5 before OTP is invalidated            |
| Expiry       | 10 minutes                             |
| Dev bypass   | `123456` works in `brello.environment=dev` |

**Refresh token:** Delivered as an `HttpOnly` Secure cookie — not in the response body.

**Error Responses:**

| Status            | Condition                                  |
| ----------------- | ------------------------------------------ |
| `400 Bad Request` | Invalid or expired OTP                     |
| `400 Bad Request` | No OTP found — initiate send-otp first     |
| `400 Bad Request` | Maximum OTP attempts exceeded (5 attempts) |
| `401 Unauthorized`| User inactive or not found                 |

---

## 1c. Resend OTP

Re-sends a fresh OTP for any in-progress flow. If no existing OTP record is found for the given email + purpose, a **new one is generated and sent anyway** — no prior send is required.

|            |                              |
| ---------- | ---------------------------- |
| **Method** | `POST`                       |
| **URL**    | `/api/v1/auth/resend-otp`    |
| **Auth**   | None                         |
| **Status** | `204 No Content`             |

**Request Body:**

| Field     | Type   | Required | Validation                            | Description                            |
| --------- | ------ | -------- | ------------------------------------- | -------------------------------------- |
| `email`   | string | ✅       | Valid email format                    | User's registered email                |
| `purpose` | string | ✅       | One of the `OtpPurpose` enum values   | Which flow's OTP to regenerate         |

**Valid `purpose` values:**

| Value                    | Use case                                  |
| ------------------------ | ----------------------------------------- |
| `LOGIN`                  | Regular login OTP (and platform admin via unified flow) |
| `PLATFORM_ADMIN_LOGIN`   | Platform admin login via dedicated endpoint |
| `PLATFORM_ADMIN_REGISTER`| Platform admin registration               |
| `RESET_PASSWORD`         | Forgot password flow                      |
| `LEAD_VERIFICATION`      | Lead email verification                   |

```json
{
  "email": "john@example.com",
  "purpose": "LOGIN"
}
```

**Response:** No body (204)

> **Behaviour:** Clears any existing OTP for the email + purpose pair, generates a new one, and sends it. If no prior OTP exists (e.g. session expired), the user is resolved by email and a fresh OTP is created — so this endpoint also serves as a standalone re-initiation.

**Error Responses:**

| Status            | Condition                                        |
| ----------------- | ------------------------------------------------ |
| `400 Bad Request` | No account found for the provided email          |
| `400 Bad Request` | Invalid `purpose` value                          |

---

## 2. Switch App

Issues a new access token scoped to a different application. The user must have at least one active role in the target app.

|            |                           |
| ---------- | ------------------------- |
| **Method** | `POST`                    |
| **URL**    | `/api/v1/auth/switch-app` |
| **Auth**   | Bearer `<access_token>`   |
| **Status** | `200 OK`                  |

**Request Body:**

| Field   | Type          | Required | Validation | Description           |
| ------- | ------------- | -------- | ---------- | --------------------- |
| `appId` | string (UUID) | ✅       | Valid UUID | Target application ID |

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

| Status             | Condition                             |
| ------------------ | ------------------------------------- |
| `401 Unauthorized` | Invalid or expired access token       |
| `403 Forbidden`    | No roles in the requested application |

---

## 3. Logout

Invalidates the current session.

|            |                         |
| ---------- | ----------------------- |
| **Method** | `POST`                  |
| **URL**    | `/api/v1/auth/logout`   |
| **Auth**   | Bearer `<access_token>` |
| **Status** | `204 No Content`        |

**Request Body:** None

**Response:** No body (204)

**Error Responses:**

| Status             | Condition                       |
| ------------------ | ------------------------------- |
| `401 Unauthorized` | Invalid or expired access token |
| `404 Not Found`    | Session not found               |

---

## 4. Refresh Token

Gets a new access token using a refresh token. Implements **token rotation** — the old refresh token is invalidated and a new one is issued.

|            |                          |
| ---------- | ------------------------ |
| **Method** | `POST`                   |
| **URL**    | `/api/v1/auth/refresh`   |
| **Auth**   | Bearer `<refresh_token>` |
| **Status** | `200 OK`                 |

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

| Status             | Condition                   |
| ------------------ | --------------------------- |
| `401 Unauthorized` | Invalid refresh token       |
| `401 Unauthorized` | Session has been logged out |
| `401 Unauthorized` | Session has expired         |

---

## 5. Update Password

Changes the authenticated user's password. **Invalidates all active sessions** (forces re-login).

|            |                                |
| ---------- | ------------------------------ |
| **Method** | `POST`                         |
| **URL**    | `/api/v1/auth/update-password` |
| **Auth**   | Bearer `<access_token>`        |
| **Status** | `204 No Content`               |

**Request Body:**

| Field          | Type   | Required | Validation                                                                       | Description      |
| -------------- | ------ | -------- | -------------------------------------------------------------------------------- | ---------------- |
| `old_password` | string | ✅       | Non-empty                                                                        | Current password |
| `new_password` | string | ✅       | Min 8 chars, must contain: uppercase, lowercase, digit, special char (`@$!%*?&`) | New password     |

```json
{
  "old_password": "OldSecurePass@123",
  "new_password": "NewSecurePass@456"
}
```

**Response:** No body (204)

**Error Responses:**

| Status             | Condition                                         |
| ------------------ | ------------------------------------------------- |
| `401 Unauthorized` | Current password is incorrect                     |
| `400 Bad Request`  | New password doesn't meet complexity requirements |

---

## 6. Forgot Password (Request OTP)

Initiates the password reset flow by generating an OTP. For security, this endpoint **always returns 204** even if the email doesn't exist.

|            |                                |
| ---------- | ------------------------------ |
| **Method** | `POST`                         |
| **URL**    | `/api/v1/auth/forgot-password` |
| **Auth**   | None                           |
| **Status** | `204 No Content`               |

**Request Body:**

| Field   | Type   | Required | Validation         | Description             |
| ------- | ------ | -------- | ------------------ | ----------------------- |
| `email` | string | ✅       | Valid email format | User's registered email |

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

|            |                           |
| ---------- | ------------------------- |
| **Method** | `POST`                    |
| **URL**    | `/api/v1/auth/verify-otp` |
| **Auth**   | None                      |
| **Status** | `204 No Content`          |

**Request Body:**

| Field          | Type   | Required | Validation           | Description             |
| -------------- | ------ | -------- | -------------------- | ----------------------- |
| `email`        | string | ✅       | Valid email format   | User's registered email |
| `otp`          | string | ✅       | Exactly 6 characters | The OTP received        |
| `new_password` | string | ✅       | Min 8 chars          | New password            |

```json
{
  "email": "john@example.com",
  "otp": "482917",
  "new_password": "NewSecurePass@789"
}
```

**Response:** No body (204)

**Error Responses:**

| Status            | Condition                                  |
| ----------------- | ------------------------------------------ |
| `400 Bad Request` | Invalid or expired OTP                     |
| `400 Bad Request` | Maximum OTP attempts exceeded (5 attempts) |
| `404 Not Found`   | User not found                             |

---

## 8. Platform Admin Register (Request OTP)

Initiates the registration flow for a new Platform Admin by securely masking their initial creation and sending an OTP to `tech@brello.co.in`.

|            |                                        |
| ---------- | -------------------------------------- |
| **Method** | `POST`                                 |
| **URL**    | `/api/v1/auth/platform-admin/register` |
| **Auth**   | None                                   |
| **Status** | `200 OK`                               |

**Request Body:**

| Field          | Type   | Required | Validation          | Description             |
| -------------- | ------ | -------- | ------------------- | ----------------------- |
| `first_name`   | string | ✅       | 2–100 chars         | First Name              |
| `middle_name`  | string | ❌       | 2–100 chars         | Middle Name             |
| `last_name`    | string | ✅       | 2–100 chars         | Last Name               |
| `email`        | string | ✅       | Valid email format  | User's registered email |
| `phone_number` | string | ✅       | E.164 format        | User's phone            |
| `password`     | string | ✅       | Min 8 chars, strong | Password                |

**Response:** No body (200 OK)

---

## 9. Platform Admin Verify Register

Verifies the OTP and activates the Platform Admin account.

|            |                                               |
| ---------- | --------------------------------------------- |
| **Method** | `POST`                                        |
| **URL**    | `/api/v1/auth/platform-admin/verify-register` |
| **Auth**   | None                                          |
| **Status** | `200 OK`                                      |

**Request Body:**

| Field   | Type   | Required | Validation           | Description              |
| ------- | ------ | -------- | -------------------- | ------------------------ |
| `email` | string | ✅       | Valid email format   | User's registered email  |
| `otp`   | string | ✅       | Exactly 6 characters | The OTP received by tech |

**Response:** No body (200 OK)

---

## 10. Platform Admin Login (Request OTP) — Dedicated Endpoint

Initiates the login flow for an existing Platform Admin by validating credentials and sending an OTP to their email.

> **Preferred approach:** Platform admins can now use the **unified OTP login flow** (`POST /api/v1/auth/login/send-otp` → `POST /api/v1/auth/login/verify-otp`) on the same login page as regular users. The server detects the user's `is_platform_admin` flag automatically and uses the correct OTP purpose. This dedicated endpoint remains available for direct API access and Postman setup flows.

|            |                                     |
| ---------- | ----------------------------------- |
| **Method** | `POST`                              |
| **URL**    | `/api/v1/auth/platform-admin/login` |
| **Auth**   | None                                |
| **Status** | `200 OK`                            |

**Request Body:**

| Field      | Type   | Required | Validation         | Description             |
| ---------- | ------ | -------- | ------------------ | ----------------------- |
| `email`    | string | ✅       | Valid email format | User's registered email |
| `password` | string | ✅       | Non-empty          | User's password         |

**Response:** No body (200 OK)

---

## 11. Platform Admin Verify Login (Returns Token)

Verifies the login OTP and formally completes authentication by returning tokens.

|            |                                            |
| ---------- | ------------------------------------------ |
| **Method** | `POST`                                     |
| **URL**    | `/api/v1/auth/platform-admin/verify-login` |
| **Auth**   | None                                       |
| **Status** | `200 OK`                                   |

**Request Body:**

| Field   | Type   | Required | Validation           | Description             |
| ------- | ------ | -------- | -------------------- | ----------------------- |
| `email` | string | ✅       | Valid email format   | User's registered email |
| `otp`   | string | ✅       | Exactly 6 characters | The OTP received        |

**Response:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 900,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "first_name": "Admin",
      "last_name": "User",
      "is_platform_admin": true
    },
    "defaultAppId": null,
    "availableApps": []
  },
  "timestamp": "2026-02-24T10:00:00.000Z"
}
```
