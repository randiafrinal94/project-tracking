'use client';

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE: Record<ToastTone, { icon: string; className: string }> = {
  success: { icon: 'check_circle', className: 'text-tertiary-container' },
  error: { icon: 'error', className: 'text-error' },
  info: { icon: 'info', className: 'text-primary-container' },
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (input: Omit<Toast, 'id'>) => {
      const id = nextId++;
      setToasts((all) => [...all.slice(-3), { ...input, id }]);
      setTimeout(() => dismiss(id), input.tone === 'error' ? 6000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-gutter right-gutter z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-space-sm"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex items-start gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-level-3 ring-1 ring-surface-container"
          >
            <Icon name={TONE[t.tone].icon} size={20} className={cn('mt-px', TONE[t.tone].className)} />
            <div className="min-w-0 flex-1">
              <p className="text-label-md font-semibold text-on-surface">{t.title}</p>
              {t.description && <p className="mt-0.5 text-body-sm text-on-surface-variant">{t.description}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.toast;
}
