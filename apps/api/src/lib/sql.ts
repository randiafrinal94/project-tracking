import { getTableName, sql, type Column } from 'drizzle-orm';

/**
 * Referensi kolom yang selalu memakai nama tabel (`"tags"."id"`).
 *
 * Drizzle menghilangkan nama tabel pada query satu tabel, sehingga `${tags.id}` di
 * dalam subquery berkorelasi menjadi `"id"` dan bisa terikat ke tabel di dalam
 * subquery. Gunakan helper ini untuk setiap referensi ke query luar.
 */
export const outer = (column: Column) =>
  sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
