/**
 * Seed: Announcement Module
 *
 * Creates the L1 "Announcement" module for the Admin app, registers
 * the required actions, and grants full access to b10admin@gmail.com's role.
 *
 * Run from project root:
 *   npx ts-node --project tsconfig.json -e "require('./src/seeds/seed-announcement-module')"
 *
 * Or using ts-node directly:
 *   npx ts-node src/seeds/seed-announcement-module.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const SCHEMA = 'brello_dev';
const ADMIN_EMAIL = 'b10@admin.com';

const ANNOUNCEMENT_ACTIONS = ['view', 'create', 'update', 'delete', 'publish', 'archive'];

const client = new Client({
  host: 'brello-service-test-brello.c.aivencloud.com',
  port: 21789,
  user: 'avnadmin',
  password: 'AVNS_6fF5sDvxo5vO1kGlzuQ',
  database: 'defaultdb',
  ssl: {
    ca: fs.readFileSync(path.resolve(__dirname, '../../certs/ca.pem')).toString(),
  },
});

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
  console.log('Apps found:', apps.map((a) => `${a.name} (${a.id})`).join(', '));

  // Prefer "Admin App" over plain "ADMIN" — roles for b10@admin.com are on Admin App
  const adminApp =
    apps.find((a) => a.name === 'Admin App') ??
    apps.find((a) => a.name.toLowerCase().includes('admin'));
  if (!adminApp) {
    throw new Error(`No admin app found. Available: ${apps.map((a) => a.name).join(', ')}`);
  }
  console.log(`\nUsing app: ${adminApp.name} (${adminApp.id})`);

  // ── 2. Find max WBS code at L1 for this app ────────────────────────────────
  const [wbsRow] = await query<{ max_wbs: string }>(
    `SELECT MAX(wbs_code::int) AS max_wbs
     FROM ${SCHEMA}.modules
     WHERE app_id = $1 AND parent_id IS NULL AND deleted_at IS NULL`,
    [adminApp.id],
  );
  const nextWbs = String((parseInt(wbsRow?.max_wbs ?? '0', 10) || 0) + 1);
  console.log(`Next WBS code: ${nextWbs}`);

  // ── 3. Upsert the Announcement L1 module ──────────────────────────────────
  const existingModule = await query<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.modules WHERE app_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [adminApp.id, 'ANNOUNCEMENT'],
  );

  let moduleId: string;
  if (existingModule.length > 0) {
    moduleId = existingModule[0].id;
    console.log(`\nAnnouncement module already exists: ${moduleId}`);
  } else {
    const [inserted] = await query<{ id: string }>(
      `INSERT INTO ${SCHEMA}.modules
         (name, code, app_id, wbs_code, parent_id, type, icon, path,
          status, enterprise_id, organization_id,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
               '00000000-0000-0000-0000-000000000000',
               '00000000-0000-0000-0000-000000000000',
               NOW(), NOW())
       RETURNING id`,
      [
        'Announcements',
        'ANNOUNCEMENT',
        adminApp.id,
        nextWbs,
        null,
        'mod',
        'Megaphone',
        '/announcements',
        'ACTIVE',
      ],
    );
    moduleId = inserted.id;
    console.log(`\nAnnouncement module created: ${moduleId}`);
  }

  // ── 4. Ensure all required actions exist ──────────────────────────────────
  const actionIdMap: Record<string, string> = {};
  for (const actionName of ANNOUNCEMENT_ACTIONS) {
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

  // ── 5. Find b10admin@gmail.com ────────────────────────────────────────────
  const users = await query<{ id: string; email: string; organization_id: string }>(
    `SELECT id, email, organization_id FROM ${SCHEMA}.users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
    [ADMIN_EMAIL],
  );
  if (users.length === 0) {
    throw new Error(`User ${ADMIN_EMAIL} not found in the database`);
  }
  const adminUser = users[0];
  console.log(`\nUser: ${adminUser.email} (${adminUser.id}), org: ${adminUser.organization_id}`);

  // ── 6. Find the user's roles in the admin app ─────────────────────────────
  const roles = await query<{ role_id: string; role_name: string }>(
    `SELECT urm.role_id, r.name AS role_name
     FROM ${SCHEMA}.user_role_map urm
     JOIN ${SCHEMA}.role r ON r.id = urm.role_id
     WHERE urm.user_id = $1
       AND urm.organization_id = $2
       AND r.app_id = $3
       AND r.status = 'ACTIVE'`,
    [adminUser.id, adminUser.organization_id, adminApp.id],
  );

  if (roles.length === 0) {
    throw new Error(
      `${ADMIN_EMAIL} has no active roles for the admin app. Please assign a role first.`,
    );
  }
  console.log(
    'Roles:',
    roles.map((r) => `${r.role_name} (${r.role_id})`).join(', '),
  );

  // ── 7. Grant module_access for each role × action ─────────────────────────
  let grantedCount = 0;
  let skippedCount = 0;

  for (const { role_id } of roles) {
    for (const [, actionId] of Object.entries(actionIdMap)) {
      const existing = await query(
        `SELECT id FROM ${SCHEMA}.module_access
         WHERE role_id = $1 AND module_id = $2 AND action_id = $3`,
        [role_id, moduleId, actionId],
      );

      if (existing.length > 0) {
        // Update to ensure access_flag is true
        await query(
          `UPDATE ${SCHEMA}.module_access
           SET access_flag = TRUE, updated_at = NOW()
           WHERE role_id = $1 AND module_id = $2 AND action_id = $3`,
          [role_id, moduleId, actionId],
        );
        skippedCount++;
      } else {
        await query(
          `INSERT INTO ${SCHEMA}.module_access
             (role_id, module_id, action_id, access_flag, created_at, updated_at)
           VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
          [role_id, moduleId, actionId],
        );
        grantedCount++;
      }
    }
  }

  console.log(`\nPermissions: ${grantedCount} granted, ${skippedCount} already existed`);

  // ── 8. Verify TypeORM synchronize creates announcement tables ─────────────
  const tables = await query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = $1
       AND tablename LIKE 'announcement%'
     ORDER BY tablename`,
    [SCHEMA],
  );
  if (tables.length > 0) {
    console.log('\nAnnouncement tables found:', tables.map((t) => t.tablename).join(', '));
  } else {
    console.log(
      '\nAnnouncement tables not yet created — they will be auto-created by TypeORM synchronize on next server start.',
    );
  }

  console.log('\nSeed complete.');
}

run()
  .catch((err) => {
    console.error('\nSeed failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => client.end());
