import { beforeAll, describe, expect, it } from 'vitest';
import { call, seedContext, type SeedContext } from './helpers.js';

let ctx: SeedContext;
let tst: { id: string };

beforeAll(async () => {
  ctx = await seedContext();
  tst = (await call('POST', `/workspaces/${ctx.ws.id}/projects`, { token: ctx.admin.token, body: { name: 'Board Test', keyPrefix: 'TST', status: 'active' } })).json.data;
});

const list = async (projectId: string, qs = '') =>
  (await call('GET', `/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`, { token: ctx.viewer.token })).json.data;
const column = async (status: string) => (await list(tst.id, `status=${status}`)).items as any[];
const titles = (items: any[]) => items.map((t) => t.title).join(',');
const create = async (title: string, extra: object = {}) =>
  (await call('POST', `/projects/${tst.id}/tasks`, { token: ctx.member.token, body: { title, ...extra } })).json.data;
const move = (id: string, body: object, token = ctx.member.token) => call('PATCH', `/tasks/${id}/move`, { token, body });

describe('board listing', () => {
  it('returns cards ordered by status/sort with card data and total', async () => {
    const data = await list(ctx.prj.id);
    expect(data.items).toHaveLength(16);
    expect(data.total).toBe(16);
    const oauth = data.items.find((t: any) => t.key === 'PRJ-7');
    expect(oauth).toMatchObject({
      subtasks: { total: 5, completed: 3 },
      assignee: { fullName: 'Bima Santoso' },
      commentCount: 2,
      attachmentCount: 0,
      estimateHours: 10,
    });
  });

  it('filters by status, assignee, priority, tag, search, overdue, milestone', async () => {
    expect((await list(ctx.prj.id, 'status=in_progress')).items).toHaveLength(3);
    expect((await list(ctx.prj.id, 'status=in_progress')).total).toBe(3);
    const mine = (await call('GET', `/projects/${ctx.prj.id}/tasks?assigneeId=me`, { token: ctx.admin.token })).json.data.items;
    expect(mine.every((t: any) => t.assignee?.id === ctx.uid.bima)).toBe(true);
    expect((await list(ctx.prj.id, 'priority=urgent,high')).items.every((t: any) => ['urgent', 'high'].includes(t.priority))).toBe(true);
    expect((await list(ctx.prj.id, `tagId=${ctx.tagId.Bug}`)).items.every((t: any) => t.tags.some((g: any) => g.name === 'Bug'))).toBe(true);
    expect((await list(ctx.prj.id, 'q=PRJ-7')).items.some((t: any) => t.key === 'PRJ-7')).toBe(true);
    expect((await list(ctx.prj.id, 'q=oauth')).items[0].key).toBe('PRJ-7');
    const overdue = (await list(ctx.prj.id, 'overdue=true')).items;
    expect(overdue.length).toBeGreaterThan(0);
    expect(overdue.every((t: any) => t.status !== 'done')).toBe(true);
    expect((await list(ctx.prj.id, 'milestoneId=none')).items.every((t: any) => t.milestoneId === null)).toBe(true);
    expect((await call('GET', `/projects/${ctx.prj.id}/tasks?priority=nope`, { token: ctx.viewer.token })).status).toBe(422);
  });

  it('paginates with keyset cursors without duplicates', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: any = await list(ctx.prj.id, `status=backlog&limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...page.items.map((t: any) => t.key));
      expect(page.total).toBe(5);
      cursor = page.nextCursor;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(5);
    expect((await call('GET', `/projects/${ctx.prj.id}/tasks?cursor=garbage`, { token: ctx.viewer.token })).json.error.code).toBe('INVALID_CURSOR');
  });
});

describe('task creation', () => {
  it('numbers tasks sequentially and appends with gaps', async () => {
    const [a, b, c] = [await create('Task A'), await create('Task B'), await create('Task C')];
    expect([a.key, b.key, c.key]).toEqual(['TST-1', 'TST-2', 'TST-3']);
    expect([a.sortOrder, b.sortOrder, c.sortOrder]).toEqual([1024, 2048, 3072]);
    expect(a.reporter.id).toBe(ctx.uid.citra);
  });

  it('validates references and permissions', async () => {
    expect((await call('POST', `/projects/${tst.id}/tasks`, { token: ctx.viewer.token, body: { title: 'x' } })).status).toBe(403);
    const toViewer = await call('POST', `/projects/${tst.id}/tasks`, { token: ctx.member.token, body: { title: 'x', assigneeId: ctx.uid.eka } });
    expect(toViewer.json.error.code).toBe('INVALID_REFERENCE');
    const prjMilestone = (await call('GET', `/projects/${ctx.prj.id}/milestones`, { token: ctx.admin.token })).json.data[0];
    expect((await call('POST', `/projects/${tst.id}/tasks`, { token: ctx.member.token, body: { title: 'x', milestoneId: prjMilestone.id } })).status).toBe(422);
  });

  it('sanitizes the description and dedupes tags', async () => {
    const t = await create('Sanitize', {
      description: '<p onclick="x">Hi <a href="javascript:alert(1)">x</a><script>a()</script><strong>ok</strong></p><iframe></iframe>',
      tagIds: [ctx.tagId.Backend, ctx.tagId.Backend],
    });
    expect(t.description).toBe('<p>Hi <a rel="noopener noreferrer nofollow" target="_blank">x</a><strong>ok</strong></p>');
    expect(t.tags).toHaveLength(1);
  });

  it('sets completedAt when created in done', async () => {
    expect((await create('Born done', { status: 'done' })).completedAt).toBeTruthy();
  });
});

describe('move / reorder (Kanban)', () => {
  it('places cards relative to neighbours', async () => {
    const backlog = await column('backlog');
    const [a, b, c] = ['Task A', 'Task B', 'Task C'].map((n) => backlog.find((t) => t.title === n));
    await move(c.id, { status: 'backlog', nextTaskId: a.id });
    expect(titles(await column('backlog'))).toMatch(/^Task C,Task A,Task B/);
    await move(b.id, { status: 'backlog', prevTaskId: c.id });
    expect(titles(await column('backlog'))).toMatch(/^Task C,Task B,Task A/);
  });

  it('moves across columns and manages completedAt', async () => {
    const a = (await column('backlog')).find((t) => t.title === 'Task A');
    let r = await move(a.id, { status: 'in_progress' });
    expect(r.json.data.task).toMatchObject({ status: 'in_progress', sortOrder: 1024 });
    r = await move(a.id, { status: 'done' });
    expect(r.json.data.task.completedAt).toBeTruthy();
    r = await move(a.id, { status: 'in_review' });
    expect(r.json.data.task.completedAt).toBeNull();
  });

  it('rejects invalid placements and viewers', async () => {
    const backlog = await column('backlog');
    const review = await column('in_review');
    expect((await move(review[0].id, { status: 'backlog', prevTaskId: review[0].id })).json.error.code).toBe('INVALID_PLACEMENT');
    expect((await move(backlog[0].id, { status: 'in_progress', prevTaskId: backlog[1].id })).json.error.code).toBe('INVALID_PLACEMENT');
    expect((await move(backlog[0].id, { status: 'done' }, ctx.viewer.token)).status).toBe(403);
  });

  it('rebalances a column when gaps are exhausted', async () => {
    const anchor = (await column('backlog'))[0];
    const x = await create('Task X');
    const y = await create('Task Y');
    await move(x.id, { status: 'backlog', prevTaskId: anchor.id });
    let rebalanced = false;
    let moves = 0;
    for (let i = 0; i < 20 && !rebalanced; i++) {
      const r = await move((i % 2 === 0 ? y : x).id, { status: 'backlog', prevTaskId: anchor.id });
      rebalanced = r.json.data.rebalanced;
      moves++;
    }
    expect(rebalanced).toBe(true);
    const after = await column('backlog');
    expect(after.map((t) => t.sortOrder)).toEqual(after.map((_, i) => (i + 1) * 1024));
    expect(after[0].id).toBe(anchor.id);
    expect(after[1].title).toBe(moves % 2 === 1 ? 'Task Y' : 'Task X');
  });

  it('serialises concurrent moves (unique sort orders)', async () => {
    const created = [];
    for (let i = 0; i < 10; i++) created.push(await create(`P${i}`));
    const results = await Promise.all(created.map((t) => move(t.id, { status: 'in_review' }, ctx.member2.token)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const review = await column('in_review');
    expect(new Set(review.map((t) => t.sortOrder)).size).toBe(review.length);
  });
});

describe('update, delete, restore', () => {
  it('patches fields but not status', async () => {
    const t = await create('Patch me');
    const r = await call('PATCH', `/tasks/${t.id}`, {
      token: ctx.member.token,
      body: { title: 'Patched', priority: 'high', assigneeId: ctx.uid.dimas, estimateHours: 3.5, actualHours: 1.25 },
    });
    expect(r.json.data).toMatchObject({ title: 'Patched', priority: 'high', estimateHours: 3.5, actualHours: 1.25, assignee: { id: ctx.uid.dimas } });
    expect((await call('PATCH', `/tasks/${t.id}`, { token: ctx.member.token, body: { status: 'done' } })).status).toBe(422);
    expect((await call('PATCH', `/tasks/${t.id}`, { token: ctx.member.token, body: { actualHours: 1000 } })).status).toBe(422);
    expect((await call('PATCH', `/tasks/${t.id}`, { token: ctx.viewer.token, body: { title: 'no' } })).status).toBe(403);
  });

  it('soft-deletes (member) and restores (admin only)', async () => {
    const t = await create('Delete me');
    expect((await call('DELETE', `/tasks/${t.id}`, { token: ctx.member.token })).json.data.deletedAt).toBeTruthy();
    expect((await call('GET', `/tasks/${t.id}`, { token: ctx.member.token })).status).toBe(404);
    expect((await call('POST', `/tasks/${t.id}/restore`, { token: ctx.member.token })).status).toBe(403);
    expect((await call('POST', `/tasks/${t.id}/restore`, { token: ctx.admin.token })).json.data.deletedAt).toBeNull();
  });
});
