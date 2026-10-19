'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { WorkspaceMember } from '@/lib/types';

/** Handle mention = bagian lokal email (sama dengan aturan API). */
export const handleOf = (email: string) => email.split('@')[0]!.toLowerCase();

const TRIGGER = /(^|[\s(])@([a-z0-9._-]*)$/i;

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  members: WorkspaceMember[];
}

/** Textarea komentar dengan autocomplete `@handle` (combobox ARIA). */
export function MentionTextarea({ value, onValueChange, members, onKeyDown, ...props }: Props) {
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const options = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return members
      .filter((m) => handleOf(m.email).startsWith(q) || m.fullName.toLowerCase().includes(q))
      .slice(0, 6);
  }, [members, query]);

  const detect = (text: string, caret: number) => {
    const match = text.slice(0, caret).match(TRIGGER);
    setQuery(match ? match[2]! : null);
    setActive(0);
  };

  const insert = (member: WorkspaceMember) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(TRIGGER, (_m, lead: string) => `${lead}@${handleOf(member.email)} `);
    const next = before + value.slice(caret);
    onValueChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (options.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        return setActive((i) => (i + 1) % options.length);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        return setActive((i) => (i - 1 + options.length) % options.length);
      }
      if ((e.key === 'Enter' && !e.metaKey && !e.ctrlKey) || e.key === 'Tab') {
        e.preventDefault();
        return insert(options[active]!);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return setQuery(null);
      }
    }
    onKeyDown?.(e);
  };

  const open = options.length > 0;

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          onValueChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        {...props}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention a teammate"
          className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-lg bg-surface-container-lowest p-1 shadow-level-3 ring-1 ring-surface-container"
        >
          {options.map((m, i) => (
            <li
              key={m.userId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                insert(m);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-space-sm py-1.5 text-label-md',
                i === active ? 'bg-primary-fixed/40 text-primary-container' : 'text-on-surface',
              )}
            >
              <Avatar name={m.fullName} seed={m.userId} src={m.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate">{m.fullName}</span>
              <span className="font-mono text-[11px] text-outline">@{handleOf(m.email)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
