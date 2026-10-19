import { prepareDatabase } from '@pt/db/prepare';
import { TEST_DATABASE_URL } from './test-env.js';

/** Sekali per run: buat & migrasi DB test (seed dilakukan per file lewat `resetData`). */
export default async function setup() {
  await prepareDatabase(TEST_DATABASE_URL, { seed: false });
}
