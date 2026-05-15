import { WHATSAPP_E164 } from '../config/site.js';
import { escapeHtml, safeImageUrl } from '../utils/dom.js';
import { formatPriceCRC } from '../utils/format.js';
import { loadProductosRaw, normalizeCatalogProducts } from '../services/catalog.js';

const fallbackProducts = [
  {
    name: 'Cuaderno de Autorreflexión',
    category: 'Escritura terapéutica',
    description: 'Guía de journaling con ejercicios para ordenar pensamientos y nombrar emociones.',
    price: 12500,
    sku: 'UT-001',
  },
  {
    name: 'Tarjetas de Calma',
    category: 'Regulación emocional',
    description: 'Set de tarjetas con prácticas breves de respiración, grounding y autocompasión.',
    price: 9800,
    sku: 'UT-002',
  },
  {
    name: 'Kit de Presencia',
    category: 'Bienestar integral',
    description: 'Pack con libreta, vela aromática y mini guía para crear rituales de pausa consciente.',
    price: 18900,
    sku: 'UT-003',
  },
  {
    name: 'Agenda Terapéutica Semanal',
    category: 'Organización emocional',
    description: 'Planificador semanal para registrar estado de ánimo, hábitos de autocuidado y metas reales.',
    price: 14300,
    sku: 'UT-004',
  },
  {
    name: 'Set de Afirmaciones Compasivas',
    category: 'Regulación emocional',
    description: 'Tarjetas con afirmaciones y preguntas de reflexión para momentos de ansiedad o bloqueo.',
    price: 7600,
    sku: 'UT-005',
  },
  {
    name: 'Cuaderno de Gratitud Consciente',
    category: 'Escritura terapéutica',
    description: 'Formato guiado para entrenar la atención en lo valioso sin negar lo difícil.',
    price: 9900,
    sku: 'UT-006',
  },
];

const catalogGrid = document.getElementById('catalogGrid');
const catalogToolbar = document.getElementById('catalogToolbar');
const categoryFilters = document.getElementById('categoryFilters');
const catalogCount = document.getElementById('catalogCount');
const cartFab = document.getElementById('cartFab');
const cartBadge = document.getElementById('cartBadge');
const cartOverlay = document.getElementById('cartOverlay');
const cartDrawer = document.getElementById('cartDrawer');
const cartClose = document.getElementById('cartClose');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const cartWhatsApp = document.getElementById('cartWhatsApp');

const allCategories = [];
const CART_KEY = 'umanaToolsCartV1';
let products = [];
let activeCategory = 'Todos';
let cart = [];

function getVisibleProducts() {
  if (activeCategory === 'Todos') return products;
  return products.filter((product) => product.category === activeCategory);
}

function refreshCategories() {
  allCategories.length = 0;
  allCategories.push('Todos', ...new Set(products.map((product) => product.category)));
}

function renderFilters() {
  categoryFilters.innerHTML = allCategories
    .map(
      (category) => `
        <button class="chip ${category === activeCategory ? 'active' : ''}" type="button" data-category="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </button>
      `
    )
    .join('');

  categoryFilters.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeCategory = chip.getAttribute('data-category');
      renderFilters();
      renderCatalog();
    });
  });
}

function renderCatalog() {
  const visibleProducts = getVisibleProducts();
  catalogCount.textContent = `${visibleProducts.length} producto${visibleProducts.length !== 1 ? 's' : ''}`;

  if (!visibleProducts.length) {
    catalogGrid.innerHTML = `
        <article class="tools-preview-empty">
          <p>Próximamente</p>
          <span>El catálogo está vacío por ahora. Pronto publicaremos nuevos productos.</span>
        </article>
      `;
    return;
  }

  catalogGrid.innerHTML = visibleProducts
    .map(
      (product) => `
        <article class="product-card">
          <div class="product-image">${
            product.image
              ? `<img src="${safeImageUrl(product.image)}" alt="${escapeHtml(product.name)}">`
              : 'Umana Tools'
          }</div>
          <div class="product-body">
            <p class="product-category">${escapeHtml(product.category)}</p>
            <h2 class="product-title">${escapeHtml(product.name)}</h2>
            <p class="product-desc">${escapeHtml(product.description)}</p>
            <div class="product-footer">
              <p class="price">${formatPriceCRC(product.price)}</p>
              <p class="sku">${escapeHtml(product.sku)}</p>
            </div>
            <button class="add-cart-btn" type="button" data-add-sku="${escapeHtml(product.sku)}">Agregar al carrito</button>
          </div>
        </article>
      `
    )
    .join('');

  catalogGrid.querySelectorAll('[data-add-sku]').forEach((button) => {
    button.addEventListener('click', () => {
      const sku = button.getAttribute('data-add-sku');
      addToCart(sku);
    });
  });
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cart = Array.isArray(parsed) ? parsed : [];
  } catch {
    cart = [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    window.alert('No se pudo guardar el carrito en este navegador.');
  }
}

function getProductBySku(sku) {
  return products.find((product) => String(product.sku) === String(sku));
}

function cartUnits() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function cartAmount() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function addToCart(sku) {
  const product = getProductBySku(sku);
  if (!product) return;

  const existing = cart.find((item) => item.sku === product.sku);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      sku: product.sku,
      name: product.name,
      price: Number(product.price) || 0,
      qty: 1,
    });
  }

  saveCart();
  renderCart();
  openCart();
}

function changeQty(sku, delta) {
  const item = cart.find((entry) => entry.sku === sku);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter((entry) => entry.sku !== sku);
  }
  saveCart();
  renderCart();
}

function removeItem(sku) {
  cart = cart.filter((entry) => entry.sku !== sku);
  saveCart();
  renderCart();
}

function openCart() {
  cartDrawer.classList.add('open');
  cartOverlay.classList.add('open');
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartOverlay.classList.remove('open');
}

function createWhatsAppMessage() {
  const lines = ['Hola Umana Living, quiero pedir estos productos de Umana Tools:'];
  cart.forEach((item) => {
    lines.push(`- ${item.name} (${item.sku}) x${item.qty} = ${formatPriceCRC(item.price * item.qty)}`);
  });
  lines.push(`Total: ${formatPriceCRC(cartAmount())}`);
  lines.push('Gracias.');
  return lines.join('\n');
}

function renderCart() {
  const units = cartUnits();
  cartBadge.textContent = String(units);
  cartTotal.textContent = formatPriceCRC(cartAmount());
  cartFab.hidden = units <= 0;

  if (!cart.length) {
    cartItems.innerHTML = `<p class="cart-empty">Tu carrito está vacío.</p>`;
    cartWhatsApp.disabled = true;
    closeCart();
    return;
  }

  cartItems.innerHTML = cart
    .map(
      (item) => `
      <article class="cart-item">
        <div class="cart-item-top">
          <div>
            <p class="cart-item-name">${escapeHtml(item.name)}</p>
            <p class="cart-item-price">${escapeHtml(item.sku)}</p>
          </div>
          <strong class="cart-item-price">${formatPriceCRC(item.price * item.qty)}</strong>
        </div>
        <div class="cart-item-controls">
          <div class="qty-wrap">
            <button class="qty-btn" type="button" data-qty-sku="${escapeHtml(item.sku)}" data-delta="-1">-</button>
            <span class="qty-text">${item.qty}</span>
            <button class="qty-btn" type="button" data-qty-sku="${escapeHtml(item.sku)}" data-delta="1">+</button>
          </div>
          <button class="remove-item" type="button" data-remove-sku="${escapeHtml(item.sku)}">Quitar</button>
        </div>
      </article>
    `
    )
    .join('');

  cartWhatsApp.disabled = false;
  cartItems.querySelectorAll('[data-qty-sku]').forEach((button) => {
    button.addEventListener('click', () => {
      changeQty(button.getAttribute('data-qty-sku'), Number(button.getAttribute('data-delta')));
    });
  });
  cartItems.querySelectorAll('[data-remove-sku]').forEach((button) => {
    button.addEventListener('click', () => {
      removeItem(button.getAttribute('data-remove-sku'));
    });
  });
}

async function loadProducts() {
  try {
    const raw = await loadProductosRaw();
    products = normalizeCatalogProducts(raw);
  } catch (error) {
    console.warn('Usando catálogo local de respaldo:', error);
    products = normalizeCatalogProducts([...fallbackProducts]);
  }

  if (!products.length) {
    catalogToolbar.style.display = 'none';
    renderCatalog();
    return;
  }

  catalogToolbar.style.display = '';
  refreshCategories();
  activeCategory = 'Todos';
  renderFilters();
  renderCatalog();
}

function boot() {
  cartFab.addEventListener('click', openCart);
  cartClose.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);
  cartWhatsApp.addEventListener('click', () => {
    const message = createWhatsAppMessage();
    const url = `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCart();
  });

  loadCart();
  renderCart();
  loadProducts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
