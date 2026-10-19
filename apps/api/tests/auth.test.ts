import { beforeAll, describe, expect, it } from 'vitest';
import { call, cookieOf, login, PASSWORD, resetData } from './helpers.js';

beforeAll(resetData);

describe('health & envelope', () => {
  it('GET /health reports the database', async () => {
    const r = await call('GET', '/health');
    expect(r.status).toBe(200);
    expect(r.json.data).toEqual({ status: 'ok', database: 'up' });
    expect(Object.keys(r.json).sort()).toEqual(['data', 'error', 'success', 'timestamp']);
    expect(r.headers.get('x-request-id')).toBeTruthy();
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('unknown routes use the standard envelope', async () => {
    const r = await call('GET', '/nope');
    expect(r.status).toBe(404);
    expect(r.json.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('login', () => {
  it('returns an access token and an httpOnly refresh cookie', async () => {
    const r = await call('POST', '/auth/login', { body: { email: 'ALYA@acme.test', password: PASSWORD } });
    expect(r.status).toBe(200);
    expect(r.json.data.accessToken).toBeTruthy();
    expect(r.json.data.user.passwordHash).toBeUndefined();
    expect(r.setCookie).toMatch(/HttpOnly/i);
    expect(r.setCookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('rejects wrong password and unknown email identically', async () => {
    const a = await call('POST', '/auth/login', { body: { email: 'alya@acme.test', password: 'wrong' } });
    const b = await call('POST', '/auth/login', { body: { email: 'ghost@acme.test', password: 'x' } });
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(a.json.error.code).toBe('INVALID_CREDENTIALS');
    expect(b.json.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('validates bodies strictly', async () => {
    const extra = await call('POST', '/auth/login', { body: { email: 'a@b.co', password: 'x', admin: true } });
    expect(extra.status).toBe(422);
    const malformed = await call('POST', '/auth/login', { raw: '{bad' });
    expect(malformed.status).toBeGreaterThanOrEqual(400);
    expect(malformed.status).toBeLessThan(500);
  });
});

describe('register', () => {
  it('creates an account and lowercases the email', async () => {
    const email = `new.${Date.now()}@acme.test`;
    const r = await call('POST', '/auth/register', { body: { email: email.toUpperCase(), password: 'Secret123', fullName: 'New User' } });
    expect(r.status).toBe(201);
    expect(r.json.data.user.email).toBe(email);
    const dup = await call('POST', '/auth/register', { body: { email, password: 'Secret123', fullName: 'Dup' } });
    expect(dup.status).toBe(409);
    expect(dup.json.error.code).toBe('EMAIL_TAKEN');
  });

  it('reports field errors', async () => {
    const r = await call('POST', '/auth/register', { body: { email: 'nope', password: 'short', fullName: '' } });
    expect(r.status).toBe(422);
    expect(r.json.error.details.length).toBeGreaterThanOrEqual(3);
  });
});

describe('access token', () => {
  it('guards protected routes', async () => {
    expect((await call('GET', '/auth/me')).status).toBe(401);
    const { token } = await login('alya@acme.test');
    const tampered = await call('GET', '/workspaces', { token: `${token}x` });
    expect(tampered.status).toBe(401);
    expect(tampered.json.error.code).toBe('INVALID_TOKEN');
    const me = await call('GET', '/auth/me', { token });
    expect(me.json.data.workspaces[0].role).toBe('owner');
  });
});

describe('refresh token rotation', () => {
  it('rotates, detects reuse and revokes the whole family', async () => {
    const s = await login('dimas@acme.test');
    const r1 = await call('POST', '/auth/refresh', { cookie: s.cookie });
    const c2 = cookieOf(r1.setCookie);
    expect(r1.status).toBe(200);
    expect(c2).not.toBe(s.cookie);

    const reuse = await call('POST', '/auth/refresh', { cookie: s.cookie });
    expect(reuse.status).toBe(401);
    expect(reuse.json.error.code).toBe('REFRESH_TOKEN_REUSED');
    expect((await call('POST', '/auth/refresh', { cookie: c2 })).status).toBe(401);
  });

  it('allows only one of two concurrent refreshes with the same token', async () => {
    const s = await login('dimas@acme.test');
    const results = await Promise.all([1, 2].map(() => call('POST', '/auth/refresh', { cookie: s.cookie })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('logout revokes the session', async () => {
    const s = await login('dimas@acme.test');
    expect((await call('POST', '/auth/logout', { cookie: s.cookie })).status).toBe(200);
    expect((await call('POST', '/auth/refresh', { cookie: s.cookie })).status).toBe(401);
  });
});
