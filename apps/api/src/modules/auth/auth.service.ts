import { randomUUID } from 'node:crypto';
import { refreshTokens, users, workspaceMembers, workspaces, type User } from '@pt/db';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db.js';
import { AppError, conflict, notFound, unauthorized } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../../lib/tokens.js';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from './auth.schemas.js';

export type PublicUser = Omit<User, 'passwordHash'>;

export interface Session {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const toPublicUser = ({ passwordHash: _omit, ...user }: User): PublicUser => user;

const findUserByEmail = async (email: string) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1);
  return user;
};

async function issueSession(
  user: User,
  userAgent: string | undefined,
  familyId: string = randomUUID(),
) {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  await db.insert(refreshTokens).values({
    userId: user.id,
    familyId,
    tokenHash: hashToken(refreshToken),
    userAgent: userAgent?.slice(0, 255),
    expiresAt: refreshExpiresAt,
  });

  return {
    user: toPublicUser(user),
    accessToken: await signAccessToken({ id: user.id, email: user.email }),
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshToken,
    refreshExpiresAt,
  } satisfies Session;
}

const revokeFamily = (familyId: string) =>
  db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));

export async function register(input: RegisterInput, userAgent?: string): Promise<Session> {
  if (await findUserByEmail(input.email)) throw conflict('Email is already registered', 'EMAIL_TAKEN');

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      fullName: input.fullName,
      passwordHash: await hashPassword(input.password),
    })
    .returning();

  return issueSession(user!, userAgent);
}

export async function login(input: LoginInput, userAgent?: string): Promise<Session> {
  const user = await findUserByEmail(input.email);
  const valid = await verifyPassword(user?.passwordHash, input.password);
  if (!user || !valid) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  return issueSession(user, userAgent);
}

/**
 * Rotasi refresh token. Token yang sudah dicabut dipakai lagi → seluruh family
 * dicabut (indikasi token dicuri) dan user harus login ulang.
 */
export async function refresh(rawToken: string, userAgent?: string): Promise<Session> {
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(rawToken)))
    .limit(1);

  if (!stored) throw unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');

  if (stored.revokedAt) {
    await revokeFamily(stored.familyId);
    throw unauthorized('Refresh token has been revoked', 'REFRESH_TOKEN_REUSED');
  }
  if (stored.expiresAt <= new Date()) {
    throw unauthorized('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
  }

  // Klaim token secara atomik; request paralel dengan token yang sama hanya satu yang menang.
  const claimed = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, stored.id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  if (claimed.length === 0) {
    await revokeFamily(stored.familyId);
    throw unauthorized('Refresh token has been revoked', 'REFRESH_TOKEN_REUSED');
  }

  const [user] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
  if (!user) throw unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');

  return issueSession(user, userAgent, stored.familyId);
}

export async function logout(rawToken: string): Promise<void> {
  const [stored] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(rawToken)))
    .limit(1);
  if (stored) await revokeFamily(stored.familyId);
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  await db.update(users).set(input).where(eq(users.id, userId));
  return getMe(userId);
}

/**
 * Ganti password: verifikasi password lama, cabut semua refresh token (sesi di
 * perangkat lain), lalu terbitkan sesi baru untuk perangkat ini.
 */
export async function changePassword(userId: string, input: ChangePasswordInput, userAgent?: string): Promise<Session> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError(422, 'INVALID_PASSWORD', 'Current password is incorrect', [
      { path: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }
  const passwordHash = await hashPassword(input.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  });
  return issueSession({ ...user, passwordHash }, userAgent);
}

export async function getMe(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound('User');

  const memberships = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.name));

  return { user: toPublicUser(user), workspaces: memberships };
}
