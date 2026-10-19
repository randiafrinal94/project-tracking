import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './client.js';

export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

export async function resetSchema(db: Database): Promise<void> {
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
}

export const runMigrations = (db: Database) => migrate(db, { migrationsFolder });
