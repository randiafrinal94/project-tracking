import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const linkTransform = sanitizeHtml.simpleTransform('a', {
  rel: 'noopener noreferrer nofollow',
  target: '_blank',
});

const BASE_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'del', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'hr',
];

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: BASE_TAGS,
  allowedAttributes: { a: ['href', 'title', 'rel', 'target'], code: ['class'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: linkTransform },
};

const MARKDOWN_OPTIONS: sanitizeHtml.IOptions = {
  ...RICH_TEXT_OPTIONS,
  allowedTags: [...BASE_TAGS, 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input'],
  allowedAttributes: {
    ...RICH_TEXT_OPTIONS.allowedAttributes,
    input: ['type', 'checked', 'disabled'],
  },
};

/** HTML mentah di dalam Markdown ditampilkan sebagai teks, bukan dieksekusi. */
const markdown = new Marked({ gfm: true, breaks: true, async: false });
markdown.use({ renderer: { html: ({ text }) => escapeHtml(text) } });

/** Deskripsi task dari rich-text editor (HTML) → HTML ber-allowlist. */
export const sanitizeRichText = (html: string) => sanitizeHtml(html, RICH_TEXT_OPTIONS).trim();

/** Markdown komentar → HTML aman untuk dirender langsung oleh client. */
export const renderMarkdown = (source: string) =>
  sanitizeHtml(markdown.parse(source) as string, MARKDOWN_OPTIONS).trim();
