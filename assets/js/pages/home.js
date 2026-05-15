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

function blogCarouselMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function updateBlogCarouselNav() {
  const track = document.getElementById('blogGrid');
  const nextBtn = document.getElementById('blogPreviewNext');
  const prevBtn = document.getElementById('blogPreviewPrev');
  if (!track || !nextBtn || !prevBtn) return;
  const overflow = track.scrollWidth > track.clientWidth + 8;
  nextBtn.hidden = !overflow;
  prevBtn.hidden = !overflow;
}

let blogCarouselNavBound = false;

function bindBlogCarouselNav() {
  if (blogCarouselNavBound) return;
  const track = document.getElementById('blogGrid');
  const nextBtn = document.getElementById('blogPreviewNext');
  const prevBtn = document.getElementById('blogPreviewPrev');
  if (!track || !nextBtn || !prevBtn) return;
  blogCarouselNavBound = true;

  function scrollByViewport(dir) {
    track.scrollBy({
      left: dir * track.clientWidth,
      behavior: blogCarouselMotion(),
    });
  }

  nextBtn.addEventListener('click', () => scrollByViewport(1));
  prevBtn.addEventListener('click', () => scrollByViewport(-1));

  track.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (track.scrollWidth <= track.clientWidth + 8) return;
    if (!track.contains(e.target)) return;
    e.preventDefault();
    scrollByViewport(e.key === 'ArrowRight' ? 1 : -1);
  });

  window.addEventListener('resize', () => window.requestAnimationFrame(updateBlogCarouselNav));
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => updateBlogCarouselNav());
    ro.observe(track);
  }
  track.addEventListener('scroll', updateBlogCarouselNav, { passive: true });
}

function renderBlogArticles(articles, observer) {
  const track = document.getElementById('blogGrid');
  const blogPreviewNext = document.getElementById('blogPreviewNext');
  const blogPreviewPrev = document.getElementById('blogPreviewPrev');
  if (!track) return;

  const emptyHtml = `<div class="blog-empty"><p>Próximamente</p><span>Los artículos aparecerán aquí una vez publicados.</span></div>`;

  if (!articles.length) {
    track.innerHTML = emptyHtml;
    if (blogPreviewNext) blogPreviewNext.hidden = true;
    if (blogPreviewPrev) blogPreviewPrev.hidden = true;
    return;
  }

  track.innerHTML = articles
    .map(
      (a, globalIndex) => `
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
        </article>`
    )
    .join('');

  if (blogPreviewNext) blogPreviewNext.hidden = true;
  if (blogPreviewPrev) blogPreviewPrev.hidden = true;

  track.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  track.querySelectorAll('img.article-cover').forEach((img) => {
    if (!img.complete) {
      img.addEventListener('load', () => requestAnimationFrame(updateBlogCarouselNav), { once: true });
    }
  });

  track.scrollLeft = 0;
  requestAnimationFrame(() => {
    updateBlogCarouselNav();
    requestAnimationFrame(updateBlogCarouselNav);
  });
}

async function loadArticles(observer) {
  const track = document.getElementById('blogGrid');
  const nextBtn = document.getElementById('blogPreviewNext');
  const prevBtn = document.getElementById('blogPreviewPrev');
  if (!track) return;

  const emptyHtml = `<div class="blog-empty"><p>Próximamente</p><span>Los artículos aparecerán aquí una vez publicados.</span></div>`;

  function hideBlogNav() {
    if (nextBtn) nextBtn.hidden = true;
    if (prevBtn) prevBtn.hidden = true;
  }

  try {
    const articles = await fetchAllArticlesFromRepo();
    if (!articles.length) {
      articlesState = [];
      track.innerHTML = emptyHtml;
      hideBlogNav();
      return;
    }
    articlesState = articles;
    renderBlogArticles(articlesState, observer);
  } catch {
    articlesState = [];
    track.innerHTML = emptyHtml;
    hideBlogNav();
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
  bindBlogCarouselNav();
  initToolsPreviewPager();
  loadToolsPreview();
  loadArticles(observer);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
