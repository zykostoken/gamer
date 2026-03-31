// ZYKOS GAMER — Lightweight page view tracking
// No cookies, no PII, just page + referrer + screen
(function() {
  if (typeof getSupabaseClient !== 'function') return;
  var sb = getSupabaseClient();
  if (!sb) return;
  try {
    sb.from('zykos_page_views').insert({
      page: location.pathname,
      referrer: document.referrer || null,
      screen_width: window.innerWidth || null
    }).then(function(){}).catch(function(){});
  } catch(e) {}
})();
