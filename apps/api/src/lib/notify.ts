import { notifications, type NewNotification } from '@pt/db';
import type { Tx } from './actor.js';

export type NotificationType = 'task.assigned' | 'comment.mention' | 'comment.created';

/**
 * Buat notifikasi in-app (dalam transaksi yang sama dengan perubahan pemicunya).
 * Penerima yang sama dengan aktor dan duplikat penerima diabaikan.
 */
export async function notify(tx: Tx, actorId: string, rows: Omit<NewNotification, 'actorId'>[]) {
  const seen = new Set<string>();
  const values = rows.filter((r) => {
    if (r.userId === actorId || seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
  if (values.length > 0) await tx.insert(notifications).values(values.map((r) => ({ ...r, actorId })));
}
