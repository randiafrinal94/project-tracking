const DAY = 86_400_000;

const toDate = (value: string | Date) =>
  value instanceof Date ? value : new Date(value.length === 10 ? `${value}T00:00:00` : value);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "Oct 30" — format tanggal ringkas pada kartu Stitch. */
export const shortDate = (value: string | Date) =>
  toDate(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

/** "Oct 25, 2026". */
export const longDate = (value: string | Date) =>
  toDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Selisih hari kalender dari hari ini (negatif = lampau). */
export const daysFromToday = (value: string | Date) =>
  Math.round((startOfDay(toDate(value)).getTime() - startOfDay(new Date()).getTime()) / DAY);

/** Label due date gaya Stitch: "Due Today", "Tomorrow", "2d overdue", atau "Oct 30". */
export function dueLabel(value: string): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' } {
  const diff = daysFromToday(value);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, tone: 'overdue' };
  if (diff === 0) return { label: 'Due Today', tone: 'today' };
  if (diff === 1) return { label: 'Tomorrow', tone: 'soon' };
  return { label: shortDate(value), tone: 'normal' };
}

/** "12m ago", "2h ago", "3d ago" — timestamp feed aktivitas Stitch. */
export function timeAgo(value: string | Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - toDate(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(value);
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
