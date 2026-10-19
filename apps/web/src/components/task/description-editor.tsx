'use client';

import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';

const isEmptyHtml = (html: string) => html.replace(/<p><\/p>|<br\s*\/?>|\s/g, '') === '';

function ToolbarButton({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // mousedown agar fokus editor tidak hilang (blur memicu simpan).
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded transition-colors',
        active ? 'bg-surface-container-lowest text-primary shadow-xs' : 'hover:bg-surface-container-lowest hover:text-on-surface',
      )}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      code: e.isActive('code'),
      bullet: e.isActive('bulletList'),
      link: e.isActive('link'),
      quote: e.isActive('blockquote'),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', previous ?? 'https://');
    if (url === null) return;
    if (url === '' || url === 'https://') return editor.chain().focus().unsetLink().run();
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div role="toolbar" aria-label="Formatting" className="flex w-fit items-center gap-0.5 rounded-lg bg-surface-container p-1 text-on-surface-variant shadow-xs">
      <ToolbarButton icon="format_bold" label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton icon="format_italic" label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton icon="code" label="Code" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()} />
      <div className="mx-1 h-4 w-px bg-outline-variant/40" />
      <ToolbarButton icon="format_list_bulleted" label="Bullet List" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarButton icon="link" label="Hyperlink" active={state.link} onClick={setLink} />
      <ToolbarButton icon="format_quote" label="Blockquote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
    </div>
  );
}

/**
 * Deskripsi rich-text (Stitch: ribbon + kotak `bg-surface-container-low`).
 * Disimpan saat editor kehilangan fokus; HTML disanitasi ulang oleh API.
 */
export function DescriptionEditor({
  html,
  editable,
  onSave,
}: {
  html: string | null;
  editable: boolean;
  onSave: (html: string | null) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: !editable, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
      }),
      Placeholder.configure({ placeholder: editable ? 'Add a description — what, why, and acceptance notes…' : 'No description.' }),
    ],
    content: html ?? '',
    editorProps: {
      attributes: { class: 'rich-text min-h-[96px] focus:outline-none', 'aria-label': 'Task description' },
    },
    onBlur: ({ editor: e }) => {
      const next = e.getHTML();
      const normalized = isEmptyHtml(next) ? null : next;
      if (normalized !== (html && !isEmptyHtml(html) ? html : null)) onSave(normalized);
    },
  });

  // Sinkron bila data server berubah dan user tidak sedang mengetik.
  useEffect(() => {
    if (editor && !editor.isFocused && editor.getHTML() !== (html ?? '')) {
      editor.commands.setContent(html ?? '', { emitUpdate: false });
    }
  }, [editor, html]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-label-md font-semibold text-on-surface">
          <Icon name="description" size={18} className="text-outline" />
          Description
        </span>
        {editable && <span className="font-mono text-[11px] text-outline-variant">Markdown shortcuts supported</span>}
      </div>
      {editable && editor && <Toolbar editor={editor} />}
      <div
        className={cn(
          'rounded-xl bg-surface-container-low p-space-md text-body-md leading-relaxed text-on-surface shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]',
          editable && 'cursor-text focus-within:ring-2 focus-within:ring-primary-container/20',
        )}
        onClick={() => editable && editor?.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
