/**
 * ROKOLA-CLIENT — shim de retrocompat sobre RokolaGate.
 *
 * Dr. Gonzalo Perez Cortizo. Audits #115, #154, #155.
 *
 * Este modulo EXISTIA antes con su propia logica. Ahora delega al nuevo
 * RokolaGate (Art XVII Constitucion V4) para no duplicar.
 * Se mantiene solo para retrocompat.
 *
 * NUEVO CODIGO: usar directamente window.RokolaGate.
 */
(function(global) {
'use strict';

function gate() { return global.RokolaGate || null; }

function isInsideRokola() {
  var g = gate();
  return !!(g && g.sessionId);
}

function isForced() {
  var g = gate();
  return !!(g && g.mode === 'rokola_patient');
}

function getContext() {
  var g = gate();
  if (!g || !g.sessionId) return null;
  return {
    sessionId: g.sessionId,
    cellSlug: g.cellSlug,
    position: null,
    forced: (g.mode === 'rokola_patient'),
    dni: (global.ZYKOS_DNI || null),
    isIframe: (global.self !== global.top)
  };
}

function enrichPayload(payload) {
  var ctx = getContext();
  if (!ctx) return payload;
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.metric_data && typeof payload.metric_data === 'object') {
    payload.metric_data.rokola_session_id = ctx.sessionId;
    payload.metric_data.rokola_cell_slug = ctx.cellSlug;
  } else {
    payload.rokola_session_id = ctx.sessionId;
    payload.rokola_cell_slug = ctx.cellSlug;
  }
  return payload;
}

function notifyCompleted(summary) {
  var g = gate();
  if (!g || g.mode !== 'rokola_patient') return false;
  try {
    g.reportCellCompleted(summary || {});
    return true;
  } catch (e) {
    console.warn('[rokola-client] notifyCompleted delegation failed:', e && e.message);
    return false;
  }
}

global.RokolaClient = {
  isInsideRokola: isInsideRokola,
  isForced: isForced,
  getContext: getContext,
  enrichPayload: enrichPayload,
  notifyCompleted: notifyCompleted
};

})(typeof window !== 'undefined' ? window : this);
