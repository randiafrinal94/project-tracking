'use client';

import { useState, type FormEvent } from 'react';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress';
import { cn } from '@/lib/cn';
import type { ChecklistItem } from '@/lib/types';

/** "Acceptance Criteria" Stitch: meter progress + item checkbox + tombol tambah. */
export function Checklist({
  items,
  editable,
  onAdd,
  onToggle,
  onRename,
  onRemove,
}: {
  items: ChecklistItem[];
  editable: boolean;
  onAdd: (title: string) => void;
  onToggle: (id: string, isCompleted: boolean) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const done = items.filter((i) => i.isCompleted).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft('');
  };

  const commitRename = (item: ChecklistItem) => {
    const title = editDraft.trim();
    if (title && title !== item.title) onRename(item.id, title);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="checklist" size={18} className="text-outline" />
          <h3 className="text-headline-sm text-on-surface">Acceptance Criteria</h3>
        </div>
        {items.length > 0 && (
          <span className="tabular text-label-sm font-semibold text-primary-container">
            {done} of {items.length} completed ({pct}%)
          </span>
        )}
      </div>

      {items.length > 0 && <ProgressBar value={pct} size="md" tone={pct === 100 ? 'success' : 'primary'} label="Checklist progress" />}

      <ul className="flex flex-col gap-1.5 pt-space-xs">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              'group flex items-start gap-space-sm rounded-lg p-2 transition-colors hover:bg-surface-container-low',
              item.isCompleted ? 'bg-surface-container-low/60' : 'bg-surface-container-lowest shadow-xs',
              item.id.startsWith('temp-') && 'opacity-60',
            )}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={item.isCompleted}
              aria-label={`Mark "${item.title}" as ${item.isCompleted ? 'not done' : 'done'}`}
              disabled={!editable || item.id.startsWith('temp-')}
              onClick={() => onToggle(item.id, !item.isCompleted)}
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/35 focus-visible:ring-offset-2',
                item.isCompleted
                  ? 'bg-primary-container text-on-primary shadow-xs'
                  : 'bg-surface-container-highest hover:bg-primary-container/20',
                !editable && 'cursor-default',
              )}
            >
              {item.isCompleted && <Icon name="check" size={14} />}
            </button>

            {editingId === item.id ? (
              <input
                autoFocus
                value={editDraft}
                maxLength={255}
                aria-label="Subtask title"
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={() => commitRename(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(item);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="flex-1 rounded bg-surface-container-lowest px-1 text-body-sm text-on-surface ring-2 ring-primary-container/20 focus:outline-none"
              />
            ) : (
              <span
                className={cn(
                  'flex-1 text-body-sm',
                  item.isCompleted ? 'text-on-surface-variant line-through' : 'font-medium text-on-surface',
                )}
              >
                {item.title}
              </span>
            )}

            {editable && !item.id.startsWith('temp-') && (
              <Dropdown>
                <DropdownTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Options for "${item.title}"`}
                    className="text-outline-variant opacity-0 transition-opacity hover:text-on-surface focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                  >
                    <Icon name="more_horiz" size={16} />
                  </button>
                </DropdownTrigger>
                <DropdownContent align="end" className="min-w-[160px]">
                  <DropdownItem
                    icon="edit"
                    onSelect={() => {
                      setEditingId(item.id);
                      setEditDraft(item.title);
                    }}
                  >
                    Rename
                  </DropdownItem>
                  <DropdownItem icon="delete" destructive onSelect={() => onRemove(item.id)}>
                    Delete
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && !adding && (
        <p className="text-body-sm text-on-surface-variant">No subtasks yet. Break the work into checkable steps.</p>
      )}

      {editable &&
        (adding ? (
          <form onSubmit={submit} className="flex items-center gap-space-sm rounded-lg bg-surface-container-lowest p-2 shadow-xs">
            <span className="h-4 w-4 shrink-0 rounded bg-surface-container-highest" />
            <input
              autoFocus
              value={draft}
              maxLength={255}
              aria-label="New subtask"
              placeholder="Describe the step, then press Enter"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
              onBlur={() => !draft.trim() && setAdding(false)}
              className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-outline focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1 flex w-fit items-center gap-2 rounded-lg px-2 py-1 text-label-md text-primary transition-colors hover:bg-primary-fixed/20 hover:text-primary-container"
          >
            <Icon name="add" size={18} />
            <span>Add Acceptance Subtask</span>
          </button>
        ))}
    </div>
  );
}
