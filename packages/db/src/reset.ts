import { createDb } from './client.js';
import { resetSchema } from './tools.js';

if (process.env.NODE_ENV === 'production') {
  console.error('✖ db:reset ditolak di NODE_ENV=production');
  process.exit(1);
}

const { db, pool } = createDb({ max: 1 });

try {
  await resetSchema(db);
  console.log('✔ Database dikosongkan');
} catch (error) {
  console.error('✖ Reset gagal:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
