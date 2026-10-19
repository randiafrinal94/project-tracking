import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { requireEnv } from './env.js';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

export interface CreateDbOptions {
  connectionString?: string;
  max?: number;
}

export function createDb(options: CreateDbOptions = {}): { db: Database; pool: pg.Pool } {
  const pool = new pg.Pool({
    connectionString: options.connectionString ?? requireEnv('DATABASE_URL'),
    max: options.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return { db: drizzle(pool, { schema, casing: 'snake_case' }), pool };
}
