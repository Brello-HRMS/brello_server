# Platform App — Sidebar / Module View

The Platform app is a **third app** alongside `ADMIN` and `EMPLOYEE`. It is used
by **Enterprise-level** admins (e.g. Brello employees, or a reseller-Enterprise's
own team) to manage the Organizations sold to.

Per-Enterprise scoping: a Platform user only sees Organizations under their own
`enterprise_id`. A user logged into Brello's Platform app sees Brello's
customers; a user logged into a reseller Enterprise's Platform app sees that
reseller's customers.

## Domain recap

- **Enterprise** = tenant of the SaaS platform (Brello itself, or a reseller).
  Has its own URL.
- **Organization** = the actual HRMS customer that an Enterprise sells to.
- One Enterprise → many Organizations.
- Platform app = Enterprise admin view over its Organizations.

## Sidebar structure

```
PLATFORM

  L1: Dashboard
    L2: Overview              — snapshot of platform usage, activity, status
    L2: Key Metrics           — high-level metrics + trends across orgs

  L1: Organizations           — companies (this Enterprise's customers)
    L2: Organization List     — all orgs under this enterprise
    L2: Organization Details  — drill-down: users, plan, subscription, status

  L1: Organization Setup      — system defaults orgs clone from
    L2: Department Templates
    L2: Designation Templates
    (Policies and Holidays are org-managed; not surfaced at the platform level)

  L1: HR Letters              — global letter templates
    L2: External Offer Letter Templates
    L2: Internal HR Letter Templates

  L1: Plans                   — what this Enterprise sells
    L2: Plan List
    L2: Plan Configuration    — toggle plan_module / plan_module_action

  L1: Access Control          — Platform-level users
    L2: Platform Roles
    L2: Platform Users
    L2: Permissions

  L1: Subscription & Billing
    L2: Invoices
    L2: Payments

  L1: System Settings
    L2: Feature Management    — per-org overrides on top of plan
    L2: Audit Logs
    L2: Industry Types
```

## Proposed module codes

Following the `EMP_` prefix pattern used by the Employee app, Platform modules
use `PLAT_`. (Module codes are scoped per-app, so collisions with ADMIN codes
are not possible — but the prefix keeps cross-app logs and queries readable.)

| WBS  | Code                        | Name                              |
|------|-----------------------------|-----------------------------------|
| 01   | PLAT_DASHBOARD              | Dashboard                         |
| 01.1 | PLAT_OVERVIEW               | Overview                          |
| 01.2 | PLAT_KEY_METRICS            | Key Metrics                       |
| 02   | PLAT_ORGANIZATIONS          | Organizations                     |
| 02.1 | PLAT_ORG_LIST               | Organization List                 |
| 02.2 | PLAT_ORG_DETAILS            | Organization Details              |
| 03   | PLAT_ORG_SETUP              | Organization Setup                |
| 03.1 | PLAT_DEPT_TEMPLATES         | Department Templates              |
| 03.2 | PLAT_DESIGNATION_TEMPLATES  | Designation Templates             |
| 04   | PLAT_HR_LETTERS             | HR Letters                        |
| 04.1 | PLAT_OFFER_TEMPLATES        | External Offer Letter Templates   |
| 04.2 | PLAT_INTERNAL_TEMPLATES     | Internal HR Letter Templates      |
| 05   | PLAT_PLANS                  | Plans                             |
| 05.1 | PLAT_PLAN_LIST              | Plan List                         |
| 05.2 | PLAT_PLAN_CONFIG            | Plan Configuration                |
| 06   | PLAT_ACCESS                 | Access Control                    |
| 06.1 | PLAT_ACCESS_ROLES           | Platform Roles                    |
| 06.2 | PLAT_ACCESS_USERS           | Platform Users                    |
| 06.3 | PLAT_ACCESS_PERMISSIONS     | Permissions                       |
| 07   | PLAT_BILLING                | Subscription & Billing            |
| 07.1 | PLAT_INVOICES               | Invoices                          |
| 07.2 | PLAT_PAYMENTS               | Payments                          |
| 08   | PLAT_SYSTEM                 | System Settings                   |
| 08.1 | PLAT_FEATURE_MGMT           | Feature Management                |
| 08.2 | PLAT_AUDIT_LOGS             | Audit Logs                        |
| 08.3 | PLAT_INDUSTRY_TYPES         | Industry Types                    |

## Default role

`PLATFORM_SUPER_ADMIN` — `is_system_role=true`, `is_default=true`,
`organization_id=NULL`, granted every action on every PLATFORM module.

When a new Enterprise is created, the platform default role is cloned per the
existing `OrganizationService.setupCompany` pattern, scoped to that
`enterprise_id` with `organization_id=NULL`.

## Schema additions required (not built yet)

These tables don't exist yet — to be added as each section gets implemented:

| Module                | Table(s) needed |
|-----------------------|-----------------|
| Organization Setup    | none — reuses existing `departments` and `designations` with `organization_id IS NULL` meaning "template". Requires making `designations.org_id` nullable and adding an `is_default` column to both tables. |
| HR Letters            | `hr_letter_template`, `hr_letter` (per-org actual letters) |
| Subscription & Billing | `invoice`, `payment` |
| Feature Management    | `organization_feature_override` |

`audit_log` and `industry_type` already exist.
