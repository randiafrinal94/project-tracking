import { seedDatabase } from '@pt/db/prepare';
import { expect } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db.js';

export const app = createApp();
export const PASSWORD = 'Password123!';

export interface CallOptions {
  token?: string;
  body?: unknown;
  cookie?: string;
  form?: FormData;
  raw?: string;
  headers?: Record<string, string>;
}

export interface CallResult<T = any> {
  status: number;
  json: { success: boolean; data: T; error: { code: string; message: string; details?: any } | null; timestamp: string };
  headers: Headers;
  setCookie: string | null;
}

/** Request in-process ke app Hono (tanpa server HTTP). */
export async function call<T = any>(method: string, path: string, opts: CallOptions = {}): Promise<CallResult<T>> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.Cookie = opts.cookie;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.raw !== undefined) {
    body = opts.raw;
    headers['Content-Type'] = 'application/json';
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await app.request(path.startsWith('/health') ? path : `/api/v1${path}`, { method, headers, body });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, headers: res.headers, setCookie: res.headers.get('set-cookie') };
}

export const cookieOf = (setCookie: string | null) => setCookie?.split(';')[0];

export async function login(email: string) {
  const r = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  expect(r.status, `login ${email}`).toBe(200);
  return { token: r.json.data.accessToken as string, cookie: cookieOf(r.setCookie)!, user: r.json.data.user };
}

/** Kembalikan DB test ke data seed (dipanggil di beforeAll tiap file). */
export async function resetData() {
  await seedDatabase(db, { quiet: true });
}

/** Konteks seed standar: token per role + id workspace/project. */
export async function seedContext() {
  await resetData();
  const [owner, admin, member, member2, viewer] = await Promise.all([
    login('alya@acme.test'),
    login('bima@acme.test'),
    login('citra@acme.test'),
    login('dimas@acme.test'),
    login('eka@client.test'),
  ]);
  const ws = (await call('GET', '/workspaces', { token: owner.token })).json.data[0];
  const projects = (await call('GET', `/workspaces/${ws.id}/projects`, { token: owner.token })).json.data;
  const prj = projects.find((p: any) => p.keyPrefix === 'PRJ');
  const core = projects.find((p: any) => p.keyPrefix === 'CORE');
  const members = (await call('GET', `/workspaces/${ws.id}/members`, { token: owner.token })).json.data;
  const uid = Object.fromEntries(members.map((m: any) => [m.email.split('@')[0], m.userId])) as Record<string, string>;
  const tags = (await call('GET', `/workspaces/${ws.id}/tags`, { token: owner.token })).json.data;
  const tagId = Object.fromEntries(tags.map((t: any) => [t.name, t.id])) as Record<string, string>;
  return { owner, admin, member, member2, viewer, ws, prj, core, uid, tagId };
}

export type SeedContext = Awaited<ReturnType<typeof seedContext>>;
