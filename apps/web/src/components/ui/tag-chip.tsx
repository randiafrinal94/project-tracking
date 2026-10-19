import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

interface TagChipProps {
  name: string;
  /** Warna hex dari tabel `tags`. Tanpa warna → chip netral Stitch. */
  color?: string | null;
  shape?: 'rounded' | 'pill';
  className?: string;
}

/**
 * Chip tag kartu Stitch (`px-2 py-0.5 rounded text-[11px]`). Warna kustom tag
 * diterapkan seperti chip "Frontend" Stitch: latar tint ±14% dan teks warna yang digelapkan.
 */
export function TagChip({ name, color, shape = 'rounded', className }: TagChipProps) {
  const style: CSSProperties | undefined = color
    ? {
        backgroundColor: `color-mix(in srgb, ${color} 14%, white)`,
        color: `color-mix(in srgb, ${color} 78%, black)`,
      }
    : undefined;

  return (
    <span
      style={style}
      className={cn(
        'inline-flex max-w-full items-center truncate px-2 py-0.5 text-[11px] leading-4 font-semibold tracking-[0.04em]',
        shape === 'pill' ? 'rounded-full' : 'rounded',
        !color && 'bg-surface-container text-on-surface-variant',
        className,
      )}
    >
      {name}
    </span>
  );
}
