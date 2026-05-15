import { CATALOG_JSON_URL } from '../config/site.js';

/**
 * Normaliza lista de productos del CMS (orden, activo, imagen).
 */
export function normalizeCatalogProducts(productos) {
  return (Array.isArray(productos) ? productos : [])
    .map((product, index) => ({
      ...product,
      image: typeof product.image === 'string' ? product.image.trim() : '',
      active: product.active !== false,
      order: Number.isFinite(Number(product.order)) ? Number(product.order) : index + 1,
    }))
    .filter((product) => product.active)
    .sort((a, b) => a.order - b.order || String(a.name).localeCompare(String(b.name), 'es'));
}

export async function loadProductosRaw() {
  const response = await fetch(CATALOG_JSON_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo cargar el catálogo');
  const data = await response.json();
  return Array.isArray(data.productos) ? data.productos : [];
}
