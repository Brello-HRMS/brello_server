/**
 * Shared Postgres connection helper for seed scripts.
 *
 * Reads connection details from src/core/properties/dev.properties.yaml so a
 * teammate (or a different environment) only needs to edit that one file.
 *
 * Schema can be overridden via the DB_SCHEMA env var:
 *   DB_SCHEMA=my_schema npx ts-node src/seeds/seed-brello-v2-base.ts
 */

import { Client, ClientConfig } from 'pg';
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

type PgConfig = {
  HOST: string;
  PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_SCHEMA: string;
  DB_SSL_CA: string;
};

function loadProps(): { db: { postgres: PgConfig } } {
  const candidates = [
    join(process.cwd(), 'src', 'core', 'properties', 'dev.properties.yaml'),
    join(__dirname, '..', 'core', 'properties', 'dev.properties.yaml'),
  ];
  for (const p of candidates) {
    try {
      return yaml.load(readFileSync(p, 'utf8')) as { db: { postgres: PgConfig } };
    } catch {
      // continue
    }
  }
  throw new Error(`dev.properties.yaml not found in: ${candidates.join(', ')}`);
}

export function getSchema(): string {
  if (process.env.DB_SCHEMA) return process.env.DB_SCHEMA;
  return loadProps().db.postgres.DB_SCHEMA;
}

export function createClient(): Client {
  const pg = loadProps().db.postgres;
  const cfg: ClientConfig = {
    host: pg.HOST,
    port: pg.PORT,
    user: pg.DB_USER,
    password: pg.DB_PASSWORD,
    database: pg.DB_NAME,
    ssl: pg.DB_SSL_CA ? { ca: readFileSync(pg.DB_SSL_CA).toString() } : false,
  };
  return new Client(cfg);
}
