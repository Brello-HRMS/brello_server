/**
 * Seed: Organisation Profile Module
 *
 * Adds the ORG_PROFILE sub-module under the ORGANISATION parent in the Admin app.
 * Grants view/edit/update access to SUPER_ADMIN roles in all organisations.
 *
 * Idempotent — safe to re-run.
 *
 * Run from project root:
 *   npx ts-node src/seeds/seed-org-profile-module.ts
 */

import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();
const MODULE_CODE = 'ORG_PROFILE';
const PARENT_CODE = 'ORGANISATION';
const WBS_CODE = '11.0';
const MODULE_ACTIONS = ['view', 'edit', 'update'];

const client = createClient();

async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await client.query(sql, params);
  return result.rows as T[];
}

async function run() {
  await client.connect();
  console.log('Connected to DB\n');

  // ── 1. Find the Admin app ──────────────────────────────────────────────────
  const apps = await query<{ id: string; name: string }>(
    `SELECT id, name FROM ${SCHEMA}.app WHERE status = 'ACTIVE'`,
  );
  const adminApp =
    apps.find((a) => a.name === 'Admin App') ??
    apps.find((a) => a.name.toLowerCase().includes('admin'));
  if (!adminApp) throw new Error(`No admin app found. Available: ${apps.map((a) => a.name).join(', ')}`);
  console.log(`Using app: ${adminApp.name} (${adminApp.id})`);

  // ── 2. Find ORGANISATION parent module ────────────────────────────────────
  const [parentMod] = await query<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.modules WHERE app_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [adminApp.id, PARENT_CODE],
  );
  if (!parentMod) throw new Error(`Parent module '${PARENT_CODE}' not found for admin app`);
  console.log(`Parent module: ${PARENT_CODE} (${parentMod.id})`);

  // ── 3. Upsert the ORG_PROFILE sub-module ──────────────────────────────────
  const existing = await query<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.modules WHERE app_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [adminApp.id, MODULE_CODE],
  );

  let moduleId: string;
  if (existing.length > 0) {
    moduleId = existing[0].id;
    console.log(`\nModule '${MODULE_CODE}' already exists: ${moduleId}`);
  } else {
    const [inserted] = await query<{ id: string }>(
      `INSERT INTO ${SCHEMA}.modules
         (name, code, app_id, wbs_code, parent_id, type, icon, path,
          status, enterprise_id, organization_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
               '00000000-0000-0000-0000-000000000000',
               '00000000-0000-0000-0000-000000000000',
               NOW(), NOW())
       RETURNING id`,
      [
        'Profile',
        MODULE_CODE,
        adminApp.id,
        WBS_CODE,
        parentMod.id,
        'submod',
        'Building2',
        '/organisation/profile',
        'ACTIVE',
      ],
    );
    moduleId = inserted.id;
    console.log(`\nModule '${MODULE_CODE}' created: ${moduleId}`);
  }

  // ── 4. Ensure actions exist ───────────────────────────────────────────────
  const actionIdMap: Record<string, string> = {};
  for (const actionName of MODULE_ACTIONS) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM ${SCHEMA}.actions WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL`,
      [actionName],
    );
    if (existing.length > 0) {
      actionIdMap[actionName] = existing[0].id;
    } else {
      const [created] = await query<{ id: string }>(
        `INSERT INTO ${SCHEMA}.actions
           (name, status, enterprise_id, organization_id, created_at, updated_at)
         VALUES ($1, 'ACTIVE',
                 '00000000-0000-0000-0000-000000000000',
                 '00000000-0000-0000-0000-000000000000',
                 NOW(), NOW())
         RETURNING id`,
        [actionName],
      );
      actionIdMap[actionName] = created.id;
      console.log(`Created action: ${actionName} (${created.id})`);
    }
  }
  console.log('\nAction IDs:', actionIdMap);

  // ── 5. Grant access to all SUPER_ADMIN roles in the admin app ─────────────
  const superAdminRoles = await query<{ id: string; name: string; organization_id: string }>(
    `SELECT r.id, r.name, r.organization_id
     FROM ${SCHEMA}.role r
     WHERE r.app_id = $1
       AND (r.code = 'SUPER_ADMIN' OR LOWER(r.name) LIKE '%super%admin%')
       AND r.status = 'ACTIVE'
       AND r.deleted_at IS NULL`,
    [adminApp.id],
  );
  console.log(`\nFound ${superAdminRoles.length} SUPER_ADMIN role(s)`);

  let granted = 0;
  let skipped = 0;

  for (const role of superAdminRoles) {
    for (const [, actionId] of Object.entries(actionIdMap)) {
      const exists = await query(
        `SELECT id FROM ${SCHEMA}.module_access
         WHERE role_id = $1 AND module_id = $2 AND action_id = $3`,
        [role.id, moduleId, actionId],
      );

      if (exists.length > 0) {
        await query(
          `UPDATE ${SCHEMA}.module_access
           SET access_flag = TRUE, updated_at = NOW()
           WHERE role_id = $1 AND module_id = $2 AND action_id = $3`,
          [role.id, moduleId, actionId],
        );
        skipped++;
      } else {
        await query(
          `INSERT INTO ${SCHEMA}.module_access
             (role_id, module_id, action_id, access_flag, created_at, updated_at)
           VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
          [role.id, moduleId, actionId],
        );
        granted++;
      }
    }
  }

  console.log(`\nPermissions: ${granted} granted, ${skipped} already existed`);
  console.log('\nSeed complete. Restart the server for RequireAccess changes to take effect.');
}

run()
  .catch((err) => {
    console.error('\nSeed failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => client.end());
