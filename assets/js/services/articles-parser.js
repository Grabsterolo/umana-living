import { safeImageUrl } from '../utils/dom.js';
import { sanitizeHtml } from '../utils/sanitize-html.js';

export function parseArticleMarkdown(text, filename) {
  const fm = {};
  let body = text;
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    fmMatch[1].split('\n').forEach((line) => {
      const [k, ...v] = line.split(':');
      if (k) fm[k.trim()] = v.join(':').trim().replace(/^["']|["']$/g, '');
    });
    body = fmMatch[2];
  }
  return {
    title: fm.title || filename.replace('.md', ''),
    cat: fm.cat || 'Artículo',
    excerpt: fm.excerpt || '',
    author: fm.author || '',
    date: fm.date || new Date().toISOString(),
    image: safeImageUrl(fm.image || ''),
    bodyRaw: body,
    bodyHtml: sanitizeHtml(typeof marked !== 'undefined' ? marked.parse(body) : body),
  };
}
