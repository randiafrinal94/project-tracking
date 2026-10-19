import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './icon';
import { Spinner } from './spinner';

/**
 * Varian tombol persis dari Stitch:
 * - primary   : tombol "New" header
 * - secondary : Share / Filter / Group (permukaan putih + shadow)
 * - tonal     : Export / Upgrade / Manage Team (surface-container)
 * - ghost     : ikon & aksi sekunder di toolbar
 * - destructive : Kinetic Slate › Buttons › Destructive
 */
const VARIANTS = {
  primary:
    'bg-primary-container text-on-primary shadow-[0_1px_2px_0_rgba(15,23,42,0.08)] hover:bg-primary',
  secondary:
    'bg-surface-container-lowest text-on-surface shadow-xs hover:bg-surface-container hover:shadow-sm',
  tonal: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
  ghost: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
  destructive:
    'bg-[#fff1f2] text-[#f43f5e] border border-[#fecdd3] hover:bg-[#f43f5e] hover:text-white',
} as const;

const SIZES = {
  sm: 'h-8 px-2.5 gap-1.5',
  md: 'h-9 px-space-md gap-1.5',
  lg: 'h-10 px-space-lg gap-2',
} as const;

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-lg text-label-md whitespace-nowrap transition-all ' +
  'active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/35 focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-50';

export const buttonClasses = (variant: keyof typeof VARIANTS = 'secondary', size: keyof typeof SIZES = 'md') =>
  cn(BASE, VARIANTS[variant], SIZES[size]);

/** Link bergaya tombol (hindari `<button>` di dalam `<a>`). */
export function ButtonLink({
  href,
  variant,
  size,
  icon,
  className,
  children,
}: {
  href: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonClasses(variant, size), className)}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </Link>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  icon?: string;
  trailingIcon?: string;
  loading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, trailingIcon, loading, disabled, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses(variant, size), className)}
      {...props}
    >
      {loading ? <Spinner size={16} /> : icon && <Icon name={icon} size={18} />}
      {children && <span>{children}</span>}
      {trailingIcon && <Icon name={trailingIcon} size={16} className="text-outline" />}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  size?: 'sm' | 'md';
  iconSize?: number;
  /** Titik notifikasi kecil (bel di header). */
  dot?: boolean;
}

/** Tombol ikon 36×36 / 32×32 (header & toolbar Stitch). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', iconSize, dot, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors',
        'hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/35',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'md' ? 'h-9 w-9' : 'h-8 w-8',
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={iconSize ?? (size === 'md' ? 20 : 18)} />
      {dot && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />}
    </button>
  );
});
