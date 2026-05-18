/**
 * Update module.path to match the frontend router routes.
 *
 * Resets every module's path to NULL, then sets the paths listed in PATHS.
 * Idempotent — re-running produces the same end state.
 *
 * Run from project root:
 *   npx ts-node src/seeds/update-module-paths.ts
 */

import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();

const PATHS: Record<string, string> = {
  // Admin App
  DASHBOARD: '/',
  EMP_DIRECTORY: '/employee/directory',
  EMP_PROFILE: '/employee/profile',
  ATTENDANCE: '/attendance/setup',
  HOLIDAY: '/attendance/holidays',
  PAY_LISTING: '/payroll/listing',
  REIMBURSEMENT: '/reimbursement/list',
  PROJ_CLIENTS: '/project/clients',
  PROJ_PROJECTS: '/project/projects',
  ANNOUNCEMENT: '/announcements/list',
  ORG_DEPARTMENTS: '/organisation/departments',
  ORG_DESIGNATIONS: '/organisation/designations',
  ORG_POLICIES: '/organisation/policies',
  ORG_LEAVE: '/organisation/leave-config',
  ORG_PAYROLL: '/organisation/payroll',
  ACCESS_USERS: '/access/users',
  ACCESS_ROLES: '/access/roles',
  // Employee App
  EMP_DASHBOARD: '/',
  EMP_REIMBURSEMENT: '/reimbursement/me',
  EMP_ANNOUNCEMENT: '/announcements/me',
};

async function run() {
  const c = createClient();
  await c.connect();
  await c.query(`SET search_path TO ${SCHEMA}`);
  await c.query('BEGIN');

  await c.query('UPDATE modules SET path = NULL, updated_at = NOW() WHERE deleted_at IS NULL');

  let updated = 0;
  const missing: string[] = [];
  for (const [code, path] of Object.entries(PATHS)) {
    const r = await c.query(
      'UPDATE modules SET path = $1, updated_at = NOW() WHERE code = $2 AND deleted_at IS NULL',
      [path, code],
    );
    if (!r.rowCount) missing.push(code);
    updated += r.rowCount ?? 0;
  }

  await c.query('COMMIT');
  console.log(`Updated ${updated} module rows.`);
  if (missing.length) console.warn(`No module found for codes: ${missing.join(', ')}`);
  await c.end();
}

run().catch((e) => {
  console.error('Update failed:', e.message || e);
  process.exit(1);
});
