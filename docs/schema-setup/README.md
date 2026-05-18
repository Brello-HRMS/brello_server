# Setting up a fresh brello schema from scratch

This document captures every step required to bootstrap a brand-new Postgres schema
(e.g. `brello_v2`) so that it is ready to accept the first `POST /enterprise` call.

The current `brello_dev` schema contains tenant-scoped junk from older builds; the
process below produces a clean baseline (apps, modules, actions, default roles,
plans, plan permissions, industry types).

---

## TL;DR — 6 steps

```bash
# 1. Create schema on Postgres (one-liner — see step 1 below)
DB_SCHEMA=<new-schema> npx ts-node -e "import { createClient, getSchema } from './src/seeds/_db'; (async () => { const c = createClient(); await c.connect(); await c.query(\`CREATE SCHEMA IF NOT EXISTS \${getSchema()}\`); await c.end(); })();"

# 2. Update properties.yaml -> DB_SCHEMA: <new-schema>

# 3. Boot the Nest server once (TypeORM synchronize creates all tables)
npm run start:dev

# 4. Seed baseline (apps + actions + modules + roles + plans + permissions)
npx ts-node src/seeds/seed-brello-v2-base.ts

# 5. Seed industry types
npx ts-node src/seeds/seed-industry-types.ts

# 6. Update module paths to match the frontend router
npx ts-node src/seeds/update-module-paths.ts
```

After step 6 the schema is ready. Hit the enterprise create API and the rest of
the bootstrap (`enterprise_app`, organization, user-role-map, etc.) is handled
by application code.

---

## Prerequisites

Before you run a single command, confirm all of these:

- [ ] `npm install` has been run (need `pg`, `ts-node`, `js-yaml`, `typeorm` from `package.json`).
- [ ] [src/core/properties/dev.properties.yaml](../../src/core/properties/dev.properties.yaml) is filled in with the target Postgres host / port / user / password / database. The seed scripts read connection details from this file via [src/seeds/_db.ts](../../src/seeds/_db.ts).
- [ ] **CA cert for the DB exists** at the path named in `db.postgres.DB_SSL_CA` (default `./certs/ca.pem`). For Aiven, download "CA Certificate" from the service overview page and save it there. If your DB doesn't use SSL, set `DB_SSL_CA` to an empty string.
- [ ] You can reach the DB from your machine. Quick sanity check:
  ```bash
  node -e "const{Client}=require('pg');const fs=require('fs');const yaml=require('js-yaml');const cfg=yaml.load(fs.readFileSync('src/core/properties/dev.properties.yaml','utf8')).db.postgres;new Client({host:cfg.HOST,port:cfg.PORT,user:cfg.DB_USER,password:cfg.DB_PASSWORD,database:cfg.DB_NAME,ssl:cfg.DB_SSL_CA?{ca:fs.readFileSync(cfg.DB_SSL_CA).toString()}:false}).connect().then(()=>console.log('OK')).catch(e=>console.error(e.message))"
  ```

### Targeting a different schema

The schema name comes from `db.postgres.DB_SCHEMA` in the yaml. To override
without editing the file, export `DB_SCHEMA`:

```bash
export DB_SCHEMA=my_new_schema
```

[src/seeds/_db.ts](../../src/seeds/_db.ts) prefers the env var; otherwise falls
back to the yaml value.

---

## Step 1 — Create the schema

`CREATE SCHEMA` is a one-liner. Run from project root:

```bash
DB_SCHEMA=brello_v2 npx ts-node -e "
import { createClient, getSchema } from './src/seeds/_db';
(async () => {
  const c = createClient();
  await c.connect();
  await c.query(\`CREATE SCHEMA IF NOT EXISTS \${getSchema()}\`);
  console.log('Schema', getSchema(), 'ready.');
  await c.end();
})();
"
```

Substitute the schema name as needed.

---

## Step 2 — Point the app at the new schema

Edit [src/core/properties/dev.properties.yaml](../../src/core/properties/dev.properties.yaml):

```yaml
db:
  postgres:
    DB_SCHEMA: 'brello_v2'   # was 'brello_dev'
```

---

## Step 3 — Let TypeORM create the tables

In dev (`brello.environment === 'dev'`), TypeORM `synchronize: true` is enabled
([src/config/database.config.ts:37](../../src/config/database.config.ts#L37)). Just boot the server once:

```bash
npm run start:dev
```

Wait until you see the Nest startup logs (no need to hit any endpoint). All
~74 tables are created from the entity definitions. Stop the server.

Verify with:

```bash
npx ts-node -e "
import { createClient, getSchema } from './src/seeds/_db';
(async () => {
  const c = createClient();
  await c.connect();
  const r = await c.query(\`SELECT count(*) FROM pg_tables WHERE schemaname = '\${getSchema()}'\`);
  console.log('Tables:', r.rows[0].count);
  await c.end();
})();
"
```

Should print `74` (or more, if new entities have been added since).

---

## Step 4 — Run the base seed

```bash
npx ts-node src/seeds/seed-brello-v2-base.ts
```

[src/seeds/seed-brello-v2-base.ts](../../src/seeds/seed-brello-v2-base.ts) inserts:

| Table | Rows | What |
|---|---|---|
| `app` | 2 | `ADMIN`, `EMPLOYEE` |
| `actions` | 11 | View, Create, Edit, Update, Delete, Approve, Publish, Archive, Activate, Clone, Export |
| `modules` | 49 | 37 admin (with parent/child tree) + 12 employee |
| `role` | 2 | `SUPER_ADMIN` (Admin), `EMPLOYEE` (Employee) — both `is_default=true`, `is_system_role=true`, `organization_id=NULL` |
| `module_access` | 539 | All (role × module × action) within each role's app |
| `plan` | 2 | `STANDARD`, `PREMIUM` |
| `plan_app` | 4 | Both plans × both apps |
| `plan_module` | 98 | Both plans × every module |
| `plan_module_action` | 1078 | Both plans × every module × every action |

The script is idempotent — re-running is safe.

See [menu-structure.md](./menu-structure.md) for the full WBS / code / name listing.

---

## Step 5 — Seed industry types

```bash
npx ts-node src/seeds/seed-industry-types.ts
```

Inserts 20 common industries into `industry_type`. Idempotent (uses
`ON CONFLICT DO NOTHING` against the unique `name` index).

---

## Step 6 — Update module paths

```bash
npx ts-node src/seeds/update-module-paths.ts
```

[src/seeds/update-module-paths.ts](../../src/seeds/update-module-paths.ts) maps each
module's `path` column to the route used by the frontend router. Modules that
have no frontend route yet are left with `path = NULL` so the menu renderer can
hide or disable them. Edit the `PATHS` map in that file as new pages get built.

---

## Sanity check

After all steps, verify row counts:

```bash
npx ts-node -e "
import { createClient, getSchema } from './src/seeds/_db';
(async () => {
  const c = createClient();
  await c.connect();
  await c.query(\`SET search_path TO \${getSchema()}\`);
  const r = await c.query(\`
    SELECT 'app' AS tbl, COUNT(*)::int AS n FROM app UNION ALL
    SELECT 'actions', COUNT(*)::int FROM actions UNION ALL
    SELECT 'modules', COUNT(*)::int FROM modules UNION ALL
    SELECT 'role', COUNT(*)::int FROM role UNION ALL
    SELECT 'module_access', COUNT(*)::int FROM module_access UNION ALL
    SELECT 'plan', COUNT(*)::int FROM plan UNION ALL
    SELECT 'plan_app', COUNT(*)::int FROM plan_app UNION ALL
    SELECT 'plan_module', COUNT(*)::int FROM plan_module UNION ALL
    SELECT 'plan_module_action', COUNT(*)::int FROM plan_module_action UNION ALL
    SELECT 'industry_type', COUNT(*)::int FROM industry_type
    ORDER BY tbl
  \`);
  console.table(r.rows);
  await c.end();
})();
"
```

Expected (immediately after seed, **before any enterprise/org is created**):

| tbl | n |
|---|---|
| actions | 11 |
| app | 2 |
| industry_type | 20 |
| module_access | 539 |
| modules | 49 |
| plan | 2 |
| plan_app | 4 |
| plan_module | 98 |
| plan_module_action | 1078 |
| role | 2 |

Once you've created your first org (next section), `role` and `module_access`
will grow because `OrganizationService.setupCompany` clones the platform-role
template per app for the new org. Expect `+2` roles and `+539` `module_access`
rows per org you set up. See the "How module_access flows…" section below for
the lifecycle.

---

## Creating the first user, enterprise, and organization

After the seed completes the schema has zero users — you can't call protected
endpoints yet. Here is the end-to-end bootstrap, assuming the API is running on
`http://localhost:8000` and the api prefix is `api/v1`.

### 1. Find a plan ID

The lead-register payload needs a `plan_id`. Grab one from the seeded plans:

```bash
npx ts-node -e "
import { createClient, getSchema } from './src/seeds/_db';
(async () => {
  const c = createClient();
  await c.connect();
  await c.query(\`SET search_path TO \${getSchema()}\`);
  const r = await c.query(\"SELECT id, name FROM plan WHERE deleted_at IS NULL ORDER BY name\");
  console.table(r.rows);
  await c.end();
})();
"
```

Pick the `id` for `STANDARD` (or `PREMIUM`) — call it `<PLAN_ID>` below.

### 2. Register as a lead

```bash
curl -sX POST http://localhost:8000/api/v1/leads/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "founder@acme.test",
    "first_name": "Founder",
    "last_name": "Acme",
    "phone": "+919999999999",
    "password": "Founder@1234",
    "source": "website",
    "plan_id": "<PLAN_ID>"
  }'
```

An OTP gets emailed via the SMTP creds in `dev.properties.yaml` (or check the
server log — for dev, the OTP is logged in plaintext by `EmailNotificationService`).

### 3. Verify the lead's OTP

```bash
curl -sX POST http://localhost:8000/api/v1/leads/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{ "email": "founder@acme.test", "otp": "<OTP>" }'
```

This promotes the lead to a `users` row.

### 4. Login (OTP flow)

```bash
curl -sX POST http://localhost:8000/api/v1/auth/login/send-otp \
  -H 'Content-Type: application/json' \
  -d '{ "email": "founder@acme.test" }'

# then with the new OTP:
curl -sX POST http://localhost:8000/api/v1/auth/login/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{ "email": "founder@acme.test", "otp": "<OTP>" }'
```

The response includes `access_token` — call it `<JWT>` below. It also includes
the user's `id` (call it `<USER_ID>`) which you'll need for the org setup call.

### 5. Create the enterprise

```bash
curl -sX POST http://localhost:8000/api/v1/enterprises \
  -H "Authorization: Bearer <JWT>" \
  -H 'Content-Type: application/json' \
  -d '{ "name": "ACME Corp", "domain": "acme.test" }'
```

[EnterpriseService.create](../../src/modules/enterprise/services/enterprise.service.ts)
inserts the row and auto-populates `enterprise_app` for every seeded app.

### 6. Setup the company / organization

Pick an `industry_type.id` for `business_type_id`:

```sql
SELECT id, name FROM industry_type WHERE deleted_at IS NULL LIMIT 5;
```

```bash
curl -sX POST http://localhost:8000/api/v1/organizations/setup \
  -H "Authorization: Bearer <JWT>" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "ACME Corp",
    "subdomain": "acme",
    "business_type_id": "<INDUSTRY_ID>",
    "user_id": "<USER_ID>"
  }'
```

[OrganizationService.setupCompany](../../src/modules/organization/services/organization.service.ts)
clones the platform default roles (and their `module_access`) per the user's
plan, attaches them to the user via `user_role_map`, creates an
`organization_subscription`, and inserts the default `Basic Salary` payroll
component.

After this call the user can log in normally and the menu/permissions resolver
returns real results.

---

## Starting over (rollback)

If a seed gets botched and you want to wipe and retry:

```bash
DB_SCHEMA=brello_v2 npx ts-node -e "
import { createClient, getSchema } from './src/seeds/_db';
(async () => {
  const c = createClient();
  await c.connect();
  const s = getSchema();
  await c.query(\`DROP SCHEMA IF EXISTS \${s} CASCADE\`);
  await c.query(\`CREATE SCHEMA \${s}\`);
  console.log('Schema', s, 'recreated empty.');
  await c.end();
})();
"
```

Then re-run Steps 3–6 (boot the server so TypeORM re-creates tables, then the
three seeds). **This destroys every row in that schema** — no recovery, so make
sure you really meant to do it.

---

## How `module_access` flows from the seed to actual users

The 539 `module_access` rows inserted by [seed-brello-v2-base.ts](../../src/seeds/seed-brello-v2-base.ts)
are attached to the **platform default roles** (`SUPER_ADMIN`, `EMPLOYEE`) where
`organization_id IS NULL`. Those roles are **templates** — they are not assigned
to any user directly.

When a new enterprise / organization gets created and
[OrganizationService.setupCompany](../../src/modules/organization/services/organization.service.ts) runs:

1. For every app in the org's plan, it finds the matching platform default role.
2. It **clones** that role into a new row scoped to the org (`organization_id = savedOrg.id`, `is_system_role = false`, `is_default = false`).
3. It **copies every `module_access` row** from the platform role to the cloned org-role (same module_id, action_id, access_flag).
4. It creates a `user_role_map` row tying the signing-in user to that cloned role.

So the lifecycle looks like:

```
platform role (template)            org role (cloned at setup-company)
  └─ module_access (539 rows)  ───►   └─ module_access (cloned subset)
                                            └─ user_role_map → user
```

### Implications

- **Adding a new module/action after orgs exist** — the seed only updates the
  platform-level rows. Existing orgs' cloned roles will **not** automatically get
  access to the new module. You need to backfill the cloned roles. See
  [src/seeds/seed-announcement-module.ts](../../src/seeds/seed-announcement-module.ts) and
  [docs/seeds/grant-module-access.sql](../seeds/grant-module-access.sql) for the
  backfill pattern (locate the org's cloned role, insert `module_access` rows for the
  new module × actions).

- **Editing a default permission** — flipping `access_flag` on a platform-role row
  does **not** propagate to existing cloned org-roles. Either backfill them or
  document that the change only affects orgs created from that point forward.

- **Custom roles per org** — admins of an org can create additional non-default
  roles and grant `module_access` ad-hoc through the admin UI; those rows are
  independent of the platform template.

- **Plan ceiling still applies** — every check is `module_access` AND
  `plan_module_action`. Even if a role has access, the org's plan must also enable
  that (module × action) pair. Both are currently seeded to permit everything for
  both plans, so this only matters when plan tiers are differentiated later.

### Verifying a user's effective access

After org setup, you can confirm cloned permissions like so:

```sql
SET search_path TO brello_v2;
SELECT r.name AS role_name, r.organization_id, m.code AS module, a.name AS action, ma.access_flag
FROM module_access ma
JOIN role r        ON r.id  = ma.role_id
JOIN modules m     ON m.id  = ma.module_id
JOIN actions a     ON a.id  = ma.action_id
WHERE r.organization_id = '<org-uuid>'
ORDER BY m.wbs_code, a.name;
```

---

## Permission model recap

```
user
  └─ user_role_map (user × role × organization)
       └─ role (scoped to one app)
             └─ module_access (role × module × action) ← grant
                                 ↑ filtered by ↓
               organization_subscription → plan
                 └─ plan_module_action (plan × module × action) ← ceiling
```

`PermissionResolverService.hasPermission(user, moduleCode, actionName)`:

1. Resolves the user's active roles for `user.appId` in `user.organizationId`.
2. OR-aggregates `module_access` rows from those roles.
3. AND-filters by the active plan's `plan_module_action` rows.
4. Returns true iff the requested `(moduleCode, actionName)` survives both.

Module codes are scoped per-app (unique on `app_id + code`), so the same code
can exist in both Admin and Employee app entries with different meanings.

---

## Known issues fixed during the v2 setup

These were committed during the bootstrap — listed for context.

### 1. `payroll_components.component_type` NOT NULL violation

[OrganizationService.setupCompany](../../src/modules/organization/services/organization.service.ts) was
inserting the default `Basic Salary` row with fields that didn't match the
`PayrollComponent` entity. Fixed at [organization.service.ts:215-228](../../src/modules/organization/services/organization.service.ts#L215-L228):

- `type` → `component_type`
- `calculation_value: { base, value }` → `value: 50` (entity has a single decimal column)
- `is_system_defined` → `is_default: true, is_editable: false`
- added `category: ComponentCategory.FIXED` (NOT NULL enum)

### 2. Controller `@RequirePermission` codes didn't match v2 module codes

Controllers were using legacy codes from `brello_dev`. Renames applied:

| Old code | New code |
|---|---|
| `ATTENDANCE_CONFIG` | `ATTENDANCE` |
| `COMPANY_POLICY` | `ORG_POLICIES` |
| `HOLIDAY_MGMT` | `HOLIDAY` |
| `LEAVE_MGMT` | `LEAVE` |
| `LEAVE_SETUP` | `ORG_LEAVE` |

Affected files:
- `src/modules/attendance/controllers/{attendance-rule,geo-validation,rule-assignment,shift,weekly-off}.controller.ts`
- `src/modules/company-policy/controllers/{company-policy,company-policy-type}.controller.ts`
- `src/modules/holiday/controllers/{holiday,holiday-calendar}.controller.ts`
- `src/modules/leave-balance/controllers/leave-balance.controller.ts`
- `src/modules/leave-config/controllers/leave-config.controller.ts`
- `src/modules/leave-request/controllers/leave-request.controller.ts`

**Open follow-up:** these endpoints (e.g. `/leave-requests`, `/holidays`) are
hit by both Admin and Employee users. After the rename they only resolve for
Admin (which has `LEAVE`, `HOLIDAY`, etc.). Employee users will 403 until either
(a) separate employee controllers are introduced, or (b) the access guard falls
back to the `EMP_*` code when the user is in the Employee app.

---

## File index

| Path | What |
|---|---|
| [docs/schema-setup/README.md](./README.md) | This document |
| [docs/schema-setup/menu-structure.md](./menu-structure.md) | Full WBS / code / path listing for the menu |
| [src/seeds/_db.ts](../../src/seeds/_db.ts) | Shared DB connection helper — reads `dev.properties.yaml`, honors `DB_SCHEMA` env var |
| [src/seeds/seed-brello-v2-base.ts](../../src/seeds/seed-brello-v2-base.ts) | Step 4 — apps, actions, modules, roles, plans, permissions |
| [src/seeds/seed-industry-types.ts](../../src/seeds/seed-industry-types.ts) | Step 5 — industry list |
| [src/seeds/update-module-paths.ts](../../src/seeds/update-module-paths.ts) | Step 6 — module path mapping |
