/**
 * Seed: Announcement module
 *
 * Adds the Announcement module to the ADMIN app, assigns all actions to
 * every admin role, and links it to the Premium plan — matching the
 * pattern used by seed-offer-management.ts.
 *
 * The route (/announcements/list, gated by ModuleCode.ANNOUNCEMENT) has
 * existed in the webapp since before this module row did, so without
 * this seed no role could ever be granted access to it.
 *
 * Idempotent — safe to re-run.
 *
 * Run from project root:
 *   npx ts-node src/seeds/seed-announcement-module.ts
 */

import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();
const client = createClient();

async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const r = await client.query(sql, params);
  return r.rows as T[];
}

async function getAdminAppId(): Promise<string> {
  const rows = await q<{ id: string }>(`SELECT id FROM ${SCHEMA}.app WHERE name = 'ADMIN' AND deleted_at IS NULL`);
  if (!rows.length) throw new Error('ADMIN app not found — run seed-brello-v2-base first');
  return rows[0].id;
}

async function getAdminRoleIds(adminAppId: string): Promise<string[]> {
  const rows = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.role WHERE app_id = $1 AND deleted_at IS NULL`,
    [adminAppId],
  );
  return rows.map((r) => r.id);
}

async function getPremiumPlanId(): Promise<string> {
  const rows = await q<{ id: string }>(`SELECT id FROM ${SCHEMA}.plan WHERE name = 'Premium' AND deleted_at IS NULL`);
  if (!rows.length) throw new Error('Premium plan not found');
  return rows[0].id;
}

async function getAllActionIds(): Promise<string[]> {
  const rows = await q<{ id: string }>(`SELECT id FROM ${SCHEMA}.actions WHERE deleted_at IS NULL`);
  return rows.map((r) => r.id);
}

async function getNextRootWbs(adminAppId: string): Promise<string> {
  const rows = await q<{ wbs_code: string }>(
    `SELECT wbs_code FROM ${SCHEMA}.modules WHERE app_id = $1 AND parent_id IS NULL AND deleted_at IS NULL`,
    [adminAppId],
  );
  const used = rows.map((r) => parseInt(r.wbs_code, 10) || 0);
  return String(Math.max(0, ...used) + 1);
}

async function upsertModule(appId: string, wbs: string): Promise<string> {
  const existing = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.modules WHERE app_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [appId, 'ANNOUNCEMENT'],
  );
  if (existing.length) return existing[0].id;

  const [row] = await q<{ id: string }>(
    `INSERT INTO ${SCHEMA}.modules
       (name, code, app_id, wbs_code, parent_id, type, icon, path, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), NOW())
     RETURNING id`,
    ['Announcements', 'ANNOUNCEMENT', appId, wbs, null, 'mod', 'Megaphone', '/announcements/list'],
  );
  return row.id;
}

async function grantAll(roleId: string, moduleId: string, actionIds: string[]): Promise<number> {
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

async function linkToPlan(planId: string, moduleId: string, actionIds: string[]): Promise<void> {
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
  console.log(`Seeding Announcement module in ${SCHEMA}...`);

  const adminAppId = await getAdminAppId();
  const adminRoleIds = await getAdminRoleIds(adminAppId);
  const premiumPlanId = await getPremiumPlanId();
  const actionIds = await getAllActionIds();
  const wbs = await getNextRootWbs(adminAppId);

  const moduleId = await upsertModule(adminAppId, wbs);
  console.log(`  Module: ANNOUNCEMENT (wbs ${wbs}) → ${moduleId.slice(0, 8)}`);

  let totalGranted = 0;
  for (const roleId of adminRoleIds) {
    totalGranted += await grantAll(roleId, moduleId, actionIds);
  }
  console.log(`Granted ${totalGranted} module_access rows to ${adminRoleIds.length} admin role(s)`);

  await linkToPlan(premiumPlanId, moduleId, actionIds);
  console.log('Linked module to Premium plan');

  console.log('\nDone. Announcement module seeded.');
}

run()
  .catch((e) => {
    console.error('Seed failed:', e.message || e);
    process.exit(1);
  })
  .finally(() => client.end());
