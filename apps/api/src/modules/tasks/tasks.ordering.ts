import { SORT_ORDER_GAP, tasks, type TaskStatus } from '@pt/db';
import { and, asc, desc, eq, gt, isNull, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import type { Tx } from '../../lib/actor.js';
import { AppError } from '../../lib/errors.js';

/** Batas aman INT4 sebelum kolom dinormalisasi ulang. */
const MAX_SORT = 2_000_000_000;
const MIN_SORT = -2_000_000_000;

interface Neighbor {
  id: string;
  sortOrder: number;
}

export interface Placement {
  prevTaskId?: string | null;
  nextTaskId?: string | null;
}

/**
 * Menghitung `sort_order` untuk task di kolom `(projectId, status)`.
 *
 * Strategi: nilai berjarak SORT_ORDER_GAP sehingga perpindahan biasanya hanya
 * meng-update satu baris (nilai tengah antara tetangga). Jika celah habis,
 * seluruh kolom dinormalisasi ulang dalam transaksi yang sama.
 *
 * Wajib dipanggil di dalam transaksi yang sudah memegang `lockProjectOrdering`.
 *
 * @param movingTaskId task yang dipindah (dikecualikan dari kolom), atau null untuk task baru.
 */
export async function resolveSortOrder(
  tx: Tx,
  projectId: string,
  status: TaskStatus,
  movingTaskId: string | null,
  placement: Placement,
): Promise<{ sortOrder: number; rebalanced: boolean }> {
  const inColumn = (extra?: SQL) =>
    and(
      eq(tasks.projectId, projectId),
      eq(tasks.status, status),
      isNull(tasks.deletedAt),
      movingTaskId ? ne(tasks.id, movingTaskId) : undefined,
      extra,
    );

  const neighborCols = { id: tasks.id, sortOrder: tasks.sortOrder };

  const findAnchor = async (id: string, field: 'prevTaskId' | 'nextTaskId') => {
    const [row] = await tx.select(neighborCols).from(tasks).where(inColumn(eq(tasks.id, id))).limit(1);
    if (!row) {
      throw new AppError(422, 'INVALID_PLACEMENT', `${field} must reference another active task in the target column`);
    }
    return row;
  };

  let prev: Neighbor | undefined;
  let next: Neighbor | undefined;

  if (placement.prevTaskId) {
    prev = await findAnchor(placement.prevTaskId, 'prevTaskId');
    // Tetangga berikutnya diambil dari data server (bukan client) agar aman terhadap filter/stale view.
    [next] = await tx
      .select(neighborCols)
      .from(tasks)
      .where(
        inColumn(
          or(
            gt(tasks.sortOrder, prev.sortOrder),
            and(eq(tasks.sortOrder, prev.sortOrder), gt(tasks.id, prev.id)),
          ),
        ),
      )
      .orderBy(asc(tasks.sortOrder), asc(tasks.id))
      .limit(1);
  } else if (placement.nextTaskId) {
    next = await findAnchor(placement.nextTaskId, 'nextTaskId');
    [prev] = await tx
      .select(neighborCols)
      .from(tasks)
      .where(
        inColumn(
          or(
            lt(tasks.sortOrder, next.sortOrder),
            and(eq(tasks.sortOrder, next.sortOrder), lt(tasks.id, next.id)),
          ),
        ),
      )
      .orderBy(desc(tasks.sortOrder), desc(tasks.id))
      .limit(1);
  } else {
    [prev] = await tx
      .select(neighborCols)
      .from(tasks)
      .where(inColumn())
      .orderBy(desc(tasks.sortOrder), desc(tasks.id))
      .limit(1);
  }

  let candidate: number | undefined;
  if (prev && next) {
    if (next.sortOrder - prev.sortOrder >= 2) {
      candidate = Math.floor((prev.sortOrder + next.sortOrder) / 2);
    }
  } else if (prev) {
    if (prev.sortOrder + SORT_ORDER_GAP <= MAX_SORT) candidate = prev.sortOrder + SORT_ORDER_GAP;
  } else if (next) {
    if (next.sortOrder - SORT_ORDER_GAP >= MIN_SORT) candidate = next.sortOrder - SORT_ORDER_GAP;
  } else {
    candidate = SORT_ORDER_GAP;
  }

  if (candidate !== undefined) return { sortOrder: candidate, rebalanced: false };

  return { sortOrder: await rebalanceColumn(tx, inColumn(), movingTaskId, prev, next), rebalanced: true };
}

/**
 * Normalisasi ulang kolom menjadi GAP, 2·GAP, … dengan task yang dipindah
 * disisipkan di antara `prev` dan `next`. Mengembalikan sort_order untuk task tersebut.
 */
async function rebalanceColumn(
  tx: Tx,
  columnWhere: SQL | undefined,
  movingTaskId: string | null,
  prev: Neighbor | undefined,
  next: Neighbor | undefined,
): Promise<number> {
  const column = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(columnWhere)
    .orderBy(asc(tasks.sortOrder), asc(tasks.id))
    .for('update');

  const ids = column.map((r) => r.id);
  const insertAt = prev
    ? ids.indexOf(prev.id) + 1
    : next
      ? ids.indexOf(next.id)
      : ids.length;
  const placeholder = movingTaskId ?? '';
  ids.splice(insertAt, 0, placeholder);

  const updates = ids
    .map((id, index) => ({ id, sortOrder: (index + 1) * SORT_ORDER_GAP }))
    .filter((u) => u.id !== '');

  if (updates.length > 0) {
    // Array dikirim sebagai literal PG agar menjadi satu parameter (UUID & integer aman).
    const idArray = `{${updates.map((u) => u.id).join(',')}}`;
    const orderArray = `{${updates.map((u) => u.sortOrder).join(',')}}`;
    await tx.execute(sql`
      UPDATE ${tasks} AS t
         SET sort_order = v.sort_order
        FROM unnest(${idArray}::uuid[], ${orderArray}::int[]) AS v(id, sort_order)
       WHERE t.id = v.id
    `);
  }

  return (insertAt + 1) * SORT_ORDER_GAP;
}
