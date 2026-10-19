import { beforeAll, describe, expect, it } from 'vitest';
import { call, seedContext, type SeedContext } from './helpers.js';

let ctx: SeedContext;
beforeAll(async () => {
  ctx = await seedContext();
});

describe('projects', () => {
  it('lists projects with task stats', async () => {
    const r = await call('GET', `/workspaces/${ctx.ws.id}/projects`, { token: ctx.viewer.token });
    const prj = r.json.data.find((p: any) => p.keyPrefix === 'PRJ');
    expect(prj.stats).toMatchObject({ totalTasks: 16, completedTasks: 6, completionRate: 38 });
    expect(prj.stats.overdueTasks).toBeGreaterThanOrEqual(1);
    expect((await call('GET', `/workspaces/${ctx.ws.id}/projects?status=bogus`, { token: ctx.viewer.token })).status).toBe(422);
  });

  it('creates, validates and protects projects', async () => {
    const base = `/workspaces/${ctx.ws.id}/projects`;
    expect((await call('POST', base, { token: ctx.member.token, body: { name: 'X', keyPrefix: 'XX' } })).status).toBe(403);

    const created = await call('POST', base, {
      token: ctx.admin.token,
      body: { name: 'Mobile App', keyPrefix: 'mob', startDate: '2026-11-01', targetDate: '2027-02-01' },
    });
    expect(created.status).toBe(201);
    expect(created.json.data).toMatchObject({ keyPrefix: 'MOB', status: 'planning', stats: { totalTasks: 0 } });
    const id = created.json.data.id;

    expect((await call('POST', base, { token: ctx.admin.token, body: { name: 'Dup', keyPrefix: 'PRJ' } })).json.error.code).toBe('KEY_PREFIX_TAKEN');
    expect((await call('POST', base, { token: ctx.admin.token, body: { name: 'R', keyPrefix: '1AB' } })).status).toBe(422);
    expect(
      (await call('POST', base, { token: ctx.admin.token, body: { name: 'R', keyPrefix: 'RNG', startDate: '2026-12-01', targetDate: '2026-11-01' } })).status,
    ).toBe(422);

    expect((await call('PATCH', `/projects/${id}`, { token: ctx.viewer.token, body: { name: 'x' } })).status).toBe(403);
    expect((await call('PATCH', `/projects/${id}`, { token: ctx.admin.token, body: { keyPrefix: 'NEW' } })).status).toBe(422);
    const range = await call('PATCH', `/projects/${id}`, { token: ctx.admin.token, body: { targetDate: '2026-01-01' } });
    expect(range.json.error.code).toBe('INVALID_DATE_RANGE');

    const patched = await call('PATCH', `/projects/${id}`, { token: ctx.admin.token, body: { status: 'active' } });
    expect(patched.json.data.status).toBe('active');
  });

  it('soft-deletes and restores', async () => {
    const created = await call('POST', `/workspaces/${ctx.ws.id}/projects`, { token: ctx.admin.token, body: { name: 'Temp', keyPrefix: 'TMP' } });
    const id = created.json.data.id;
    expect((await call('DELETE', `/projects/${id}`, { token: ctx.admin.token })).json.data.deletedAt).toBeTruthy();
    expect((await call('GET', `/projects/${id}`, { token: ctx.admin.token })).status).toBe(404);
    const archived = await call('GET', `/workspaces/${ctx.ws.id}/projects?archived=true`, { token: ctx.admin.token });
    expect(archived.json.data.some((p: any) => p.id === id)).toBe(true);
    const restored = await call('POST', `/workspaces/${ctx.ws.id}/projects/${id}/restore`, { token: ctx.admin.token });
    expect(restored.json.data.deletedAt).toBeNull();
    expect((await call('POST', `/workspaces/${ctx.ws.id}/projects/${id}/restore`, { token: ctx.admin.token })).status).toBe(404);
  });

  it('records project activity with the actor', async () => {
    const created = await call('POST', `/workspaces/${ctx.ws.id}/projects`, { token: ctx.admin.token, body: { name: 'Audit', keyPrefix: 'AUD' } });
    const feed = await call('GET', `/projects/${created.json.data.id}/activity`, { token: ctx.viewer.token });
    expect(feed.json.data.items[0]).toMatchObject({ action: 'project.created', actor: { fullName: 'Bima Santoso' } });
  });
});

describe('dashboard', () => {
  it('returns workspace KPIs', async () => {
    const r = await call('GET', `/workspaces/${ctx.ws.id}/dashboard`, { token: ctx.viewer.token });
    const d = r.json.data;
    expect(d.completionRate).toBeGreaterThanOrEqual(0);
    expect(d.completionRate).toBeLessThanOrEqual(100);
    expect(Object.values(d.tasksByStatus as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(d.totalTasks);
  });
});
