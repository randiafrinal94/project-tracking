import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './icon';
import { Kbd } from './kbd';

const FIELD =
  'w-full rounded-lg bg-surface-container-lowest text-body-sm text-on-surface placeholder:text-outline shadow-xs ' +
  'transition-shadow focus:outline-none focus:ring-2 focus:ring-primary-container/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:ring-2 aria-invalid:ring-error/30';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  /** Shortcut di sisi kanan, mis. ⌘K. */
  shortcut?: string;
  inputSize?: 'sm' | 'md' | 'lg';
}

const HEIGHT = { sm: 'h-8', md: 'h-9', lg: 'h-10' } as const;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, shortcut, inputSize = 'md', className, ...props },
  ref,
) {
  return (
    <div className={cn('relative flex items-center', className)}>
      {icon && (
        <Icon
          name={icon}
          size={inputSize === 'sm' ? 16 : 18}
          className={cn('pointer-events-none absolute text-outline', inputSize === 'sm' ? 'left-2.5' : 'left-space-md')}
        />
      )}
      <input
        ref={ref}
        className={cn(
          FIELD,
          HEIGHT[inputSize],
          icon ? (inputSize === 'sm' ? 'pl-8' : 'pl-9') : 'pl-space-md',
          shortcut ? 'pr-14' : 'pr-3',
        )}
        {...props}
      />
      {shortcut && <Kbd className="pointer-events-none absolute right-space-sm">{shortcut}</Kbd>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(FIELD, 'resize-none p-2.5', className)} {...props} />;
  },
);

/** Label + kontrol + pesan error dengan pola aksesibel. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label-md font-semibold text-on-surface">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-body-sm text-error">
          {error}
        </p>
      ) : (
        hint && <p className="text-body-sm text-on-surface-variant">{hint}</p>
      )}
    </div>
  );
}
