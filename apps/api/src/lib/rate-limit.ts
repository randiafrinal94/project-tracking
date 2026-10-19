import { getConnInfo } from '@hono/node-server/conninfo';
import { createMiddleware } from 'hono/factory';
import { AppError } from './errors.js';

interface Options {
  /** Jendela waktu dalam milidetik. */
  windowMs: number;
  /** Maksimum request per IP per jendela. */
  max: number;
  /** Pemisah bucket antar endpoint. */
  name: string;
}

/**
 * Rate limiter fixed-window in-memory per IP. Cukup untuk single instance;
 * ganti ke Redis bila API di-scale horizontal.
 */
export function rateLimit({ windowMs, max, name }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return createMiddleware(async (c, next) => {
    let ip = 'unknown';
    try {
      ip = getConnInfo(c).remote.address ?? 'unknown';
    } catch {
      // Request in-process (mis. app.request di test) tidak punya socket.
    }
    const key = `${name}:${ip}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else if (++entry.count > max) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later');
    }

    await next();
  });
}
