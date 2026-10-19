import { createHash, randomBytes } from 'node:crypto';
import { sign, verify } from 'hono/jwt';
import { env } from '../config/env.js';
import type { AuthUser } from '../types.js';
import { unauthorized } from './errors.js';

const ALG = 'HS256';
const ISSUER = 'project-tracker-api';

export async function signAccessToken(user: AuthUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: user.id,
      email: user.email,
      typ: 'access',
      iss: ISSUER,
      iat: now,
      exp: now + env.JWT_ACCESS_TTL_SECONDS,
    },
    env.JWT_SECRET,
    ALG,
  );
}

export async function verifyAccessToken(token: string): Promise<AuthUser> {
  try {
    const payload = await verify(token, env.JWT_SECRET, { alg: ALG, iss: ISSUER });
    if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new Error('invalid claims');
    }
    return { id: payload.sub, email: payload.email };
  } catch {
    throw unauthorized('Invalid or expired access token', 'INVALID_TOKEN');
  }
}

/** Refresh token opaque 256-bit; hanya hash-nya yang disimpan di DB. */
export const generateRefreshToken = () => randomBytes(32).toString('base64url');

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
