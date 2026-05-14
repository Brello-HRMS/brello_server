const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const propsPath = path.join(root, 'src/core/properties/dev.properties.yaml');
const props = yaml.load(fs.readFileSync(propsPath, 'utf8'));
const pg = props.db.postgres;

const sql = fs.readFileSync(path.join(root, 'docs/seeds/grant-module-access.sql'), 'utf8');

(async () => {
  const sslCaPath = pg.DB_SSL_CA && path.resolve(root, pg.DB_SSL_CA);
  const client = new Client({
    host: pg.HOST,
    port: pg.PORT,
    user: pg.DB_USER,
    password: pg.DB_PASSWORD,
    database: pg.DB_NAME,
    ssl: sslCaPath && fs.existsSync(sslCaPath) ? { ca: fs.readFileSync(sslCaPath, 'utf8') } : undefined,
  });

  client.on('notice', (m) => console.log('NOTICE:', m.message));

  try {
    await client.connect();
    console.log('Connected to', pg.HOST + ':' + pg.PORT, 'schema=' + pg.DB_SCHEMA);
    await client.query(sql);
    console.log('OK — grant-module-access.sql executed');
  } catch (e) {
    console.error('ERROR:', e.message);
    if (e.detail) console.error('detail:', e.detail);
    if (e.where) console.error('where:', e.where);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
