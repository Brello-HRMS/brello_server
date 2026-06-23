import { createClient, getSchema } from './_db';

async function main() {
  const schema = getSchema();
  const client = createClient();
  await client.connect();

  console.log(`Connected to database. Schema: ${schema}`);

  try {
    await client.query(`TRUNCATE TABLE ${schema}.letter_templates, ${schema}.letter_categories CASCADE;`);
    console.log('Successfully cleared letter_templates and letter_categories.');
  } catch (error) {
    console.error('Failed to clear tables:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
