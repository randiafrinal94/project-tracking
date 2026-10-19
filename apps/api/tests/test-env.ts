/** Satu sumber konfigurasi env test (dipakai vitest.config & global-setup). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://tracker:tracker_dev_password@localhost:5432/project_tracker_test';

export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  JWT_SECRET: 'test-secret-for-vitest-only-0123456789abcdef',
  AUTH_RATE_LIMIT_PER_MINUTE: '1000',
  STORAGE_DIR: 'storage/test-uploads',
  MAX_UPLOAD_MB: '1',
  SEED_USER_PASSWORD: 'Password123!',
} as const;
