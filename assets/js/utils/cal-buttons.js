import { CAL_LINK } from '../config/site.js';

/** Botones .btn-agendar-cal — modal Cal.com o fallback al enlace */
export function initCalAgendarButtons() {
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
