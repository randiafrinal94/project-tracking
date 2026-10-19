import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

/** Palet avatar inisial yang dipakai Stitch (MC, SJ, ER, AK, ...). */
const PALETTE = [
  'bg-primary-container text-on-primary',
  'bg-secondary-container text-on-secondary-container',
  'bg-tertiary-container text-on-tertiary-container',
  'bg-secondary text-on-secondary',
  'bg-tertiary text-on-tertiary',
  'bg-primary text-on-primary',
];

const SIZES = {
  xs: 'h-4 w-4 text-[8px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-7 w-7 text-[11px]',
  lg: 'h-8 w-8 text-[11px]',
} as const;

const STATUS = {
  online: 'bg-tertiary-container',
  busy: 'bg-review',
  focused: 'bg-secondary-container',
} as const;

function paletteFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

interface AvatarProps {
  name: string;
  /** Seed warna stabil (biasanya user id). */
  seed?: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  status?: keyof typeof STATUS;
  ring?: boolean;
  className?: string;
}

export function Avatar({ name, seed, src, size = 'sm', status, ring, className }: AvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} title={name}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className={cn('rounded-full object-cover', SIZES[size], ring && 'ring-2 ring-surface-container-lowest')} />
      ) : (
        <span
          aria-label={name}
          className={cn(
            'flex items-center justify-center rounded-full font-bold',
            SIZES[size],
            paletteFor(seed ?? name),
            ring && 'ring-2 ring-surface-container-lowest',
          )}
        >
          {initials(name)}
        </span>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-surface-container-lowest',
            STATUS[status],
          )}
        />
      )}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 3,
  size = 'md',
}: {
  people: { id: string; fullName: string; avatarUrl?: string | null }[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-1">
      {shown.map((p) => (
        <Avatar key={p.id} name={p.fullName} seed={p.id} src={p.avatarUrl} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-surface-container-high font-medium text-on-surface-variant ring-2 ring-surface',
            SIZES[size],
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
