/**
 * Seeds dummy data for testing the Payroll Processing APIs end-to-end.
 *
 * Creates, in your target organization:
 *   - 4 employees (users + EMPLOYEE profiles)
 *   - an active salary structure + components for each (Basic / HRA / Special /
 *     Professional Tax) so processing produces real gross / PF / net
 *   - a PF config (if the org has none)
 *   - a full month of attendance (weekdays PRESENT, weekends WEEKLY_OFF, with a
 *     couple of ABSENT days and a HALF_DAY so LOP is exercised)
 *   - 2 approved reimbursements (to exercise reimbursement-to-net)
 *
 * It is idempotent — re-running cleans the previous seed (fixed employee ids)
 * and re-inserts.
 *
 * Usage:
 *   # auto-detects the org with the most users:
 *   npx ts-node src/seeds/seed-payroll-test-data.ts
 *
 *   # or pin the org + pay-period month explicitly:
 *   PAYROLL_ORG_ID=... PAYROLL_ENTERPRISE_ID=... PAYROLL_MONTH=2026-05 \
 *     npx ts-node src/seeds/seed-payroll-test-data.ts
 *
 *   # override schema:
 *   DB_SCHEMA=brello_dev npx ts-node src/seeds/seed-payroll-test-data.ts
 */
import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();

// Fixed ids so re-runs are clean.
const EMPLOYEES = [
  { id: '11111111-1111-4111-8111-000000000001', first: 'Asha', last: 'Rao', code: 'PRT-001', ctc: 720000,
    components: [['Basic', 'earning', 30000], ['HRA', 'earning', 15000], ['Special Allowance', 'earning', 13000], ['Professional Tax', 'deduction', 200]] },
  { id: '11111111-1111-4111-8111-000000000002', first: 'Vikram', last: 'Singh', code: 'PRT-002', ctc: 600000,
    components: [['Basic', 'earning', 25000], ['HRA', 'earning', 12500], ['Special Allowance', 'earning', 12300], ['Professional Tax', 'deduction', 200]] },
  { id: '11111111-1111-4111-8111-000000000003', first: 'Neha', last: 'Patel', code: 'PRT-003', ctc: 900000,
    components: [['Basic', 'earning', 37500], ['HRA', 'earning', 18750], ['Special Allowance', 'earning', 18550], ['Professional Tax', 'deduction', 200]] },
  { id: '11111111-1111-4111-8111-000000000004', first: 'Imran', last: 'Khan', code: 'PRT-004', ctc: 540000,
    components: [['Basic', 'earning', 22500], ['HRA', 'earning', 11250], ['Special Allowance', 'earning', 11050], ['Professional Tax', 'deduction', 200]] },
] as const;

const PROFILE_IDS = EMPLOYEES.map((_, i) => `22222222-2222-4222-8222-00000000000${i + 1}`);

function parseMonth(): { year: number; monthIndex: number; label: string } {
  const raw = process.env.PAYROLL_MONTH ?? '2026-05';
  const [y, m] = raw.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`Invalid PAYROLL_MONTH "${raw}" (expected YYYY-MM)`);
  return { year: y, monthIndex: m - 1, label: raw };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

async function main(): Promise<void> {
  const client = createClient();
  await client.connect();
  await client.query(`SET search_path TO ${SCHEMA}, public`);

  try {
    // 1. Resolve target enterprise + organization.
    let enterpriseId = process.env.PAYROLL_ENTERPRISE_ID ?? null;
    let organizationId = process.env.PAYROLL_ORG_ID ?? null;

    if (!organizationId) {
      const { rows } = await client.query(
        `SELECT enterprise_id, organization_id, COUNT(*) AS c
           FROM users
          WHERE organization_id IS NOT NULL
          GROUP BY enterprise_id, organization_id
          ORDER BY c DESC
          LIMIT 1`,
      );
      if (!rows.length) throw new Error('No organizations with users found. Set PAYROLL_ORG_ID / PAYROLL_ENTERPRISE_ID.');
      enterpriseId = rows[0].enterprise_id;
      organizationId = rows[0].organization_id;
    }
    console.log(`→ Target org: ${organizationId} (enterprise ${enterpriseId})`);

    const { year, monthIndex, label } = parseMonth();
    const ids = EMPLOYEES.map((e) => e.id);

    await client.query('BEGIN');

    // 2. Clean previous seed (fixed ids).
    await client.query(
      `DELETE FROM employee_salary_components
        WHERE employee_salary_id IN (SELECT id FROM employee_salary WHERE user_id = ANY($1))`,
      [ids],
    );
    await client.query(`DELETE FROM employee_salary WHERE user_id = ANY($1)`, [ids]);
    await client.query(`DELETE FROM attendance_records WHERE employee_id = ANY($1)`, [ids]);
    await client.query(`DELETE FROM reimbursement WHERE employee_id = ANY($1)`, [ids]);

    // 3. Employees: profile + user (upsert by id).
    for (let i = 0; i < EMPLOYEES.length; i++) {
      const e = EMPLOYEES[i];
      const profileId = PROFILE_IDS[i];
      const email = `payroll.test${i + 1}@brello.test`;

      await client.query(
        `INSERT INTO user_profile (id, employee_id, type, email, employee_status, enterprise_id, organization_id, status, created_at, updated_at)
         VALUES ($1,$2,'EMPLOYEE',$3,'ACTIVE',$4,$5,'ACTIVE',now(),now())
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, employee_id = EXCLUDED.employee_id,
           organization_id = EXCLUDED.organization_id, enterprise_id = EXCLUDED.enterprise_id`,
        [profileId, e.code, email, enterpriseId, organizationId],
      );

      await client.query(
        `INSERT INTO users (id, first_name, last_name, email, user_profile_id, enterprise_id, organization_id, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE',now(),now())
         ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
           user_profile_id = EXCLUDED.user_profile_id, organization_id = EXCLUDED.organization_id,
           enterprise_id = EXCLUDED.enterprise_id`,
        [e.id, e.first, e.last, email, profileId, enterpriseId, organizationId],
      );

      // 4. Salary structure + components.
      const { rows: salRows } = await client.query(
        `INSERT INTO employee_salary (id, user_id, version_number, ctc, effective_from, is_active, enterprise_id, organization_id, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 1, $2, '2024-01-01', true, $3, $4, 'ACTIVE', now(), now())
         RETURNING id`,
        [e.id, e.ctc, enterpriseId, organizationId],
      );
      const salaryId = salRows[0].id;
      let priority = 0;
      for (const [name, type, value] of e.components) {
        await client.query(
          `INSERT INTO employee_salary_components (id, employee_salary_id, component_name, component_type, value, calculation_type, is_residual, calculation_priority, enterprise_id, organization_id, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'fixed', false, $5, $6, $7, 'ACTIVE', now(), now())`,
          [salaryId, name, type, value, priority++, enterpriseId, organizationId],
        );
      }
    }

    // 5. PF config (only if the org has none).
    const { rows: pfRows } = await client.query(
      `SELECT id FROM pf_config WHERE organization_id = $1 LIMIT 1`,
      [organizationId],
    );
    if (!pfRows.length) {
      await client.query(
        `INSERT INTO pf_config (id, employee_contribution, employer_contribution, minimum_salary_threshold, is_enabled, effective_from, enterprise_id, organization_id, status, created_at, updated_at)
         VALUES (gen_random_uuid(), 12, 12, 15000, true, '2024-01-01', $1, $2, 'ACTIVE', now(), now())`,
        [enterpriseId, organizationId],
      );
      console.log('→ Inserted PF config (12% / 12%, threshold 15000)');
    } else {
      console.log('→ PF config already present, left as-is');
    }

    // 6. Attendance for the pay-period month.
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let attRows = 0;
    for (let i = 0; i < EMPLOYEES.length; i++) {
      const e = EMPLOYEES[i];
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${year}-${pad(monthIndex + 1)}-${pad(d)}`;
        const dow = new Date(Date.UTC(year, monthIndex, d)).getUTCDay();
        let status = dow === 0 || dow === 6 ? 'WEEKLY_OFF' : 'PRESENT';

        // Inject a couple of exceptions to exercise LOP / half-day.
        if (i === 1 && (d === 3 || d === 4) && status === 'PRESENT') status = 'ABSENT';
        if (i === 2 && d === 5 && status === 'PRESENT') status = 'HALF_DAY';

        const worked = status === 'PRESENT' ? 480 : status === 'HALF_DAY' ? 240 : 0;
        await client.query(
          `INSERT INTO attendance_records (id, employee_id, date, attendance_status, worked_minutes, is_half_day, source, is_deleted, enterprise_id, organization_id, status, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'WEB', false, $6, $7, 'ACTIVE', now(), now())`,
          [e.id, date, status, worked, status === 'HALF_DAY', enterpriseId, organizationId],
        );
        attRows++;
      }
    }

    // 7. Approved reimbursements for the first employee.
    const reimb = [
      ['Client dinner', 2500],
      ['Travel — cab fare', 1800],
    ] as const;
    for (const [title, amount] of reimb) {
      await client.query(
        `INSERT INTO reimbursement (id, employee_id, title, expense_date, amount, currency, reimb_status, is_paid, created_by, version, enterprise_id, organization_id, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'INR', 'Approved', false, $1, 1, $5, $6, 'ACTIVE', now(), now())`,
        [EMPLOYEES[0].id, title, `${year}-${pad(monthIndex + 1)}-10`, amount, enterpriseId, organizationId],
      );
    }

    await client.query('COMMIT');

    console.log('\n✅ Payroll test data seeded.');
    console.log(`   Employees : ${EMPLOYEES.length}`);
    console.log(`   Attendance: ${attRows} rows for ${label}`);
    console.log(`   Reimburse : 2 approved (employee Asha Rao)`);
    console.log('\nNext — test the flow:');
    console.log(`   POST /payroll/runs            { "month": "${monthName(monthIndex)}", "year": ${year} }`);
    console.log(`   POST /payroll/runs/:id/prepare`);
    console.log(`   GET  /payroll/runs/:id/validation`);
    console.log(`   POST /payroll/runs/:id/process`);
    console.log(`   POST /payroll/runs/:id/lock`);
    console.log(`   POST /payroll/runs/:id/disburse`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

function monthName(idx: number): string {
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][idx];
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
