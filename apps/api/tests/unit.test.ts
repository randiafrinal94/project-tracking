import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/error-handler.js';
import { rateLimit } from '../src/lib/rate-limit.js';
import { renderMarkdown, sanitizeRichText } from '../src/lib/sanitize.js';
import { sanitizeFileName } from '../src/modules/attachments/attachments.routes.js';
import type { AppEnv } from '../src/types.js';

describe('renderMarkdown (comments)', () => {
  it('renders markdown and keeps literal text', () => {
    expect(renderMarkdown('x<y and y>z & `<div>`')).toBe('<p>x&lt;y and y&gt;z &amp; <code>&lt;div&gt;</code></p>');
    expect(renderMarkdown('**bold** _it_')).toBe('<p><strong>bold</strong> <em>it</em></p>');
  });

  it('neutralises raw HTML (shown as text, never as elements)', () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<script|<img/i);
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops javascript: hrefs', () => {
    const html = renderMarkdown('see [x](javascript:alert(1)) now');
    expect(html).toContain('<a');
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it('hardens links', () => {
    expect(renderMarkdown('[ok](https://a.test)')).toContain('rel="noopener noreferrer nofollow" target="_blank"');
  });
});

describe('sanitizeRichText (descriptions)', () => {
  it('keeps allow-listed tags and strips the rest', () => {
    const out = sanitizeRichText('<p onclick="x">Hi <strong>ok</strong><script>bad()</script></p><iframe src="//e"></iframe>');
    expect(out).toBe('<p>Hi <strong>ok</strong></p>');
  });
});

describe('sanitizeFileName', () => {
  it('drops path components and control characters', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\Users\\x\\report.pdf')).toBe('report.pdf');
    expect(sanitizeFileName('a\u0000b"<>|.txt')).toBe('ab.txt');
    expect(sanitizeFileName('   ')).toBe('file');
  });
});

describe('rateLimit', () => {
  it('returns 429 with Retry-After after the limit', async () => {
    const app = new Hono<AppEnv>()
      .use(rateLimit({ name: 'unit', windowMs: 60_000, max: 3 }))
      .get('/', (c) => c.text('ok'));
    app.onError(errorHandler);
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await app.request('/')).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    expect((await app.request('/')).headers.get('Retry-After')).toBeTruthy();
  });
});
