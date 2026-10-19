import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { Database } from './client.js';

export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

/** Buat database bila belum ada (terhubung ke DB maintenance `postgres`). */
export async function ensureDatabase(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Nama database tidak valid: ${name}`);
  url.pathname = '/postgres';
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}

export async function resetSchema(db: Database): Promise<void> {
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
}

export const runMigrations = (db: Database) => migrate(db, { migrationsFolder });

/** Pengaman: operasi destruktif otomatis hanya untuk DB khusus test/e2e. */
export function assertDisposableDatabase(connectionString: string): void {
  const name = new URL(connectionString).pathname.slice(1);
  if (!/_(test|e2e)$/.test(name)) {
    throw new Error(`Menolak me-reset "${name}": hanya database berakhiran _test atau _e2e yang boleh disiapkan otomatis.`);
  }
}
