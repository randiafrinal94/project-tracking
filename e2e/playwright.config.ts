import { defineConfig, devices } from '@playwright/test';
import { E2E_ENV } from './env';

/**
 * E2E memakai DB terpisah (`project_tracker_e2e`) dan menyalakan API + web sendiri.
 * Prasyarat: `pnpm build:web` (rewrite /api → :4000 ditanam saat build) dan port 3000/4000 bebas.
 * Browser: Edge terpasang di Windows (default), atau `pnpm exec playwright install chromium`.
 */
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1, // satu DB bersama — jalankan berurutan
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    channel,
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Edge'], channel, viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    {
      command: 'pnpm --filter @pt/api start',
      cwd: '..',
      port: 4000,
      reuseExistingServer: false,
      env: { ...E2E_ENV },
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @pt/web start',
      cwd: '..',
      url: 'http://localhost:3000/login',
      reuseExistingServer: false,
      env: { NEXT_TELEMETRY_DISABLED: '1' },
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
