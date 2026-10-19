export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://tracker:tracker_dev_password@localhost:5432/project_tracker_e2e';

/** Env untuk API saat E2E (DB & folder lampiran terpisah dari development). */
export const E2E_ENV = {
  DATABASE_URL: E2E_DATABASE_URL,
  AUTH_RATE_LIMIT_PER_MINUTE: '500',
  STORAGE_DIR: 'storage/e2e-uploads',
  SEED_USER_PASSWORD: 'Password123!',
} as const;
