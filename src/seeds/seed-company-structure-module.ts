/**
 * Seed: Company Structure (user hierarchy) modules
 *
 * Adds two menu modules:
 *   - ADMIN app    → COMPANY_STRUCTURE      (org-wide org chart)   path /company-structure
 *   - EMPLOYEE app → EMP_COMPANY_STRUCTURE  ("My Team" self view)  path /team
 *
 * Each module is granted (all actions) to every role in its app and linked to
 * ALL plans, so any subscription tier can access it — matching the pattern in
 * seed-announcement-module.ts / seed-offer-management.ts.
 *
 * Idempotent — safe to re-run.
 *
 * Run from project root:
 *   npx ts-node src/seeds/seed-company-structure-module.ts
 */

import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();
const client = createClient();

interface ModuleDef {
  appName: 'ADMIN' | 'EMPLOYEE';
  code: string;
  name: string;
  icon: string;
  path: string;
}

const MODULES: ModuleDef[] = [
  {
    appName: 'ADMIN',
    code: 'COMPANY_STRUCTURE',
    name: 'Company Structure',
    icon: 'Network',
    path: '/company-structure',
  },
  {
    appName: 'EMPLOYEE',
    code: 'EMP_COMPANY_STRUCTURE',
    name: 'My Team',
    icon: 'Network',
    path: '/team',
  },
];

async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const r = await client.query(sql, params);
  return r.rows as T[];
}

async function getAppId(name: string): Promise<string> {
  const rows = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.app WHERE name = $1 AND deleted_at IS NULL`,
    [name],
  );
  if (!rows.length)
    throw new Error(`${name} app not found — run seed-brello-v2-base first`);
  return rows[0].id;
}

async function getRoleIds(appId: string): Promise<string[]> {
  const rows = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.role WHERE app_id = $1 AND deleted_at IS NULL`,
    [appId],
  );
  return rows.map((r) => r.id);
}

async function getAllPlanIds(): Promise<string[]> {
  const rows = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.plan WHERE deleted_at IS NULL`,
  );
  return rows.map((r) => r.id);
}

async function getAllActionIds(): Promise<string[]> {
  const rows = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.actions WHERE deleted_at IS NULL`,
  );
  return rows.map((r) => r.id);
}

async function getNextRootWbs(appId: string): Promise<string> {
  const rows = await q<{ wbs_code: string }>(
    `SELECT wbs_code FROM ${SCHEMA}.modules WHERE app_id = $1 AND parent_id IS NULL AND deleted_at IS NULL`,
    [appId],
  );
  const used = rows.map((r) => parseInt(r.wbs_code, 10) || 0);
  return String(Math.max(0, ...used) + 1);
}

async function upsertModule(
  appId: string,
  m: ModuleDef,
  wbs: string,
): Promise<string> {
  const existing = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.modules WHERE app_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [appId, m.code],
  );
  if (existing.length) {
    // Keep name/icon/path in sync on re-run.
    await client.query(
      `UPDATE ${SCHEMA}.modules SET name = $2, icon = $3, path = $4, updated_at = NOW() WHERE id = $1`,
      [existing[0].id, m.name, m.icon, m.path],
    );
    return existing[0].id;
  }
  const [row] = await q<{ id: string }>(
    `INSERT INTO ${SCHEMA}.modules
       (name, code, app_id, wbs_code, parent_id, type, icon, path, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), NOW())
     RETURNING id`,
    [m.name, m.code, appId, wbs, null, 'mod', m.icon, m.path],
  );
  return row.id;
}

async function grantAll(
  roleId: string,
  moduleId: string,
  actionIds: string[],
): Promise<number> {
  let count = 0;
  for (const actionId of actionIds) {
    const r = await client.query(
      `INSERT INTO ${SCHEMA}.module_access (role_id, module_id, action_id, access_flag, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW(), NOW())
       ON CONFLICT (role_id, module_id, action_id)
         DO UPDATE SET access_flag = TRUE, updated_at = NOW()`,
      [roleId, moduleId, actionId],
    );
    count += r.rowCount ?? 0;
  }
  return count;
}

async function linkToPlan(
  planId: string,
  moduleId: string,
  actionIds: string[],
): Promise<void> {
  await client.query(
    `INSERT INTO ${SCHEMA}.plan_module (plan_id, module_id, enabled, status, created_at, updated_at)
     VALUES ($1, $2, TRUE, 'ACTIVE', NOW(), NOW())
     ON CONFLICT (plan_id, module_id) DO NOTHING`,
    [planId, moduleId],
  );
  for (const actionId of actionIds) {
    await client.query(
      `INSERT INTO ${SCHEMA}.plan_module_action (plan_id, module_id, action_id, enabled, status, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, 'ACTIVE', NOW(), NOW())
       ON CONFLICT (plan_id, module_id, action_id) DO NOTHING`,
      [planId, moduleId, actionId],
    );
  }
}

async function run() {
  await client.connect();
  console.log(`Seeding Company Structure modules in ${SCHEMA}...`);

  const actionIds = await getAllActionIds();
  const planIds = await getAllPlanIds();

  for (const m of MODULES) {
    const appId = await getAppId(m.appName);
    const roleIds = await getRoleIds(appId);
    const wbs = await getNextRootWbs(appId);

    const moduleId = await upsertModule(appId, m, wbs);
    console.log(
      `  ${m.appName}: ${m.code} (wbs ${wbs}) → ${moduleId.slice(0, 8)}`,
    );

    let granted = 0;
    for (const roleId of roleIds)
      granted += await grantAll(roleId, moduleId, actionIds);
    console.log(
      `    Granted ${granted} module_access rows to ${roleIds.length} role(s)`,
    );

    for (const planId of planIds) await linkToPlan(planId, moduleId, actionIds);
    console.log(`    Linked to ${planIds.length} plan(s)`);
  }

  console.log('\nDone. Company Structure modules seeded.');
}

run()
  .catch((e) => {
    console.error('Seed failed:', e.message || e);
    process.exit(1);
  })
  .finally(() => client.end());
