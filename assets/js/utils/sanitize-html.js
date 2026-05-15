import { safeImageUrl } from './dom.js';

/**
 * Sanitiza HTML generado desde Markdown (marked) antes de inyectarlo con innerHTML.
 */
export function sanitizeHtml(dirtyHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(dirtyHtml || ''), 'text/html');
  const blockedTags = new Set(['script', 'style', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button']);
  const allowedIframeHosts = new Set([
    'www.youtube.com',
    'youtube.com',
    'youtu.be',
    'www.youtube-nocookie.com',
    'youtube-nocookie.com',
    'player.vimeo.com',
  ]);
  doc.querySelectorAll('*').forEach((el) => {
    const tagName = el.tagName.toLowerCase();
    if (blockedTags.has(tagName)) {
      el.remove();
      return;
    }

    if (tagName === 'iframe') {
      const src = (el.getAttribute('src') || '').trim();
      let isTrusted = false;
      try {
        const parsed = new URL(src, window.location.href);
        isTrusted = parsed.protocol === 'https:' && allowedIframeHosts.has(parsed.hostname.toLowerCase());
        if (!isTrusted) {
          el.remove();
          return;
        }
        el.setAttribute('src', parsed.href);
        el.setAttribute('loading', 'lazy');
        el.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        el.setAttribute('allowfullscreen', '');
        if (!el.getAttribute('title')) {
          el.setAttribute('title', 'Contenido embebido');
        }
      } catch {
        el.remove();
        return;
      }
    }

    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });

    if (tagName === 'a') {
      const href = (el.getAttribute('href') || '').trim();
      if (!href) return;
      try {
        const parsed = new URL(href, window.location.href);
        if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
          el.removeAttribute('href');
          return;
        }
        if (parsed.origin !== window.location.origin) {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer nofollow');
        }
      } catch {
        el.removeAttribute('href');
      }
    }

    if (tagName === 'img') {
      const src = safeImageUrl(el.getAttribute('src') || '');
      if (!src) {
        el.remove();
        return;
      }
      el.setAttribute('src', src);
      el.setAttribute('loading', 'lazy');
      el.setAttribute('decoding', 'async');
    }
  });
  return doc.body.innerHTML;
}
