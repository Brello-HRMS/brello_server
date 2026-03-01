# Postman Collection — Step-by-Step Usage Guide

> This guide walks you through the entire API flow **starting from an empty database**.
> Follow the steps in exact order — each step depends on data created in previous steps.

---

## Prerequisites

1. Server running at `http://localhost:8000` (`nvm use 24 && npm run start:dev`)
2. PostgreSQL database `brello_dev` with schema `brello` created
3. Import the Postman collection from `docs/postman/Brello_HRMS_API.postman_collection.json`

---

## Flow Overview

```
 PHASE 1: DB Bootstrap & First User
 ┌──────────────────────────────────────────────────────┐
 │  (Seed 1 Enterprise & 1 Org into the DB manually)    │
 │  Step 1:  Create User (is_platform_admin: true)      │
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 1.5: Platform Admin Architecture Setup
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 2:  Login as Platform Admin     → tokens 🔑     │
 │  Step 3:  Create Enterprise (via API) → enterprise_id │
 │  Step 4:  Create Organization         → organization_id│
 │  Step 5:  Create App (e.g., "HRMS")   → app_id       │
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 2: Setup RBAC
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 6:  Create Role (e.g., "Admin") → role_id       │
 │  Step 7:  Assign Role to normal User  → user can login│
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 3: Authentication
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 7:  Login                       → tokens 🔑     │
 │  Step 8:  Get Menu (RBAC tree)                        │
 │  Step 9:  Refresh Token               → new tokens    │
 │  Step 10: Switch App (if multiple)                    │
 │  Step 11: Logout                                      │
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 4: Password Flows (optional)
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 12: Update Password                             │
 │  Step 13: Forgot Password (get OTP)                   │
 │  Step 14: Verify OTP & Reset Password                 │
 └──────────────────────────────────────────────────────┘
```

---

## Phase 1: DB Bootstrap & First User

> **⚠️ CRITICAL BOOTSTRAP:** Because creating an Enterprise or App requires a **Platform Admin** JWT, and creating a User requires an existing Enterprise, **you must seed the first Enterprise and Organization directly into the database** when starting from a completely empty environment.

Once you have a single `enterprise_id` and `organization_id` in your DB, use them below to create your very first Platform Admin user.

### Step 1 — Create Platform Admin User

> **Folder:** User → Create User

```
POST /api/v1/users
```

```json
{
  "name": "Acme Corporation",
  "domain": "acme.com"
}
```

✅ **Save the `id` from the response** — this is your `enterprise_id`.

> The Postman script auto-saves this to `{{enterprise_id}}`.

---

### Step 2 — Create Organization

> **Folder:** Organization → Create Organization

```
POST /api/v1/organizations
```

```json
{
  "name": "Acme India Branch",
  "enterprise_id": "{{enterprise_id}}"
}
```

✅ **Save the `id`** — this is your `organization_id`.

---

### Step 3 — Create User

> **Folder:** User → Create User

```
POST /api/v1/users
```

```json
{
  "first_name": "Admin",
  "last_name": "Root",
  "email": "admin@brello.com",
  "phone": "+10000000000",
  "password": "SecurePass@123",
  "enterprise_id": "{{enterprise_id}}",
  "organization_id": "{{organization_id}}",
  "is_platform_admin": true
}
```

✅ **Save the `id`** — this is your `user_id`.

> **Password rules:** Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char (`@$!%*?&`)

---

## Phase 1.5: Platform Admin Architecture Setup

> **⚠️ NOTE:** Now that you have a Platform Admin user, you must log in to get a JWT token before creating the actual App and assigning Roles.

### Step 2 — Login as Platform Admin (Request OTP)

> **Folder:** Auth → Platform Admin Login (Request OTP)

```
POST /api/v1/auth/platform-admin/login
```

```json
{
  "email": "admin@brello.com",
  "password": "SecurePass@123"
}
```

✅ Check the **server console** for the 6-digit OTP (in dev mode).

### Step 2.5 — Verify Login (Get Token)

> **Folder:** Auth → Platform Admin Verify Login (Returns Token)

```
POST /api/v1/auth/platform-admin/verify-login
```

```json
{
  "email": "admin@brello.com",
  "otp": "123456"
}
```

✅ **Save the `access_token`**

### Step 3 — Create App

> **Folder:** App → Create App

```
POST /api/v1/apps
Authorization: Bearer {{access_token}}
```

```json
{
  "name": "HRMS",
  "priority": 1,
  "enterprise_id": "{{enterprise_id}}",
  "organization_id": "{{organization_id}}"
}
```

✅ **Save the `id`** — this is your `app_id`.

> 💡 **Optional Module & Plan Configuration:** If you wish to test RBAC at the module/action level or test plan limits, you can now define `App Modules`, `Actions`, and `Plans` using their respective folders.

---

## Phase 2: User Roles & Access

> `priority` determines the default app on login (lower = higher priority). If a user has roles in multiple apps, the lowest priority number becomes the default.

---

### Step 4 — Create Role

> **Folder:** RBAC → Create Role

```
POST /api/v1/roles
```

```json
{
  "name": "Admin",
  "app_id": "{{app_id}}",
  "enterprise_id": "{{enterprise_id}}",
  "organization_id": "{{organization_id}}"
}
```

✅ **Save the `id`** — this is your `role_id`.

---

### Step 5 — Assign Role to User

> **Folder:** RBAC → Assign Role to User

```
POST /api/v1/user-role-maps
```

```json
{
  "user_id": "{{user_id}}",
  "role_id": "{{role_id}}",
  "organization_id": "{{organization_id}}"
}
```

✅ The user now has an active role in the HRMS app. **Login will work!**

---

## Phase 3: Authentication

### Step 6 — Login Normal User

> **Folder:** Auth → Login

```
POST /api/v1/auth/login
```

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass@123",
  "device_fingerprint": "postman-dev"
}
```

✅ **Response includes:**

- `access_token` — short-lived (15 min), used for authenticated requests
- `refresh_token` — long-lived (7 days), used to get new access tokens
- `defaultAppId` — the app the JWT is scoped to
- `availableApps` — all apps the user has roles in

> The Postman script auto-saves both tokens and IDs to collection variables.

---

### Step 7 — Get Menu (RBAC-resolved module tree)

> **Folder:** RBAC → Get Menu

```
GET /api/v1/menu
Authorization: Bearer {{access_token}}
```

Returns the hierarchical module tree the user can access in the current app.

> **Note:** With a fresh setup (no modules/actions seeded), this will return an empty array `[]`. That's expected — modules and actions need to be configured for the RBAC tree to have content.

---

### Step 8 — Refresh Token

> **Folder:** Auth → Refresh Token

```
POST /api/v1/auth/refresh
Authorization: Bearer {{refresh_token}}   ← NOTE: uses refresh_token, not access_token!
```

✅ Returns new `access_token` and `refresh_token`. The old refresh token is **invalidated** (token rotation).

---

### Step 9 — Switch App (optional)

> Only applicable if you created **multiple apps** (e.g., HRMS + CRM) and the user has roles in both.

```
POST /api/v1/auth/switch-app
Authorization: Bearer {{access_token}}
```

```json
{
  "appId": "<another_app_id>"
}
```

✅ Returns a new `access_token` scoped to the target app.

---

### Step 10 — Logout

> **Folder:** Auth → Logout

```
POST /api/v1/auth/logout
Authorization: Bearer {{access_token}}
```

✅ Session invalidated. Both tokens become unusable.

---

## Phase 4: Password Flows (Optional Testing)

### Step 11 — Update Password

Requires the user to be logged in.

```
POST /api/v1/auth/update-password
Authorization: Bearer {{access_token}}
```

```json
{
  "old_password": "SecurePass@123",
  "new_password": "NewSecurePass@456"
}
```

⚠️ **Side effect:** All active sessions are invalidated. You'll need to login again.

---

### Step 12 — Forgot Password (Request OTP)

No authentication needed.

```
POST /api/v1/auth/forgot-password
```

```json
{
  "email": "john.doe@example.com"
}
```

✅ Check the **server console** for the OTP (in dev mode, it's logged instead of emailed).

---

### Step 13 — Verify OTP & Reset Password

```
POST /api/v1/auth/verify-otp
```

```json
{
  "email": "john.doe@example.com",
  "otp": "123456",
  "new_password": "ResetPass@789"
}
```

⚠️ **Side effect:** All active sessions are invalidated.

---

## Multi-App Setup (Advanced)

To test the multi-app flow, repeat Phase 2 for a second app:

```
1. POST /api/v1/apps           → { "name": "CRM", "priority": 2, ... }
2. POST /api/v1/roles          → { "name": "Sales Manager", "app_id": "<crm_app_id>", ... }
3. POST /api/v1/user-role-maps → { "user_id": "...", "role_id": "<sales_role_id>", ... }
4. POST /api/v1/auth/login     → Response now shows 2 items in availableApps
5. POST /api/v1/auth/switch-app → { "appId": "<crm_app_id>" } → new JWT scoped to CRM
```

---

## Quick Reference Table

| Step | Method | Endpoint                            | Prerequisite                           |
| ---- | ------ | ----------------------------------- | -------------------------------------- |
| 1    | POST   | `/users`                            | enterprise_id, organization_id         |
| 2    | POST   | `/auth/platform-admin/login`        | Platform Admin User exists             |
| 2.5  | POST   | `/auth/platform-admin/verify-login` | OTP from step 2                        |
| 3    | POST   | `/apps`                             | access_token (Platform Admin)          |
| 4    | POST   | `/roles`                            | app_id, enterprise_id, organization_id |
| 5    | POST   | `/user-role-maps`                   | user_id, role_id, organization_id      |
| 6    | POST   | `/auth/login`                       | User + Role + App exist                |
| 7    | GET    | `/menu`                             | access_token                           |
| 8    | POST   | `/auth/refresh`                     | refresh_token                          |
| 9    | POST   | `/auth/switch-app`                  | access_token + multiple apps           |
| 10   | POST   | `/auth/logout`                      | access_token                           |
| 11   | POST   | `/auth/update-password`             | access_token                           |
| 12   | POST   | `/auth/forgot-password`             | —                                      |
| 13   | POST   | `/auth/verify-otp`                  | OTP from step 12                       |

---

## Troubleshooting

| Error                                   | Cause                   | Fix                                  |
| --------------------------------------- | ----------------------- | ------------------------------------ |
| `403: No active roles assigned`         | Login without Steps 3–5 | Create app, role, and assign to user |
| `401: Invalid email or password`        | Wrong credentials       | Check email/password                 |
| `401: Account is inactive`              | User status ≠ ACTIVE    | Check user status                    |
| `409: App with name "X" already exists` | Duplicate app name      | Use a unique name                    |
| `409: This role is already assigned`    | Duplicate user-role-map | Already assigned, skip               |
| `400: Validation failed`                | Missing/invalid fields  | Check DTO requirements               |

---

## Defensive Programming & Testing Guidelines

When using this Postman collection to verify backend behavior or build new features, adhere to the project's **Backend Engineering Specification**:

1. **Test for Failure, Not Just Success:** Do not only test happy paths. Intentionally send invalid data (nulls, missing fields, wrong types) to verify the DTOs fail fast at the boundary.
2. **Verify Error Structures:** Ensure all errors returned match the standard format exactly:
   ```json
   {
     "statusCode": 400,
     "timestamp": "...",
     "path": "...",
     "message": "...",
     "errorCode": "..."
   }
   ```
   _Note specifically the presence of `errorCode` (not `error`)._
3. **No Silent Failures:** If an endpoint returns 200/201 but fails to persist data or sends back a generic 500 without a clear structural error, report it. The system is designed to have no silent failures.
4. **Naming Intent:** When adding new endpoints or examples to the collection, avoid vague variable names like `data`, `obj`, or `temp` in request bodies. Use intent-based names (`isActive`, `userProfileData`).
