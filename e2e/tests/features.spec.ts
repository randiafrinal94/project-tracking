import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { cardKeys, column, dragCard, login, openBoard, reseed, trackErrors, USERS } from './fixtures';

const API = 'http://localhost:4000/api/v1';

async function apiAs(email: string) {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, { data: { email, password: 'Password123!' } });
  const token = (await res.json()).data.accessToken as string;
  const call = async (method: string, path: string, data?: unknown) => {
    const r = await ctx.fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` }, data });
    return (await r.json()).data;
  };
  return { ctx, call };
}

let admin: { ctx: APIRequestContext; call: (m: string, p: string, d?: unknown) => Promise<any> };
let ws: any;
let prj: any;

test.beforeAll(async () => {
  reseed();
  admin = await apiAs(USERS.admin);
  ws = (await admin.call('GET', '/workspaces'))[0];
  prj = (await admin.call('GET', `/workspaces/${ws.id}/projects`)).find((p: any) => p.keyPrefix === 'PRJ');
});

test.afterAll(async () => admin.ctx.dispose());

test.describe('project views', () => {
  test('Done column is fully visible at 1280px (rail moves below the board)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page, USERS.admin);
    await openBoard(page);
    const box = (await column(page, 'Done').boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
  });

  test('overview, list and gantt tabs', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page, USERS.admin);
    await openBoard(page);

    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page).toHaveURL(/view=overview/);
    await expect(page.getByText('About this project')).toBeVisible();
    await expect(page.getByText('Squad on this project')).toBeVisible();

    await page.getByRole('tab', { name: /List View/ }).click();
    const table = page.getByRole('table', { name: 'Tasks' });
    await expect(table.getByRole('row', { name: /^PRJ-1:/ })).toBeVisible();
    await expect(page.getByText('Showing 16 of 16')).toBeVisible();
    await table.getByRole('button', { name: /Priority/ }).click();
    await expect(table.getByRole('row').nth(1)).toContainText('Urgent');

    await page.getByRole('tab', { name: /Gantt Timeline/ }).click();
    await expect(page.getByText('Sprint 3 — Collaboration').first()).toBeVisible();
    const bar = page.getByRole('button', { name: /^PRJ-7 Implement OAuth2.*: \d{4}-\d{2}-\d{2} to/ });
    await expect(bar).toBeVisible();
    const b = (await bar.boundingBox())!;
    const patched = page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/tasks\/[0-9a-f-]+$/.test(r.url()));
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 80, b.y + b.height / 2, { steps: 10 });
    await page.mouse.up();
    expect((await patched).status()).toBe(200);
    await expect(page.getByText(/PRJ-7 rescheduled/)).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test('virtual scrolling keeps the DOM small for 260 tasks', async ({ page }) => {
  const load = await admin.call('POST', `/workspaces/${ws.id}/projects`, { name: 'Virtual Load', keyPrefix: 'VIRT', status: 'active' });
  for (let i = 0; i < 260; i += 26) {
    await Promise.all(Array.from({ length: 26 }, (_, k) => admin.call('POST', `/projects/${load.id}/tasks`, { title: `Virtual task ${i + k + 1}` })));
  }
  await login(page, USERS.admin);
  await page.goto(`/acme-corp/projects/${load.id}`);
  const backlog = column(page, 'Backlog');
  await expect(backlog.locator('article').first()).toBeVisible();
  await expect(backlog.getByText('50 of 260 loaded')).toBeVisible();
  expect(await backlog.locator('article').count()).toBeLessThan(40);

  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 6000);
    await page.waitForTimeout(400);
  }
  await expect(backlog.getByText(/(100|150|200|250|260) of 260 loaded/)).toBeVisible();
  expect(await backlog.locator('article').count()).toBeLessThan(40);
});

test.describe('workspace pages', () => {
  test('tasks list (mine / all) opens the modal', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/acme-corp/tasks');
    const table = page.getByRole('table', { name: 'Tasks' });
    await expect(table.getByRole('row').nth(1)).toBeVisible();
    const mine = await table.getByRole('row').count();
    await page.getByRole('tab', { name: 'All tasks' }).click();
    await expect(page.getByText(/Showing \d+ of 2\d/)).toBeVisible();
    expect(await table.getByRole('row').count()).toBeGreaterThan(mine);
    await table.getByRole('row', { name: /^CORE-1:/ }).click();
    await expect(page.getByRole('dialog').getByText('Acceptance Criteria')).toBeVisible();
  });

  test('cross-project kanban moves a card to Done', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/acme-corp/tasks/kanban');
    await page.getByRole('tab', { name: 'All tasks' }).click();
    await expect(column(page, 'In Review').locator('article').first()).toBeVisible();
    const key = (await cardKeys(page, 'In Review'))[0]!;
    const moved = page.waitForResponse((r) => r.url().includes('/move'));
    await dragCard(page, column(page, 'In Review').locator('article').first(), column(page, 'Done').locator('article').first());
    expect((await moved).status()).toBe(200);
    await expect.poll(() => cardKeys(page, 'Done')).toContain(key);
  });

  test('milestones page lets admins add a milestone', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/acme-corp/milestones');
    await expect(page.getByText('Sprint 3 — Collaboration')).toBeVisible();
    await page.getByRole('button', { name: 'New milestone' }).first().click();
    await page.getByLabel('Milestone name').fill('Launch readiness');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Launch readiness')).toBeVisible();
  });

  test('workload and reports render', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page, USERS.admin);
    await expect(page.getByText('Squad Workload')).toBeVisible();
    await page.getByRole('link', { name: 'Manage Team Allocation' }).click();
    await expect(page.getByRole('table', { name: 'Workload by member' }).getByText('Bima Santoso')).toBeVisible();
    await expect(page.getByText('Unassigned work')).toBeVisible();

    await page.goto('/acme-corp/reports');
    await expect(page.getByRole('region', { name: 'Weekly throughput' }).locator('svg')).toBeVisible();
    await page.getByRole('region', { name: 'Weekly throughput' }).getByRole('button', { name: 'Table' }).click();
    await expect(page.getByRole('region', { name: 'Weekly throughput' }).getByRole('columnheader', { name: 'Completed' })).toBeVisible();
    await page.getByRole('tab', { name: '4 weeks' }).click();
    await expect(page.getByText('in the last 4 weeks').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('settings: tags, members and profile', async ({ page }) => {
    const outsider = await (await pwRequest.newContext()).post(`${API}/auth/register`, {
      data: { email: `new.member.${Date.now()}@acme.test`, password: 'Secret123', fullName: 'New Member' },
    });
    const outsiderEmail = (await outsider.json()).data.user.email;

    await login(page, USERS.owner);
    await page.goto('/acme-corp/settings?tab=tags');
    await page.getByLabel('Tag name').first().fill('Security');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Security' }).first()).toBeVisible();

    await page.getByRole('tab', { name: 'Members' }).click();
    await page.getByLabel('Email').fill(outsiderEmail);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('New Member added')).toBeVisible();
    await page.getByLabel('Role for New Member').selectOption('viewer');
    await expect(page.getByLabel('Role for New Member')).toHaveValue('viewer');

    await page.getByRole('tab', { name: 'My profile' }).click();
    await page.getByLabel('Full name').fill('Alya P.');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile updated')).toBeVisible();
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByText('Alya P.').first()).toBeVisible();
  });
});

test.describe('collaboration', () => {
  test('mention autocomplete inserts a handle', async ({ page }) => {
    await login(page, USERS.admin);
    await openBoard(page);
    await page.getByRole('button', { name: /^PRJ-8:/ }).click();
    const box = page.getByRole('dialog').getByLabel('Write a comment');
    await box.fill('');
    await box.pressSequentially('Thanks @ci');
    await expect(page.getByRole('listbox', { name: 'Mention a teammate' }).getByRole('option', { name: /Citra Lestari/ })).toBeVisible();
    await box.press('Enter');
    await expect(box).toHaveValue('Thanks @citra ');
    await box.pressSequentially('please review');
    await page.getByRole('dialog').getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByRole('dialog').locator('.rich-text .mention', { hasText: '@citra' })).toBeVisible();
  });

  test('realtime: notification badge and board update without reload', async ({ browser }) => {
    const citra = await (await browser.newContext()).newPage();
    await login(citra, USERS.member);
    await openBoard(citra);
    const bell = citra.getByRole('button', { name: /^Notifications/ });
    const before = (await bell.getAttribute('aria-label')) ?? '';

    // Orang lain (Alya) me-mention Citra & memindahkan kartu Citra — lewat API, tanpa reload di sisi Citra.
    // Member hanya melihat task yang di-assign kepadanya (PRJ-8 & PRJ-13 milik Citra).
    const alya = await apiAs(USERS.owner);
    const tasks = (await alya.call('GET', `/projects/${prj.id}/tasks?limit=50`)).items;
    const prj8 = tasks.find((t: any) => t.key === 'PRJ-8');
    const prj13 = tasks.find((t: any) => t.key === 'PRJ-13');
    await alya.call('POST', `/tasks/${prj8.id}/comments`, { body: 'Realtime check @citra' });
    await alya.call('PATCH', `/tasks/${prj13.id}/move`, { status: 'done' });

    await expect(bell).not.toHaveAttribute('aria-label', before, { timeout: 10_000 });
    await expect.poll(() => cardKeys(citra, 'Done'), { timeout: 10_000 }).toContain('PRJ-13');

    await bell.click();
    await citra.getByRole('button', { name: /mentioned you in PRJ-8/ }).first().click();
    await expect(citra.getByRole('dialog').getByRole('heading', { name: /Task detail slide-out drawer/ })).toBeVisible();
    await alya.ctx.dispose();
  });
});
