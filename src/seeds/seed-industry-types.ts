/**
 * Seed: industry_type
 *
 * Inserts a baseline list of 20 common industries. Idempotent.
 *
 * Run from project root:
 *   npx ts-node src/seeds/seed-industry-types.ts
 */

import { createClient, getSchema } from './_db';

const SCHEMA = getSchema();

const INDUSTRIES = [
  'Software & IT',
  'Finance & Banking',
  'Healthcare',
  'Education',
  'Manufacturing',
  'Retail & E-commerce',
  'Consulting',
  'Real Estate',
  'Construction',
  'Hospitality',
  'Logistics & Transportation',
  'Media & Entertainment',
  'Telecommunications',
  'Legal Services',
  'Marketing & Advertising',
  'Non-Profit',
  'Government',
  'Pharmaceutical',
  'Energy & Utilities',
  'Other',
];

async function run() {
  const c = createClient();
  await c.connect();
  await c.query(`SET search_path TO ${SCHEMA}`);

  let inserted = 0;
  let skipped = 0;
  for (const name of INDUSTRIES) {
    const r = await c.query(
      `INSERT INTO industry_type (name, status, created_at, updated_at)
       VALUES ($1, 'ACTIVE', NOW(), NOW())
       ON CONFLICT (name) DO NOTHING`,
      [name],
    );
    if (r.rowCount) inserted++;
    else skipped++;
  }

  console.log(`Industries: ${inserted} inserted, ${skipped} already existed`);
  await c.end();
}

run().catch((e) => {
  console.error('Seed failed:', e.message || e);
  process.exit(1);
});
