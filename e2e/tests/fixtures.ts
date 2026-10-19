import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';
import { E2E_ENV } from '../env';

const root = fileURLToPath(new URL('../..', import.meta.url));

export const USERS = {
  owner: 'alya@acme.test',
  admin: 'bima@acme.test',
  member: 'citra@acme.test',
  member2: 'dimas@acme.test',
  viewer: 'eka@client.test',
} as const;

/** Kembalikan DB e2e ke data seed (server tetap berjalan). */
export function reseed() {
  execSync('pnpm --filter @pt/db seed', { cwd: root, stdio: 'ignore', env: { ...process.env, ...E2E_ENV } });
}

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/acme-corp$/);
}

export const column = (page: Page, label: string) => page.getByRole('region', { name: `${label} column` });

export async function cardKeys(page: Page, label: string): Promise<string[]> {
  return column(page, label)
    .locator('article')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!.split(':')[0]!));
}

export async function openBoard(page: Page, projectName = 'Project Tracker Platform') {
  await page.goto('/acme-corp/projects');
  await page.getByRole('link', { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole('heading', { name: 'Workflow Matrix' })).toBeVisible();
  await expect(column(page, 'Done').locator('article').first()).toBeVisible();
}

/** Drag mouse bertahap (sensor dnd-kit butuh gerakan ≥6px). */
export async function dragCard(page: Page, source: Locator, target: Locator, offsetY = 0) {
  const s = (await source.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(s.x + s.width / 2, s.y + 20);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + 30, { steps: 4 });
  await page.mouse.move(t.x + t.width / 2, t.y + 20 + offsetY, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

/** Gagalkan test bila ada error JS / console error yang tidak diharapkan. */
export function trackErrors(page: Page, allow: RegExp = /status of 40[19]/) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !allow.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}
