export function formatPriceCRC(value) {
  return Number(value).toLocaleString('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  });
}

export function formatDateEsCR(d) {
  try {
    return new Date(d).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}
