import { expect, test } from '@playwright/test';
import { login, reseed, trackErrors, USERS } from './fixtures';

test.beforeAll(reseed);

test('protected routes redirect to login with ?next', async ({ page }) => {
  await page.goto('/acme-corp/projects');
  await expect(page).toHaveURL(/\/login\?next=%2Facme-corp%2Fprojects/);
});

test('invalid credentials show an inline error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(USERS.admin);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Invalid email or password' })).toBeVisible();
});

test('new accounts wait on the login page until added to a workspace', async ({ page }) => {
  const email = `pending${Date.now()}@example.test`;
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create one' }).click();
  await page.getByLabel('Full name').fill('Pending User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Secret123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Registration successful')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Password').fill('Secret123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('No workspace assigned')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('dashboard shows KPIs, projects, milestones and activity', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, USERS.admin);
  await expect(page.getByRole('heading', { name: 'Acme Corp Overview' })).toBeVisible();
  for (const label of ['Active Projects', 'Tasks Completed', 'Overdue Items', 'Completion Rate']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: /Project Tracker Platform/ }).first()).toBeVisible();
  await expect(page.getByText('Upcoming Milestones')).toBeVisible();
  await expect(page.getByText('Live Activity')).toBeVisible();
  expect(errors).toEqual([]);
});

test('create project dialog validates and redirects', async ({ page }) => {
  await login(page, USERS.admin);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Project name').fill('Design Ops');
  await dialog.getByLabel('Key prefix').fill('PRJ');
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(dialog.getByText('Key prefix is already used in this workspace')).toBeVisible();

  await dialog.getByLabel('Key prefix').fill('DOPS');
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(page).toHaveURL(/\/acme-corp\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Design Ops' })).toBeVisible();
  await expect(page.getByText('Project created')).toBeVisible();
});

test('sidebar collapses on desktop and the choice persists', async ({ page }) => {
  await login(page, USERS.member);
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
});

test('workspace switcher and sign out', async ({ page }) => {
  await login(page, USERS.member);
  await page.getByRole('button', { name: /Switch workspace/ }).click();
  await expect(page.getByRole('menuitem', { name: /Acme Corp/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/acme-corp');
  await expect(page).toHaveURL(/\/login/);
});
