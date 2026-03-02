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
 │  Step 8:  Login                       → tokens 🔑     │
 │  Step 9:  Get Menu (RBAC tree)                        │
 │  Step 10: Refresh Token               → new tokens    │
 │  Step 11: Switch App (if multiple)                    │
 │  Step 12: Logout                                      │
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 4: Password Flows (optional)
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 13: Update Password                             │
 │  Step 14: Forgot Password (get OTP)                   │
 │  Step 15: Verify OTP & Reset Password                 │
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 5: Module & Permission Configuration
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 16: Create App Modules (e.g., Leave Mgmt)      │
 │  Step 17: Create Actions (e.g., view, create)        │
 │  Step 18: Create Module Access (role → module grant)  │
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 6: Plan & Subscription Setup
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 19: Create Plan (e.g., "Starter")              │
 │  Step 20: Create Plan Module mapping                  │
 │  Step 21: Create Plan Module Action mapping           │
 │  Step 22: Create Organization Subscription            │
 └───────────────────────┬──────────────────────────────┘
                         │
 PHASE 7: Domain Resources
 ┌───────────────────────▼──────────────────────────────┐
 │  Step 23: Organization Profile (create / update)     │
 │  Step 24: Industry Types (master data)               │
 │  Step 25: Document Storage (upload / confirm / view) │
 │  Step 26: Employee Aggregate (full HRMS profile)     │
 │  Step 27: Notifications (in-app alerts)              │
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

### Step 3 — Create Enterprise

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

### Step 4 — Create Organization

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

### Step 5 — Create App

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

### Step 8 — Login Normal User

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

✅ **Response includes:**

- `access_token` — short-lived (15 min), used for authenticated requests
- `refresh_token` — long-lived (7 days), used to get new access tokens
- `defaultAppId` — the app the JWT is scoped to
- `availableApps` — all apps the user has roles in

> The Postman script auto-saves both tokens and IDs to collection variables.

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
Authorization: Bearer {{refresh_token}}   ← NOTE: uses refresh_token, not access_token!
```

✅ Returns new `access_token` and `refresh_token`. The old refresh token is **invalidated** (token rotation).

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

✅ Session invalidated. Both tokens become unusable.

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

## Phase 5: Module & Permission Configuration

> This phase defines **what actions exist** in the system and **which roles can access which modules**. It powers the RBAC menu tree (Step 9).

### Step 16 — Create App Modules

> **Folder:** App Module (Permissions) → Create App Module

Modules represent UI sections or feature areas (e.g., "Leave Management", "Attendance").

```
POST /api/v1/modules
```

```json
{
  "name": "Leave Management",
  "wbs_code": "1.0",
  "type": "module"
}
```

✅ Auto-saves `module_id`.

Create submodules by using a child WBS code (e.g., `1.1`, `1.2`).

**Other available operations:**

| Method   | Endpoint              | Description       |
| -------- | --------------------- | ----------------- |
| `GET`    | `/modules`            | List all modules  |
| `GET`    | `/modules/:id`        | Get by ID         |
| `PATCH`  | `/modules/:id`        | Update module     |
| `DELETE` | `/modules/:id`        | Delete module     |

---

### Step 17 — Create Actions

> **Folder:** App Module (Permissions) → Create Action

Actions are the verbs a user can perform (e.g., `view`, `create`, `update`, `delete`, `approve`, `export`).

```
POST /api/v1/actions
```

```json
{
  "name": "view"
}
```

✅ Auto-saves `action_id`. Repeat for each action type you need.

**Other available operations:**

| Method   | Endpoint          | Description      |
| -------- | ----------------- | ---------------- |
| `GET`    | `/actions`        | List all actions |
| `GET`    | `/actions/:id`    | Get by ID        |
| `PATCH`  | `/actions/:id`    | Update action    |
| `DELETE` | `/actions/:id`    | Delete action    |

---

### Step 18 — Create Module Access (Grant permission to a role)

> **Folder:** App Module (Permissions) → Create Module Access

This maps a **Role → Module → Action** triple, granting that specific permission.

```
POST /api/v1/module-access
```

```json
{
  "role_id": "{{role_id}}",
  "module_id": "{{module_id}}",
  "action_id": "{{action_id}}",
  "access_flag": true
}
```

✅ Auto-saves `module_access_id`. After configuring these, the **Get Menu** endpoint will return a populated tree.

**Other available operations:**

| Method   | Endpoint                       | Description                     |
| -------- | ------------------------------ | ------------------------------- |
| `GET`    | `/module-access`               | List all module access entries  |
| `GET`    | `/module-access/role/:roleId`  | Get all access grants for a role|
| `GET`    | `/module-access/:id`           | Get by ID                       |
| `PATCH`  | `/module-access/:id`           | Update access_flag              |
| `DELETE` | `/module-access/:id`           | Revoke access                   |

---

## Phase 6: Plan & Subscription Setup

> Plans define **tier-based limits** on which modules/actions are available. The effective permissions for a user are: `Role Grants AND Plan Allowances`.

### Step 19 — Create Plan

> **Folder:** Plan & Subscription → Create Plan

```
POST /api/v1/plans
```

```json
{
  "name": "Starter",
  "price": 500.00,
  "description": "Starter plan with basic modules",
  "feature": ["Leave", "Attendance"]
}
```

✅ Auto-saves `plan_id`.

**Other available operations:**

| Method   | Endpoint       | Description  |
| -------- | -------------- | ------------ |
| `GET`    | `/plans`       | List all     |
| `GET`    | `/plans/:id`   | Get by ID    |
| `PATCH`  | `/plans/:id`   | Update plan  |
| `DELETE` | `/plans/:id`   | Delete plan  |

---

### Step 20 — Create Plan Module Mapping

> **Folder:** Plan & Subscription → Create Plan Module

Maps which modules are enabled for a specific plan.

```
POST /api/v1/plan-modules
```

```json
{
  "plan_id": "{{plan_id}}",
  "module_id": "{{module_id}}",
  "enabled": true
}
```

✅ Auto-saves `plan_module_id`.

**Other available operations:**

| Method   | Endpoint                          | Description               |
| -------- | --------------------------------- | ------------------------- |
| `GET`    | `/plan-modules`                   | List all                  |
| `GET`    | `/plan-modules/plan/:planId`      | Get modules for a plan    |
| `GET`    | `/plan-modules/:id`               | Get by ID                 |
| `PATCH`  | `/plan-modules/:id`               | Update mapping            |
| `DELETE` | `/plan-modules/:id`               | Remove mapping            |

---

### Step 21 — Create Plan Module Action Mapping

> **Folder:** Plan & Subscription → Create Plan Module Action

Fine-grains exactly which actions are allowed inside an enabled module for the plan.

```
POST /api/v1/plan-module-actions
```

```json
{
  "plan_id": "{{plan_id}}",
  "module_id": "{{module_id}}",
  "action_id": "{{action_id}}",
  "enabled": true
}
```

✅ Auto-saves `plan_module_action_id`.

**Other available operations:**

| Method   | Endpoint                                              | Description                            |
| -------- | ----------------------------------------------------- | -------------------------------------- |
| `GET`    | `/plan-module-actions`                                | List all                               |
| `GET`    | `/plan-module-actions/plan/:planId/module/:moduleId`  | Get actions for a plan+module combo    |
| `GET`    | `/plan-module-actions/:id`                            | Get by ID                              |
| `PATCH`  | `/plan-module-actions/:id`                            | Update                                 |
| `DELETE` | `/plan-module-actions/:id`                            | Delete                                 |

---

### Step 22 — Create Organization Subscription

> **Folder:** Plan & Subscription → Create Organization Subscription

Links a plan to an organization, activating the tier limits.

```
POST /api/v1/organization-subscriptions
```

```json
{
  "organization_id": "{{organization_id}}",
  "plan_id": "{{plan_id}}",
  "start_date": "2026-01-01T00:00:00.000Z",
  "status": "Active"
}
```

✅ Auto-saves `subscription_id`.

> **Note:** An organization cannot have more than one Active subscription simultaneously.

**Other available operations:**

| Method   | Endpoint                            | Description        |
| -------- | ----------------------------------- | ------------------ |
| `GET`    | `/organization-subscriptions`       | List all           |
| `GET`    | `/organization-subscriptions/:id`   | Get by ID          |
| `PATCH`  | `/organization-subscriptions/:id`   | Update (e.g., expire) |
| `DELETE` | `/organization-subscriptions/:id`   | Delete             |

---

## Phase 7: Domain Resources

> These modules can be set up in any order once the core architecture (Phases 1–6) is in place.

### Step 23 — Organization Profile

> **Folder:** Organization → Create Organization Profile / Get / Update

Stores legal and contact details for an organization.

```
POST /api/v1/organizations/profile
```

```json
{
  "name": "Acme India Legal",
  "email": "legal@acme.in",
  "phone": "+919876543210",
  "gst_no": "27AAAAA0000A1Z5",
  "registration_no": "CIN-1234",
  "organization_id": "{{organization_id}}",
  "enterprise_id": "{{enterprise_id}}"
}
```

**Other available operations:**

| Method   | Endpoint                              | Description         |
| -------- | ------------------------------------- | ------------------- |
| `GET`    | `/organizations/profile/:id`         | Get profile         |
| `PATCH`  | `/organizations/profile/:id`         | Update profile      |

---

### Step 24 — Industry Types

> **Folder:** Industry Type

Master lookup table for industry categorizations (IT, Manufacturing, Retail, etc.).

```
POST /api/v1/industry-types
```

```json
{
  "name": "Software & IT"
}
```

✅ Auto-saves `industry_type_id`.

**Other available operations:**

| Method   | Endpoint                 | Description     |
| -------- | ------------------------ | --------------- |
| `GET`    | `/industry-types`        | List all        |
| `GET`    | `/industry-types/:id`    | Get by ID       |
| `PATCH`  | `/industry-types/:id`    | Update          |
| `DELETE` | `/industry-types/:id`    | Soft delete     |

---

### Step 25 — Document Storage (S3 Upload Flow)

> **Folder:** Document Storage

Three-step flow for secure file uploads via S3 pre-signed URLs:

**A. Generate Upload URL**

```
POST /api/v1/documents/upload-url
Authorization: Bearer {{access_token}}
```

```json
{
  "originalName": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 1048576,
  "folderType": "EMPLOYEE_IMAGE",
  "enterpriseId": "{{enterprise_id}}"
}
```

✅ Auto-saves `document_id`. Returns `uploadUrl` — use this to PUT the file directly to S3.

**B. Upload File to S3** (outside Postman — use the `uploadUrl` from step A)

**C. Confirm Upload**

```
POST /api/v1/documents/{{document_id}}/confirm
Authorization: Bearer {{access_token}}
```

✅ Activates the document record. It's now usable across modules.

**Other available operations:**

| Method   | Endpoint                          | Description                            |
| -------- | --------------------------------- | -------------------------------------- |
| `GET`    | `/documents/:id`                  | Get document metadata                  |
| `GET`    | `/documents/:id/signed-url`      | Get short-lived download URL           |
| `DELETE` | `/documents/:id`                  | Delete document record                 |

**Folder types:** `ENTERPRISE_LOGO`, `ORGANIZATION_LOGO`, `EMPLOYEE_IMAGE`, `EMPLOYEE_DOCUMENT`, `ORGANIZATION_DOCUMENT`

---

### Step 26 — Employee Aggregate

> **Folder:** User & Employee

The Employee module wraps User identity + rich HR profile data. Creating an employee also creates the underlying User record atomically.

**A. Create Employee**

```
POST /api/v1/employees
```

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com",
  "phone": "+919876543222",
  "password": "SecurePass@123",
  "enterprise_id": "{{enterprise_id}}",
  "organization_id": "{{organization_id}}",
  "profile": {
    "employeeId": "EMP001",
    "type": "EMPLOYEE",
    "joiningDate": "2026-01-01",
    "employmentType": "FULL_TIME"
  }
}
```

**B. Get Employee Aggregate**

```
GET /api/v1/employees/{{user_id}}
```

Returns the full tree: identity + profile + education + experience + assets + documents + bankInfo + govInfo + emergencyContact.

**C. Child Collection Endpoints**

| Method   | Endpoint                                  | Description                  |
| -------- | ----------------------------------------- | ---------------------------- |
| `GET`    | `/employees`                              | List all employees           |
| `PATCH`  | `/employees/:id`                          | Update basic info            |
| `PATCH`  | `/employees/:id/profile`                  | Update HR profile            |
| `POST`   | `/employees/:id/education`                | Add education entry          |
| `DELETE` | `/employees/:id/education/:educationId`   | Remove education entry       |
| `POST`   | `/employees/:id/experience`               | Add experience entry         |
| `DELETE` | `/employees/:id/experience/:experienceId` | Remove experience entry      |
| `POST`   | `/employees/:id/assets`                   | Assign asset                 |
| `DELETE` | `/employees/:id/assets/:assetId`          | Return asset                 |
| `PUT`    | `/employees/:id/gov-info`                 | Upsert PAN/Aadhaar/Passport  |
| `PUT`    | `/employees/:id/bank-info`                | Upsert bank details          |
| `POST`   | `/employees/:id/documents`                | Link a document              |
| `DELETE` | `/employees/:id/documents/:docId`         | Unlink a document            |
| `PUT`    | `/employees/:id/emergency-contact`        | Upsert emergency contact     |
| `POST`   | `/employees/:id/exit`                     | Initiate resignation/exit    |
| `DELETE` | `/employees/:id`                          | Soft delete employee         |

---

### Step 27 — Notifications

> **Folder:** Notifications

In-app notifications for authenticated users. All endpoints require `Bearer {{access_token}}`.

| Method   | Endpoint                        | Description                      |
| -------- | ------------------------------- | -------------------------------- |
| `GET`    | `/notifications`                | Get all notifications            |
| `GET`    | `/notifications/unread`         | Get unread only                  |
| `PATCH`  | `/notifications/:id/read`      | Mark a single notification read  |
| `PATCH`  | `/notifications/read-all`      | Mark all notifications read      |

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
| 1    | POST   | `/users`                            | enterprise_id, organization_id (seeded)|
| 2    | POST   | `/auth/platform-admin/login`        | Platform Admin User exists             |
| 2.5  | POST   | `/auth/platform-admin/verify-login` | OTP from step 2                        |
| 3    | POST   | `/enterprises`                      | access_token (Platform Admin)          |
| 4    | POST   | `/organizations`                    | enterprise_id                          |
| 5    | POST   | `/apps`                             | access_token, enterprise_id, org_id    |
| 6    | POST   | `/roles`                            | app_id, enterprise_id, organization_id |
| 7    | POST   | `/user-role-maps`                   | user_id, role_id, organization_id      |
| 8    | POST   | `/auth/login`                       | User + Role + App exist                |
| 9    | GET    | `/menu`                             | access_token                           |
| 10   | POST   | `/auth/refresh`                     | refresh_token                          |
| 11   | POST   | `/auth/switch-app`                  | access_token + multiple apps           |
| 12   | POST   | `/auth/logout`                      | access_token                           |
| 13   | POST   | `/auth/update-password`             | access_token                           |
| 14   | POST   | `/auth/forgot-password`             | —                                      |
| 15   | POST   | `/auth/verify-otp`                  | OTP from step 14                       |
| 16   | POST   | `/modules`                          | —                                      |
| 17   | POST   | `/actions`                          | —                                      |
| 18   | POST   | `/module-access`                    | role_id, module_id, action_id          |
| 19   | POST   | `/plans`                            | —                                      |
| 20   | POST   | `/plan-modules`                     | plan_id, module_id                     |
| 21   | POST   | `/plan-module-actions`              | plan_id, module_id, action_id          |
| 22   | POST   | `/organization-subscriptions`       | organization_id, plan_id               |
| 23   | POST   | `/organizations/profile`            | organization_id, enterprise_id         |
| 24   | POST   | `/industry-types`                   | —                                      |
| 25   | POST   | `/documents/upload-url`             | access_token, enterprise_id            |
| 26   | POST   | `/employees`                        | enterprise_id, organization_id         |
| 27   | GET    | `/notifications`                    | access_token                           |

---

## Collection Variables

All auto-saved variables used across the collection:

| Variable                | Set By                         | Description                    |
| ----------------------- | ------------------------------ | ------------------------------ |
| `base_url`              | Pre-configured                 | `http://localhost:8000/api/v1` |
| `access_token`          | Login / Refresh / Switch App   | JWT access token               |
| `refresh_token`         | Login / Refresh                | JWT refresh token              |
| `enterprise_id`         | Login / Create Enterprise      | Current enterprise UUID        |
| `organization_id`       | Login / Create Organization    | Current organization UUID      |
| `user_id`               | Login / Create User            | Current user UUID              |
| `default_app_id`        | Login / Switch App             | Active application UUID        |
| `app_id`                | Create App                     | Last created app UUID          |
| `role_id`               | Create Role                    | Last created role UUID         |
| `user_role_map_id`      | Assign Role to User            | Last assignment UUID           |
| `document_id`           | Generate Upload URL            | Last created document UUID     |
| `industry_type_id`      | Create Industry Type           | Last created industry type     |
| `module_id`             | Create App Module              | Last created module UUID       |
| `action_id`             | Create Action                  | Last created action UUID       |
| `module_access_id`      | Create Module Access           | Last created access grant      |
| `plan_id`               | Create Plan                    | Last created plan UUID         |
| `subscription_id`       | Create Org Subscription        | Last subscription UUID         |
| `plan_module_id`        | Create Plan Module             | Last plan-module mapping UUID  |
| `plan_module_action_id` | Create Plan Module Action      | Last plan-module-action UUID   |

---

## Troubleshooting

| Error                                   | Cause                   | Fix                                  |
| --------------------------------------- | ----------------------- | ------------------------------------ |
| `403: No active roles assigned`         | Login without Steps 6–7 | Create app, role, and assign to user |
| `401: Invalid email or password`        | Wrong credentials       | Check email/password                 |
| `401: Account is inactive`              | User status ≠ ACTIVE    | Check user status                    |
| `409: App with name "X" already exists` | Duplicate app name      | Use a unique name                    |
| `409: This role is already assigned`    | Duplicate user-role-map | Already assigned, skip               |
| `400: Validation failed`               | Missing/invalid fields  | Check DTO requirements               |
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
