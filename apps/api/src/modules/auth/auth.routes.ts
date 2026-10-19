import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { env, isProduction } from '../../config/env.js';
import { unauthorized } from '../../lib/errors.js';
import { rateLimit } from '../../lib/rate-limit.js';
import { ok } from '../../lib/response.js';
import { validate } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import type { AppEnv } from '../../types.js';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from './auth.schemas.js';
import * as auth from './auth.service.js';

const REFRESH_COOKIE = 'pt_refresh';
const COOKIE_PATH = '/api/v1/auth';

/** Refresh token hanya dikirim via cookie httpOnly; access token di body (disimpan in-memory oleh client). */
function respondWithSession(c: Context<AppEnv>, session: auth.Session, status: 200 | 201 = 200) {
  setCookie(c, REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: COOKIE_PATH,
    expires: session.refreshExpiresAt,
  });
  return ok(
    c,
    { user: session.user, accessToken: session.accessToken, expiresIn: session.expiresIn },
    status,
  );
}

const credentialLimiter = rateLimit({
  name: 'auth',
  windowMs: 60_000,
  max: env.AUTH_RATE_LIMIT_PER_MINUTE,
});

export const authRoutes = new Hono<AppEnv>()
  .post('/register', credentialLimiter, validate('json', registerSchema), async (c) => {
    const session = await auth.register(c.req.valid('json'), c.req.header('User-Agent'));
    return respondWithSession(c, session, 201);
  })
  .post('/login', credentialLimiter, validate('json', loginSchema), async (c) => {
    const session = await auth.login(c.req.valid('json'), c.req.header('User-Agent'));
    return respondWithSession(c, session);
  })
  .post('/refresh', async (c) => {
    const token = getCookie(c, REFRESH_COOKIE);
    if (!token) throw unauthorized('Refresh token missing', 'INVALID_REFRESH_TOKEN');
    try {
      return respondWithSession(c, await auth.refresh(token, c.req.header('User-Agent')));
    } catch (error) {
      deleteCookie(c, REFRESH_COOKIE, { path: COOKIE_PATH });
      throw error;
    }
  })
  .post('/logout', async (c) => {
    const token = getCookie(c, REFRESH_COOKIE);
    if (token) await auth.logout(token);
    deleteCookie(c, REFRESH_COOKIE, { path: COOKIE_PATH });
    return ok(c, { loggedOut: true });
  })
  .get('/me', requireAuth, async (c) => ok(c, await auth.getMe(c.var.user.id)))
  .patch('/me', requireAuth, validate('json', updateProfileSchema), async (c) =>
    ok(c, await auth.updateProfile(c.var.user.id, c.req.valid('json'))),
  )
  .post('/password', requireAuth, credentialLimiter, validate('json', changePasswordSchema), async (c) =>
    respondWithSession(c, await auth.changePassword(c.var.user.id, c.req.valid('json'), c.req.header('User-Agent'))),
  );
