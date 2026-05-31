/**
 * Seed: brello_v2 base data
 *
 * Inserts the minimum baseline required before an enterprise can be created:
 *   - Apps: ADMIN, EMPLOYEE
 *   - Actions: 11 system-wide
 *   - Modules: Admin (37) + Employee (12) with parent/child via WBS
 *   - Default roles: SUPER_ADMIN (Admin), EMPLOYEE (Employee)
 *   - module_access: every (role x module x action) for the role's app
 *   - Plans: STANDARD, PREMIUM
 *   - plan_app, plan_module, plan_module_action: both plans include everything
 *
 * Idempotent — safe to re-run.
 *
 * Run from project root:
 *   npx ts-node src/seeds/seed-brello-v2-base.ts
 */

import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();

const ACTIONS = [
  'View',
  'Create',
  'Edit',
  'Update',
  'Delete',
  'Approve',
  'Publish',
  'Archive',
  'Activate',
  'Clone',
  'Export',
];

const APPS = [
  { name: 'ADMIN', description: 'Admin Application', icon: 'Settings', priority: 1 },
  { name: 'EMPLOYEE', description: 'Employee Self-Service', icon: 'User', priority: 2 },
];

type Mod = {
  wbs: string;
  code: string;
  name: string;
  parent_wbs?: string;
  icon?: string;
  path?: string;
};

const ADMIN_MODULES: Mod[] = [
  { wbs: '01', code: 'DASHBOARD', name: 'Dashboard', icon: 'LayoutDashboard', path: '/admin/dashboard' },

  { wbs: '02', code: 'EMPLOYEE', name: 'Employee', icon: 'Users', path: '/admin/employee' },
  { wbs: '02.1', code: 'EMP_DIRECTORY', name: 'Directory', parent_wbs: '02', icon: 'Users', path: '/admin/employee/directory' },
  { wbs: '02.2', code: 'EMP_PROFILE', name: 'Profile', parent_wbs: '02', icon: 'User', path: '/admin/employee/profile' },

  { wbs: '03', code: 'ATTENDANCE', name: 'Attendance', icon: 'Clock', path: '/admin/attendance' },
  { wbs: '03.1', code: 'ATT_DAILY', name: 'Daily', parent_wbs: '03', icon: 'Calendar', path: '/admin/attendance/daily' },

  { wbs: '04', code: 'LEAVE', name: 'Leave', icon: 'CalendarOff', path: '/admin/leave' },
  { wbs: '04.1', code: 'LEAVE_REQUESTS', name: 'Requests', parent_wbs: '04', icon: 'FileText', path: '/admin/leave/requests' },
  { wbs: '04.2', code: 'LEAVE_BALANCES', name: 'Balances', parent_wbs: '04', icon: 'Wallet', path: '/admin/leave/balances' },

  { wbs: '05', code: 'HOLIDAY', name: 'Holidays', icon: 'PartyPopper', path: '/admin/holiday' },

  { wbs: '06', code: 'PAYROLL', name: 'Payroll', icon: 'DollarSign', path: '/admin/payroll' },
  { wbs: '06.1', code: 'PAY_LISTING', name: 'Listing', parent_wbs: '06', icon: 'List', path: '/admin/payroll/listing' },
  { wbs: '06.2', code: 'PAY_PROCESS', name: 'Process', parent_wbs: '06', icon: 'PlayCircle', path: '/admin/payroll/process' },
  { wbs: '06.3', code: 'PAY_PAYSLIP', name: 'Payslips', parent_wbs: '06', icon: 'FileText', path: '/admin/payroll/payslip' },

  { wbs: '07', code: 'REIMBURSEMENT', name: 'Reimbursement', icon: 'Receipt', path: '/admin/reimbursement' },

  { wbs: '08', code: 'PROJECT', name: 'Project', icon: 'Briefcase', path: '/admin/project' },
  { wbs: '08.1', code: 'PROJ_CLIENTS', name: 'Clients', parent_wbs: '08', icon: 'Building', path: '/admin/project/clients' },
  { wbs: '08.2', code: 'PROJ_PROJECTS', name: 'Projects', parent_wbs: '08', icon: 'FolderKanban', path: '/admin/project/projects' },

  { wbs: '09', code: 'HR_LETTERS', name: 'HR Letters', icon: 'FileSignature', path: '/admin/hr-letters' },
  { wbs: '09.1', code: 'HR_OFFER_LETTERS', name: 'External Offer Letters', parent_wbs: '09', icon: 'FileText', path: '/admin/hr-letters/offer' },
  { wbs: '09.2', code: 'HR_INTERNAL_LETTERS', name: 'Internal HR Letters', parent_wbs: '09', icon: 'FileText', path: '/admin/hr-letters/internal' },

  { wbs: '10', code: 'ANNOUNCEMENT', name: 'Announcements', icon: 'Megaphone', path: '/admin/announcement' },

  { wbs: '11', code: 'ORGANISATION', name: 'Organisation', icon: 'Building2', path: '/admin/organisation' },
  { wbs: '11.1', code: 'ORG_DEPARTMENTS', name: 'Departments', parent_wbs: '11', icon: 'Network', path: '/admin/organisation/departments' },
  { wbs: '11.2', code: 'ORG_DESIGNATIONS', name: 'Designations', parent_wbs: '11', icon: 'Award', path: '/admin/organisation/designations' },
  { wbs: '11.3', code: 'ORG_POLICIES', name: 'Policies', parent_wbs: '11', icon: 'Shield', path: '/admin/organisation/policies' },
  { wbs: '11.4', code: 'ORG_LEAVE', name: 'Leave', parent_wbs: '11', icon: 'CalendarOff', path: '/admin/organisation/leave' },
  { wbs: '11.5', code: 'ORG_ATTENDANCE', name: 'Attendance', parent_wbs: '11', icon: 'Clock', path: '/admin/organisation/attendance' },
  { wbs: '11.6', code: 'ORG_PAYROLL', name: 'Payroll', parent_wbs: '11', icon: 'DollarSign', path: '/admin/organisation/payroll' },

  { wbs: '12', code: 'ACCESS', name: 'Access', icon: 'Lock', path: '/admin/access' },
  { wbs: '12.1', code: 'ACCESS_USERS', name: 'Users', parent_wbs: '12', icon: 'Users', path: '/admin/access/users' },
  { wbs: '12.2', code: 'ACCESS_ROLES', name: 'Roles', parent_wbs: '12', icon: 'UserCog', path: '/admin/access/roles' },
  { wbs: '12.3', code: 'ACCESS_PERMISSIONS', name: 'Permissions', parent_wbs: '12', icon: 'Key', path: '/admin/access/permissions' },

  { wbs: '13', code: 'BILLING', name: 'Billing', icon: 'CreditCard', path: '/admin/billing' },
  { wbs: '13.1', code: 'BILLING_PLAN', name: 'Current Plan', parent_wbs: '13', icon: 'Tag', path: '/admin/billing/plan' },
  { wbs: '13.2', code: 'BILLING_INVOICES', name: 'Invoices', parent_wbs: '13', icon: 'FileText', path: '/admin/billing/invoices' },
  { wbs: '13.3', code: 'BILLING_HISTORY', name: 'Payment History', parent_wbs: '13', icon: 'History', path: '/admin/billing/history' },
];

const EMPLOYEE_MODULES: Mod[] = [
  { wbs: '01', code: 'EMP_DASHBOARD', name: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
  { wbs: '02', code: 'EMP_PROFILE', name: 'Profile', icon: 'User', path: '/profile' },
  { wbs: '03', code: 'EMP_ATTENDANCE', name: 'Attendance', icon: 'Clock', path: '/attendance' },
  { wbs: '04', code: 'EMP_TIMESHEET', name: 'Timesheet', icon: 'ClipboardList', path: '/timesheet' },
  { wbs: '05', code: 'EMP_LEAVE', name: 'Leave', icon: 'CalendarOff', path: '/leave' },
  { wbs: '06', code: 'EMP_HOLIDAY', name: 'Holiday Listing', icon: 'PartyPopper', path: '/holiday' },
  { wbs: '07', code: 'EMP_REIMBURSEMENT', name: 'Reimbursement', icon: 'Receipt', path: '/reimbursement' },
  { wbs: '08', code: 'EMP_PAYSLIP', name: 'Payslip', icon: 'FileText', path: '/payslip' },
  { wbs: '09', code: 'EMP_PROJECT', name: 'Project', icon: 'Briefcase', path: '/project' },
  { wbs: '10', code: 'EMP_HR_LETTERS', name: 'HR Letters', icon: 'FileSignature', path: '/hr-letters' },
  { wbs: '11', code: 'EMP_POLICY', name: 'Company Policy', icon: 'Shield', path: '/policy' },
  { wbs: '12', code: 'EMP_ANNOUNCEMENT', name: 'Announcements', icon: 'Megaphone', path: '/announcement' },
];

const PLANS = [
  {
    name: 'Free',
    price: 0,
    price_per_employee_annual: 0,
    annual_discount_percent: 0,
    tier_rank: 0,
    description: 'Perfect for exploring Brello and managing basic HR needs.',
    feature: [
      'Employee directory & profiles',
      'Basic attendance tracking',
      'Leave management',
      'Holiday calendar',
      '1 admin user',
      'Email support'
    ]
  },
  {
    name: 'Standard',
    price: 99,
    // 10 months billed annually (2 months free) → 99 × 10 = 990 / 12 = 82.50 per employee per month equivalent.
    price_per_employee_annual: 990,
    annual_discount_percent: 16.67,
    tier_rank: 1,
    description: 'Everything you need to run HR for a growing company.',
    feature: [
      'Everything in Free',
      'Payroll processing',
      'Statutory compliance (PF, ESI, TDS)',
      'Geofencing attendance',
      'Custom leave policies',
      'Reimbursements',
      'Advanced reports & exports',
      '5 admin users',
      'Priority support'
    ]
  },
  {
    name: 'Premium',
    price: 149,
    price_per_employee_annual: 1490,
    annual_discount_percent: 16.67,
    tier_rank: 2,
    description: 'For larger teams with complex HR and payroll needs.',
    feature: [
      'Everything in Standard',
      'Multiple payroll cycles',
      'Department-wise policies',
      'Role-based access control',
      'API access',
      'Biometric integration',
      '15 admin users',
      'Dedicated account manager',
      'SLA guarantee'
    ]
  }
];

const DEFAULT_ROLES = [
  { app: 'ADMIN', name: 'SUPER_ADMIN' },
  { app: 'EMPLOYEE', name: 'EMPLOYEE' },
];

const client = createClient();

async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const r = await client.query(sql, params);
  return r.rows as T[];
}

async function upsertApp(a: typeof APPS[number]): Promise<string> {
  const existing = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.app WHERE name = $1 AND deleted_at IS NULL`,
    [a.name],
  );
  if (existing.length) return existing[0].id;
  const [row] = await q<{ id: string }>(
    `INSERT INTO ${SCHEMA}.app (name, description, icon, priority, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())
     RETURNING id`,
    [a.name, a.description, a.icon, a.priority],
  );
  return row.id;
}

async function upsertAction(name: string): Promise<string> {
  const existing = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.actions WHERE name = $1 AND deleted_at IS NULL`,
    [name],
  );
  if (existing.length) return existing[0].id;
  const [row] = await q<{ id: string }>(
    `INSERT INTO ${SCHEMA}.actions (name, code, status, created_at, updated_at)
     VALUES ($1, $2, 'ACTIVE', NOW(), NOW())
     RETURNING id`,
    [name, name.toLowerCase()],
  );
  return row.id;
}

async function upsertModule(
  appId: string,
  m: Mod,
  parentId: string | null,
): Promise<string> {
  const existing = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.modules WHERE app_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [appId, m.code],
  );
  if (existing.length) return existing[0].id;
  const type = m.parent_wbs ? 'submod' : 'mod';
  const [row] = await q<{ id: string }>(
    `INSERT INTO ${SCHEMA}.modules
       (name, code, app_id, wbs_code, parent_id, type, icon, path, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', NOW(), NOW())
     RETURNING id`,
    [m.name, m.code, appId, m.wbs, parentId, type, m.icon ?? null, m.path ?? null],
  );
  return row.id;
}

async function upsertRole(appId: string, name: string): Promise<string> {
  const existing = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.role
     WHERE name = $1 AND app_id = $2 AND organization_id IS NULL AND deleted_at IS NULL`,
    [name, appId],
  );
  if (existing.length) return existing[0].id;
  const [row] = await q<{ id: string }>(
    `INSERT INTO ${SCHEMA}.role
       (name, app_id, is_system_role, is_default, status, created_at, updated_at)
     VALUES ($1, $2, TRUE, TRUE, 'ACTIVE', NOW(), NOW())
     RETURNING id`,
    [name, appId],
  );
  return row.id;
}

async function upsertPlan(p: typeof PLANS[number]): Promise<string> {
  const existing = await q<{ id: string }>(
    `SELECT id FROM ${SCHEMA}.plan WHERE name = $1 AND deleted_at IS NULL`,
    [p.name],
  );
  if (existing.length) {
    await client.query(
      `UPDATE ${SCHEMA}.plan
         SET price = $2,
             price_per_employee_annual = $3,
             annual_discount_percent = $4,
             tier_rank = $5,
             description = $6,
             feature = $7
       WHERE id = $1`,
      [existing[0].id, p.price, p.price_per_employee_annual, p.annual_discount_percent, p.tier_rank, p.description, p.feature],
    );
    return existing[0].id;
  }
  const [row] = await q<{ id: string }>(
    `INSERT INTO ${SCHEMA}.plan
       (name, price, price_per_employee_annual, annual_discount_percent, tier_rank,
        billing_cycle_default, description, discount, feature, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'Monthly', $6, 0, $7, 'ACTIVE', NOW(), NOW())
     RETURNING id`,
    [p.name, p.price, p.price_per_employee_annual, p.annual_discount_percent, p.tier_rank, p.description, p.feature],
  );
  return row.id;
}

async function seedModulesForApp(appId: string, modules: Mod[]): Promise<Record<string, string>> {
  const wbsToId: Record<string, string> = {};
  // top-level first, then submods (relies on parent_wbs being set on submods only)
  const tops = modules.filter((m) => !m.parent_wbs);
  const subs = modules.filter((m) => !!m.parent_wbs);
  for (const m of tops) {
    wbsToId[m.wbs] = await upsertModule(appId, m, null);
  }
  for (const m of subs) {
    const parentId = wbsToId[m.parent_wbs!];
    if (!parentId) throw new Error(`Parent WBS ${m.parent_wbs} not found for module ${m.code}`);
    wbsToId[m.wbs] = await upsertModule(appId, m, parentId);
  }
  return wbsToId;
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

async function planLink(planId: string, appIds: string[], moduleIds: string[], actionIds: string[]): Promise<void> {
  for (const appId of appIds) {
    await client.query(
      `INSERT INTO ${SCHEMA}.plan_app (plan_id, app_id, is_active, status, created_at, updated_at)
       VALUES ($1, $2, TRUE, 'ACTIVE', NOW(), NOW())
       ON CONFLICT (plan_id, app_id) DO NOTHING`,
      [planId, appId],
    );
  }
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
  console.log(`Seeding ${SCHEMA}...`);

  // 1. Apps
  const appIds: Record<string, string> = {};
  for (const a of APPS) {
    appIds[a.name] = await upsertApp(a);
  }
  console.log(`Apps:    ${Object.entries(appIds).map(([k, v]) => `${k}=${v.slice(0, 8)}`).join(', ')}`);

  // 2. Actions
  const actionIds: string[] = [];
  for (const n of ACTIONS) actionIds.push(await upsertAction(n));
  console.log(`Actions: ${ACTIONS.length} ready`);

  // 3. Modules
  const adminModuleMap = await seedModulesForApp(appIds.ADMIN, ADMIN_MODULES);
  const empModuleMap = await seedModulesForApp(appIds.EMPLOYEE, EMPLOYEE_MODULES);
  const adminModuleIds = Object.values(adminModuleMap);
  const empModuleIds = Object.values(empModuleMap);
  console.log(`Modules: ${adminModuleIds.length} admin + ${empModuleIds.length} employee`);

  // 4. Default roles
  const roleIds: Record<string, string> = {};
  for (const r of DEFAULT_ROLES) roleIds[r.name] = await upsertRole(appIds[r.app], r.name);
  console.log(`Roles:   ${Object.keys(roleIds).join(', ')}`);

  // 5. module_access (full grant on own app)
  const adminGranted = await grantAll(roleIds.SUPER_ADMIN, adminModuleIds, actionIds);
  const empGranted = await grantAll(roleIds.EMPLOYEE, empModuleIds, actionIds);
  console.log(`Access:  SUPER_ADMIN +${adminGranted}, EMPLOYEE +${empGranted} module_access rows`);

  // 6. Plans + plan_app + plan_module + plan_module_action
  const allAppIds = Object.values(appIds);
  const freeWbs = [
    '01', // Dashboard
    '02', '02.1', '02.2', // Employee
    '03', '03.1', // Attendance
    '04', '04.1', '04.2', // Leave
    '05', // Holiday
    '10', // Announcement
    '11', '11.1', '11.2', '11.4', '11.5', // Org (basic)
    '12', '12.1', '12.2', // Access basic
    '13', '13.1', '13.2', '13.3', // Billing
  ];
  const standardWbs = [
    ...freeWbs,
    '06', '06.1', '06.2', '06.3', // Payroll
    '07', // Reimbursement
    '11.3', '11.6', // Org advanced
  ];
  const premiumWbs = [
    ...standardWbs,
    '08', '08.1', '08.2', // Project
    '09', '09.1', '09.2', // HR Letters
    '12.3', // Access Permissions
  ];

  for (const p of PLANS) {
    const planId = await upsertPlan(p);
    
    let allowedAdminWbs = premiumWbs;
    if (p.name === 'Free') allowedAdminWbs = freeWbs;
    if (p.name === 'Standard') allowedAdminWbs = standardWbs;

    const allowedAdminModules = allowedAdminWbs.map(w => adminModuleMap[w]).filter(Boolean);
    const planModuleIds = [...allowedAdminModules, ...empModuleIds];
    
    await planLink(planId, allAppIds, planModuleIds, actionIds);
    console.log(`Plan ${p.name}: linked ${allAppIds.length} apps, ${planModuleIds.length} modules, ${actionIds.length} actions each`);
  }

  console.log('\nDone.');
}

run()
  .catch((e) => {
    console.error('Seed failed:', e.message || e);
    process.exit(1);
  })
  .finally(() => client.end());
