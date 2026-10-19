'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Palet chart (divalidasi dengan dataviz `validate_palette.js`, light mode):
 * slot 1 #4F46E5 (Stitch primary-container), slot 2 #0EA5E9 (Kinetic Slate sky-500).
 * CVD ΔE 17.9 ✓; slot 2 kontras 2.7:1 → wajib legend + tabel (disediakan).
 */
export const SERIES = ['#4f46e5', '#0ea5e9'] as const;
export const GRID = '#e5eeff'; // surface-container: satu langkah dari surface
export const AXIS_TEXT = '#777587'; // outline (teks muted)

/** Lebar kontainer responsif. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Tick y "bersih" (0, 2, 4 … / 0, 5, 10 …). */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(2));
}

/** Kolom dengan ujung data membulat 4px dan pangkal persegi di baseline. */
export function columnPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function Legend({ items }: { items: { label: string; color: string; kind?: 'rect' | 'line' }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-space-md text-[12px] text-on-surface-variant">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.kind === 'line' ? (
            <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: i.color }} />
          ) : (
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Tooltip: nilai di depan (tebal), label seri sekunder, kunci berupa garis pendek. */
export function ChartTooltip({ x, y, title, rows, containerWidth }: { x: number; y: number; title: string; rows: { label: string; value: string; color: string }[]; containerWidth: number }) {
  const flip = x > containerWidth - 170;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[140px] rounded-lg bg-surface-container-lowest px-3 py-2 shadow-level-3 ring-1 ring-surface-container"
      style={{ left: flip ? undefined : x + 12, right: flip ? containerWidth - x + 12 : undefined, top: Math.max(0, y - 10) }}
    >
      <p className="mb-1 text-[11px] font-semibold text-on-surface-variant">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-[12px]">
          <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: r.color }} />
          <strong className="tabular font-semibold text-on-surface">{r.value}</strong>
          <span className="text-on-surface-variant">{r.label}</span>
        </p>
      ))}
    </div>
  );
}

/** Kartu chart dengan toggle Chart/Table (tabel = padanan aksesibel). */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  table: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section aria-label={title} className={cn('rounded-xl bg-surface-container-lowest p-space-lg shadow-xs', className)}>
      <div className="mb-space-md flex flex-wrap items-start justify-between gap-space-sm">
        <div>
          <h3 className="text-headline-sm text-on-surface">{title}</h3>
          {subtitle && <p className="text-body-sm text-on-surface-variant">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-space-md">
          {!showTable && legend}
          <button
            type="button"
            aria-pressed={showTable}
            onClick={() => setShowTable((v) => !v)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-label-sm text-primary hover:bg-primary-fixed/30"
          >
            <span className="material-symbols-outlined text-[16px]">{showTable ? 'bar_chart' : 'table_rows'}</span>
            {showTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </div>
      {showTable ? <div className="overflow-x-auto">{table}</div> : children}
    </section>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-body-sm">
      <thead>
        <tr className="border-b border-[#e2e8f0] text-label-sm tracking-wider text-on-surface-variant uppercase">
          {head.map((h, i) => (
            <th key={h} scope="col" className={cn('py-2 pr-space-md font-semibold', i > 0 && 'text-right')}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-[#e2e8f0] last:border-0">
            {r.map((c, ci) => (
              <td key={ci} className={cn('py-1.5 pr-space-md text-on-surface', ci > 0 && 'tabular text-right')}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
