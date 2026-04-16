// ============================================================
// require-auth.js — ZYKOS GAMER authentication guard V4
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Sin registro no hay juego. Sin datos no hay evidencia.
// Sin evidencia no hay valor.
//
// V4 changes:
//   - Validates token against DB (not just localStorage).
//   - Exposes window.ZYKOS_USER = { dni, name, email, role } for games to render identity.
//   - Renders a persistent identity badge top-right so the patient sees who is playing.
//   - If validation fails, redirects to /auth/ with return URL.
//
// This script runs on DOMContentLoaded.
// ============================================================

(function() {
'use strict';

function setGlobalsAndBadge(user) {
  window.ZYKOS_DNI = user.dni || null;
  window.ZYKOS_USER_ID = user.user_id || user.id || null;
  window.ZYKOS_USER = {
    dni: user.dni || null,
    name: user.display_name || user.name || null,
    email: user.email || null,
    role: user.role || 'free_user'
  };
  window.ZYKOS_AUTH_BLOCKED = false;

  try {
    if (user.dni) localStorage.setItem('zykos_patient_dni', user.dni);
  } catch(e) {}

  renderIdentityBadge(window.ZYKOS_USER);
}

function renderIdentityBadge(u) {
  if (!u || !u.dni) return;
  if (document.getElementById('zykos-identity-badge')) return;

  var badge = document.createElement('div');
  badge.id = 'zykos-identity-badge';
  badge.style.cssText = [
    'position:fixed', 'top:10px', 'right:10px', 'z-index:99999',
    'background:rgba(6,9,18,.92)', 'border:1px solid rgba(0,212,255,.25)',
    'border-radius:8px', 'padding:6px 11px', 'color:#e5e9f0',
    'font-family:system-ui,-apple-system,sans-serif', 'font-size:11px',
    'line-height:1.3', 'pointer-events:none', 'backdrop-filter:blur(8px)',
    'max-width:240px', 'box-shadow:0 2px 10px rgba(0,0,0,.4)'
  ].join(';');

  var label = (u.name && u.name !== u.dni) ? u.name : 'Paciente';
  badge.innerHTML =
    '<div style="color:#00d4ff;font-size:9px;text-transform:uppercase;letter-spacing:.06em;opacity:.7">Registrado como</div>' +
    '<div style="font-weight:500">' + escapeHtml(label) + '</div>' +
    '<div style="color:rgba(229,233,240,.55);font-size:10px">DNI ' + escapeHtml(u.dni) + '</div>';

  // Insert after body is ready
  if (document.body) {
    document.body.appendChild(badge);
  } else {
    document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(badge); });
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function redirectToAuth(reason) {
  console.warn('[require-auth] redirect to /auth/:', reason);
  window.ZYKOS_DNI = null;
  window.ZYKOS_AUTH_BLOCKED = true;
  if (window.location.pathname.indexOf('/auth') === -1) {
    var returnUrl = window.location.pathname + window.location.search;
    window.location.href = '/auth/?return=' + encodeURIComponent(returnUrl);
  }
}

// === Entry point ===

// Gather sources
var dni = null;
try {
  var params = new URLSearchParams(window.location.search);
  dni = params.get('dni') || null;
} catch(e) {}

if (!dni) { try { dni = localStorage.getItem('zykos_patient_dni'); } catch(e) {} }

var localUser = null;
try { localUser = JSON.parse(localStorage.getItem('zykos_user') || 'null'); } catch(e) {}
if (!dni && localUser) dni = localUser.dni || null;

var token = null;
try { token = localStorage.getItem('zykos_token'); } catch(e) {}

var isDemoMode = token && token.indexOf('demo_token_') === 0;

if (!dni || (!token && !isDemoMode)) {
  redirectToAuth('no dni or token');
  // Prevent further execution of game scripts
  window.stop && window.stop();
  return;
}

// Demo mode: trust localStorage, no DB roundtrip
if (isDemoMode) {
  setGlobalsAndBadge({
    dni: dni,
    display_name: (localUser && localUser.name) || 'Demo',
    email: (localUser && localUser.email) || null,
    role: 'demo'
  });
  window.ZYKOS_DEMO_MODE = true;
  return;
}

// Real session: validate against DB before proceeding
function validateAndBoot() {
  if (typeof getSupabaseClient !== 'function') {
    // supabase-config.js not loaded yet — retry
    return setTimeout(validateAndBoot, 150);
  }
  var sb = getSupabaseClient();
  if (!sb) {
    console.warn('[require-auth] supabase client not ready, trusting localStorage');
    setGlobalsAndBadge({
      dni: dni,
      display_name: (localUser && localUser.name) || null,
      email: (localUser && localUser.email) || null,
      role: (localUser && localUser.role) || 'free_user'
    });
    return;
  }
  sb.rpc('zykos_validate_session', { p_token: token }).then(function(res){
    if (res.error || !res.data || !res.data.ok) {
      try { localStorage.removeItem('zykos_token'); } catch(e) {}
      try { localStorage.removeItem('zykos_user'); } catch(e) {}
      redirectToAuth('token validation failed');
      return;
    }
    var u = res.data;
    // Persist refreshed user object
    try {
      localStorage.setItem('zykos_user', JSON.stringify({
        user_id: u.user_id, name: u.display_name, dni: u.dni,
        email: u.email, role: u.role
      }));
    } catch(e) {}
    setGlobalsAndBadge(u);
  }).catch(function(err){
    console.warn('[require-auth] validation error, falling back to local:', err && err.message);
    setGlobalsAndBadge({
      dni: dni,
      display_name: (localUser && localUser.name) || null,
      email: (localUser && localUser.email) || null,
      role: (localUser && localUser.role) || 'free_user'
    });
  });
}

validateAndBoot();

})();
