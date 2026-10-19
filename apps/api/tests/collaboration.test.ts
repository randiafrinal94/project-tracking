import { beforeAll, describe, expect, it } from 'vitest';
import { call, seedContext, type SeedContext } from './helpers.js';

let ctx: SeedContext;
let project: { id: string };
let task: { id: string; key: string };

beforeAll(async () => {
  ctx = await seedContext();
  project = (await call('POST', `/workspaces/${ctx.ws.id}/projects`, { token: ctx.admin.token, body: { name: 'Collab', keyPrefix: 'COL', status: 'active' } })).json.data;
  task = (await call('POST', `/projects/${project.id}/tasks`, { token: ctx.member.token, body: { title: 'Collab task' } })).json.data;
});

describe('tags', () => {
  it('creates, dedupes and permissions', async () => {
    const qa = await call('POST', `/workspaces/${ctx.ws.id}/tags`, { token: ctx.member.token, body: { name: 'QA', color: '#0ea5e9' } });
    expect(qa.json.data).toMatchObject({ color: '#0EA5E9', usageCount: 0 });
    expect((await call('POST', `/workspaces/${ctx.ws.id}/tags`, { token: ctx.member.token, body: { name: 'qa', color: '#000000' } })).json.error.code).toBe('TAG_NAME_TAKEN');
    expect((await call('POST', `/workspaces/${ctx.ws.id}/tags`, { token: ctx.member.token, body: { name: 'Z', color: 'red' } })).status).toBe(422);

    const set = await call('PUT', `/tasks/${task.id}/tags`, { token: ctx.member.token, body: { tagIds: [qa.json.data.id, ctx.tagId.Backend] } });
    expect(set.json.data.tags.map((t: any) => t.name)).toEqual(['Backend', 'QA']);
    const replaced = await call('PUT', `/tasks/${task.id}/tags`, { token: ctx.member.token, body: { tagIds: [qa.json.data.id] } });
    expect(replaced.json.data.tags).toHaveLength(1);

    expect((await call('PATCH', `/tags/${qa.json.data.id}`, { token: ctx.member.token, body: { color: '#111111' } })).status).toBe(403);
    const patched = await call('PATCH', `/tags/${qa.json.data.id}`, { token: ctx.admin.token, body: { color: '#111111' } });
    expect(patched.json.data.usageCount).toBe(1); // regression: correlated subquery
  });
});

describe('subtasks', () => {
  it('supports the checklist lifecycle', async () => {
    const ids: string[] = [];
    for (const title of ['Spec', 'Build', 'Review']) {
      ids.push((await call('POST', `/tasks/${task.id}/subtasks`, { token: ctx.member.token, body: { title } })).json.data.id);
    }
    expect((await call('PATCH', `/subtasks/${ids[0]}`, { token: ctx.member.token, body: { isCompleted: true } })).json.data.completedAt).toBeTruthy();
    expect((await call('GET', `/tasks/${task.id}/subtasks`, { token: ctx.viewer.token })).json.data.progress).toEqual({ total: 3, completed: 1, percent: 33 });

    const reorder = await call('PUT', `/tasks/${task.id}/subtasks/order`, { token: ctx.member.token, body: { subtaskIds: [ids[2], ids[0], ids[1]] } });
    expect(reorder.json.data.items.map((s: any) => s.title)).toEqual(['Review', 'Spec', 'Build']);
    expect((await call('PUT', `/tasks/${task.id}/subtasks/order`, { token: ctx.member.token, body: { subtaskIds: [ids[0]] } })).status).toBe(422);
    expect((await call('PATCH', `/subtasks/${ids[1]}`, { token: ctx.viewer.token, body: { isCompleted: true } })).status).toBe(403);
    expect((await call('DELETE', `/subtasks/${ids[1]}`, { token: ctx.member.token })).status).toBe(200);

    const detail = (await call('GET', `/tasks/${task.id}`, { token: ctx.viewer.token })).json.data;
    expect(detail.checklist).toHaveLength(2);
    expect(detail.subtasks).toEqual({ total: 2, completed: 1 });
  });
});

describe('comments', () => {
  it('stores raw markdown and safe HTML; enforces author/admin rules', async () => {
    const body = 'LGTM **today** x<y\n<script>alert(1)</script>\n[l](javascript:alert(1))';
    const c = (await call('POST', `/tasks/${task.id}/comments`, { token: ctx.member.token, body: { body } })).json.data;
    expect(c.body).toBe(body);
    expect(c.bodyHtml).toContain('<strong>today</strong>');
    expect(c.bodyHtml).toContain('x&lt;y');
    expect(c.bodyHtml).not.toMatch(/<script|javascript:/i);

    expect((await call('POST', `/tasks/${task.id}/comments`, { token: ctx.viewer.token, body: { body: 'hi' } })).status).toBe(403);
    expect((await call('PATCH', `/comments/${c.id}`, { token: ctx.admin.token, body: { body: 'hijack' } })).status).toBe(403);
    const edited = await call('PATCH', `/comments/${c.id}`, { token: ctx.member.token, body: { body: 'Edited _text_' } });
    expect(edited.json.data.bodyHtml).toBe('<p>Edited <em>text</em></p>');

    const other = (await call('POST', `/tasks/${task.id}/comments`, { token: ctx.member2.token, body: { body: 'second' } })).json.data;
    expect((await call('DELETE', `/comments/${other.id}`, { token: ctx.member.token })).status).toBe(403);
    expect((await call('DELETE', `/comments/${other.id}`, { token: ctx.admin.token })).status).toBe(200);
    const listed = (await call('GET', `/tasks/${task.id}/comments`, { token: ctx.viewer.token })).json.data.items;
    expect(listed.map((x: any) => x.id)).toEqual([c.id]);
  });
});

describe('milestones', () => {
  it('tracks progress and detaches tasks on delete', async () => {
    const m = (await call('POST', `/projects/${project.id}/milestones`, { token: ctx.admin.token, body: { name: 'Beta', dueDate: '2026-12-31' } })).json.data;
    expect((await call('POST', `/projects/${project.id}/milestones`, { token: ctx.member.token, body: { name: 'x' } })).status).toBe(403);
    const t2 = (await call('POST', `/projects/${project.id}/tasks`, { token: ctx.member.token, body: { title: 'Second', milestoneId: m.id } })).json.data;
    await call('PATCH', `/tasks/${task.id}`, { token: ctx.member.token, body: { milestoneId: m.id } });
    await call('PATCH', `/tasks/${t2.id}/move`, { token: ctx.member.token, body: { status: 'done' } });
    const progress = (await call('GET', `/projects/${project.id}/milestones`, { token: ctx.viewer.token })).json.data[0].progress;
    expect(progress).toEqual({ total: 2, completed: 1, percent: 50 });

    expect((await call('PATCH', `/milestones/${m.id}`, { token: ctx.admin.token, body: { completed: true } })).json.data.isCompleted).toBe(true);
    await call('DELETE', `/milestones/${m.id}`, { token: ctx.admin.token });
    expect((await call('GET', `/tasks/${task.id}`, { token: ctx.viewer.token })).json.data.milestone).toBeNull();
  });
});

describe('activity log (DB triggers)', () => {
  it('records task events with the actor', async () => {
    const feed = (await call('GET', `/tasks/${task.id}/activity?limit=100`, { token: ctx.viewer.token })).json.data.items;
    const actions = new Set(feed.map((a: any) => a.action));
    for (const a of ['task.created', 'task.tag_added', 'task.tag_removed', 'subtask.created', 'subtask.completed', 'subtask.deleted', 'comment.created', 'comment.edited', 'task.updated']) {
      expect(actions, a).toContain(a);
    }
    expect(feed.find((a: any) => a.action === 'task.created')).toMatchObject({ actor: { fullName: 'Citra Lestari' }, metadata: { key: task.key } });
  });

  it('logs moves but not pure reorders', async () => {
    const a = (await call('POST', `/projects/${project.id}/tasks`, { token: ctx.member.token, body: { title: 'Mover' } })).json.data;
    const b = (await call('POST', `/projects/${project.id}/tasks`, { token: ctx.member.token, body: { title: 'Other' } })).json.data;
    await call('PATCH', `/tasks/${a.id}/move`, { token: ctx.member.token, body: { status: 'backlog', prevTaskId: b.id } });
    await call('PATCH', `/tasks/${a.id}/move`, { token: ctx.member.token, body: { status: 'in_progress' } });
    const moves = (await call('GET', `/tasks/${a.id}/activity`, { token: ctx.viewer.token })).json.data.items.filter((x: any) => x.action === 'task.moved');
    expect(moves).toHaveLength(1);
    expect(moves[0].metadata).toMatchObject({ from: 'backlog', to: 'in_progress' });
  });

  it('paginates the workspace feed without duplicates', async () => {
    const ids: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 3; i++) {
      const page: any = (await call('GET', `/workspaces/${ctx.ws.id}/activity?limit=5${cursor ? `&cursor=${cursor}` : ''}`, { token: ctx.viewer.token })).json.data;
      ids.push(...page.items.map((x: any) => x.id));
      cursor = page.nextCursor;
    }
    expect(new Set(ids).size).toBe(15);
  });
});

describe('isolation', () => {
  it('hides resources of deleted projects and other workspaces', async () => {
    const outsider = (await call('POST', '/auth/register', { body: { email: `o${Date.now()}@x.test`, password: 'Secret123', fullName: 'Out' } })).json.data.accessToken;
    expect((await call('GET', `/tasks/${task.id}`, { token: outsider })).status).toBe(404);
    expect((await call('PATCH', `/tags/${ctx.tagId.Bug}`, { token: outsider, body: { name: 'x' } })).status).toBe(404);
    await call('DELETE', `/projects/${project.id}`, { token: ctx.admin.token });
    expect((await call('GET', `/tasks/${task.id}`, { token: ctx.admin.token })).status).toBe(404);
    expect((await call('GET', `/tasks/${task.id}/subtasks`, { token: ctx.admin.token })).status).toBe(404);
  });
});
