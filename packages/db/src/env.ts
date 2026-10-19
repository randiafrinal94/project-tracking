import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// Muat `.env` di root monorepo; env yang sudah di-set (CI/container) tetap diutamakan.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} wajib di-set (lihat .env.example)`);
  return value;
}
