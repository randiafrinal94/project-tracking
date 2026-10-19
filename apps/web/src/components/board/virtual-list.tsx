'use client';

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Mulai virtualisasi di atas jumlah ini — kolom kecil dirender biasa. */
export const VIRTUALIZE_AT = 40;

interface VirtualListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  render: (item: T) => ReactNode;
  estimateSize: number;
  gap?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Muat halaman berikutnya bila item terakhir yang dirender ≤ ambang ini dari akhir. */
  loadAhead?: number;
}

/**
 * Daftar ter-virtualisasi terhadap scroll window (beberapa kolom berbagi satu scroll).
 * Tinggi item diukur dinamis; halaman berikutnya dimuat otomatis mendekati akhir.
 */
export function WindowVirtualList<T>({
  items,
  getKey,
  render,
  estimateSize,
  gap = 12,
  hasMore,
  loadingMore,
  onLoadMore,
  loadAhead = 8,
}: VirtualListProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Posisi list relatif dokumen berubah saat konten di atasnya dimuat → ukur ulang.
  useLayoutEffect(() => {
    const measure = () => {
      const top = (ref.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
      setScrollMargin((prev) => (Math.abs(prev - top) > 1 ? top : prev));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan: 6,
    gap,
    scrollMargin,
    getItemKey: (index) => getKey(items[index]!),
  });

  const rendered = virtualizer.getVirtualItems();
  const lastIndex = rendered[rendered.length - 1]?.index ?? -1;

  useEffect(() => {
    if (hasMore && !loadingMore && lastIndex >= items.length - loadAhead) onLoadMore?.();
  }, [hasMore, loadingMore, lastIndex, items.length, loadAhead, onLoadMore]);

  return (
    <div ref={ref} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {rendered.map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtualizer.measureElement}
          className="absolute left-0 top-0 w-full"
          style={{ transform: `translateY(${row.start - scrollMargin}px)` }}
        >
          {render(items[row.index]!)}
        </div>
      ))}
    </div>
  );
}
