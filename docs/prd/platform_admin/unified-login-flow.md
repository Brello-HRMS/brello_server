# PRD: Unified Platform Admin Login Flow

**Date:** 2026-05-28
**Status:** Shipped
**Scope:** Backend (auth service) + Frontend (login/OTP/routing)

---

## Problem

Platform admins previously had a completely separate login flow from regular users:

- Dedicated endpoint: `POST /auth/platform-admin/login` required **email + password** to initiate OTP
- A second dedicated endpoint: `POST /auth/platform-admin/verify-login` to complete authentication
- The frontend had no mechanism to handle platform admin users — the login page only called the regular user OTP endpoint, so platform admins could not log in through the UI at all

This created two pain points:
1. Platform admins could not use the web application login page — they had to use direct API calls (Postman/curl)
2. Maintaining two parallel login code paths (DTOs, services, OTP purposes) increased complexity

---

## Solution

### Core idea

Extend the **existing regular OTP login endpoints** to handle platform admin users without any change to the client. Both regular users and platform admins use the same endpoints and the same `LOGIN` OTP purpose. The server detects `is_platform_admin` on the user record and includes it in the auth response, which the frontend uses to route to the correct dashboard.

### What changed

#### Backend (`brello_server`)

| File | Change |
|------|--------|
| `auth.service.ts` — `buildAuthResponse` | Now includes `is_platform_admin` in the returned `user` object |
| `auth.service.ts` — `resendOtp` | No longer throws when no prior OTP exists — falls back to email lookup and creates a fresh OTP |
| `token.service.ts` — `createSessionAndTokens` | `app_id` stored as `undefined` (not `''`) when no app is assigned, preventing `22P02` UUID error for platform admins |

The OTP send and verify methods (`loginSendOtp`, `loginWithOtp`) are **unchanged** — they always use `LOGIN` purpose for the regular flow. Platform admin detection happens only at the token-generation stage.

The dedicated platform admin endpoints (`/auth/platform-admin/login` and `/auth/platform-admin/verify-login`) are **unchanged** and remain available for direct API/Postman use.

#### Frontend (`brello_webapp`)

| File | Change |
|------|--------|
| `OtpForm.tsx` | After `verifyLoginOtp` success, checks `data.data.user.is_platform_admin`; if `true`, navigates to `/platform/dashboard` |
| `routes/index.tsx` | Added `platformAdminLoader` (guards `/platform/dashboard` — redirects non-platform-admins to `/dashboard`); added `/platform/dashboard` route |
| `pages/platform/PlatformDashboardPage.tsx` | New placeholder page for platform admin dashboard |
| `features/auth/api/authType.ts` | Added `is_platform_admin?: boolean` to `User` type |

---

## Login Flow (After This Change)

### Platform Admin — via unified login page

```
1. User opens /auth/login
2. Enters email → clicks "Send OTP"
   → POST /auth/login/send-otp { email }
   → Server finds user, stores OTP with LOGIN purpose (same as regular users)
   → 204 No Content

3. User receives OTP, enters it on /auth/otp page
   → POST /auth/login/verify-otp { email, otp, device_fingerprint }
   → Server finds LOGIN OTP, verifies it
   → Server generates JWT with isPlatformAdmin: true
   → Response includes user.is_platform_admin: true, availableApps: [], defaultAppId: ""

4. Frontend reads is_platform_admin from response
   → navigate('/platform/dashboard')
```

### Regular User — unchanged

```
1. POST /auth/login/send-otp { email }
   → OTP stored with LOGIN purpose
2. POST /auth/login/verify-otp { email, otp, device_fingerprint }
   → Response: is_platform_admin: false
   → Frontend routes to /dashboard or /auth/lead (if setup_required)
```

### Platform Admin — via dedicated endpoints (Postman/bootstrap only)

```
POST /auth/platform-admin/login { email, password }   → OTP sent (PLATFORM_ADMIN_LOGIN purpose)
POST /auth/platform-admin/verify-login { email, otp } → JWT returned
```

---

## Routing Guard

`/platform/dashboard` is protected by `platformAdminLoader`:

```ts
const platformAdminLoader = () => {
  if (!isAuthenticated()) return redirect('/auth/login');
  if (!isPlatformAdmin()) return redirect('/dashboard');
  return null;
};
```

`isPlatformAdmin()` reads `sessionStorage.auth_response.data.user.is_platform_admin`.

---

## JWT Payload

The access token issued for platform admins contains `isPlatformAdmin: true`:

```json
{
  "userId": "...",
  "sessionId": "...",
  "organizationId": null,
  "enterpriseId": null,
  "appId": "",
  "isPlatformAdmin": true,
  "iat": 1748390400,
  "exp": 1748391300
}
```

---

## API Response Change

`POST /auth/login/verify-otp` now includes `is_platform_admin` in the user object (was previously omitted):

```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "user": {
      "id": "...",
      "email": "admin@brello.com",
      "first_name": "Admin",
      "last_name": "Root",
      "enterprise_id": null,
      "organization_id": null,
      "is_platform_admin": true
    },
    "expires_in": 900,
    "defaultAppId": "",
    "availableApps": []
  }
}
```

This is a **non-breaking additive change** — existing clients that don't read `is_platform_admin` are unaffected.

---

## OTP Purpose Mapping

All OTPs in the regular unified flow use `LOGIN` purpose regardless of user type.

| User type      | Regular flow purpose | Dedicated endpoint purpose  |
|----------------|----------------------|-----------------------------|
| Regular user   | `LOGIN`              | N/A                         |
| Platform admin | `LOGIN`              | `PLATFORM_ADMIN_LOGIN`      |

Purpose switching is not needed — `is_platform_admin` in the response is sufficient for the frontend to route correctly.

---

## Resend OTP Behaviour Change

`POST /auth/resend-otp` previously required an existing OTP record for the given email + purpose and threw `400` if none was found. It now:

1. Looks for an existing OTP record
2. If found — uses its `user_id`, deletes it, creates a new OTP
3. If **not found** — looks up the user by email, creates a fresh OTP from scratch

This means resend can be called even when the previous OTP expired or was never issued (e.g. user navigated back to OTP page after session expiry).

---

## Bug Fixes During Testing

### Bug 1 — verify-otp: "No OTP Found" for platform admin

**Symptom:** `POST /auth/login/verify-otp` returned 400 "No OTP Found" for platform admin users even though the OTP email was received.

**Root cause (initial implementation):** The first attempt at this feature stored OTPs with `PLATFORM_ADMIN_LOGIN` purpose for platform admins in `loginSendOtp`. But verify-otp also needed to know the purpose to look up the OTP. Any mismatch between the purpose used at send time vs verify time (e.g. due to server restarts, stale records, or inconsistent `is_platform_admin` loading) caused the lookup to fail.

**Fix:** Reverted to using `LOGIN` purpose for all users in the regular flow. Both send and verify always use `LOGIN` — no server-side purpose switching needed.

---

### Bug 2 — verify-otp: "Invalid input format" (PostgreSQL `22P02`)

**Symptom:** After fixing Bug 1, `POST /auth/login/verify-otp` returned 400 with `INVALID_INPUT_FORMAT` error code.

**Root cause:** Platform admins have no assigned apps, so `getUserAvailableApps` returns `[]` and `determineDefaultApp` returns `''` (empty string). This empty string was passed as `app_id` to the session insert:

```ts
// token.service.ts — before fix
app_id: params.appId,  // '' → fails UUID column constraint → 22P02
```

The `sessions.app_id` column is typed `uuid, nullable: true` in PostgreSQL. Inserting `''` (not a valid UUID) causes PostgreSQL error `22P02` (invalid text representation).

**Fix:**

```ts
// token.service.ts — after fix
app_id: params.appId || undefined,  // empty string → undefined → NULL in DB
```

`undefined` is omitted by TypeORM, which maps to `NULL` for a nullable column.

---

## Not Changed

- The login page UI is unchanged (email field only)
- Platform admin registration flow (`/auth/platform-admin/register` + `/auth/platform-admin/verify-register`) is unchanged
- The dedicated platform admin login endpoints still work and are documented for Postman/bootstrap use
- Regular user login flows (password-based and OTP-based) are fully unaffected
