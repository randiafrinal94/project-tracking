import { z } from 'zod';
import { badRequest } from './errors.js';

/** Cursor opaque berbasis base64url dari tuple (nilai urutan, id). */
export function encodeCursor(order: string | number | Date, id: string): string {
  const value = order instanceof Date ? order.toISOString() : String(order);
  return Buffer.from(JSON.stringify([value, id])).toString('base64url');
}

export function decodeCursor(cursor: string): { order: string; id: string } {
  try {
    const [order, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown[];
    if (typeof order !== 'string' || typeof id !== 'string' || !z.uuid().safeParse(id).success) {
      throw new Error('shape');
    }
    return { order, id };
  } catch {
    throw badRequest('Invalid pagination cursor', 'INVALID_CURSOR');
  }
}

export const paginationQuery = (defaultLimit: number, maxLimit: number) => ({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
});

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Ambil `limit + 1` baris, lalu potong untuk menentukan apakah ada halaman berikutnya. */
export function toPage<T>(rows: T[], limit: number, cursorOf: (row: T) => string): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? cursorOf(items[items.length - 1]!) : null };
}
