/**
 * Siapkan database sekali-pakai untuk test/E2E: buat → reset → migrasi → seed.
 * Hanya berjalan untuk DATABASE_URL berakhiran `_test` / `_e2e`.
 */
import { pathToFileURL } from 'node:url';
import { createDb } from './client.js';
import { requireEnv } from './env.js';
import { seedDatabase } from './seed.js';
import { assertDisposableDatabase, ensureDatabase, resetSchema, runMigrations } from './tools.js';

export { seedDatabase };

export async function prepareDatabase(connectionString = requireEnv('DATABASE_URL'), { seed = true } = {}) {
  assertDisposableDatabase(connectionString);
  await ensureDatabase(connectionString);
  const { db, pool } = createDb({ connectionString, max: 1 });
  try {
    await resetSchema(db);
    await runMigrations(db);
    if (seed) await seedDatabase(db, { quiet: true });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareDatabase()
    .then(() => console.log('✔ Database test siap'))
    .catch((error) => {
      console.error('✖ Gagal menyiapkan database test:', error);
      process.exit(1);
    });
}
