import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Unit test tidak menyentuh database; nilai di bawah hanya agar validasi env lolos.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://unused@localhost:5432/unused',
      JWT_SECRET: 'unit-test-secret-0123456789abcdef0123456789',
    },
  },
});
