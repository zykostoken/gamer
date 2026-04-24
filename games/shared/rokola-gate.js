// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
// ============================================================
// rokola-gate.js — Doctrina Constitucion V4 Art XVII (audit #154)
//
// "El paciente no elige. La Rokola es la unica puerta de acceso al
//  gameplay. Los motores son instrumentos sin menu visible al paciente."
//
// Cada juego incluye este script ANTES de su propio <script> de inicializacion.
// Toma la decision del flujo:
//
//   CASO A — Admin/superadmin sin rokola_session_id:
//     Modo desarrollador. Muestra menu de niveles. Art XIII normal.
//
//   CASO B — Paciente con rokola_session_id:
//     Oculta menu. Auto-start del nivel pedido. Respeta Art XIII como fallback.
//
//   CASO C — Paciente SIN rokola_session_id:
//     Redirige a /jugar con mensaje corto. El juego no arranca standalone.
//
// API expuesta:
//   window.RokolaGate.mode            — 'admin_dev' | 'rokola_patient' | 'redirected'
//   window.RokolaGate.sessionId       — UUID si viene de Rokola, null si no
//   window.RokolaGate.cellSlug        — slug de la cell actual (ej 'lawn-mower-L2')
//   window.RokolaGate.requestedLevel  — int del nivel pedido por Rokola
//   window.RokolaGate.autostart       — bool
//   window.RokolaGate.hideMenu()      — oculta elementos con class .patient-hide cuando no admin
//   window.RokolaGate.onReady(cb)     — cb se llama con el modo decidido, despues de chequear rol
//   window.RokolaGate.backToRokola()  — redirige a /jugar o /games/play/rokola.html
//
// DEPENDENCIAS:
//   Se ejecuta despues de require-auth.js (necesita window.ZYKOS_USER.role).
// ============================================================

(function(global) {
  'use strict';

  var _ready = false;
  var _readyCbs = [];

  function getParam(name) {
    try { return new URLSearchParams(location.search).get(name); } catch(e) { return null; }
  }

  function getRole() {
    try {
      if (global.ZYKOS_USER && global.ZYKOS_USER.role) return global.ZYKOS_USER.role;
      var raw = localStorage.getItem('zykos_user');
      if (raw) {
        var u = JSON.parse(raw);
        return u.role || null;
      }
    } catch(e) {}
    return null;
  }

  var rokolaSessionId = getParam('rokola_session_id');
  var cellSlug = getParam('rokola_cell_slug');
  var requestedLevelRaw = getParam('level') || getParam('levelId');
  var requestedLevel = requestedLevelRaw ? parseInt(requestedLevelRaw, 10) : null;
  var autostart = getParam('autostart') === '1' || !!rokolaSessionId; // Rokola siempre autostart

  var mode = null;

  function decide() {
    var role = getRole();
    var isAdmin = (role === 'superadmin' || role === 'admin');

    if (rokolaSessionId) {
      // Viene desde Rokola — paciente o admin, da igual, respetamos la orden
      mode = 'rokola_patient';
    } else if (isAdmin) {
      // Admin sin Rokola = modo desarrollador
      mode = 'admin_dev';
    } else {
      // Paciente no-admin accediendo directo al juego: redirect a Rokola
      mode = 'redirected';
      console.warn('[rokola-gate] Paciente sin rokola_session_id. Redirigiendo a /jugar.');
      showRedirectMessage();
      setTimeout(function() {
        location.href = '/jugar';
      }, 1800);
    }

    // Expose state
    global.RokolaGate.mode = mode;
    global.RokolaGate.sessionId = rokolaSessionId;
    global.RokolaGate.cellSlug = cellSlug;
    global.RokolaGate.requestedLevel = requestedLevel;
    global.RokolaGate.autostart = autostart;
    global.RokolaGate.isAdmin = isAdmin;

    // Aplicar hideMenu si corresponde
    if (mode === 'rokola_patient') {
      global.RokolaGate.hideMenu();
    }

    // Marcar ready y disparar callbacks
    _ready = true;
    _readyCbs.forEach(function(cb) {
      try { cb(mode); } catch(e) { console.warn('[rokola-gate] onReady cb threw:', e.message); }
    });
    _readyCbs = [];
  }

  function showRedirectMessage() {
    try {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:#0a0a0f;color:#e8e8ed;' +
        'display:flex;align-items:center;justify-content:center;z-index:99999;' +
        'font-family:system-ui,sans-serif;padding:24px;text-align:center;';
      overlay.innerHTML =
        '<div style="max-width:380px;">' +
          '<div style="font-size:1.3rem;font-weight:700;margin-bottom:10px;color:#f1ff3b;">La Rokola te lleva.</div>' +
          '<div style="font-size:0.95rem;color:#a8a8b4;">Los juegos se acceden desde tu Rokola, no directo. Redirigiendo&hellip;</div>' +
        '</div>';
      document.body.appendChild(overlay);
    } catch(e) {}
  }

  global.RokolaGate = {
    mode: null,
    sessionId: null,
    cellSlug: null,
    requestedLevel: null,
    autostart: false,
    isAdmin: false,

    /**
     * Oculta cualquier elemento con class="patient-hide" en el DOM.
     * Se usa para el menu de niveles y botones que solo admin debe ver.
     */
    hideMenu: function() {
      try {
        var nodes = document.querySelectorAll('.patient-hide');
        nodes.forEach(function(n) { n.style.display = 'none'; });
      } catch(e) {}
    },

    /**
     * Registra callback cuando el modo fue decidido. Si ya esta decidido, llama inmediato.
     */
    onReady: function(cb) {
      if (typeof cb !== 'function') return;
      if (_ready) cb(mode);
      else _readyCbs.push(cb);
    },

    /**
     * Redirige de vuelta a la Rokola.
     */
    backToRokola: function() {
      try {
        if (rokolaSessionId) {
          location.href = '/games/play/rokola.html';
        } else {
          location.href = '/jugar';
        }
      } catch(e) {}
    },

    /**
     * Envia postMessage cell_completed al parent (Rokola orchestrator).
     * Debe llamarse al terminar un nivel cuando mode='rokola_patient'.
     */
    reportCellCompleted: function(extraData) {
      if (mode !== 'rokola_patient') return;
      try {
        var payload = {
          type: 'zykos:cell_completed',
          rokola_session_id: rokolaSessionId,
          cell_slug: cellSlug,
          level: requestedLevel,
          timestamp: new Date().toISOString(),
          data: extraData || {}
        };
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, location.origin);
        } else {
          // Si no hay parent (no es iframe), navegar a Rokola con flag
          console.log('[rokola-gate] No iframe parent; navigating back to Rokola with cell_completed flag.');
          location.href = '/games/play/rokola.html?completed_cell=' + encodeURIComponent(cellSlug || '');
        }
      } catch(e) {
        console.warn('[rokola-gate] reportCellCompleted failed:', e.message);
      }
    },

    /**
     * Envia postMessage cell_abandoned si el paciente se fue sin terminar.
     */
    reportCellAbandoned: function(reason) {
      if (mode !== 'rokola_patient') return;
      try {
        var payload = {
          type: 'zykos:cell_abandoned',
          rokola_session_id: rokolaSessionId,
          cell_slug: cellSlug,
          reason: reason || 'user_exit',
          timestamp: new Date().toISOString()
        };
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, location.origin);
        }
      } catch(e) {}
    }
  };

  // Decidir modo apenas el DOM este listo (o ya si es tarde)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decide);
  } else {
    decide();
  }

})(window);
