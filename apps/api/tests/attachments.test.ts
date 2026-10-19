import { readdir } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { storageDir } from '../src/config/env.js';
import { app, call, seedContext, type SeedContext } from './helpers.js';

let ctx: SeedContext;
let taskId: string;

const PNG_1PX = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

const form = (...files: File[]) => {
  const f = new FormData();
  for (const file of files) f.append('file', file);
  return f;
};

const download = (id: string, token: string, qs = '') =>
  app.request(`/api/v1/attachments/${id}/download${qs}`, { headers: { Authorization: `Bearer ${token}` } });

beforeAll(async () => {
  ctx = await seedContext();
  taskId = (await call('GET', `/projects/${ctx.prj.id}/tasks?q=PRJ-7`, { token: ctx.viewer.token })).json.data.items[0].id;
});

describe('attachments (local disk)', () => {
  let pngId: string;
  let htmlId: string;

  it('uploads multiple files and lists them', async () => {
    const r = await call('POST', `/tasks/${taskId}/attachments`, {
      token: ctx.member.token,
      form: form(
        new File([PNG_1PX], 'pixel.png', { type: 'image/png' }),
        new File(['<script>alert(1)</script>'], '../../evil.html', { type: 'text/html' }),
      ),
    });
    expect(r.status).toBe(201);
    expect(r.json.data).toHaveLength(2);
    const png = r.json.data.find((a: any) => a.fileName === 'pixel.png');
    const html = r.json.data.find((a: any) => a.mimeType === 'text/html');
    expect(png).toMatchObject({ previewable: true, sizeBytes: PNG_1PX.length, uploadedBy: { fullName: 'Citra Lestari' } });
    expect(html.fileName).toBe('evil.html'); // komponen path dibuang
    expect(html.previewable).toBe(false);
    pngId = png.id;
    htmlId = html.id;

    const listed = await call('GET', `/tasks/${taskId}/attachments`, { token: ctx.viewer.token });
    expect(listed.json.data).toHaveLength(2);
    const card = (await call('GET', `/tasks/${taskId}`, { token: ctx.viewer.token })).json.data;
    expect(card.attachmentCount).toBe(2);
  });

  it('stores files under server-generated keys inside STORAGE_DIR', async () => {
    const files = await readdir(`${storageDir}/${taskId}`);
    expect(files).toHaveLength(2);
    expect(files.every((f) => /^[0-9a-f-]{36}$/.test(f))).toBe(true);
  });

  it('serves images inline only on request, everything else as download', async () => {
    const inline = await download(pngId, ctx.viewer.token, '?inline=1');
    expect(inline.status).toBe(200);
    expect(inline.headers.get('content-type')).toBe('image/png');
    expect(inline.headers.get('content-disposition')).toMatch(/^inline/);
    expect(new Uint8Array(await inline.arrayBuffer())).toEqual(PNG_1PX);

    const html = await download(htmlId, ctx.viewer.token, '?inline=1');
    expect(html.headers.get('content-disposition')).toMatch(/^attachment; filename="evil.html"/);
    expect(html.headers.get('x-content-type-options')).toBe('nosniff');
    expect(html.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('validates uploads', async () => {
    const none = await call('POST', `/tasks/${taskId}/attachments`, { token: ctx.member.token, form: new FormData() });
    expect(none.json.error.code).toBe('NO_FILE');
    const empty = await call('POST', `/tasks/${taskId}/attachments`, { token: ctx.member.token, form: form(new File([], 'empty.txt')) });
    expect(empty.json.error.code).toBe('EMPTY_FILE');
    // MAX_UPLOAD_MB=1 di env test
    const big = await call('POST', `/tasks/${taskId}/attachments`, {
      token: ctx.member.token,
      form: form(new File([new Uint8Array(1024 * 1024 + 10)], 'big.bin')),
    });
    expect(big.status).toBe(413);
    expect((await call('POST', `/tasks/${taskId}/attachments`, { token: ctx.viewer.token, form: form(new File(['x'], 'a.txt')) })).status).toBe(403);
  });

  it('logs activity and enforces delete permissions', async () => {
    const feed = (await call('GET', `/tasks/${taskId}/activity`, { token: ctx.viewer.token })).json.data.items;
    expect(feed.some((a: any) => a.action === 'attachment.added' && a.metadata.fileName === 'pixel.png')).toBe(true);

    expect((await call('DELETE', `/attachments/${pngId}`, { token: ctx.member2.token })).status).toBe(403);
    expect((await call('DELETE', `/attachments/${pngId}`, { token: ctx.member.token })).status).toBe(200);
    expect((await call('DELETE', `/attachments/${htmlId}`, { token: ctx.admin.token })).status).toBe(200);
    expect(await readdir(`${storageDir}/${taskId}`)).toHaveLength(0);
    expect((await download(pngId, ctx.viewer.token)).status).toBe(404);
  });

  it('hides attachments from outsiders', async () => {
    const r = await call('POST', `/tasks/${taskId}/attachments`, { token: ctx.member.token, form: form(new File(['secret'], 's.txt', { type: 'text/plain' })) });
    const outsider = (await call('POST', '/auth/register', { body: { email: `o${Date.now()}@x.test`, password: 'Secret123', fullName: 'Out' } })).json.data.accessToken;
    expect((await download(r.json.data[0].id, outsider)).status).toBe(404);
  });
});
