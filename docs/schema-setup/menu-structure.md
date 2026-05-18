# Menu structure (brello_v2 baseline)

Reference listing of every module seeded by
[src/seeds/seed-brello-v2-base.ts](../../src/seeds/seed-brello-v2-base.ts) and the path
applied by [src/seeds/update-module-paths.ts](../../src/seeds/update-module-paths.ts).

`(no path)` = module has no frontend route yet. The menu renderer should hide
or disable these.

## Admin App

| WBS  | Code                  | Name                   | Path                          |
|------|-----------------------|------------------------|-------------------------------|
| 01   | DASHBOARD             | Dashboard              | `/`                           |
| 02   | EMPLOYEE              | Employee               | (no path)                     |
| 02.1 | EMP_DIRECTORY         | Directory              | `/employee/directory`         |
| 02.2 | EMP_PROFILE           | Profile                | `/employee/profile`           |
| 03   | ATTENDANCE            | Attendance             | `/attendance/setup`           |
| 03.1 | ATT_DAILY             | Daily                  | (no path)                     |
| 04   | LEAVE                 | Leave                  | (no path)                     |
| 04.1 | LEAVE_REQUESTS        | Requests               | (no path)                     |
| 04.2 | LEAVE_BALANCES        | Balances               | (no path)                     |
| 05   | HOLIDAY               | Holidays               | `/attendance/holidays`        |
| 06   | PAYROLL               | Payroll                | (no path)                     |
| 06.1 | PAY_LISTING           | Listing                | `/payroll/listing`            |
| 06.2 | PAY_PROCESS           | Process                | (no path)                     |
| 06.3 | PAY_PAYSLIP           | Payslips               | (no path)                     |
| 07   | REIMBURSEMENT         | Reimbursement          | `/reimbursement/list`         |
| 08   | PROJECT               | Project                | (no path)                     |
| 08.1 | PROJ_CLIENTS          | Clients                | `/project/clients`            |
| 08.2 | PROJ_PROJECTS         | Projects               | `/project/projects`           |
| 09   | HR_LETTERS            | HR Letters             | (no path)                     |
| 09.1 | HR_OFFER_LETTERS      | External Offer Letters | (no path)                     |
| 09.2 | HR_INTERNAL_LETTERS   | Internal HR Letters    | (no path)                     |
| 10   | ANNOUNCEMENT          | Announcements          | `/announcements/list`         |
| 11   | ORGANISATION          | Organisation           | (no path)                     |
| 11.1 | ORG_DEPARTMENTS       | Departments            | `/organisation/departments`   |
| 11.2 | ORG_DESIGNATIONS      | Designations           | `/organisation/designations`  |
| 11.3 | ORG_POLICIES          | Policies               | `/organisation/policies`      |
| 11.4 | ORG_LEAVE             | Leave                  | `/organisation/leave-config`  |
| 11.5 | ORG_ATTENDANCE        | Attendance             | (no path)                     |
| 11.6 | ORG_PAYROLL           | Payroll                | `/organisation/payroll`       |
| 12   | ACCESS                | Access                 | (no path)                     |
| 12.1 | ACCESS_USERS          | Users                  | `/access/users`               |
| 12.2 | ACCESS_ROLES          | Roles                  | `/access/roles`               |
| 12.3 | ACCESS_PERMISSIONS    | Permissions            | (no path)                     |
| 13   | BILLING               | Billing                | (no path)                     |
| 13.1 | BILLING_PLAN          | Current Plan           | (no path)                     |
| 13.2 | BILLING_INVOICES      | Invoices               | (no path)                     |
| 13.3 | BILLING_HISTORY       | Payment History        | (no path)                     |

## Employee App

| WBS | Code              | Name            | Path                |
|-----|-------------------|-----------------|---------------------|
| 01  | EMP_DASHBOARD     | Dashboard       | `/`                 |
| 02  | EMP_PROFILE       | Profile         | `/employee/profile` |
| 03  | EMP_ATTENDANCE    | Attendance      | (no path)           |
| 04  | EMP_TIMESHEET     | Timesheet       | (no path)           |
| 05  | EMP_LEAVE         | Leave           | (no path)           |
| 06  | EMP_HOLIDAY       | Holiday Listing | (no path)           |
| 07  | EMP_REIMBURSEMENT | Reimbursement   | `/reimbursement/me` |
| 08  | EMP_PAYSLIP       | Payslip         | (no path)           |
| 09  | EMP_PROJECT       | Project         | (no path)           |
| 10  | EMP_HR_LETTERS    | HR Letters      | (no path)           |
| 11  | EMP_POLICY        | Company Policy  | (no path)           |
| 12  | EMP_ANNOUNCEMENT  | Announcements   | `/announcements/me` |

## Actions

System-wide, shared across all apps:

```
View, Create, Edit, Update, Delete, Approve, Publish, Archive, Activate, Clone, Export
```

## Default roles

| App      | Role          | is_default | is_system_role | organization_id |
|----------|---------------|------------|----------------|-----------------|
| ADMIN    | SUPER_ADMIN   | true       | true           | NULL            |
| EMPLOYEE | EMPLOYEE      | true       | true           | NULL            |

Each role is granted every action on every module of its own app, giving 407
`module_access` rows for SUPER_ADMIN and 132 for EMPLOYEE.

## Plans

| Plan     | Price | Scope         |
|----------|-------|---------------|
| STANDARD | 999   | Everything    |
| PREMIUM  | 1999  | Everything    |

Both plans include both apps, every module, every action — they're functionally
identical at the moment. Differentiate by editing `plan_module` / `plan_module_action`
once product tiers are finalized.
