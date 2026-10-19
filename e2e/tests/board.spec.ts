import { expect, test } from '@playwright/test';
import { cardKeys, column, dragCard, login, openBoard, reseed, trackErrors, USERS } from './fixtures';

test.beforeEach(async ({ page }) => {
  reseed();
  await login(page, USERS.admin);
  await openBoard(page);
});

test('renders columns with seed data in sort order', async ({ page }) => {
  expect(await cardKeys(page, 'Backlog')).toHaveLength(5);
  expect(await cardKeys(page, 'In Progress')).toEqual(['PRJ-7', 'PRJ-8', 'PRJ-9']);
  expect(await cardKeys(page, 'In Review')).toHaveLength(2);
  expect(await cardKeys(page, 'Done')).toHaveLength(6);
});

test('drag between columns is optimistic and persisted', async ({ page }) => {
  const errors = trackErrors(page);
  const first = (await cardKeys(page, 'Backlog'))[0]!;
  const moved = page.waitForResponse((r) => r.url().includes('/move') && r.request().method() === 'PATCH');
  await dragCard(page, column(page, 'Backlog').locator('article').first(), column(page, 'In Progress').locator('article').first());
  expect((await moved).status()).toBe(200);
  expect(await cardKeys(page, 'In Progress')).toContain(first);
  const arrangement = await cardKeys(page, 'In Progress');

  await page.reload();
  await expect(column(page, 'In Progress').locator('article').first()).toBeVisible();
  expect(await cardKeys(page, 'In Progress')).toEqual(arrangement);
  expect(errors).toEqual([]);
});

test('reorder within a column persists', async ({ page }) => {
  const before = await cardKeys(page, 'In Progress');
  const cards = column(page, 'In Progress').locator('article');
  await dragCard(page, cards.nth(0), cards.nth(2), 40);
  await expect.poll(() => cardKeys(page, 'In Progress')).not.toEqual(before);
  const after = await cardKeys(page, 'In Progress');
  await page.reload();
  await expect(column(page, 'In Progress').locator('article').first()).toBeVisible();
  expect(await cardKeys(page, 'In Progress')).toEqual(after);
});

test('rolls back and shows a toast when the API fails', async ({ page }) => {
  await page.route('**/api/v1/tasks/*/move', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'Simulated failure' }, timestamp: new Date().toISOString() }),
    }),
  );
  const before = await cardKeys(page, 'In Review');
  await dragCard(page, column(page, 'In Review').locator('article').first(), column(page, 'Done').locator('article').first());
  await expect(page.getByText('Could not move task')).toBeVisible();
  await expect.poll(() => cardKeys(page, 'In Review')).toEqual(before);
});

test('keyboard drag moves a card to the next column', async ({ page }) => {
  const card = column(page, 'In Review').locator('article').first();
  const key = (await card.getAttribute('aria-label'))!.split(':')[0]!;
  await card.focus();
  // Jeda seperti ketikan manusia: sensor keyboard dnd-kit aktif setelah render berikutnya.
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const moved = page.waitForResponse((r) => r.url().includes('/move'));
  await page.keyboard.press('Space');
  expect((await moved).status()).toBe(200);
  await expect.poll(() => cardKeys(page, 'Done')).toContain(key);
});

test('filters by search and tag', async ({ page }) => {
  await page.getByLabel('Filter tasks').fill('oauth');
  await expect.poll(async () => page.locator('article').count()).toBe(1);
  await expect(column(page, 'Backlog').getByText('No tasks match the filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.getByRole('group', { name: 'Filter by tag' }).getByRole('button', { name: /Frontend/ }).click();
  await expect.poll(async () => page.locator('article').count()).toBeLessThan(16);
});

test('quick task creates a card in Backlog', async ({ page }) => {
  await column(page, 'Backlog').getByRole('button', { name: 'Quick task' }).click();
  await page.getByLabel('New task title in Backlog').fill('Quick task from E2E');
  await page.getByLabel('New task title in Backlog').press('Enter');
  await expect(column(page, 'Backlog').getByText('Quick task from E2E')).toBeVisible();
});

test('viewer is read-only', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await login(page, USERS.viewer);
  await openBoard(page);
  await expect(page.getByRole('button', { name: 'Quick task' })).toHaveCount(0);
  await expect(page.getByText('View only').first()).toBeVisible();
  const before = await cardKeys(page, 'Backlog');
  await dragCard(page, column(page, 'Backlog').locator('article').first(), column(page, 'Done').locator('article').first());
  expect(await cardKeys(page, 'Backlog')).toEqual(before);
  await page.getByRole('button', { name: /^PRJ-7:/ }).click();
  await expect(page.getByRole('dialog').getByText('Acceptance Criteria')).toBeVisible();
  await expect(page.getByLabel('Write a comment')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Upload files' })).toHaveCount(0);
});
