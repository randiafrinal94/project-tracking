import { createDb } from '@pt/db';
import { env } from './config/env.js';

export const { db, pool } = createDb({ connectionString: env.DATABASE_URL, max: 20 });

pool.on('error', (error) => {
  // Error pada idle client tidak boleh menjatuhkan proses.
  console.error('[db] idle client error', error);
});
