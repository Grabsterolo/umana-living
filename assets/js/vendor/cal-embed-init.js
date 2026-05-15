/* Cal.com embed: mantener calLink alineado con CAL_LINK en assets/js/config/site.js */
(function (C, A, L) {
  const p = function (a, ar) {
    a.q.push(ar);
  };
  const d = C.document;
  C.Cal =
    C.Cal ||
    function () {
      const cal = C.Cal;
      const ar = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        d.head.appendChild(d.createElement('script')).src = A;
        cal.loaded = true;
      }
      if (ar[0] === L) {
        const api = function () {
          p(api, arguments);
        };
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === 'string') {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ['initNamespace', namespace]);
        } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
})(window, 'https://app.cal.com/embed/embed.js', 'init');

Cal('init', { calOrigin: 'https://app.cal.com' });
Cal('preload', { calLink: 'umana-living-7k2goz/umana-consulta' });
