import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E2E_ENV } from './env';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Buat → reset → migrasi → seed DB e2e (menolak DB yang tidak berakhiran _e2e). */
export default function globalSetup() {
  execSync('pnpm --filter @pt/db prepare-db', { cwd: root, stdio: 'inherit', env: { ...process.env, ...E2E_ENV } });
}
