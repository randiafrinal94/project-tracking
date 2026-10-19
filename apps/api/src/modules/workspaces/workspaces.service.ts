import { randomBytes } from 'node:crypto';
import { projects, users, workspaceMembers, workspaces } from '@pt/db';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { outer } from '../../lib/sql.js';
import type { Membership } from '../../types.js';
import type {
  AddMemberInput,
  AssignableRole,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from './workspaces.schemas.js';

const workspaceColumns = {
  id: workspaces.id,
  name: workspaces.name,
  slug: workspaces.slug,
  ownerId: workspaces.ownerId,
  createdAt: workspaces.createdAt,
  updatedAt: workspaces.updatedAt,
};

const memberCount = sql<number>`(
  SELECT count(*) FROM ${workspaceMembers} wm WHERE wm.workspace_id = ${outer(workspaces.id)}
)`.mapWith(Number);

const projectCount = sql<number>`(
  SELECT count(*) FROM ${projects} p
  WHERE p.workspace_id = ${outer(workspaces.id)} AND p.deleted_at IS NULL
)`.mapWith(Number);

function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length >= 3 ? slug : `workspace-${slug}`.replace(/-+$/, '');
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const [taken] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, candidate))
      .limit(1);
    if (!taken) return candidate;
    candidate = `${base}-${randomBytes(2).toString('hex')}`;
  }
  return `${base}-${randomBytes(4).toString('hex')}`;
}

export function listForUser(userId: string) {
  return db
    .select({ ...workspaceColumns, role: workspaceMembers.role, memberCount, projectCount })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.name));
}

/**
 * Membuat workspace hanya untuk akun level owner (`users.can_create_workspace`).
 * Role di workspace lain (admin, dll.) maupun user baru tidak cukup.
 */
async function assertCanCreate(userId: string) {
  const [user] = await db
    .select({ canCreateWorkspace: users.canCreateWorkspace })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.canCreateWorkspace) {
    throw forbidden('Only owner-level accounts can create a workspace');
  }
}

export async function create(userId: string, input: CreateWorkspaceInput) {
  await assertCanCreate(userId);
  const slug = input.slug ?? (await uniqueSlug(slugify(input.name)));

  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: input.name, slug, ownerId: userId })
      .returning(workspaceColumns);
    await tx.insert(workspaceMembers).values({ workspaceId: workspace!.id, userId, role: 'owner' });
    return { ...workspace!, role: 'owner' as const, memberCount: 1, projectCount: 0 };
  });
}

export async function get(membership: Membership) {
  const [workspace] = await db
    .select({ ...workspaceColumns, memberCount, projectCount })
    .from(workspaces)
    .where(eq(workspaces.id, membership.workspaceId))
    .limit(1);
  if (!workspace) throw notFound('Workspace');
  return { ...workspace, role: membership.role };
}

export async function update(membership: Membership, input: UpdateWorkspaceInput) {
  await db.update(workspaces).set(input).where(eq(workspaces.id, membership.workspaceId));
  return get(membership);
}

export async function remove(workspaceId: string) {
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export function listMembers(workspaceId: string) {
  return db
    .select({
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.role), asc(users.fullName));
}

async function getMember(workspaceId: string, userId: string) {
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  if (!member) throw notFound('Member');
  return member;
}

/** Hanya owner yang boleh memberi atau mencabut role admin. */
function assertCanManageAdmin(actor: Membership, ...roles: string[]) {
  if (roles.includes('admin') && actor.role !== 'owner') {
    throw forbidden('Only the workspace owner can manage admins');
  }
}

export async function addMember(actor: Membership, input: AddMemberInput) {
  assertCanManageAdmin(actor, input.role);

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, input.email))
    .limit(1);
  if (!user) throw notFound('User with this email');

  const inserted = await db
    .insert(workspaceMembers)
    .values({ workspaceId: actor.workspaceId, userId: user.id, role: input.role })
    .onConflictDoNothing()
    .returning({ userId: workspaceMembers.userId });
  if (inserted.length === 0) throw conflict('User is already a member', 'ALREADY_MEMBER');

  const members = await listMembers(actor.workspaceId);
  return members.find((m) => m.userId === user.id)!;
}

export async function updateMemberRole(
  actor: Membership & { userId: string },
  targetUserId: string,
  role: AssignableRole,
) {
  if (actor.userId === targetUserId) throw forbidden('You cannot change your own role');

  const target = await getMember(actor.workspaceId, targetUserId);
  if (target.role === 'owner') throw forbidden('The owner role cannot be changed');
  assertCanManageAdmin(actor, target.role, role);

  await db
    .update(workspaceMembers)
    .set({ role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, actor.workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    );

  const members = await listMembers(actor.workspaceId);
  return members.find((m) => m.userId === targetUserId)!;
}

/** Admin+ dapat mengeluarkan anggota; setiap anggota (kecuali owner) boleh keluar sendiri. */
export async function removeMember(actor: Membership & { userId: string }, targetUserId: string) {
  const target = await getMember(actor.workspaceId, targetUserId);
  if (target.role === 'owner') {
    throw forbidden('The owner cannot be removed from the workspace');
  }

  const isSelf = actor.userId === targetUserId;
  if (!isSelf) {
    if (actor.role !== 'owner' && actor.role !== 'admin') throw forbidden();
    assertCanManageAdmin(actor, target.role);
  }

  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, actor.workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    );
}
