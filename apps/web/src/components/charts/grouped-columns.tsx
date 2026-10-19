'use client';

import { useState } from 'react';
import { AXIS_TEXT, ChartTooltip, columnPath, GRID, niceTicks, useWidth } from './chart-kit';

interface Series {
  label: string;
  color: string;
  values: number[];
}

const H = 220;
const M = { top: 12, right: 8, bottom: 28, left: 32 };

/**
 * Kolom berkelompok per kategori (mis. minggu). Bar ≤ 24px, celah 2px antar bar,
 * ujung membulat 4px; seluruh pita kategori adalah hit target (satu tooltip, semua seri).
 */
export function GroupedColumns({ categories, series, formatCategory }: { categories: string[]; series: Series[]; formatCategory: (c: string) => string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;
  const band = categories.length ? plotW / categories.length : 0;
  const barW = Math.min(24, Math.max(4, (band * 0.7 - (series.length - 1) * 2) / series.length));
  const groupW = barW * series.length + (series.length - 1) * 2;
  const y = (v: number) => M.top + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(categories.length / Math.max(1, Math.floor(plotW / 56)));

  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`${series.map((s) => s.label).join(' and ')} per ${categories.length} periods`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT} className="tabular">
                {t}
              </text>
            </g>
          ))}
          {categories.map((c, i) => {
            const x0 = M.left + i * band + (band - groupW) / 2;
            return (
              <g key={c}>
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  return (
                    <path
                      key={s.label}
                      d={columnPath(x0 + si * (barW + 2), y(v), barW, M.top + plotH - y(v))}
                      fill={s.color}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                    />
                  );
                })}
                {i % labelEvery === 0 && (
                  <text x={M.left + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                    {formatCategory(c)}
                  </text>
                )}
                <rect
                  x={M.left + i * band}
                  y={M.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${formatCategory(c)}: ${series.map((s) => `${s.label} ${s.values[i] ?? 0}`).join(', ')}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none focus-visible:fill-[rgba(79,70,229,0.06)]"
                />
              </g>
            );
          })}
          <line x1={M.left} x2={width - M.right} y1={M.top + plotH} y2={M.top + plotH} stroke="#cbd5e1" strokeWidth={1} />
        </svg>
      )}
      {hover !== null && (
        <ChartTooltip
          containerWidth={width}
          x={M.left + hover * band + band / 2}
          y={M.top}
          title={formatCategory(categories[hover]!)}
          rows={series.map((s) => ({ label: s.label, value: String(s.values[hover] ?? 0), color: s.color }))}
        />
      )}
    </div>
  );
}
