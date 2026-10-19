import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './tests/test-env.ts';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Semua file berbagi satu DB test → jalankan berurutan.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: { ...TEST_ENV },
  },
});
