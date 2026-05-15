import { CAL_LINK } from '../config/site.js';
import { escapeHtml, safeImageUrl } from '../utils/dom.js';
import { formatPriceCRC, formatDateEsCR } from '../utils/format.js';
import { loadProductosRaw, normalizeCatalogProducts } from '../services/catalog.js';
import { fetchAllArticlesFromRepo } from '../services/articles-github.js';

function initHeroPhrases() {
  const phrases = [
    'Un espacio para detenerte<br><em>y escuchar lo que sientes.</em>',
    'No es necesario tener todo claro<br><em>para comenzar.</em>',
    'Algunas cosas se comprenden<br><em>con el tiempo.</em>',
    'Aquí puedes tomarte ese tiempo<br><em>con calma.</em>',
    'Acompañamiento humano,<br><em>sin presión.</em>',
    'Puedes empezar<br><em>cuando te sientas bien.</em>',
  ];
  const el = document.getElementById('heroPhrase');
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const HOLD_MS = 6000;
  const FADE_MS = 600;
  let idx = 0;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function loop() {
    while (true) {
      await sleep(HOLD_MS);
      el.classList.add('hero-phrase--hidden');
      await sleep(FADE_MS);
      idx = (idx + 1) % phrases.length;
      el.innerHTML = phrases[idx];
      el.classList.remove('hero-phrase--hidden');
      await sleep(FADE_MS);
    }
  }
  loop();
}

function createScrollRevealObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('visible'), i * 80);
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  return observer;
}

function initCaminosToggles() {
  document.querySelectorAll('.camino-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.camino-card');
      const isOpen = card.classList.toggle('open');
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });
}

function initCalAgendarButtons() {
  const OPEN_DELAY_MS = 220;
  document.querySelectorAll('.btn-agendar-cal').forEach((btn) => {
    btn.addEventListener('click', function (e) {
      if (btn.tagName === 'A') e.preventDefault();
      btn.classList.add('is-cal-priming');
      btn.setAttribute('aria-busy', 'true');
      window.setTimeout(() => {
        btn.classList.remove('is-cal-priming');
        btn.removeAttribute('aria-busy');
        if (typeof Cal === 'function') {
          Cal('modal', { calLink: CAL_LINK });
        } else if (btn.tagName === 'A' && btn.getAttribute('href')) {
          window.location.href = btn.getAttribute('href');
        }
      }, OPEN_DELAY_MS);
    });
  });
}

let articlesState = [];
const BLOG_MOBILE = window.matchMedia('(max-width: 768px)');
const BLOG_PREVIEW_TRANSITION_MS = 220;
/** Índice del primer artículo visible en la página actual (alineado a tamaño de página). */
let blogListOffset = 0;
/** Tras un swipe en móvil, bloquea el click sintético que abriría el artículo por error. */
let blogSwipeSuppressClickUntil = 0;

const BLOG_SLIDE_OUT_MS = 300;
const BLOG_SWIPE_MIN_PX = 52;
/** Si el gesto es más vertical que horizontal, no lo tratamos como swipe de página. */
const BLOG_SWIPE_VERTICAL_TOLERANCE = 0.72;

/** Escritorio: 3 tarjetas (1 fila × 3 columnas). Móvil: 1 tarjeta por página. */
function getBlogPageSize() {
  return BLOG_MOBILE.matches ? 1 : 3;
}

function alignBlogListOffset(rawOffset) {
  const n = articlesState.length;
  const pageSize = getBlogPageSize();
  if (!n) return 0;
  const lastStart = Math.floor((n - 1) / pageSize) * pageSize;
  const aligned = Math.floor(Math.max(0, rawOffset) / pageSize) * pageSize;
  return Math.min(aligned, lastStart);
}

function openArticleModal(index) {
  const a = articlesState[index];
  if (!a) return;
  const cover = document.getElementById('modalCover');
  if (a.image) {
    cover.src = a.image;
    cover.style.display = 'block';
  } else {
    cover.style.display = 'none';
  }
  document.getElementById('modalCat').textContent = a.cat;
  document.getElementById('modalTitle').textContent = a.title;
  document.getElementById('modalMeta').textContent = (a.author ? `${a.author} · ` : '') + formatDateEsCR(a.date);
  document.getElementById('modalBody').innerHTML = a.bodyHtml;
  document.getElementById('readModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeArticleModal() {
  document.getElementById('readModal').classList.remove('open');
  document.body.style.overflow = '';
}

function initReadModal(observer) {
  const modal = document.getElementById('readModal');
  const grid = document.getElementById('blogGrid');
  if (!modal || !grid) return;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeArticleModal();
  });

  modal.querySelectorAll('[data-action="close-read"]').forEach((btn) => {
    btn.addEventListener('click', closeArticleModal);
  });

  grid.addEventListener('click', (e) => {
    if (Date.now() < blogSwipeSuppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const card = e.target.closest('[data-article-index]');
    if (!card) return;
    const i = parseInt(card.getAttribute('data-article-index'), 10);
    if (Number.isFinite(i)) openArticleModal(i);
  });

  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-article-index]');
    if (!card || !grid.contains(card)) return;
    e.preventDefault();
    const i = parseInt(card.getAttribute('data-article-index'), 10);
    if (Number.isFinite(i)) openArticleModal(i);
  });
}

function renderBlogArticles(articles, offset, observer) {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  const emptyHtml = `<div class="blog-empty"><p>Próximamente</p><span>Los artículos aparecerán aquí una vez publicados.</span></div>`;

  if (!articles.length) {
    grid.innerHTML = emptyHtml;
    syncBlogPager();
    return;
  }

  const pageSize = getBlogPageSize();
  const safeOffset = alignBlogListOffset(offset);
  blogListOffset = safeOffset;
  const end = Math.min(safeOffset + pageSize, articles.length);
  const slice = articles.slice(safeOffset, end);
  grid.innerHTML = slice
    .map(
      (a, i) => {
        const globalIndex = safeOffset + i;
        return `
        <article class="article-card reveal" data-article-index="${globalIndex}" role="button" tabindex="0" aria-label="${escapeHtml(a.title)}">
          ${
            a.image
              ? `<img class="article-cover" src="${safeImageUrl(a.image)}" alt="${escapeHtml(a.title)}">`
              : `<div class="article-cover-placeholder"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M10 38 Q14 28 20 24 Q26 20 24 12 Q30 18 28 26 Q34 20 32 12 Q40 20 36 30 Q40 28 42 32 Q38 40 10 38Z" fill="#C4A882"/></svg></div>`
          }
          <div class="article-body">
            <p class="article-cat">${escapeHtml(a.cat || 'Artículo')}</p>
            <h3 class="article-title">${escapeHtml(a.title)}</h3>
            <p class="article-excerpt">${escapeHtml(a.excerpt || `${a.bodyRaw.slice(0, 100).replace(/#/g, '')}...`)}</p>
            <p class="article-meta">${escapeHtml(a.author ? `${a.author} · ` : '')}${escapeHtml(formatDateEsCR(a.date))}</p>
          </div>
        </article>`;
      }
    )
    .join('');

  grid.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  syncBlogPager();
}

function syncBlogPager() {
  const slider = document.getElementById('blogSlider');
  const prev = document.getElementById('blogPagePrev');
  const next = document.getElementById('blogPageNext');
  const indicator = document.getElementById('blogPageIndicator');
  if (!slider || !prev || !next || !indicator) return;

  if (!articlesState.length) {
    slider.classList.add('blog-slider--single');
    prev.disabled = true;
    next.disabled = true;
    indicator.textContent = '';
    return;
  }

  const pageSize = getBlogPageSize();
  const total = articlesState.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.floor(blogListOffset / pageSize) + 1;

  if (totalPages <= 1) {
    slider.classList.add('blog-slider--single');
    prev.disabled = true;
    next.disabled = true;
    indicator.textContent = '';
    return;
  }

  slider.classList.remove('blog-slider--single');
  prev.disabled = currentPage <= 1;
  next.disabled = currentPage >= totalPages;
  const label = `Página ${currentPage} de ${totalPages}`;
  indicator.textContent =
    BLOG_MOBILE.matches && totalPages > 1 ? `${label} · Desliza` : label;
}

function scrollBlogSectionIntoView() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.getElementById('blogGrid')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function runBlogMobileSlide(grid, slideDir, observer) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderBlogArticles(articlesState, blogListOffset, observer);
    return;
  }

  grid.classList.remove(
    'is-switching',
    'blog-grid--out-next',
    'blog-grid--out-prev',
    'blog-grid--in-next',
    'blog-grid--in-prev',
    'blog-grid--in-settle'
  );

  const outClass = slideDir === 'next' ? 'blog-grid--out-next' : 'blog-grid--out-prev';
  grid.classList.add(outClass);

  window.setTimeout(() => {
    grid.classList.remove(outClass);
    renderBlogArticles(articlesState, blogListOffset, observer);

    const inClass = slideDir === 'next' ? 'blog-grid--in-next' : 'blog-grid--in-prev';
    grid.classList.add(inClass);
    void grid.offsetWidth;

    requestAnimationFrame(() => {
      grid.classList.add('blog-grid--in-settle');
    });

    window.setTimeout(() => {
      grid.classList.remove(inClass, 'blog-grid--in-settle');
    }, BLOG_SLIDE_OUT_MS + 400);
  }, BLOG_SLIDE_OUT_MS);
}

function animateBlogArticles(offset, observer, options = {}) {
  const { slideDir } = options;
  const grid = document.getElementById('blogGrid');
  blogListOffset = alignBlogListOffset(offset);
  if (!grid) {
    renderBlogArticles(articlesState, blogListOffset, observer);
    return;
  }

  if (slideDir && BLOG_MOBILE.matches && articlesState.length) {
    runBlogMobileSlide(grid, slideDir, observer);
    return;
  }

  grid.classList.remove(
    'blog-grid--out-next',
    'blog-grid--out-prev',
    'blog-grid--in-next',
    'blog-grid--in-prev',
    'blog-grid--in-settle'
  );
  grid.classList.add('is-switching');
  window.setTimeout(() => {
    renderBlogArticles(articlesState, blogListOffset, observer);
    requestAnimationFrame(() => {
      grid.classList.remove('is-switching');
    });
  }, BLOG_PREVIEW_TRANSITION_MS);
}

function goToBlogPage(pageIndex0, observer, doScroll = true) {
  if (!articlesState.length) return;
  const pageSize = getBlogPageSize();
  const totalPages = Math.ceil(articlesState.length / pageSize);
  const clamped = Math.max(0, Math.min(pageIndex0, totalPages - 1));
  const oldOffset = blogListOffset;
  const newOffset = clamped * pageSize;

  let slideDir = null;
  if (BLOG_MOBILE.matches && newOffset !== oldOffset) {
    slideDir = newOffset > oldOffset ? 'next' : 'prev';
  }

  blogListOffset = newOffset;
  animateBlogArticles(blogListOffset, observer, { slideDir });
  if (doScroll) scrollBlogSectionIntoView();
}

function initBlogMobileSwipe(observer) {
  const view = document.getElementById('blogSliderView');
  if (!view) return;

  let startX = 0;
  let startY = 0;
  let tracking = false;

  view.addEventListener(
    'touchstart',
    (e) => {
      if (!BLOG_MOBILE.matches || e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    { passive: true }
  );

  view.addEventListener(
    'touchcancel',
    () => {
      tracking = false;
    },
    { passive: true }
  );

  view.addEventListener(
    'touchend',
    (e) => {
      if (!tracking || !BLOG_MOBILE.matches) {
        tracking = false;
        return;
      }
      tracking = false;
      if (!articlesState.length || e.changedTouches.length !== 1) return;

      const pageSize = getBlogPageSize();
      const totalPages = Math.ceil(articlesState.length / pageSize);
      if (totalPages <= 1) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;

      if (Math.abs(dx) < BLOG_SWIPE_MIN_PX) return;
      if (Math.abs(dy) > Math.abs(dx) * BLOG_SWIPE_VERTICAL_TOLERANCE) return;

      const cur = Math.floor(blogListOffset / pageSize);
      if (dx > 0 && cur > 0) {
        blogSwipeSuppressClickUntil = Date.now() + 450;
        goToBlogPage(cur - 1, observer, false);
      } else if (dx < 0 && cur < totalPages - 1) {
        blogSwipeSuppressClickUntil = Date.now() + 450;
        goToBlogPage(cur + 1, observer, false);
      }
    },
    { passive: true }
  );
}

function initBlogPagination(observer) {
  const prev = document.getElementById('blogPagePrev');
  const next = document.getElementById('blogPageNext');

  prev?.addEventListener('click', () => {
    if (!articlesState.length || prev.disabled) return;
    const pageSize = getBlogPageSize();
    goToBlogPage(Math.floor(blogListOffset / pageSize) - 1, observer);
  });

  next?.addEventListener('click', () => {
    if (!articlesState.length || next.disabled) return;
    const pageSize = getBlogPageSize();
    goToBlogPage(Math.floor(blogListOffset / pageSize) + 1, observer);
  });

  BLOG_MOBILE.addEventListener('change', () => {
    if (!articlesState.length) return;
    blogListOffset = alignBlogListOffset(blogListOffset);
    renderBlogArticles(articlesState, blogListOffset, observer);
  });

  initBlogMobileSwipe(observer);
}

async function loadArticles(observer) {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  const emptyHtml = `<div class="blog-empty"><p>Próximamente</p><span>Los artículos aparecerán aquí una vez publicados.</span></div>`;

  try {
    const articles = await fetchAllArticlesFromRepo();
    if (!articles.length) {
      articlesState = [];
      grid.innerHTML = emptyHtml;
      syncBlogPager();
      return;
    }
    articlesState = articles;
    blogListOffset = 0;
    renderBlogArticles(articlesState, blogListOffset, observer);
  } catch {
    articlesState = [];
    grid.innerHTML = emptyHtml;
    syncBlogPager();
  }
}

const TOOLS_PREVIEW_BATCH = 3;
const TOOLS_PREVIEW_TRANSITION_MS = 220;
let toolsPreviewProducts = [];
let toolsPreviewOffset = 0;

function renderToolsPreview(products, offset) {
  const toolsPreviewList = document.getElementById('toolsPreviewList');
  const toolsPreviewNext = document.getElementById('toolsPreviewNext');
  const toolsPreviewPrev = document.getElementById('toolsPreviewPrev');
  if (!toolsPreviewList || !toolsPreviewNext || !toolsPreviewPrev) return;

  if (!products.length) {
    toolsPreviewList.innerHTML = `
        <article class="tools-preview-empty">
          <p>Próximamente</p>
          <span>El catálogo está vacío por ahora. Pronto publicaremos nuevos productos.</span>
        </article>
      `;
    toolsPreviewNext.hidden = true;
    toolsPreviewPrev.hidden = true;
    return;
  }

  const pagedProducts = products.slice(offset, offset + TOOLS_PREVIEW_BATCH);
  toolsPreviewList.innerHTML = pagedProducts
    .map(
      (product) => `
      <article class="tools-mini-card">
        <div>
          <p class="tools-mini-tag">${escapeHtml(product.category || 'Umana Tools')}</p>
          <h3 class="tools-mini-name">${escapeHtml(product.name || 'Producto Umana Tools')}</h3>
        </div>
        <span class="tools-mini-price">${formatPriceCRC(Number(product.price) || 0)}</span>
      </article>
    `
    )
    .join('');

  const hasMultiplePages = products.length > TOOLS_PREVIEW_BATCH;
  toolsPreviewNext.hidden = !hasMultiplePages;
  toolsPreviewPrev.hidden = !hasMultiplePages;
}

function animateToolsPreview(offset) {
  const toolsPreviewList = document.getElementById('toolsPreviewList');
  if (!toolsPreviewList) {
    renderToolsPreview(toolsPreviewProducts, offset);
    return;
  }

  toolsPreviewList.classList.add('is-switching');
  window.setTimeout(() => {
    renderToolsPreview(toolsPreviewProducts, offset);
    requestAnimationFrame(() => {
      toolsPreviewList.classList.remove('is-switching');
    });
  }, TOOLS_PREVIEW_TRANSITION_MS);
}

async function loadToolsPreview() {
  try {
    const raw = await loadProductosRaw();
    toolsPreviewProducts = normalizeCatalogProducts(raw);
    toolsPreviewOffset = 0;
    renderToolsPreview(toolsPreviewProducts, toolsPreviewOffset);
  } catch {
    toolsPreviewProducts = [];
    toolsPreviewOffset = 0;
    renderToolsPreview([], 0);
  }
}

function initToolsPreviewPager() {
  document.getElementById('toolsPreviewNext')?.addEventListener('click', () => {
    if (!toolsPreviewProducts.length) return;
    const nextOffset = toolsPreviewOffset + TOOLS_PREVIEW_BATCH;
    toolsPreviewOffset = nextOffset >= toolsPreviewProducts.length ? 0 : nextOffset;
    animateToolsPreview(toolsPreviewOffset);
  });

  document.getElementById('toolsPreviewPrev')?.addEventListener('click', () => {
    if (!toolsPreviewProducts.length) return;
    const prevOffset = toolsPreviewOffset - TOOLS_PREVIEW_BATCH;
    if (prevOffset >= 0) {
      toolsPreviewOffset = prevOffset;
    } else {
      const lastPageStart =
        Math.floor((toolsPreviewProducts.length - 1) / TOOLS_PREVIEW_BATCH) * TOOLS_PREVIEW_BATCH;
      toolsPreviewOffset = lastPageStart;
    }
    animateToolsPreview(toolsPreviewOffset);
  });
}

function boot() {
  initHeroPhrases();
  const observer = createScrollRevealObserver();
  initCaminosToggles();
  initCalAgendarButtons();
  initReadModal(observer);
  initBlogPagination(observer);
  initToolsPreviewPager();
  loadToolsPreview();
  loadArticles(observer);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
