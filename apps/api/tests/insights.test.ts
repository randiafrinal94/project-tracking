import { beforeAll, describe, expect, it } from 'vitest';
import { loadLabel } from '../src/modules/insights/insights.routes.js';
import { call, seedContext, type SeedContext } from './helpers.js';

let ctx: SeedContext;
beforeAll(async () => {
  ctx = await seedContext();
});

describe('workspace tasks (cross-project)', () => {
  it('lists tasks from every active project with project info', async () => {
    const r = await call('GET', `/workspaces/${ctx.ws.id}/tasks?limit=500`, { token: ctx.viewer.token });
    expect(r.json.data.total).toBe(21);
    expect(new Set(r.json.data.items.map((t: any) => t.projectName))).toEqual(new Set(['Project Tracker Platform', 'Core Services']));
  });

  it('filters by project and assignee=me', async () => {
    const r = await call('GET', `/workspaces/${ctx.ws.id}/tasks?projectId=${ctx.core.id}`, { token: ctx.viewer.token });
    expect(r.json.data.items.every((t: any) => t.key.startsWith('CORE-'))).toBe(true);
    const mine = await call('GET', `/workspaces/${ctx.ws.id}/tasks?assigneeId=me`, { token: ctx.admin.token });
    expect(mine.json.data.items.length).toBeGreaterThan(0);
    expect(mine.json.data.items.every((t: any) => t.assignee?.id === ctx.uid.bima)).toBe(true);
  });

  it('supports list sorting with offset pagination', async () => {
    const p1 = (await call('GET', `/workspaces/${ctx.ws.id}/tasks?sort=due&limit=5`, { token: ctx.viewer.token })).json.data;
    expect(p1.items).toHaveLength(5);
    expect(p1.nextOffset).toBe(5);
    const dues = p1.items.map((t: any) => t.dueDate).filter(Boolean);
    expect([...dues].sort()).toEqual(dues);
    const p2 = (await call('GET', `/workspaces/${ctx.ws.id}/tasks?sort=due&limit=5&offset=5`, { token: ctx.viewer.token })).json.data;
    expect(p2.items.map((t: any) => t.id)).not.toContain(p1.items[0].id);

    const prio = (await call('GET', `/projects/${ctx.prj.id}/tasks?sort=priority&dir=desc&limit=3`, { token: ctx.viewer.token })).json.data;
    expect(prio.items[0].priority).toBe('urgent');
  });

  it('hides workspace tasks from outsiders', async () => {
    const outsider = (await call('POST', '/auth/register', { body: { email: `o${Date.now()}@x.test`, password: 'Secret123', fullName: 'Out' } })).json.data.accessToken;
    expect((await call('GET', `/workspaces/${ctx.ws.id}/tasks`, { token: outsider })).status).toBe(404);
  });
});

describe('workspace milestones', () => {
  it('returns milestones across projects, open ones first', async () => {
    const r = await call('GET', `/workspaces/${ctx.ws.id}/milestones`, { token: ctx.viewer.token });
    expect(r.json.data).toHaveLength(4);
    expect(r.json.data[0].isCompleted).toBe(false);
    expect(r.json.data.at(-1).isCompleted).toBe(true);
    expect(r.json.data[0].project).toMatchObject({ keyPrefix: expect.any(String), name: expect.any(String) });
  });
});

describe('workload', () => {
  it('computes per-member load', async () => {
    const r = await call('GET', `/workspaces/${ctx.ws.id}/workload`, { token: ctx.viewer.token });
    const d = r.json.data;
    expect(d.capacityHours).toBe(40);
    expect(d.members.map((m: any) => m.role)).not.toContain('viewer');
    const bima = d.members.find((m: any) => m.user.id === ctx.uid.bima);
    expect(bima.openTasks).toBeGreaterThan(0);
    expect(bima.loadPercent).toBe(Math.round((bima.weightedHours / 40) * 100));
    expect(d.unassigned.openTasks).toBeGreaterThan(0);
  });

  it('labels load like the Stitch squad panel', () => {
    expect(loadLabel(0, 0)).toBe('Available');
    expect(loadLabel(60, 3)).toBe('Balanced');
    expect(loadLabel(80, 5)).toBe('Healthy');
    expect(loadLabel(95, 6)).toBe('High Load');
  });
});

describe('reports', () => {
  it('returns weekly throughput, breakdowns and per-project hours', async () => {
    const r = await call('GET', `/workspaces/${ctx.ws.id}/reports?weeks=8`, { token: ctx.viewer.token });
    const d = r.json.data;
    expect(d.weekly).toHaveLength(8);
    expect(d.weekly.reduce((s: number, w: any) => s + w.completed, 0)).toBe(d.summary.completed);
    expect(Object.values(d.byStatus as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(21);
    const prj = d.projects.find((p: any) => p.keyPrefix === 'PRJ');
    expect(prj).toMatchObject({ total: 16, done: 6, completionRate: 38 });
    expect(prj.actualHours).toBeGreaterThan(0);
    expect((await call('GET', `/workspaces/${ctx.ws.id}/reports?weeks=2`, { token: ctx.viewer.token })).status).toBe(422);
  });

  it('can be scoped to one project', async () => {
    const d = (await call('GET', `/workspaces/${ctx.ws.id}/reports?projectId=${ctx.core.id}`, { token: ctx.viewer.token })).json.data;
    expect(d.projects).toHaveLength(1);
    expect(Object.values(d.byStatus as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(5);
  });
});
