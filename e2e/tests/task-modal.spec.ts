import { expect, test } from '@playwright/test';
import { column, login, openBoard, reseed, trackErrors, USERS } from './fixtures';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeEach(async ({ page }) => {
  reseed();
  await login(page, USERS.admin);
  await openBoard(page);
  await page.getByRole('button', { name: /^PRJ-7:/ }).click();
  await expect(page.getByRole('dialog').getByText('Acceptance Criteria')).toBeVisible();
});

test('edits task fields and syncs the board card', async ({ page }) => {
  const errors = trackErrors(page);
  const dialog = page.getByRole('dialog');
  await expect(page).toHaveURL(/\?task=/);
  await expect(dialog.getByText('3 of 5 completed (60%)')).toBeVisible();

  await dialog.getByRole('checkbox', { name: /Refresh token rotation/ }).click();
  await expect(dialog.getByText('4 of 5 completed (80%)')).toBeVisible();

  await dialog.getByRole('button', { name: 'Add Acceptance Subtask' }).click();
  await dialog.getByLabel('New subtask').fill('Write runbook');
  await dialog.getByLabel('New subtask').press('Enter');
  await expect(dialog.getByText('4 of 6 completed (67%)')).toBeVisible();

  await dialog.getByRole('button', { name: /^Priority:/ }).click();
  await page.getByRole('menuitem', { name: /High/ }).click();
  await expect(dialog.getByRole('button', { name: 'Priority: High' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Edit title' }).click({ force: true });
  await dialog.getByLabel('Task title').fill('Implement OAuth2 Google Login (SSO)');
  await dialog.getByLabel('Task title').press('Enter');
  await expect(dialog.getByRole('heading', { name: 'Implement OAuth2 Google Login (SSO)' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Log Time' }).click();
  await dialog.getByLabel('Hours to log').fill('1.5');
  await dialog.getByRole('button', { name: 'Log', exact: true }).click();
  await expect(dialog.getByText('5.5h logged')).toBeVisible();

  await dialog.getByRole('button', { name: 'Reassign' }).click();
  await page.getByRole('menuitem', { name: /Citra Lestari/ }).click();
  await expect(dialog.getByText('Citra Lestari').first()).toBeVisible();

  await expect(dialog.getByText('All changes saved automatically')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/task=/);

  const card = page.getByRole('button', { name: /^PRJ-7:/ });
  await expect(card).toContainText('SSO');
  await expect(card).toContainText('High');
  await expect(card).toContainText('4/6');
  expect(errors).toEqual([]);
});

test('comments render sanitized markdown and history is recorded', async ({ page }) => {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Write a comment').fill('Ready for review **today** <script>alert(1)</script>');
  await dialog.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(dialog.locator('.rich-text strong', { hasText: 'today' })).toBeVisible();
  await expect(dialog.locator('.rich-text script')).toHaveCount(0);

  await dialog.getByRole('button', { name: /^Priority:/ }).click();
  await page.getByRole('menuitem', { name: /Low/ }).click();
  await dialog.getByRole('tab', { name: 'History' }).click();
  await expect(dialog.getByText(/changed priority from urgent to low/)).toBeVisible();
});

test('deep link opens the modal directly', async ({ page }) => {
  const url = page.url();
  await page.keyboard.press('Escape');
  await page.goto(url);
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Implement OAuth2 Google Login/ })).toBeVisible();
});

test('uploads, previews, and deletes attachments', async ({ page }) => {
  const errors = trackErrors(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Attachments (0)')).toBeVisible();
  await dialog.getByLabel('Choose files to upload').setInputFiles([
    { name: 'pixel.png', mimeType: 'image/png', buffer: PNG_1PX },
    { name: 'spec.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') },
  ]);
  await expect(dialog.getByText('Attachments (2)')).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'pixel.png' })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Attachments' }).getByText('spec.pdf')).toBeVisible();

  const download = page.waitForEvent('download');
  await dialog.getByTitle('Download spec.pdf').click();
  expect((await download).suggestedFilename()).toBe('spec.pdf');

  await dialog.getByRole('button', { name: 'Delete spec.pdf' }).click({ force: true });
  await expect(dialog.getByText('Attachments (1)')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^PRJ-7:/ }).getByLabel('1 attachments')).toBeVisible();
  expect(errors).toEqual([]);
});

test('deleting a task removes it from the board', async ({ page }) => {
  await page.keyboard.press('Escape');
  await column(page, 'Backlog').getByRole('button', { name: 'Quick task' }).click();
  await page.getByLabel('New task title in Backlog').fill('Temporary task');
  await page.getByLabel('New task title in Backlog').press('Enter');
  await page.getByRole('button', { name: /Temporary task/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Delete task' }).click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('article', { hasText: 'Temporary task' })).toHaveCount(0);
});
