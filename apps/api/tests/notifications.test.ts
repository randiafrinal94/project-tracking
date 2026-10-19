import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eventHub } from '../src/lib/realtime.js';
import { app, call, login, seedContext, type SeedContext } from './helpers.js';

let ctx: SeedContext;
let task: { id: string; key: string };

beforeAll(async () => {
  ctx = await seedContext();
  // Task milik Dimas (assignee) dengan reporter Citra.
  task = (await call('POST', `/projects/${ctx.prj.id}/tasks`, {
    token: ctx.member.token,
    body: { title: 'Notify me', assigneeId: ctx.uid.dimas },
  })).json.data;
});

afterAll(() => eventHub.close());

const inbox = async (token: string, qs = '') =>
  (await call('GET', `/workspaces/${ctx.ws.id}/notifications${qs ? `?${qs}` : ''}`, { token })).json.data;

describe('notifications', () => {
  it('notifies the assignee (not self-assignments)', async () => {
    const d = await inbox(ctx.member2.token);
    const n = d.items.find((x: any) => x.type === 'task.assigned' && x.taskId === task.id);
    expect(n).toMatchObject({ actor: { fullName: 'Citra Lestari' }, metadata: { key: task.key, title: 'Notify me' }, readAt: null });
    expect(d.unreadCount).toBeGreaterThan(0);

    await call('PATCH', `/tasks/${task.id}`, { token: ctx.member.token, body: { assigneeId: ctx.uid.citra } });
    expect((await inbox(ctx.member.token)).items.some((x: any) => x.type === 'task.assigned' && x.taskId === task.id)).toBe(false);
    await call('PATCH', `/tasks/${task.id}`, { token: ctx.member.token, body: { assigneeId: ctx.uid.dimas } });
  });

  it('handles @mentions and comment notifications without duplicates', async () => {
    const before = (await inbox(ctx.admin.token)).items.length;
    const c = (await call('POST', `/tasks/${task.id}/comments`, {
      token: ctx.owner.token,
      body: { body: 'Hey @bima and @dimas please check. `@citra` in code is ignored. @nobody too.' },
    })).json.data;

    expect(c.bodyHtml).toContain('<span class="mention"');
    expect(c.bodyHtml).toContain('>@bima</span>');
    expect(c.bodyHtml).toContain('<code>@citra</code>');
    expect(c.bodyHtml).not.toContain('data-user-id="' + ctx.uid.citra);

    const bima = (await inbox(ctx.admin.token)).items;
    expect(bima.length).toBe(before + 1);
    expect(bima[0]).toMatchObject({ type: 'comment.mention', actor: { fullName: 'Alya Pratama' } });

    // Dimas = assignee & di-mention → satu notifikasi mention saja.
    const dimas = (await inbox(ctx.member2.token)).items.filter((x: any) => x.metadata.commentId === c.id);
    expect(dimas.map((x: any) => x.type)).toEqual(['comment.mention']);
    // Citra = reporter, hanya disebut di dalam code → notifikasi comment.created.
    const citra = (await inbox(ctx.member.token)).items.filter((x: any) => x.metadata.commentId === c.id);
    expect(citra.map((x: any) => x.type)).toEqual(['comment.created']);
  });

  it('marks notifications as read and isolates users', async () => {
    const { items, unreadCount } = await inbox(ctx.member2.token, 'unread=true');
    expect(items.length).toBe(unreadCount);
    const one = await call('POST', `/workspaces/${ctx.ws.id}/notifications/read`, { token: ctx.member2.token, body: { ids: [items[0].id] } });
    expect(one.json.data.unreadCount).toBe(unreadCount - 1);

    // Tidak bisa menandai notifikasi milik user lain.
    const bimaUnread = (await inbox(ctx.admin.token, 'unread=true')).unreadCount;
    const bimaItem = (await inbox(ctx.admin.token, 'unread=true')).items[0];
    await call('POST', `/workspaces/${ctx.ws.id}/notifications/read`, { token: ctx.member2.token, body: { ids: [bimaItem.id] } });
    expect((await inbox(ctx.admin.token, 'unread=true')).unreadCount).toBe(bimaUnread);

    const all = await call('POST', `/workspaces/${ctx.ws.id}/notifications/read`, { token: ctx.member2.token, body: { all: true } });
    expect(all.json.data.unreadCount).toBe(0);
  });
});

describe('profile & password', () => {
  it('updates the profile', async () => {
    const r = await call('PATCH', '/auth/me', { token: ctx.member.token, body: { fullName: 'Citra L.' } });
    expect(r.json.data.user.fullName).toBe('Citra L.');
    expect((await call('PATCH', '/auth/me', { token: ctx.member.token, body: { avatarUrl: 'javascript:alert(1)' } })).status).toBe(422);
    await call('PATCH', '/auth/me', { token: ctx.member.token, body: { fullName: 'Citra Lestari' } });
  });

  it('changes the password and revokes other sessions', async () => {
    const other = await login('dimas@acme.test');
    const wrong = await call('POST', '/auth/password', { token: ctx.member2.token, body: { currentPassword: 'nope', newPassword: 'NewSecret123' } });
    expect(wrong.json.error.code).toBe('INVALID_PASSWORD');

    const ok = await call('POST', '/auth/password', { token: ctx.member2.token, body: { currentPassword: 'Password123!', newPassword: 'NewSecret123' } });
    expect(ok.status).toBe(200);
    expect(ok.json.data.accessToken).toBeTruthy();
    expect((await call('POST', '/auth/refresh', { cookie: other.cookie })).status).toBe(401);
    expect((await call('POST', '/auth/login', { body: { email: 'dimas@acme.test', password: 'NewSecret123' } })).status).toBe(200);
  });
});

describe('realtime (SSE)', () => {
  async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, needle: string, timeoutMs = 5000) {
    const decoder = new TextDecoder();
    let buffer = '';
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await Promise.race([
        reader.read(),
        new Promise<{ timeout: true }>((r) => setTimeout(() => r({ timeout: true }), deadline - Date.now())),
      ]);
      if ('timeout' in result || result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      if (buffer.includes(needle)) return buffer;
    }
    throw new Error(`Timed out waiting for "${needle}". Got: ${buffer}`);
  }

  it('rejects bad tokens and non-members', async () => {
    expect((await app.request(`/api/v1/events?workspaceId=${ctx.ws.id}&token=bad`)).status).toBe(401);
    const outsider = (await call('POST', '/auth/register', { body: { email: `o${Date.now()}@x.test`, password: 'Secret123', fullName: 'Out' } })).json.data.accessToken;
    expect((await app.request(`/api/v1/events?workspaceId=${ctx.ws.id}&token=${outsider}`)).status).toBe(404);
  });

  it('streams activity and personal notification events', async () => {
    const res = await app.request(`/api/v1/events?workspaceId=${ctx.ws.id}&token=${ctx.member2.token}`);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-transform');
    const reader = res.body!.getReader();
    await readUntil(reader, 'event: ready');

    await call('PATCH', `/tasks/${task.id}/move`, { token: ctx.member.token, body: { status: 'in_review' } });
    const activity = await readUntil(reader, '"action":"task.moved"');
    expect(activity).toContain(`"taskId":"${task.id}"`);

    await call('POST', `/tasks/${task.id}/comments`, { token: ctx.owner.token, body: { body: 'ping @dimas' } });
    const notification = await readUntil(reader, 'event: notification');
    expect(notification).toContain(`"userId":"${ctx.uid.dimas}"`);

    await reader.cancel();
    await new Promise((r) => setTimeout(r, 50));
    expect(eventHub.subscriberCount).toBe(0);
  });

  it('does not leak other users notifications', async () => {
    const res = await app.request(`/api/v1/events?workspaceId=${ctx.ws.id}&token=${ctx.viewer.token}`);
    const reader = res.body!.getReader();
    await readUntil(reader, 'event: ready');
    await call('POST', `/tasks/${task.id}/comments`, { token: ctx.owner.token, body: { body: 'again @dimas' } });
    const chunk = await readUntil(reader, '"action":"comment.created"');
    expect(chunk).not.toContain('event: notification');
    await reader.cancel();
  });
});
