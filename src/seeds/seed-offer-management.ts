/**
 * Seed: offer_management modules
 *
 * Adds Offer Management module + sub-modules to the ADMIN app,
 * assigns all actions to SUPER_ADMIN role, and links to PREMIUM plan.
 *
 * Idempotent — safe to re-run.
 *
 * Run from project root:
 *   npx ts-node src/seeds/seed-offer-management.ts
 */

import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();
const client = createClient();

async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const r = await client.query(sql, params);
  return r.rows as T[];
}

const OFFER_MODULES = [
  { wbs: '14', code: 'OFFER_MANAGEMENT', name: 'Offer Management', icon: 'Handshake', path: '/offer-management' },
  { wbs: '14.1', code: 'OFFER_CANDIDATES', name: 'Candidates', parent_wbs: '14', icon: 'Users', path: '/offer-management' },
  { wbs: '14.2', code: 'OFFER_ANALYTICS', name: 'Analytics', parent_wbs: '14', icon: 'TrendingUp', path: '/offer-management/analytics' },
  { wbs: '14.3', code: 'OFFER_SETTINGS', name: 'Settings', parent_wbs: '14', icon: 'Settings', path: '/offer-management/settings' },
];

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

async function upsertModule(
  appId: string,
  code: string,
  name: string,
  wbs: string,
  parentId: string | null,
  icon: string,
  path: string,
): Promise<string> {
  const existing = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.modules WHERE app_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [appId, code],
  );
  if (existing.length) return existing[0].id;

  const type = parentId ? 'submod' : 'mod';
  const [row] = await q<{ id: string }>(
    `INSERT INTO ${SCHEMA}.modules
       (name, code, app_id, wbs_code, parent_id, type, icon, path, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), NOW())
     RETURNING id`,
    [name, code, appId, wbs, parentId, type, icon, path],
  );
  return row.id;
}

async function grantAll(roleId: string, moduleIds: string[], actionIds: string[]): Promise<number> {
  let count = 0;
  for (const moduleId of moduleIds) {
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
  }
  return count;
}

async function linkToPlan(
  planId: string,
  moduleIds: string[],
  actionIds: string[],
): Promise<void> {
  for (const moduleId of moduleIds) {
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
}

async function run() {
  await client.connect();
  console.log(`Seeding offer management modules in ${SCHEMA}...`);

  const adminAppId = await getAdminAppId();
  const adminRoleIds = await getAdminRoleIds(adminAppId);
  const premiumPlanId = await getPremiumPlanId();
  const actionIds = await getAllActionIds();

  // Upsert modules
  const wbsToId: Record<string, string> = {};
  const tops = OFFER_MODULES.filter((m) => !m.parent_wbs);
  const subs = OFFER_MODULES.filter((m) => !!m.parent_wbs);

  for (const m of tops) {
    wbsToId[m.wbs] = await upsertModule(adminAppId, m.code, m.name, m.wbs, null, m.icon, m.path);
    console.log(`  Module: ${m.code} → ${wbsToId[m.wbs].slice(0, 8)}`);
  }
  for (const m of subs) {
    const parentId = wbsToId[m.parent_wbs!];
    if (!parentId) throw new Error(`Parent WBS ${m.parent_wbs} not found`);
    wbsToId[m.wbs] = await upsertModule(adminAppId, m.code, m.name, m.wbs, parentId, m.icon, m.path);
    console.log(`  Sub-module: ${m.code} → ${wbsToId[m.wbs].slice(0, 8)}`);
  }

  const moduleIds = Object.values(wbsToId);

  // Grant all to each admin role
  let totalGranted = 0;
  for (const roleId of adminRoleIds) {
    totalGranted += await grantAll(roleId, moduleIds, actionIds);
  }
  console.log(`Granted ${totalGranted} module_access rows to ${adminRoleIds.length} admin role(s)`);

  // Link to Premium plan
  await linkToPlan(premiumPlanId, moduleIds, actionIds);
  console.log(`Linked ${moduleIds.length} modules to Premium plan`);

  console.log('\nDone. Offer Management seeded.');
}

run()
  .catch((e) => {
    console.error('Seed failed:', e.message || e);
    process.exit(1);
  })
  .finally(() => client.end());
