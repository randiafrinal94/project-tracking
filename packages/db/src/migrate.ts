import { createDb } from './client.js';
import { runMigrations } from './tools.js';

const { db, pool } = createDb({ max: 1 });

try {
  await runMigrations(db);
  console.log('✔ Migrasi selesai');
} catch (error) {
  console.error('✖ Migrasi gagal:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
