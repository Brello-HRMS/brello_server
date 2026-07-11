/**
 * Backfills the starter letter categories/templates (see
 * ../modules/letter-management/shared/seed/starter-letter-content.ts) into
 * every organization that has zero letter categories today.
 *
 * organization.service.ts seeds these automatically for orgs created after
 * this feature shipped — this script exists purely to catch up orgs that
 * were created before that, or the local dev org(s) you're testing with.
 *
 * Safe to re-run: an org is only seeded if it currently has zero rows in
 * letter_categories, so it never duplicates content for an org that already
 * built its own categories/templates.
 *
 * Usage:
 *   npx ts-node src/seeds/backfill-starter-letter-content.ts
 *   DB_SCHEMA=brello_dev npx ts-node src/seeds/backfill-starter-letter-content.ts
 */
import { createClient, getSchema } from './_db';
import { STARTER_LETTER_CATEGORIES } from '../modules/letter-management/shared/seed/starter-letter-content';
import { extractVariableKeys } from '../modules/letter-management/shared/registry/variable-registry';

const SCHEMA = getSchema();

async function main(): Promise<void> {
  const client = createClient();
  await client.connect();
  await client.query(`SET search_path TO ${SCHEMA}, public`);

  try {
    const { rows: orgs } = await client.query(
      `SELECT o.id AS organization_id, o.enterprise_id
         FROM organizations o
        WHERE NOT EXISTS (
          SELECT 1 FROM letter_categories lc WHERE lc.organization_id = o.id
        )`,
    );

    if (!orgs.length) {
      console.log(
        'No organizations without letter categories — nothing to do.',
      );
      return;
    }

    console.log(
      `→ Seeding starter letter content for ${orgs.length} organization(s)...`,
    );

    for (const org of orgs) {
      const { organization_id: organizationId, enterprise_id: enterpriseId } =
        org;

      await client.query('BEGIN');
      try {
        for (const categorySeed of STARTER_LETTER_CATEGORIES) {
          const { rows: catRows } = await client.query(
            `INSERT INTO letter_categories (id, name, description, organization_id, enterprise_id, status, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ACTIVE', now(), now())
             RETURNING id`,
            [
              categorySeed.name,
              categorySeed.description,
              organizationId,
              enterpriseId,
            ],
          );
          const categoryId = catRows[0].id;

          const { template } = categorySeed;
          const variables = extractVariableKeys([
            template.heading,
            ...template.paragraphs,
            ...template.bullet_list,
          ]);

          await client.query(
            `INSERT INTO letter_templates
               (id, category_id, name, heading, paragraphs, bullet_list, include_salary_table,
                variables, version, template_status, organization_id, enterprise_id, status,
                created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::jsonb, $6,
                     $7::jsonb, 1, 'DRAFT', $8, $9, 'ACTIVE',
                     now(), now())`,
            [
              categoryId,
              template.name,
              template.heading,
              JSON.stringify(template.paragraphs),
              JSON.stringify(template.bullet_list),
              template.include_salary_table,
              JSON.stringify(variables),
              organizationId,
              enterpriseId,
            ],
          );
        }
        await client.query('COMMIT');
        console.log(`  ✓ ${organizationId}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${organizationId} — ${(err as Error).message}`);
      }
    }

    console.log('\n✅ Backfill complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
