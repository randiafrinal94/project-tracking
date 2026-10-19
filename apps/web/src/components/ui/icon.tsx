import { cn } from '@/lib/cn';

interface IconProps {
  /** Nama ikon Material Symbols Outlined, mis. `grid_view`. */
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
  label?: string;
}

/** Ikon Material Symbols (sama seperti Stitch). Dekoratif kecuali `label` diisi. */
export function Icon({ name, size = 20, filled, className, label }: IconProps) {
  return (
    <span
      className={cn('material-symbols-outlined shrink-0', className)}
      style={{
        fontSize: size,
        width: size,
        height: size,
        ...(filled ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : {}),
      }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {name}
    </span>
  );
}
