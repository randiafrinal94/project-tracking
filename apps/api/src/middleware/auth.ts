import { createMiddleware } from 'hono/factory';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import type { AppEnv } from '../types.js';

/** Mewajibkan header `Authorization: Bearer <access token>`. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw unauthorized();

  c.set('user', await verifyAccessToken(match[1]));
  await next();
});
