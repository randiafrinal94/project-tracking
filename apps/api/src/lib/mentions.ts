import { users, workspaceMembers } from '@pt/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Tx } from './actor.js';

/** Handle mention = bagian lokal email (lowercase), mis. `citra@acme.test` → `@citra`. */
export const handleOf = (email: string) => email.split('@')[0]!.toLowerCase();

const MENTION_RE = /(^|[\s(>])@([a-z0-9][a-z0-9._-]{0,63})/gi;

/** Handle unik yang disebut di Markdown (di luar blok/inline code). */
export function extractHandles(markdown: string): string[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
  const found = new Set<string>();
  for (const m of withoutCode.matchAll(MENTION_RE)) found.add(m[2]!.toLowerCase().replace(/[._-]+$/, ''));
  return [...found];
}

export interface ResolvedMention {
  userId: string;
  handle: string;
  fullName: string;
}

/** Cocokkan handle ke anggota workspace (non-anggota diabaikan). */
export async function resolveMentions(tx: Tx, workspaceId: string, handles: string[]): Promise<ResolvedMention[]> {
  if (handles.length === 0) return [];
  const handleExpr = sql<string>`lower(split_part(${users.email}, '@', 1))`;
  const rows = await tx
    .select({ userId: users.id, handle: handleExpr, fullName: users.fullName })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(handleExpr, handles)));
  return rows;
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Tandai mention yang valid di HTML hasil render (sudah disanitasi) sebagai
 * `<span class="mention">`. Segmen `<code>`/`<pre>` tidak disentuh.
 */
export function highlightMentions(html: string, mentions: ResolvedMention[]): string {
  if (mentions.length === 0) return html;
  const byHandle = new Map(mentions.map((m) => [m.handle, m]));
  return html
    .split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)/g)
    .map((segment) => {
      if (segment.startsWith('<')) return segment; // tag atau blok kode
      return segment.replace(MENTION_RE, (full, lead: string, handle: string) => {
        const m = byHandle.get(handle.toLowerCase());
        return m
          ? `${lead}<span class="mention" data-user-id="${m.userId}" title="${escapeAttr(m.fullName)}">@${handle}</span>`
          : full;
      });
    })
    .join('');
}
