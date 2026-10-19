'use client';

import { useState, type PointerEvent } from 'react';
import { AXIS_TEXT, ChartTooltip, GRID, niceTicks, useWidth } from './chart-kit';

const H = 200;
const M = { top: 16, right: 44, bottom: 28, left: 32 };

/**
 * Line chart satu seri (garis 2px, marker 8px bercincin surface 2px). Nilai null
 * = celah. Crosshair vertikal mengikuti pointer dan menempel ke titik terdekat.
 */
export function LineChart({
  categories,
  values,
  color,
  label,
  unit,
  formatCategory,
}: {
  categories: string[];
  values: (number | null)[];
  color: string;
  label: string;
  unit: string;
  formatCategory: (c: string) => string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const max = Math.max(1, ...values.filter((v): v is number => v !== null));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;
  const step = categories.length > 1 ? plotW / (categories.length - 1) : 0;
  const x = (i: number) => M.left + i * step;
  const y = (v: number) => M.top + plotH - (v / top) * plotH;

  // Segmen garis terputus pada nilai null.
  const segments: string[] = [];
  let current = '';
  values.forEach((v, i) => {
    if (v === null) {
      if (current) segments.push(current);
      current = '';
    } else current += `${current ? 'L' : 'M'}${x(i)},${y(v)}`;
  });
  if (current) segments.push(current);

  const lastIndex = values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1);
  const labelEvery = Math.ceil(categories.length / Math.max(1, Math.floor(plotW / 56)));

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - box.left) / Math.max(1, step));
    setHover(Math.max(0, Math.min(categories.length - 1, i)));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`${label} per period`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}>{t}</text>
            </g>
          ))}
          {categories.map((c, i) =>
            i % labelEvery === 0 ? (
              <text key={c} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>{formatCategory(c)}</text>
            ) : null,
          )}
          {segments.map((d) => (
            <path key={d} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + plotH} stroke="#cbd5e1" strokeWidth={1} />}
          {values.map((v, i) =>
            v !== null && (i === hover || i === lastIndex) ? (
              <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={color} stroke="#ffffff" strokeWidth={2} />
            ) : null,
          )}
          {lastIndex >= 0 && (
            <text x={x(lastIndex) + 8} y={y(values[lastIndex]!)} dy="0.32em" fontSize={11} fontWeight={600} fill="#0b1c30">
              {values[lastIndex]}{unit}
            </text>
          )}
          <rect
            x={M.left}
            y={M.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label={`${label}: ${categories.map((c, i) => `${formatCategory(c)} ${values[i] ?? 'no data'}`).join('; ')}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(lastIndex >= 0 ? lastIndex : 0)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? 0) - 1));
              if (e.key === 'ArrowRight') setHover((h) => Math.min(categories.length - 1, (h ?? 0) + 1));
            }}
            className="outline-none"
          />
        </svg>
      )}
      {hover !== null && (
        <ChartTooltip
          containerWidth={width}
          x={x(hover)}
          y={M.top}
          title={formatCategory(categories[hover]!)}
          rows={[{ label, value: values[hover] === null ? 'No completions' : `${values[hover]}${unit}`, color }]}
        />
      )}
    </div>
  );
}
