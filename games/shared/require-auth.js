// ============================================================
// require-auth.js — ZYKOS GAMER authentication guard
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Sin registro no hay juego. Sin datos no hay evidencia.
// Sin evidencia no hay valor.
//
// This script runs IMMEDIATELY when loaded.
// If no valid DNI is found, the game does not start.
// Player is redirected to /auth/ to register/login.
//
// DNI sources (priority order):
//   1. URL param ?dni=
//   2. localStorage zykos_patient_dni
//   3. zykos_user object in localStorage
//
// If none found → redirect to /auth/
// If found → set window.ZYKOS_DNI and window.ZYKOS_USER_ID globally
// ============================================================

(function() {
'use strict';

var dni = null;
var userId = null;

// 1. URL param
try {
  var params = new URLSearchParams(window.location.search);
  dni = params.get('dni') || null;
} catch(e) {}

// 2. localStorage direct
if (!dni) {
  try { dni = localStorage.getItem('zykos_patient_dni'); } catch(e) {}
}

// 3. zykos_user object
if (!dni) {
  try {
    var user = JSON.parse(localStorage.getItem('zykos_user') || '{}');
    dni = user.dni || null;
    userId = user.id || null;
  } catch(e) {}
}

// 4. Check zykos_token exists (proves they logged in)
var token = null;
try { token = localStorage.getItem('zykos_token'); } catch(e) {}

// GUARD: no dni OR no token → block game, redirect to auth
if (!dni || !token) {
  // Don't redirect if already on auth page
  if (window.location.pathname.indexOf('/auth') === -1) {
    var returnUrl = window.location.pathname + window.location.search;
    window.location.href = '/auth/?return=' + encodeURIComponent(returnUrl);
  }
  // Prevent any further script execution
  window.ZYKOS_DNI = null;
  window.ZYKOS_AUTH_BLOCKED = true;
  return;
}

// VALID: set globals
window.ZYKOS_DNI = dni;
window.ZYKOS_USER_ID = userId;
window.ZYKOS_AUTH_BLOCKED = false;

// Also ensure localStorage is consistent
try {
  localStorage.setItem('zykos_patient_dni', dni);
} catch(e) {}

})();
