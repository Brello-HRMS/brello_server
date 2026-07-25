import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();
const client = createClient();

async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const r = await client.query(sql, params);
  return r.rows as T[];
}

async function run() {
  await client.connect();
  console.log(`Syncing existing modules to global_search_documents in ${SCHEMA}...`);

  // Helper to upsert
  const upsert = async (
    enterprise_id: string, organization_id: string | null, entity_id: string, entity_type: string, module_key: string,
    title: string, subtitle: string, keywords: string, route: string, permissions: string[]
  ) => {
    if (!enterprise_id) return;
    await client.query(`
      INSERT INTO ${SCHEMA}.global_search_documents (
        enterprise_id, organization_id, entity_id, entity_type, module_key, 
        title, subtitle, keywords, route, permissions, is_active, is_deleted, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, false, NOW(), NOW())
      ON CONFLICT (enterprise_id, entity_id, entity_type) 
      DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        module_key = EXCLUDED.module_key,
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        keywords = EXCLUDED.keywords,
        route = EXCLUDED.route,
        permissions = EXCLUDED.permissions,
        is_active = EXCLUDED.is_active,
        is_deleted = EXCLUDED.is_deleted,
        updated_at = NOW();
    `, [enterprise_id, organization_id, entity_id, entity_type, module_key, title, subtitle, keywords, route, permissions]);
  };

  // 1. Departments
  const depts = await q(`SELECT id, enterprise_id, organization_id, name, description FROM ${SCHEMA}.departments WHERE deleted_at IS NULL`);
  for (const d of depts) {
    await upsert(d.enterprise_id, d.organization_id, d.id, 'department', 'departments', d.name, d.description || '', d.name, `/organisation/departments/${d.id}`, ['ORG_DEPARTMENTS']);
  }
  console.log(`Synced ${depts.length} departments.`);

  // 2. Employees (Users)
  const users = await q(`SELECT id, enterprise_id, organization_id, first_name, middle_name, last_name, email FROM ${SCHEMA}.users WHERE deleted_at IS NULL AND is_platform_admin = false`);
  for (const u of users) {
    const fullName = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ');
    await upsert(u.enterprise_id, u.organization_id, u.id, 'employee', 'employees', fullName, u.email, `${fullName} ${u.email}`, `/employee/profile/${u.id}`, ['EMP_DIRECTORY']);
  }
  console.log(`Synced ${users.length} employees.`);

  // 3. Designations
  const desigs = await q(`SELECT id, enterprise_id, organization_id, title, description FROM ${SCHEMA}.designations WHERE deleted_at IS NULL`);
  for (const d of desigs) {
    await upsert(d.enterprise_id, d.organization_id, d.id, 'designation', 'designations', d.title, d.description || '', d.title, `/organisation/designations/${d.id}`, ['ORG_DESIGNATIONS']);
  }
  console.log(`Synced ${desigs.length} designations.`);

  // 4. Clients
  try {
    const clients = await q(`SELECT id, enterprise_id, organization_id, name, poc_name, poc_email FROM ${SCHEMA}.clients WHERE deleted_at IS NULL`);
    for (const c of clients) {
      const subtitle = c.poc_name || c.poc_email || '';
      const keywords = [c.name, c.poc_name, c.poc_email].filter(Boolean).join(' ');
      await upsert(c.enterprise_id, c.organization_id, c.id, 'client', 'clients', c.name, subtitle, keywords, `/project/clients/${c.id}`, ['PROJECT_CLIENTS']);
    }
    console.log(`Synced ${clients.length} clients.`);
  } catch(e) { console.log(`Clients skipped: ${e.message}`); }

  // 5. Projects
  try {
    const projs = await q(`SELECT id, enterprise_id, organization_id, name, client_id, status FROM ${SCHEMA}.projects WHERE deleted_at IS NULL`);
    for (const p of projs) {
      await upsert(p.enterprise_id, p.organization_id, p.id, 'project', 'projects', p.name, p.status || '', p.name, `/project/clients/${p.client_id}/projects/${p.id}`, ['PROJECT_PROJECTS']);
    }
    console.log(`Synced ${projs.length} projects.`);
  } catch(e) { console.log(`Projects skipped: ${e.message}`); }

  // 6. Announcements
  try {
    const anns = await q(`SELECT id, enterprise_id, organization_id, title, priority FROM ${SCHEMA}.announcements WHERE deleted_at IS NULL`);
    for (const a of anns) {
      await upsert(a.enterprise_id, a.organization_id, a.id, 'announcement', 'announcements', a.title, a.priority || '', a.title, `/announcements/list`, ['ANNOUNCEMENT']);
    }
    console.log(`Synced ${anns.length} announcements.`);
  } catch(e) { console.log(`Announcements skipped: ${e.message}`); }

  // 7. Policies
  try {
    const pols = await q(`SELECT id, enterprise_id, organization_id, title, description FROM ${SCHEMA}.company_policies WHERE deleted_at IS NULL`);
    for (const p of pols) {
      await upsert(p.enterprise_id, p.organization_id, p.id, 'company_policy', 'company_policies', p.title, p.description || '', p.title, `/organisation/policies`, ['ORG_POLICIES']);
    }
    console.log(`Synced ${pols.length} policies.`);
  } catch(e) { console.log(`Policies skipped: ${e.message}`); }

  // 8. Roles
  try {
    const roles = await q(`SELECT id, enterprise_id, organization_id, name, description FROM ${SCHEMA}.role WHERE deleted_at IS NULL`);
    for (const r of roles) {
      await upsert(r.enterprise_id, r.organization_id, r.id, 'role', 'roles', r.name, r.description || '', r.name, `/access/roles`, ['ACCESS_ROLES']);
    }
    console.log(`Synced ${roles.length} roles.`);
  } catch(e) { console.log(`Roles skipped: ${e.message}`); }

  // 9. Holidays
  try {
    const hols = await q(`SELECT id, enterprise_id, organization_id, name, calendar_id, type FROM ${SCHEMA}.holidays WHERE deleted_at IS NULL`);
    for (const h of hols) {
      await upsert(h.enterprise_id, h.organization_id, h.id, 'holiday', 'holidays', h.name, h.type || '', h.name, `/attendance/holidays/${h.calendar_id}`, ['LEAVE_HOLIDAYS']);
    }
    console.log(`Synced ${hols.length} holidays.`);
  } catch(e) { console.log(`Holidays skipped: ${e.message}`); }

  // 10. Reimbursements
  try {
    const reims = await q(`SELECT id, enterprise_id, organization_id, title, amount, currency FROM ${SCHEMA}.reimbursement WHERE deleted_at IS NULL`);
    for (const r of reims) {
      const subtitle = r.amount !== undefined && r.amount !== null ? `${r.currency || 'INR'} ${r.amount}` : '';
      await upsert(r.enterprise_id, r.organization_id, r.id, 'reimbursement', 'reimbursements', r.title, subtitle, r.title, `/reimbursement/list`, ['REIMBURSEMENT']);
    }
    console.log(`Synced ${reims.length} reimbursements.`);
  } catch(e) { console.log(`Reimbursements skipped: ${e.message}`); }

  // Update search vectors
  console.log(`Updating search_vectors...`);
  await client.query(`
    UPDATE ${SCHEMA}.global_search_documents
    SET search_vector = to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(keywords, '')
    )
  `);

  console.log('\nDone. Global Search indexed successfully.');
}

run()
  .catch((e) => {
    console.error('Seed failed:', e.message || e);
    process.exit(1);
  })
  .finally(() => client.end());
