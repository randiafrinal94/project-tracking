'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Icon } from './icon';

export interface SegmentedTab {
  id: string;
  label: string;
  icon?: string;
  count?: number;
  href?: string;
  disabled?: boolean;
}

/** View tabs Stitch (Overview / Kanban Board / Gantt / List) — kontainer `bg-surface-container rounded-xl p-1`. */
export function SegmentedTabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: SegmentedTab[];
  active: string;
  onChange?: (id: string) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex items-center gap-1 rounded-xl bg-surface-container p-1">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const className = cn(
          'flex items-center gap-1.5 rounded-lg px-space-md py-1.5 text-label-md transition-all',
          isActive
            ? 'gap-2 bg-surface-container-lowest text-primary shadow-xs'
            : 'text-on-surface-variant hover:bg-surface-container-lowest/60 hover:text-on-surface',
          tab.disabled && 'pointer-events-none opacity-50',
        );
        const content = (
          <>
            {tab.icon && <Icon name={tab.icon} size={18} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="tabular rounded-full bg-primary-fixed px-1.5 text-label-sm font-semibold text-on-primary-fixed">
                {tab.count}
              </span>
            )}
          </>
        );
        return tab.href && !tab.disabled ? (
          <Link key={tab.id} href={tab.href} role="tab" aria-selected={isActive} className={className}>
            {content}
          </Link>
        ) : (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={tab.disabled || undefined}
            onClick={() => onChange?.(tab.id)}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
