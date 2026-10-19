import { beforeAll, describe, expect, it } from 'vitest';
import { call, seedContext, type SeedContext } from './helpers.js';

let ctx: SeedContext;
let outsider: { token: string; id: string; email: string; canCreateWorkspace: boolean };

beforeAll(async () => {
  ctx = await seedContext();
  const r = await call('POST', '/auth/register', {
    body: { email: `outsider.${Date.now()}@x.test`, password: 'Secret123', fullName: 'Out Sider' },
  });
  outsider = { token: r.json.data.accessToken, ...r.json.data.user };
});

describe('workspaces', () => {
  it('lists memberships with counts', async () => {
    const r = await call('GET', '/workspaces', { token: ctx.owner.token });
    expect(r.json.data[0]).toMatchObject({ slug: 'acme-corp', role: 'owner', memberCount: 5, projectCount: 2 });
  });

  it('GET by id has correct counts (regression: correlated subquery)', async () => {
    const r = await call('GET', `/workspaces/${ctx.ws.id}`, { token: ctx.viewer.token });
    expect(r.json.data).toMatchObject({ role: 'viewer', memberCount: 5, projectCount: 2 });
  });

  it('hides workspaces from non-members (404, not 403)', async () => {
    expect((await call('GET', `/workspaces/${ctx.ws.id}`, { token: outsider.token })).status).toBe(404);
    expect((await call('GET', '/workspaces/not-a-uuid', { token: ctx.owner.token })).status).toBe(404);
  });

  it('auto-generates a unique slug', async () => {
    const r = await call('POST', '/workspaces', { token: ctx.owner.token, body: { name: 'Acme Corp' } });
    expect(r.status).toBe(201);
    expect(r.json.data.slug).toMatch(/^acme-corp-[0-9a-f]{4}$/);
    const taken = await call('POST', '/workspaces', { token: ctx.owner.token, body: { name: 'X', slug: 'acme-corp' } });
    expect(taken.json.error.code).toBe('SLUG_TAKEN');
    expect((await call('DELETE', `/workspaces/${r.json.data.id}`, { token: ctx.owner.token })).status).toBe(200);
  });

  it('lets only owner-level accounts create workspaces', async () => {
    expect(ctx.owner.user.canCreateWorkspace).toBe(true);
    expect(outsider.canCreateWorkspace).toBe(false);
    for (const token of [ctx.admin.token, ctx.member.token, ctx.viewer.token, outsider.token]) {
      const r = await call('POST', '/workspaces', { token, body: { name: 'Side project' } });
      expect(r.status).toBe(403);
    }
    const r = await call('POST', '/workspaces', { token: ctx.owner.token, body: { name: 'Side project' } });
    expect(r.status).toBe(201);
    expect((await call('DELETE', `/workspaces/${r.json.data.id}`, { token: ctx.owner.token })).status).toBe(200);
  });

  it('enforces roles for update/delete', async () => {
    expect((await call('PATCH', `/workspaces/${ctx.ws.id}`, { token: ctx.member.token, body: { name: 'x' } })).status).toBe(403);
    expect((await call('PATCH', `/workspaces/${ctx.ws.id}`, { token: ctx.admin.token, body: { name: 'Acme Corp' } })).status).toBe(200);
    expect((await call('DELETE', `/workspaces/${ctx.ws.id}`, { token: ctx.admin.token })).status).toBe(403);
  });
});

describe('members', () => {
  const path = () => `/workspaces/${ctx.ws.id}/members`;

  it('lists members owner first', async () => {
    const r = await call('GET', path(), { token: ctx.viewer.token });
    expect(r.json.data).toHaveLength(5);
    expect(r.json.data[0].role).toBe('owner');
  });

  it('applies role-management rules', async () => {
    expect((await call('POST', path(), { token: ctx.admin.token, body: { email: outsider.email, role: 'admin' } })).status).toBe(403);
    expect((await call('POST', path(), { token: ctx.owner.token, body: { email: outsider.email, role: 'owner' } })).status).toBe(422);

    const add = await call('POST', path(), { token: ctx.admin.token, body: { email: outsider.email.toUpperCase(), role: 'viewer' } });
    expect(add.status).toBe(201);
    expect((await call('POST', path(), { token: ctx.admin.token, body: { email: outsider.email } })).json.error.code).toBe('ALREADY_MEMBER');
    expect((await call('POST', path(), { token: ctx.admin.token, body: { email: 'ghost@nowhere.test' } })).status).toBe(404);

    const promote = await call('PATCH', `${path()}/${outsider.id}`, { token: ctx.admin.token, body: { role: 'member' } });
    expect(promote.json.data.role).toBe('member');
    expect((await call('PATCH', `${path()}/${ctx.uid.bima}`, { token: ctx.admin.token, body: { role: 'member' } })).status).toBe(403);
    expect((await call('PATCH', `${path()}/${ctx.uid.alya}`, { token: ctx.admin.token, body: { role: 'member' } })).status).toBe(403);
    expect((await call('DELETE', `${path()}/${ctx.uid.alya}`, { token: ctx.admin.token })).status).toBe(403);
    expect((await call('DELETE', `${path()}/${outsider.id}`, { token: ctx.member.token })).status).toBe(403);
    expect((await call('DELETE', `${path()}/${outsider.id}`, { token: outsider.token })).status).toBe(200);
  });
});
