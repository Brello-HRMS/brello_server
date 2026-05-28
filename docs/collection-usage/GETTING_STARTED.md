# Postman Collection — Step-by-Step Usage Guide

> This guide walks you through the entire API flow **starting from an empty database**.
> Follow the steps in exact order — each step depends on data created in previous steps.

---

## Prerequisites

1. Server running at `http://localhost:8000` (`nvm use 24 && npm run start:dev`)
2. PostgreSQL database `brello_dev` with schema `brello` created
3. Import the Postman collection from `docs/postman/Brello_HRMS_API.postman_collection.json`

---

## Environment Setup

> **Always use a Postman Environment** rather than editing collection variables directly. This lets you switch between `local`, `staging`, and `production` without touching the collection.

### Step-by-step: Create the "Brello Local" Environment

1. In Postman, click **Environments** (left sidebar) → **Create Environment**.
2. Name it **`Brello Local`**.
3. Add the following variables (Initial Value = Default Value for local dev):

| Variable           | Initial Value                  | Description                                  |
| ------------------ | ------------------------------ | -------------------------------------------- |
| `base_url`         | `http://localhost:8000/api/v1` | API base URL                                 |
| `access_token`     | _(empty)_                      | Auto-populated by Login / Verify OTP scripts |
| `user_id`          | _(empty)_                      | Auto-populated on login                      |
| `enterprise_id`    | _(empty)_                      | Auto-populated on login                      |
| `organization_id`  | _(empty)_                      | Auto-populated on login                      |
| `default_app_id`   | _(empty)_                      | Auto-populated on login                      |
| `app_id`           | _(empty)_                      | Set after creating an App                    |
| `role_id`          | _(empty)_                      | Set after creating a Role                    |
| `plan_id`          | _(empty)_                      | Set after creating a Plan                    |
| `industry_type_id` | _(empty)_                      | Set after creating an Industry Type          |
| `department_id`    | _(empty)_                      | Set after creating a Department              |
| `document_id`      | _(empty)_                      | Set after uploading a document               |

4. Click **Save**, then select **`Brello Local`** from the environment dropdown (top-right in Postman).
5. **Import the collection** via **File → Import** or drag-and-drop the JSON file.

> 💡 The collection's test scripts write to **collection variables** (`pm.collectionVariables.set`). These are always visible to all requests regardless of which environment is active, and are ideal for temporary session data like `access_token`.

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
 │  Step 3:  Create Industry Type        → industry_type_id│
 │  Step 4:  Create Plan                 → plan_id      │
 │  Step 5:  Create Enterprise (via API) → enterprise_id │
 │  Step 6:  Create Organization         → organization_id│
 │  Step 6b: Create Organization Profile → profile data  │
 │  Step 7:  Create App (e.g., "HRMS")   → app_id       │
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
 │  Option A — Password Login:                           │
 │    Step 8a: Login (email + password)  → tokens 🔑     │
 │                                                       │
 │  Option B — OTP Login (passwordless): │
 │    Step 8b: Login - Send OTP  (204)                   │
 │    Step 8c: Login - Verify OTP        → tokens 🔑     │
 │                                                       │
 │  Step 9:  Get Menu (RBAC tree)                        │
 │  Step 10: Refresh Token               → new tokens    │
 │  Step 11: Switch App (if multiple)                    │
 │  Step 12: Logout                                      │
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 4: Password Flows (optional)
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 12: Update Password                             │
 │  Step 13: Forgot Password (get OTP)                   │
 │  Step 14: Verify OTP & Reset Password                 │
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 6: Client & Project Management
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 18: Create Client              → client_id     │
 │  Step 19: Create Project             → project_id    │
 │  Step 20: Assign Team (with roles)                   │
 │  Step 21: Upload Contract (S3)                       │
 │  Step 22: Get Team (with user profiles)              │
 │  Step 23: Get Contracts                              │
 │  Step 24: Remove Team Member                         │
 └──────────────────────────────────────────────────────┘
```

---

## Phase 0: Lead Registration (Public)

> This is the public-facing registration flow. No authentication required.

### Step 0.1 — Register Lead

> **Folder:** Lead → Register Lead

```
POST /api/v1/leads/register
```

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

✅ Check the **server console** for the 6-digit OTP (in dev mode).

### Step 0.2 — Verify Lead OTP

> **Folder:** Lead → Verify Lead OTP

```
POST /api/v1/leads/verify-otp
```

```json
{
  "email": "samir@company.com",
  "otp": "123456"
}
```

✅ On success, the lead is marked as **verified** and a **User** record is automatically created from the lead details (first_name, last_name, email, phone, password_hash). Both operations are transactional — if anything fails, everything is rolled back.

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

There are two ways to log in as a Platform Admin. Both produce the same token.

**Option A — Unified Login (same UI as regular users):**

> **Folder:** Auth → Login - Send OTP

```
POST /api/v1/auth/login/send-otp
```

```json
{
  "email": "admin@brello.com"
}
```

The server automatically detects the user is a platform admin and issues a `PLATFORM_ADMIN_LOGIN` OTP. ✅ Check the **server console** for the OTP (dev mode).

**Option B — Dedicated Endpoint (Postman/API only, requires password):**

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

**If you used Option A (unified flow):**

> **Folder:** Auth → Login - Verify OTP

```
POST /api/v1/auth/login/verify-otp
```

```json
{
  "email": "admin@brello.com",
  "otp": "123456",
  "device_fingerprint": "postman-dev"
}
```

The response will include `"is_platform_admin": true` in the user object. The frontend automatically routes to `/platform/dashboard`.

**If you used Option B (dedicated endpoint):**

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

✅ **Save the `access_token`** — it contains `isPlatformAdmin: true` in the JWT payload.

### Step 3 — Create Industry Type

> **Folder:** Industry Type → Create Industry Type

```
POST /api/v1/industry-types
Authorization: Bearer {{access_token}}
```

```json
{
  "name": "Technology"
}
```

✅ **Save the `id`** — this is your `industry_type_id`.

### Step 4 — Create Plan

> **Folder:** Platform Admin Post-Creation Setup → Create Plan

```
POST /api/v1/plans
Authorization: Bearer {{access_token}}
```

```json
{
  "name": "Enterprise Pro",
  "price": 499.00,
  "price_per_employee_annual": 4990.00,
  "annual_discount_percent": 20,
  "tier_rank": 2,
  "billing_cycle_default": "Monthly",
  "description": "Premium tier plan with all features.",
  "discount": 0,
  "feature": ["HRMS", "CRM", "Payroll", "Attendance", "Leave", "Reimbursement"],
  "status": "ACTIVE"
}
```

> **Field guide:**
> - `tier_rank` — `0` = Free, `1` = Standard, `2` = Premium (controls upgrade/downgrade logic)
> - `billing_cycle_default` — `"Monthly"` or `"Annual"` (shown as default on pricing page)
> - `annual_discount_percent` — discount applied when customer selects annual billing
> - `status` — `"ACTIVE"` makes it visible on the public website immediately

✅ **Save the `id`** — this is your `plan_id`. The test script saves it to `{{plan_id}}` automatically.

> 💡 Plans created here are immediately visible on `GET /plans` (public endpoint). Set `"status": "INACTIVE"` to hide a plan from the website while still keeping it in the system.

### Step 5 — Create Enterprise

> **Folder:** Enterprise → Create Enterprise

```
POST /api/v1/enterprises
Authorization: Bearer {{access_token}}
```

```json
{
  "name": "Acme Corporation",
  "domain": "acme.com"
}
```

✅ **Save the `id`** — this is your `enterprise_id`.

> The Postman script auto-saves this to `{{enterprise_id}}`.

### Step 6 — Create Organization

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

### Step 6b — Create Organization Profile

> **Folder:** Organization → Create Organization Profile

```
POST /api/v1/organizations/profile
Authorization: Bearer {{access_token}}
```

```json
{
  "name": "Acme India Profile",
  "email": "contact@acme.com",
  "phone": "+919876543210",
  "registration_no": "REG12345",
  "industry_type_id": "{{industry_type_id}}",
  "organization_id": "{{organization_id}}",
  "enterprise_id": "{{enterprise_id}}"
}
```

### Step 7 — Create App

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

> 💡 `priority` determines the default app on login (lower = higher priority).

---

## Phase 2: User Roles & Access

### Step 6 — Create Role

> **Folder:** RBAC → Create Role

```
POST /api/v1/roles
```

```json
{
  "name": "Admin",
  "context": "Admin",
  "app_id": "{{app_id}}",
  "enterprise_id": "{{enterprise_id}}",
  "organization_id": "{{organization_id}}"
}
```

✅ **Save the `id`** — this is your `role_id`.

---

### Step 7 — Assign Role to User

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

> There are **two login methods**. Use whichever matches your user setup. Both auto-populate the same collection variables on success.

---

### Step 8a — Login (Password-based)

> **Folder:** Auth → Login

```
POST /api/v1/auth/login
```

```json
{
  "email": "admin@brello.com",
  "password": "SecurePass@123",
  "device_fingerprint": "postman-dev"
}
```

✅ **Auto-saves on success:** `access_token`, `user_id`, `enterprise_id`, `organization_id`, `default_app_id`

**Refresh token** is delivered as an **HttpOnly cookie** — stored automatically by Postman's cookie jar.

---

### Step 8b — Login (OTP-based) — Part 1: Send OTP

> **Folder:** Auth → Login - Send OTP

```
POST /api/v1/auth/login/send-otp
```

```json
{
  "email": "john.doe@example.com"
}
```

✅ Returns **204 No Content**. The OTP is sent to the email (in dev mode, check the server console).

**What the script does automatically:**

- The **pre-request script** reads the `email` from the body and stores it as `otp_login_email` in collection variables.
- This staging variable is automatically consumed by the next request.

---

### Step 8c — Login (OTP-based) — Part 2: Verify OTP

> **Folder:** Auth → Login - Verify OTP

```
POST /api/v1/auth/login/verify-otp
```

```json
{
  "email": "john.doe@example.com",
  "otp": "123456",
  "device_fingerprint": "postman-dev"
}
```

> **Tip:** The `email` field is **auto-filled** by the pre-request script from `otp_login_email`. You only need to paste the 6-digit OTP.

✅ **Auto-saves on success:** `access_token`, `user_id`, `enterprise_id`, `organization_id`, `default_app_id`

The `otp_login_email` staging variable is cleaned up (unset) automatically after a successful verification.

**Refresh token** is delivered as an HttpOnly cookie — stored automatically by Postman's cookie jar.

| Field        | Rule                                 |
| ------------ | ------------------------------------ |
| `otp`        | Exactly 6 digits                     |
| Max attempts | 5 attempts before OTP is invalidated |
| Expiry       | 10 minutes                           |

---

### Step 8d — Resend OTP (if needed)

> **Folder:** Auth → Resend OTP

```
POST /api/v1/auth/resend-otp
```

```json
{
  "email": "john.doe@example.com",
  "purpose": "LOGIN"
}
```

✅ A fresh OTP is generated and sent even if the previous OTP expired or was never issued. Use `"purpose": "LOGIN"` for both regular users and platform admins on the unified flow.

---

### Step 9 — Get Menu (RBAC-resolved module tree)

> **Folder:** RBAC → Get Menu

```
GET /api/v1/menu
Authorization: Bearer {{access_token}}
```

Returns the hierarchical module tree the user can access in the current app.

> **Note:** With a fresh setup (no modules/actions seeded), this will return an empty array `[]`. That's expected — modules and actions need to be configured in Phase 5.

---

### Step 10 — Refresh Token

> **Folder:** Auth → Refresh Token

```
POST /api/v1/auth/refresh
(No Authorization header needed — the HttpOnly cookie `refresh_token` is sent automatically by the browser/Postman)
```

✅ Returns a new `access_token` in the JSON body. A new `refresh_token` is set as an HttpOnly cookie (token rotation — the old cookie is replaced).

> **Postman note:** Postman automatically manages cookies. After login, the `refresh_token` cookie is stored in Postman's cookie jar for the domain. The refresh endpoint reads it from the cookie, not from a header.

---

### Step 11 — Switch App (optional)

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

### Step 12 — Logout

> **Folder:** Auth → Logout

```
POST /api/v1/auth/logout
Authorization: Bearer {{access_token}}
```

✅ Session invalidated. Access token becomes unusable. The `refresh_token` HttpOnly cookie is cleared.

---

## Phase 4: Password Flows (Optional Testing)

### Step 13 — Update Password

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

### Step 14 — Forgot Password (Request OTP)

No authentication needed.

```
POST /api/v1/auth/forgot-password
```

```json
{
  "email": "admin@brello.com"
}
```

✅ Check the **server console** for the OTP (in dev mode, it's logged instead of emailed).

---

### Step 15 — Verify OTP & Reset Password

```
POST /api/v1/auth/verify-otp
```

```json
{
  "email": "admin@brello.com",
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

---

## Phase 6: Client & Project Management

### Step 18 — Create Client

> **Folder:** Client → Create Client

```
POST /api/v1/clients
Authorization: Bearer {{access_token}}
```

```json
{
  "name": "Brello Tech Solutions",
  "poc_name": "Samir Mohd",
  "poc_email": "samir@brello.io",
  "poc_phone": "+919999999999",
  "address": "Tech Hub, Bengaluru",
  "status": "ACTIVE"
}
```

✅ **Save the `id`** — this is your `client_id`.

### Step 19 — Create Project

> **Folder:** Project → Create Project

```
POST /api/v1/clients/{{client_id}}/projects
Authorization: Bearer {{access_token}}
```

```json
{
  "name": "Brello v2 Backend",
  "description": "Enterprise stability and documentation",
  "project_type": "AGILE",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "start_date": "2024-03-01",
  "end_date": "2024-12-31"
}
```

✅ **Save the `id`** — this is your `project_id`.

### Step 20 — Assign Team

> **Folder:** Project → Assign Team

```
POST /api/v1/projects/{{project_id}}/team
Authorization: Bearer {{access_token}}
```

```json
{
  "members": [
    {
      "user_id": "{{user_id}}",
      "role": "Lead Architect"
    }
  ]
}
```

### Step 21 — Upload Contract

...
✅ On success, the binary is uploaded to S3, a Document record is created, and the metadata is linked to the Project Contract table.

### Step 22 — Get Project Team

> **Folder:** Project → Get Project Team

```
GET /api/v1/projects/{{project_id}}/team
Authorization: Bearer {{access_token}}
```

✅ Returns the detailed list of team members, including their roles and full user profiles (name, email).

### Step 23 — Get Project Contracts

> **Folder:** Project → Get Project Contracts

```
GET /api/v1/projects/{{project_id}}/contracts
Authorization: Bearer {{access_token}}
```

✅ Returns the list of all contract documents uploaded for the project.

### Step 24 — Remove Team Member

> **Folder:** Project → Remove Team Member

```
DELETE /api/v1/projects/{{project_id}}/team/{{user_id}}
Authorization: Bearer {{access_token}}
```

✅ Removes the specified user from the project team.

---

## Quick Reference Table

| Step | Method | Endpoint                            | Prerequisite                            |
| ---- | ------ | ----------------------------------- | --------------------------------------- |
| 1    | POST   | `/users`                            | enterprise_id, organization_id (seeded) |
| 2    | POST   | `/auth/login/send-otp` *(unified)* OR `/auth/platform-admin/login` *(dedicated)* | Platform Admin User exists |
| 2.5  | POST   | `/auth/login/verify-otp` *(unified)* OR `/auth/platform-admin/verify-login` *(dedicated)* | OTP from step 2 |
| 3    | POST   | `/industry-types`                   | access_token (Platform Admin)           |
| 4    | POST   | `/plans`                            | access_token (Platform Admin)           |
| 5    | POST   | `/enterprises`                      | access_token (Platform Admin)           |
| 6    | POST   | `/organizations`                    | enterprise_id                           |
| 6b   | POST   | `/organizations/profile`            | organization_id, industry_type_id       |
| 7    | POST   | `/apps`                             | access_token (Platform Admin)           |
| 8    | POST   | `/roles`                            | app_id, enterprise_id, organization_id  |
| 9    | POST   | `/user-role-maps`                   | user_id, role_id, organization_id       |
| 8d   | POST   | `/auth/resend-otp`                  | Email exists (no prior OTP required)    |
| 10   | POST   | `/auth/login`                       | User + Role + App exist                 |
| 11   | GET    | `/menu`                             | access_token                            |
| 12   | POST   | `/auth/refresh`                     | HttpOnly cookie (auto)                  |
| 13   | POST   | `/auth/switch-app`                  | access_token + multiple apps            |
| 14   | POST   | `/auth/logout`                      | access_token                            |
| 15   | POST   | `/auth/update-password`             | access_token                            |
| 16   | POST   | `/auth/forgot-password`             | —                                       |
| 17   | POST   | `/auth/verify-otp`                  | OTP from step 16                        |
| 18   | POST   | `/clients`                          | access_token                            |
| 19   | POST   | `/clients/:id/projects`             | client_id                               |
| 20   | POST   | `/projects/:id/team`                | project_id                              |
| 21   | POST   | `/projects/:id/contract`            | project_id                              |
| 22   | GET    | `/projects/:id/team`                | project_id                              |
| 23   | GET    | `/projects/:id/contracts`           | project_id                              |
| 24   | DELETE | `/projects/:id/team/:userId`        | project_id, user_id                     |

---

## Troubleshooting

| Error                                   | Cause                   | Fix                                  |
| --------------------------------------- | ----------------------- | ------------------------------------ |
| `403: No active roles assigned`         | Login without Steps 6–7 | Create app, role, and assign to user |
| `401: Invalid email or password`        | Wrong credentials       | Check email/password                 |
| `401: Account is inactive`              | User status ≠ ACTIVE    | Check user status                    |
| `409: App with name "X" already exists` | Duplicate app name      | Use a unique name                    |
| `409: This role is already assigned`    | Duplicate user-role-map | Already assigned, skip               |
| `400: Validation failed`                | Missing/invalid fields  | Check DTO requirements               |
| Empty `[]` from `/menu`                 | No modules configured   | Complete Phase 5 first               |
| `404` on document endpoints             | Document not confirmed  | Run Confirm Upload after S3 PUT      |

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
