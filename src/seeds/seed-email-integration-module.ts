/**
 * Seed: Email Integration Module (menu)
 *
 * Registers the "Integration" L1 module and its "Email" L2 sub-module for the
 * Admin app, creates the required actions, grants access to every active admin
 * role, and enables the modules on every plan (so plan-gating does not hide the
 * menu). The `email_integrations` table itself is created automatically by
 * TypeORM `synchronize` on server start — this seed only wires up the RBAC menu.
 *
 * Connection details are read from src/core/properties/dev.properties.yaml, so
 * it targets the same database the server uses (incl. Aiven SSL).
 *
 * Run from project root:
 *   npx ts-node src/seeds/seed-email-integration-module.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

const L1_MODULE = {
  name: 'Integration',
  code: 'INTEGRATION',
  icon: 'Plug',
  path: null as string | null, // parent node — expands, does not navigate
};

const L2_MODULE = {
  name: 'Email',
  code: 'INTEGRATION_EMAIL',
  icon: 'Mails',
  path: '/integration/email',
};

const ACTIONS = ['view', 'create', 'activate', 'delete'];

// ── Load DB connection from the properties YAML ─────────────────────────────
function loadDbConfig() {
  const propsPath = path.join(
    __dirname,
    '../core/properties/dev.properties.yaml',
  );
  const props = yaml.load(fs.readFileSync(propsPath, 'utf8')) as {
    db: {
      postgres: {
        HOST: string;
        PORT: number;
        DB_USER: string;
        DB_PASSWORD: string;
        DB_NAME: string;
        DB_SCHEMA: string;
        DB_SSL_CA?: string;
      };
    };
  };
  return props.db.postgres;
}

const pg = loadDbConfig();
const SCHEMA = pg.DB_SCHEMA;

const client = new Client({
  host: pg.HOST,
  port: pg.PORT,
  user: pg.DB_USER,
  password: pg.DB_PASSWORD,
  database: pg.DB_NAME,
  ssl: pg.DB_SSL_CA
    ? { ca: fs.readFileSync(pg.DB_SSL_CA).toString() }
    : false,
});

async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await client.query(sql, params);
  return result.rows as T[];
}

async function upsertModule(
  appId: string,
  mod: { name: string; code: string; icon: string; path: string | null },
  wbs: string,
  parentId: string | null,
  type: 'mod' | 'submod',
): Promise<string> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.modules WHERE app_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [appId, mod.code],
  );
  if (existing.length > 0) {
    await query(
      `UPDATE ${SCHEMA}.modules
       SET name = $1, icon = $2, path = $3, wbs_code = $4, parent_id = $5,
           type = $6, status = 'ACTIVE', updated_at = NOW()
       WHERE id = $7`,
      [mod.name, mod.icon, mod.path, wbs, parentId, type, existing[0].id],
    );
    console.log(`  ↻ Updated module ${mod.code} (${existing[0].id})`);
    return existing[0].id;
  }

  const [inserted] = await query<{ id: string }>(
    `INSERT INTO ${SCHEMA}.modules
       (name, code, app_id, wbs_code, parent_id, type, icon, path,
        status, enterprise_id, organization_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',$9,$9,NOW(),NOW())
     RETURNING id`,
    [
      mod.name,
      mod.code,
      appId,
      wbs,
      parentId,
      type,
      mod.icon,
      mod.path,
      ZERO_UUID,
    ],
  );
  console.log(`  ＋ Created module ${mod.code} (${inserted.id})`);
  return inserted.id;
}

async function ensureActions(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const name of ACTIONS) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM ${SCHEMA}.actions WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL`,
      [name],
    );
    if (existing.length > 0) {
      map[name] = existing[0].id;
    } else {
      const [created] = await query<{ id: string }>(
        `INSERT INTO ${SCHEMA}.actions
           (name, status, enterprise_id, organization_id, created_at, updated_at)
         VALUES ($1, 'ACTIVE', $2, $2, NOW(), NOW())
         RETURNING id`,
        [name, ZERO_UUID],
      );
      map[name] = created.id;
      console.log(`  ＋ Created action ${name}`);
    }
  }
  return map;
}

async function grantModuleAccess(
  roleIds: string[],
  moduleId: string,
  actionIds: string[],
): Promise<void> {
  for (const roleId of roleIds) {
    for (const actionId of actionIds) {
      const existing = await query(
        `SELECT id FROM ${SCHEMA}.module_access
         WHERE role_id = $1 AND module_id = $2 AND action_id = $3`,
        [roleId, moduleId, actionId],
      );
      if (existing.length > 0) {
        await query(
          `UPDATE ${SCHEMA}.module_access SET access_flag = TRUE, updated_at = NOW()
           WHERE role_id = $1 AND module_id = $2 AND action_id = $3`,
          [roleId, moduleId, actionId],
        );
      } else {
        await query(
          `INSERT INTO ${SCHEMA}.module_access
             (role_id, module_id, action_id, access_flag, created_at, updated_at)
           VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
          [roleId, moduleId, actionId],
        );
      }
    }
  }
}

async function enableOnAllPlans(
  moduleId: string,
  actionIds: string[],
): Promise<void> {
  const plans = await query<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.plan WHERE deleted_at IS NULL`,
  );
  if (plans.length === 0) {
    console.log('  (no plans found — plan gating will pass through)');
    return;
  }

  for (const { id: planId } of plans) {
    // plan_module
    const pm = await query(
      `SELECT id FROM ${SCHEMA}.plan_module WHERE plan_id = $1 AND module_id = $2`,
      [planId, moduleId],
    );
    if (pm.length > 0) {
      await query(
        `UPDATE ${SCHEMA}.plan_module SET enabled = TRUE, status = 'ACTIVE', updated_at = NOW()
         WHERE plan_id = $1 AND module_id = $2`,
        [planId, moduleId],
      );
    } else {
      await query(
        `INSERT INTO ${SCHEMA}.plan_module
           (plan_id, module_id, enabled, status, created_at, updated_at)
         VALUES ($1, $2, TRUE, 'ACTIVE', NOW(), NOW())`,
        [planId, moduleId],
      );
    }

    // plan_module_action
    for (const actionId of actionIds) {
      const pma = await query(
        `SELECT id FROM ${SCHEMA}.plan_module_action
         WHERE plan_id = $1 AND module_id = $2 AND action_id = $3`,
        [planId, moduleId, actionId],
      );
      if (pma.length > 0) {
        await query(
          `UPDATE ${SCHEMA}.plan_module_action SET enabled = TRUE, status = 'ACTIVE', updated_at = NOW()
           WHERE plan_id = $1 AND module_id = $2 AND action_id = $3`,
          [planId, moduleId, actionId],
        );
      } else {
        await query(
          `INSERT INTO ${SCHEMA}.plan_module_action
             (plan_id, module_id, action_id, enabled, status, created_at, updated_at)
           VALUES ($1, $2, $3, TRUE, 'ACTIVE', NOW(), NOW())`,
          [planId, moduleId, actionId],
        );
      }
    }
  }
  console.log(`  ✓ Enabled module on ${plans.length} plan(s)`);
}

async function run() {
  await client.connect();
  console.log(`Connected to DB (${pg.HOST}, schema ${SCHEMA})\n`);

  // 1. Find the Admin app
  const apps = await query<{ id: string; name: string }>(
    `SELECT id, name FROM ${SCHEMA}.app WHERE status = 'ACTIVE'`,
  );
  const adminApp =
    apps.find((a) => a.name === 'Admin App') ??
    apps.find((a) => a.name.toLowerCase().includes('admin'));
  if (!adminApp) {
    throw new Error(
      `No admin app found. Available apps: ${apps.map((a) => a.name).join(', ')}`,
    );
  }
  console.log(`Using app: ${adminApp.name} (${adminApp.id})\n`);

  // 2. Compute next L1 WBS code
  const [wbsRow] = await query<{ max_wbs: string }>(
    `SELECT MAX(wbs_code::int) AS max_wbs
     FROM ${SCHEMA}.modules
     WHERE app_id = $1 AND parent_id IS NULL AND deleted_at IS NULL
       AND wbs_code ~ '^[0-9]+$'`,
    [adminApp.id],
  );
  const l1Wbs = String((parseInt(wbsRow?.max_wbs ?? '0', 10) || 0) + 1);
  console.log(`L1 WBS code: ${l1Wbs}\n`);

  // 3. Upsert Integration (L1) and Email (L2)
  console.log('Modules:');
  const integrationId = await upsertModule(
    adminApp.id,
    L1_MODULE,
    l1Wbs,
    null,
    'mod',
  );
  const emailId = await upsertModule(
    adminApp.id,
    L2_MODULE,
    `${l1Wbs}.1`,
    integrationId,
    'submod',
  );

  // 4. Ensure actions
  console.log('\nActions:');
  const actionMap = await ensureActions();
  const emailActionIds = ACTIONS.map((a) => actionMap[a]);
  const viewActionId = actionMap['view'];

  // 5. Grant to every active admin role
  const roles = await query<{ id: string; name: string }>(
    `SELECT id, name FROM ${SCHEMA}.role
     WHERE app_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
    [adminApp.id],
  );
  console.log(`\nGranting access to ${roles.length} admin role(s)...`);
  await grantModuleAccess(
    roles.map((r) => r.id),
    emailId,
    emailActionIds,
  );
  // Parent needs 'view' so it renders even before child propagation.
  await grantModuleAccess(
    roles.map((r) => r.id),
    integrationId,
    [viewActionId],
  );

  // 6. Enable on all plans (so plan gating passes)
  console.log('\nPlan enablement:');
  await enableOnAllPlans(emailId, emailActionIds);
  await enableOnAllPlans(integrationId, [viewActionId]);

  console.log('\n✅ Seed complete. Reload the webapp to see Integration → Email.');
}

run()
  .catch((err) => {
    console.error('\n❌ Seed failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
