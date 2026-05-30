# Organisation Creation — Platform Setup Prerequisites

Before a new organisation can be created via the onboarding flow (`POST /organizations/setup-company`), the platform admin must complete the following steps in order. Skipping or doing them out of sequence causes the org to be created with missing permissions, empty menus, or broken sidebar navigation.

---

## Why order matters

`setupCompany` runs a single DB transaction that:
1. Clones platform default roles → org-specific roles
2. Clones `module_access` rows from those platform roles → new org roles
3. Creates the `organization_subscription` (Trial, linked to the user's plan)
4. Seeds departments, designations, and payroll components

If platform roles have no `module_access` rows at clone time, the org role will have zero permissions and the sidebar will be empty. There is no retroactive sync — any entries added to the platform role after the org is created must be manually synced to existing orgs.

---

## Step-by-Step Checklist

### Step 1 — Create Actions

**Where:** `Platform > Setup > Actions`

Create the base CRUD action set. Every module permission references one of these.

| Name   | Notes                    |
|--------|--------------------------|
| View   | Read-only access          |
| Create | Create new records        |
| Update | Edit existing records     |
| Delete | Remove records            |

> All four actions must exist before creating modules or assigning permissions.

---

### Step 2 — Create Apps

**Where:** `Platform > App & Modules > Apps`

Apps represent the top-level product contexts a user can switch between.

| Name     | Code     | Priority | Notes                            |
|----------|----------|----------|----------------------------------|
| ADMIN    | ADMIN    | 1        | HR/admin-facing features         |
| EMPLOYEE | EMPLOYEE | 2        | Employee self-service features   |

> `priority` controls which app is the default when a user first logs in.

---

### Step 3 — Create Modules

**Where:** `Platform > App & Modules > Modules`

Modules define the navigable sections within each app. Each module needs:
- **Name** — display label
- **Code** — unique stable identifier used in `@RequirePermission()` decorators
- **WBS Code** — hierarchical order string (e.g. `1`, `2`, `2.1`, `2.2`)
- **App** — which app this module belongs to
- **Parent** — parent module (for sub-items in the sidebar)
- **Path** — frontend route (e.g. `/dashboard`)
- **Icon** — lucide icon name (must be registered in `iconMapper.ts`)

Example ADMIN app module structure:

| WBS  | Name             | Code              | Path                      | Icon            | Parent           |
|------|------------------|-------------------|---------------------------|-----------------|------------------|
| 1    | Dashboard        | DASH              | /dashboard                | LayoutDashboard | —                |
| 2    | Organisation     | ORG               | —                         | Building2       | —                |
| 2.1  | Departments      | ORG_DEPARTMENTS   | /organisation/departments | Users           | Organisation     |
| 2.2  | Designations     | ORG_DESIGNATIONS  | /organisation/designations| Tags            | Organisation     |
| 2.3  | Policies         | ORG_POLICIES      | /organisation/policies    | ScrollText      | Organisation     |
| 2.4  | Leave Config     | LEAVE_SETUP       | /organisation/leave-config| CalendarOff     | Organisation     |
| 2.5  | Payroll Config   | ORG_PAYROLL       | /organisation/payroll     | HandCoins       | Organisation     |
| 3    | Employee         | EMP               | —                         | UserCog         | —                |
| 3.1  | Directory        | EMP_DIRECTORY     | /employee/directory       | Users           | Employee         |
| 3.2  | Profile (Admin)  | EMP_PROFILE_ADMIN | /employee/profile/:id     | Users           | Employee         |
| 4    | Attendance       | ATT               | —                         | Fingerprint     | —                |
| 4.1  | Daily Preview    | ATTENDANCE_DAILY  | /attendance/daily         | Clock           | Attendance       |
| 4.2  | Leave Balance    | LEAVE_BALANCE     | /attendance/balance       | CalendarCheck   | Attendance       |
| 4.3  | Leave Requests   | LEAVE_REQUESTS    | /attendance/requests      | CalendarOff     | Attendance       |
| 4.4  | Holidays         | LEAVE_HOLIDAYS    | /attendance/holidays      | CalendarOff     | Attendance       |
| 4.5  | Attendance Setup | ATTENDANCE_SETUP  | /attendance/setup         | Fingerprint     | Attendance       |
| 5    | Client & Project | CAP               | —                         | Briefcase       | —                |
| 5.1  | Projects         | PROJECT_PROJECTS  | /project/projects         | FolderKanban    | Client & Project |
| 5.2  | Clients          | PROJECT_CLIENTS   | /project/clients          | Users           | Client & Project |
| 6    | Payroll          | PAY               | —                         | DollarSign      | —                |
| 6.1  | Payroll Listing  | PAYROLL_OVERVIEW  | /payroll/listing          | ReceiptText     | Payroll          |
| 7    | Reimbursement    | REIMB             | /reimbursement            | Receipt         | —                |
| 8    | Announcements    | ANN               | /announcements            | Megaphone       | —                |
| 9    | Access Control   | ACC               | —                         | Shield          | —                |
| 9.1  | Roles            | ACCESS_ROLES      | /access/roles             | KeyRound        | Access Control   |
| 9.2  | Users            | ACCESS_USERS      | /access/users             | Users           | Access Control   |
| 9.3  | Permissions      | ACCESS_PERMISSIONS| /access/permissions       | KeyRound        | Access Control   |

> Module `Code` values must match the `ModuleCode` enum in `brello_webapp/src/enum/modules.ts` and the strings passed to `@RequirePermission()` in controllers.
> Icon names must be added to `brello_webapp/src/features/sidebar/utils/iconMapper.ts`.

---

### Step 4 — Create Plans

**Where:** `Platform > Plans`

Plans define subscription tiers (e.g. Standard, Professional).

| Field       | Notes                                      |
|-------------|--------------------------------------------|
| Name        | e.g. "Standard"                            |
| Billing Cycle | Monthly / Annual                         |
| Price       | Used for billing display                   |

---

### Step 5 — Link Apps to Plans

**Where:** `Platform > Plans > [Plan] > Permissions > Apps tab`

Each plan must have at least one app linked to it. The linked apps determine which platform roles get cloned when an org is created on this plan.

> If no apps are linked to a plan, `setupCompany` will throw: "No suitable platform default roles found."

---

### Step 6 — Configure Plan Module Permissions

**Where:** `Platform > Plans > [Plan] > Permissions > Modules & Actions tab`

For each module in the plan's apps, configure:
- **Include** checkbox — whether the module is available in this plan at all
- **Action checkboxes** — which actions (Create, Update, Delete, View) are allowed

> Modules with "Include" unchecked will be filtered out of the org user's sidebar, regardless of what their role grants them.

---

### Step 7 — Create Platform Default Roles

**Where:** `Platform > Access > Roles`

Create at least one system role per app. These roles are the templates that get cloned to every new org.

| Field           | Value                    |
|-----------------|--------------------------|
| Name            | e.g. "Organisation Owner"|
| App             | Select the app           |
| Is Default      | ✓ Yes                    |

> Only roles with `is_system_role = true`, `is_default = true`, and `organization_id = null` are cloned during `setupCompany`.

---

### Step 8 — Assign Module Access to Platform Roles

**Where:** `Platform > Access > Permissions`

**This is the most critical step.** Select a role and configure which modules and actions it can access. These entries are cloned into every new org at setup time.

- Assign all modules the role should have access to
- Check all required actions (typically Create, Update, Delete, View for full access)

> If this step is skipped or done AFTER an org is already created, that org will have an empty sidebar. You must manually sync the module access to existing org roles via the database.

---

## What `setupCompany` Does (Summary)

```
POST /organizations/setup-company
  │
  ├── Creates Enterprise (if new)
  ├── Creates Organization
  ├── Creates OrganizationProfile
  │
  ├── For each app in the user's plan:
  │     └── Finds platform default role (is_system_role=true, is_default=true, org=null)
  │           ├── Clones role → org-specific role
  │           └── Clones all module_access rows from platform role → org role
  │
  ├── Creates UserRoleMap (user ↔ cloned org roles)
  ├── Updates User (organization_id, enterprise_id)
  ├── Creates OrganizationSubscription (14-day Trial)
  ├── Seeds default Payroll Component (Basic Salary, 50%)
  ├── Copies platform default Departments (is_default=true)
  └── Copies platform default Designations (is_default=true)
```

---

## Fixing an Existing Org With Empty Sidebar

If an org was created before Steps 7–8 were completed, its cloned roles will have zero `module_access` entries. To fix:

```sql
-- 1. Find the platform role and the org's cloned role
SELECT id, name FROM brello_v3.role WHERE is_system_role = true AND organization_id IS NULL;
-- note: platform_role_id

SELECT r.id, r.name FROM brello_v3.role r
JOIN brello_v3.user_role_map urm ON urm.role_id = r.id
JOIN brello_v3.users u ON u.id = urm.user_id
WHERE u.email = '<org-admin-email>';
-- note: org_role_id

-- 2. Clone module_access from platform role to org role
INSERT INTO brello_v3.module_access (id, role_id, module_id, action_id, access_flag, created_at, updated_at)
SELECT gen_random_uuid(), '<org_role_id>', module_id, action_id, access_flag, NOW(), NOW()
FROM brello_v3.module_access
WHERE role_id = '<platform_role_id>';
```

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| No module_access on platform role at org creation time | Empty sidebar for all org users | Clone entries retroactively (see above) |
| Module missing `path` | Sidebar item renders but clicking does nothing | Set path in Platform > Modules |
| Module icon not in `iconMapper.ts` | Sidebar shows generic circle icon | Add icon to the map |
| Plan has no apps linked | `setupCompany` throws 404 | Link apps under Plan > Permissions > Apps tab |
| Module "Include" unchecked in plan | Module missing from sidebar | Check the Include toggle in Plan Permissions |
| Trial subscription (plan not applied) | Plan restrictions skipped | Fixed — `getActivePlanId` now includes Trial subscriptions |
