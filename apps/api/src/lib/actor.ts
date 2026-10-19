import type { Database } from '@pt/db';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Menjalankan `fn` dalam transaksi dengan `app.actor_id` terpasang, sehingga
 * trigger activity log di database mencatat siapa pelakunya.
 * Semua mutasi yang tercatat di activity log WAJIB lewat helper ini.
 */
export function withActor<T>(actorId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
    return fn(tx);
  });
}

/** Serialisasi operasi urutan (reorder/insert) per project dalam satu transaksi. */
export const lockProjectOrdering = (tx: Tx, projectId: string) =>
  tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${projectId}, 0))`);
