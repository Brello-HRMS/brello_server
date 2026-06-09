/**
 * Registers the Payroll Processing RBAC modules and grants them to a user.
 *
 * The payroll-run endpoints are guarded with @RequirePermission on the module
 * codes PAY_LISTING / PAY_PROCESS / PAY_PAYSLIP. On databases seeded before those
 * modules existed, the AccessGuard returns 403. This script:
 *   1. ensures those three modules exist in the user's app
 *   2. grants every action on them to each of the user's active roles
 *   3. enables them in the org's active subscription plan (plan gate)
 *
 * Usage:
 *   PAYROLL_ADMIN_EMAIL=mohd.samir@brello.co.in \
 *   PAYROLL_ORG_ID=09f21c2a-c73b-4ce1-a4ef-03cd0294ffd5 \
 *     npx ts-node src/seeds/seed-payroll-permissions.ts
 */
import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();
const EMAIL = process.env.PAYROLL_ADMIN_EMAIL ?? 'mohd.samir@brello.co.in';
const ORG = process.env.PAYROLL_ORG_ID ?? '09f21c2a-c73b-4ce1-a4ef-03cd0294ffd5';

const MODULES = [
  { code: 'PAY_LISTING', name: 'Payroll Listing' },
  { code: 'PAY_PROCESS', name: 'Payroll Process' },
  { code: 'PAY_PAYSLIP', name: 'Payslips' },
];

async function main(): Promise<void> {
  const c = createClient();
  await c.connect();
  await c.query(`SET search_path TO ${SCHEMA}, public`);

  try {
    const u = await c.query(
      `SELECT id, enterprise_id, last_access_app_id FROM users WHERE email=$1`,
      [EMAIL],
    );
    if (!u.rowCount) throw new Error(`User ${EMAIL} not found`);
    const userId = u.rows[0].id;
    const enterpriseId = u.rows[0].enterprise_id;

    let appId: string | null = u.rows[0].last_access_app_id;
    if (!appId) {
      const a = await c.query(
        `SELECT r.app_id FROM user_role_map urm JOIN role r ON r.id=urm.role_id
          WHERE urm.user_id=$1 AND urm.organization_id=$2 AND r.status='ACTIVE'
          ORDER BY urm.created_at ASC LIMIT 1`,
        [userId, ORG],
      );
      appId = a.rows[0]?.app_id ?? null;
    }
    if (!appId) throw new Error('Could not resolve app_id (user has no active roles)');

    const roles = await c.query(
      `SELECT urm.role_id FROM user_role_map urm JOIN role r ON r.id=urm.role_id
        WHERE urm.user_id=$1 AND urm.organization_id=$2 AND r.app_id=$3 AND r.status='ACTIVE'`,
      [userId, ORG, appId],
    );
    if (!roles.rowCount) throw new Error('User has no active roles in this app');

    const actions = await c.query(`SELECT id FROM actions WHERE status='ACTIVE'`);
    const actionIds = actions.rows.map((r: { id: string }) => r.id);

    const plan = await c.query(
      `SELECT plan_id FROM organization_subscription
        WHERE organization_id=$1 AND sub_status='Active'
        ORDER BY start_date DESC LIMIT 1`,
      [ORG],
    );
    const planId: string | null = plan.rows[0]?.plan_id ?? null;

    // Next integer wbs_code, mirroring grant-module-access.sql.
    const wbs = await c.query(
      `SELECT COALESCE(MAX((wbs_code)::int),0) AS m FROM modules
        WHERE app_id=$1 AND wbs_code ~ '^\\d+$'`,
      [appId],
    );
    let nextWbs = Number(wbs.rows[0].m) + 1;

    await c.query('BEGIN');
    let grantRows = 0;
    let planRows = 0;

    for (const mod of MODULES) {
      let moduleId: string;
      const existing = await c.query(
        `SELECT id FROM modules WHERE app_id=$1 AND code=$2`,
        [appId, mod.code],
      );
      if (existing.rowCount) {
        moduleId = existing.rows[0].id;
      } else {
        const ins = await c.query(
          `INSERT INTO modules (id, app_id, code, name, wbs_code, type, status, organization_id, enterprise_id, modified_by)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'mod', 'ACTIVE', NULL, NULL, $5)
           RETURNING id`,
          [appId, mod.code, mod.name, String(nextWbs++), userId],
        );
        moduleId = ins.rows[0].id;
        console.log(`  + created module ${mod.code}`);
      }

      for (const role of roles.rows) {
        for (const actionId of actionIds) {
          await c.query(
            `INSERT INTO module_access (id, role_id, module_id, action_id, access_flag)
             VALUES (gen_random_uuid(), $1, $2, $3, true)
             ON CONFLICT (role_id, module_id, action_id) DO UPDATE SET access_flag=true`,
            [role.role_id, moduleId, actionId],
          );
          grantRows++;
        }
      }

      if (planId) {
        await c.query(
          `INSERT INTO plan_module (id, plan_id, module_id, enabled, status, organization_id, enterprise_id, modified_by)
           VALUES (gen_random_uuid(), $1, $2, true, 'ACTIVE', $3, $4, $5)
           ON CONFLICT (plan_id, module_id) DO UPDATE SET enabled=true`,
          [planId, moduleId, ORG, enterpriseId, userId],
        );
        for (const actionId of actionIds) {
          await c.query(
            `INSERT INTO plan_module_action (id, plan_id, module_id, action_id, enabled, status, organization_id, enterprise_id, modified_by)
             VALUES (gen_random_uuid(), $1, $2, $3, true, 'ACTIVE', $4, $5, $6)
             ON CONFLICT (plan_id, module_id, action_id) DO UPDATE SET enabled=true`,
            [planId, moduleId, actionId, ORG, enterpriseId, userId],
          );
          planRows++;
        }
      }
      console.log(`  ✓ granted ${mod.code} to ${roles.rowCount} role(s)`);
    }

    await c.query('COMMIT');
    console.log(
      `\n✅ Done. module_access: ${grantRows}, plan_module_action: ${planRows}, ` +
        `plan=${planId ?? 'none (resolver passes through plan gate)'}`,
    );
    console.log('Re-login (or refresh token) so the new permissions load, then retry.');
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  } finally {
    await c.end();
  }
}

main().catch((err) => {
  console.error('Grant failed:', err);
  process.exit(1);
});
