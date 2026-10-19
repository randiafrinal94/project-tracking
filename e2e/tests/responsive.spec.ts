import { expect, test } from '@playwright/test';
import { login, openBoard, reseed, USERS } from './fixtures';

test.beforeAll(reseed);

const noHorizontalOverflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe('mobile 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('dashboard, drawer navigation and board have no page overflow', async ({ page }) => {
    await login(page, USERS.member);
    expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('dialog').getByRole('link', { name: /Projects/ }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await openBoard(page);
    expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('task modal fits the screen', async ({ page }) => {
    await login(page, USERS.member);
    await openBoard(page);
    await page.getByRole('button', { name: /^PRJ-7:/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Acceptance Criteria')).toBeVisible();
    const box = (await dialog.locator('> div').first().boundingBox()) ?? (await dialog.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(390);
  });
});

test.describe('tablet 1024px', () => {
  test.use({ viewport: { width: 1024, height: 800 } });

  test('uses the icon rail sidebar', async ({ page }) => {
    await login(page, USERS.member);
    await expect(page.getByRole('link', { name: 'Project Tracker home' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();
    expect(await noHorizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
