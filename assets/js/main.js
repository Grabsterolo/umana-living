(function () {
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

  function toggleCaminoCard(toggle) {
    const card = toggle.closest('.camino-card');
    const isOpen = card.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  document.querySelectorAll('.camino-toggle').forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      if (e.target.closest('[data-editable]')) return;
      toggleCaminoCard(toggle);
    });
    toggle.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('[data-editable]')) return;
      e.preventDefault();
      toggleCaminoCard(toggle);
    });
  });
})();
