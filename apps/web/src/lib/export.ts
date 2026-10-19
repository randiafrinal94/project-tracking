import { api } from './api';
import type { Page, TaskCard } from './types';

const csvCell = (value: unknown) => {
  const s = value === null || value === undefined ? '' : String(value);
  // Cegah formula injection saat dibuka di spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Ambil seluruh task aktif project (semua halaman) lalu unduh sebagai CSV. */
export async function exportProjectTasksCsv(projectId: string, fileBase: string) {
  const all: TaskCard[] = [];
  let cursor: string | null = null;
  do {
    const page: Page<TaskCard> = await api<Page<TaskCard>>(`/projects/${projectId}/tasks`, {
      query: { limit: 500, cursor: cursor ?? undefined },
    });
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  const header = ['Key', 'Title', 'Status', 'Priority', 'Assignee', 'Tags', 'Due date', 'Estimate (h)', 'Actual (h)', 'Subtasks done', 'Subtasks total', 'Completed at'];
  const rows = all.map((t) => [
    t.key, t.title, t.status, t.priority, t.assignee?.fullName, t.tags.map((g) => g.name).join('; '),
    t.dueDate, t.estimateHours, t.actualHours, t.subtasks.completed, t.subtasks.total, t.completedAt,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase}-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return all.length;
}
