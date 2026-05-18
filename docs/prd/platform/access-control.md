# Tech PRD — Platform Access Control

## Module: PLATFORM → Access Control

---

## Overview

Manages the users, roles, and permissions for the **Platform app itself** —
i.e. the Enterprise's own staff (Brello employees, or a reseller-Enterprise's
operators). Distinct from per-organization access, which is owned by each
organization's admin.

Three sub-screens:
- **Platform Roles** — define role templates scoped to the current Enterprise
- **Platform Users** — invite / suspend / reset password for Enterprise staff
- **Permissions** — view the effective `(module × action)` matrix per role

---

## Tech Stack

- **Framework**: NestJS (TypeORM, PostgreSQL)
- **Auth**: JwtAuthGuard + `@LoggedInUser()` (`appId = PLATFORM`)
- **Pattern**: Repository → Service → Controller
- **Tenancy**: every query scoped to `enterprise_id = jwt.enterpriseId`. Two
  Enterprises never see each other's roles or users.

---

## Scope

### In Scope (V1)

**Platform Roles**
- List roles where `app_id = PLATFORM`, `enterprise_id = jwt.enterpriseId`
- Create / Rename / Delete (only non-default roles can be deleted)
- The seeded `PLATFORM_SUPER_ADMIN` is read-only (system role)
- Set `module_access` matrix for each role (full grid editor)

**Platform Users**
- List users with any Platform-app role for this Enterprise
- Invite a new platform user (sends email with set-password / OTP link)
- Assign / revoke roles per user
- Suspend / reactivate a user (independent of the org-level user concept)
- Force password reset

**Permissions**
- Read-only view: matrix of every Platform role × Platform module × action
- Effective permissions for the currently-logged-in user

### Out of Scope (V1)

- Custom action types beyond the seeded 11
- Role hierarchy / inheritance
- Time-bound access (e.g. "admin until Friday")
- IP-allowlist / 2FA enforcement per role
- Audit-log filtering UI (handled in Audit Logs module)

---

## User Roles

| Role                  | Access                                  |
|-----------------------|------------------------------------------|
| PLATFORM_SUPER_ADMIN  | Full                                     |
| Custom Platform role  | Subject to `module_access` on `PLAT_ACCESS_ROLES` / `PLAT_ACCESS_USERS` / `PLAT_ACCESS_PERMISSIONS` |

| Endpoint group         | RequirePermission                       |
|------------------------|------------------------------------------|
| Roles read             | `PLAT_ACCESS_ROLES.view`                 |
| Roles write            | `PLAT_ACCESS_ROLES.{create,update,delete}` |
| Users read             | `PLAT_ACCESS_USERS.view`                 |
| Users write / invite   | `PLAT_ACCESS_USERS.{create,update,delete}` |
| Permissions read       | `PLAT_ACCESS_PERMISSIONS.view`           |

---

## Data Sources

Existing tables — no new schema:

| Table                 | Used for                                          |
|-----------------------|---------------------------------------------------|
| `role`                | Platform role rows: `app_id = PLATFORM`, `enterprise_id = <ent>`, `organization_id IS NULL` |
| `module_access`       | Per-(role, module, action) grants                 |
| `users`               | Platform staff users                              |
| `user_role_map`       | Linking users to platform roles; `organization_id IS NULL` for platform-scoped maps |
| `modules`, `actions`  | Lookups for the matrix UI                         |

One model-level note: `user_role_map.organization_id` is currently `NOT NULL`
in the entity. For Platform user assignments we need it nullable — confirm
during implementation, may require a small migration / entity change.

---

## API Endpoints

Prefix: `/api/v1/platform/access`

### Roles

| Method | Path             | Description                          | Permission                       |
|--------|------------------|--------------------------------------|----------------------------------|
| GET    | /roles           | List Platform roles                  | `PLAT_ACCESS_ROLES.view`         |
| GET    | /roles/:id       | Role detail + module_access matrix   | `PLAT_ACCESS_ROLES.view`         |
| POST   | /roles           | Create role                          | `PLAT_ACCESS_ROLES.create`       |
| PUT    | /roles/:id       | Rename / describe role               | `PLAT_ACCESS_ROLES.update`       |
| PUT    | /roles/:id/permissions | Replace the role's matrix      | `PLAT_ACCESS_ROLES.update`       |
| DELETE | /roles/:id       | Delete (non-system, non-default)     | `PLAT_ACCESS_ROLES.delete`       |

### Users

| Method | Path                | Description                       | Permission                       |
|--------|---------------------|-----------------------------------|----------------------------------|
| GET    | /users              | List Platform users               | `PLAT_ACCESS_USERS.view`         |
| GET    | /users/:id          | User detail + assigned roles      | `PLAT_ACCESS_USERS.view`         |
| POST   | /users/invite       | Invite (creates user + sends mail)| `PLAT_ACCESS_USERS.create`       |
| PUT    | /users/:id/roles    | Replace user's Platform role set  | `PLAT_ACCESS_USERS.update`       |
| POST   | /users/:id/suspend  | Suspend                           | `PLAT_ACCESS_USERS.update`       |
| POST   | /users/:id/reactivate | Reactivate                      | `PLAT_ACCESS_USERS.update`       |
| POST   | /users/:id/force-reset | Force password reset           | `PLAT_ACCESS_USERS.update`       |
| DELETE | /users/:id          | Soft-delete (remove all Platform role maps) | `PLAT_ACCESS_USERS.delete` |

### Permissions

| Method | Path             | Description                        | Permission                          |
|--------|------------------|------------------------------------|-------------------------------------|
| GET    | /permissions     | Full role × module × action matrix | `PLAT_ACCESS_PERMISSIONS.view`      |
| GET    | /permissions/me  | Effective permissions for current user | `PLAT_ACCESS_PERMISSIONS.view` |

---

## Request / Response Contracts

### POST /api/v1/platform/access/roles

**Request**

```json
{
  "name": "Support Operator",
  "description": "Read-only access to Organizations + Audit Logs",
  "permissions": [
    { "module_id": "uuid", "action_ids": ["uuid-view"] }
  ]
}
```

**Response**

```json
{
  "success": true,
  "message": "Role created",
  "data": { "id": "uuid", "name": "Support Operator" }
}
```

### POST /api/v1/platform/access/users/invite

**Request**

```json
{
  "email": "support@brello.co.in",
  "first_name": "Sara",
  "last_name": "Khan",
  "role_ids": ["uuid"]
}
```

**Response**

```json
{
  "success": true,
  "message": "Invitation sent",
  "data": {
    "user_id": "uuid",
    "invitation_expires_at": "2026-05-20T12:00:00Z"
  }
}
```

### GET /api/v1/platform/access/permissions

**Response** — pivoted matrix for the UI:

```json
{
  "success": true,
  "data": {
    "roles": [
      { "id": "uuid", "name": "PLATFORM_SUPER_ADMIN", "is_system_role": true }
    ],
    "modules": [
      {
        "id": "uuid",
        "code": "PLAT_ORG_LIST",
        "name": "Organization List",
        "actions": [
          { "id": "uuid", "name": "View" },
          { "id": "uuid", "name": "Update" }
        ]
      }
    ],
    "matrix": [
      {
        "role_id": "uuid",
        "module_id": "uuid",
        "action_id": "uuid",
        "access_flag": true
      }
    ]
  }
}
```

---

## Module Structure

```
src/modules/platform-access/
├── controllers/
│   ├── platform-roles.controller.ts
│   ├── platform-users.controller.ts
│   └── platform-permissions.controller.ts
├── services/
│   ├── platform-roles.service.ts
│   ├── platform-users.service.ts
│   ├── platform-user-invite.service.ts     # email + onboarding token
│   └── platform-permissions.service.ts
├── repositories/
│   ├── platform-roles.repository.ts
│   └── platform-users.repository.ts
├── dto/
│   ├── create-role.dto.ts
│   ├── set-role-permissions.dto.ts
│   ├── invite-user.dto.ts
│   └── set-user-roles.dto.ts
└── platform-access.module.ts
```

---

## Service Logic

### `PlatformRolesService.create(user, dto)`

1. Validate role name unique within (`PLATFORM`, `enterprise_id = user.enterpriseId`).
2. Insert `role` row with `app_id = PLATFORM`, `enterprise_id = user.enterpriseId`, `organization_id = NULL`, `is_system_role = false`, `is_default = false`.
3. Insert `module_access` rows from `dto.permissions` payload.
4. Audit log.

### `PlatformRolesService.delete(id)`

- Reject if `is_system_role = true` or `is_default = true` (the seeded `PLATFORM_SUPER_ADMIN` is protected).
- Reject if any `user_role_map` row references it — must first reassign.
- Soft-delete (set `deleted_at`).

### `PlatformUserInviteService.invite(dto)`

1. Check `users.email` not already a Platform user in this Enterprise.
   - Allow if the email exists but only has org-level roles — same person can have both.
2. Insert / find `users` row (status = `INVITED`).
3. Insert `user_role_map` rows for each `role_id`, with `organization_id = NULL`.
4. Generate a one-time invitation token (24h expiry, stored in `otps` or dedicated `user_invitations` table).
5. Send email with set-password link.
6. Return invitation details.

### `PlatformPermissionsService.getMatrix(user)`

1. Read all Platform roles for `user.enterpriseId`.
2. Read all Platform modules + actions.
3. Read `module_access` joined to all those roles.
4. Return three flat arrays so the frontend can pivot.

### `PlatformPermissionsService.getEffective(user)`

- Reuses `PermissionResolverService.resolve(user)` (already exists for ADMIN/EMPLOYEE apps). Returns the same shape — just runs against `appId = PLATFORM`.

---

## Enums

```typescript
export enum PlatformUserStatus {
  INVITED   = 'INVITED',
  ACTIVE    = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED   = 'DELETED',
}
```

(reuses the existing `users.status` column; we just constrain to this subset for Platform users.)

---

## Open questions / future work

- **`user_role_map.organization_id` nullability** — confirm during build. If the
  column is `NOT NULL`, we have a few options: make nullable, or use a sentinel
  `'00000000-...'` UUID, or introduce a separate `platform_user_role_map` table.
  My recommendation: make nullable (one-line entity change + TypeORM sync).
- **Single sign-on** for platform users — likely needed before scaling the
  ops team. Out of scope V1.
- **Role hierarchy** — "PlatformAdmin > SupportOperator > ReadOnly". V1 keeps
  roles flat; revisit if the role list grows past ~10.
