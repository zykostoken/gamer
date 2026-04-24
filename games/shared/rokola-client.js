/**
 * ROKOLA-CLIENT — helper que cargan los motores/juegos cuando viven dentro de la Rokola.
 *
 * Dr. Gonzalo Perez Cortizo. Audit #115.
 *
 * FUNCION:
 *  - Detecta si el juego esta corriendo dentro de un iframe de Rokola (query param rokola_session_id).
 *  - Expone window.RokolaClient.isInsideRokola().
 *  - Expone window.RokolaClient.getContext() → {sessionId, cellSlug, position, dni}.
 *  - Expone window.RokolaClient.notifyCompleted(summary) → postMessage al parent con type rokola:cell_completed.
 *  - Inyecta contexto Rokola en cualquier payload antes de persistir (helper enrichPayload).
 *
 * DNI-NO-ID (#114): el contexto expone solo DNI, nunca user_id.
 *
 * USO:
 *   if (RokolaClient.isInsideRokola()) {
 *     var ctx = RokolaClient.getContext();
 *     payload.metric_data.rokola_session_id = ctx.sessionId;
 *     payload.metric_data.rokola_cell_slug = ctx.cellSlug;
 *   }
 *   ...
 *   // Al terminar el nivel:
 *   RokolaClient.notifyCompleted({ score: 85, completed: true });
 */
(function(global) {
'use strict';

var _context = null;
var _detected = false;

function detect() {
  if (_detected) return _context;
  _detected = true;

  try {
    var params = new URLSearchParams(location.search);
    var sessionId = params.get('rokola_session_id');
    if (!sessionId) return null;

    _context = {
      sessionId: sessionId,
      cellSlug: params.get('rokola_cell_slug') || null,
      position: parseInt(params.get('rokola_position') || '0', 10) || null,
      forced: params.get('rokola_forced') === '1',
      dni: params.get('dni') || null,
      isIframe: (global.self !== global.top)
    };
    console.log('[rokola-client] Running inside Rokola:', _context);
  } catch (e) {
    console.warn('[rokola-client] detect error:', e && e.message);
  }
  return _context;
}

function isInsideRokola() {
  return detect() !== null;
}

/**
 * Indica si la Rokola pidio este juego en modo "forced":
 * el juego debe ignorar su historial personal (niveles completados, bloqueos por
 * progresion propia) y jugar exactamente el nivel pedido por el query param.
 * El progreso individual del paciente NO se pierde — lawn-mower sigue sabiendo
 * que paso nivel 3. Pero cuando la Rokola lo llama a jugar L2 de nuevo,
 * no lo bloquea por "ya lo completaste".
 */
function isForced() {
  var ctx = detect();
  return !!(ctx && ctx.forced);
}

function getContext() {
  return detect();
}

/**
 * Enriquece un payload de metric_data con el contexto Rokola.
 * Retorna el payload mutado (o el mismo si no hay contexto).
 */
function enrichPayload(payload) {
  var ctx = detect();
  if (!ctx) return payload;
  if (!payload || typeof payload !== 'object') return payload;

  // Si el payload tiene metric_data anidado, enriquecemos dentro
  if (payload.metric_data && typeof payload.metric_data === 'object') {
    payload.metric_data.rokola_session_id = ctx.sessionId;
    payload.metric_data.rokola_cell_slug = ctx.cellSlug;
    payload.metric_data.rokola_position = ctx.position;
  } else {
    payload.rokola_session_id = ctx.sessionId;
    payload.rokola_cell_slug = ctx.cellSlug;
    payload.rokola_position = ctx.position;
  }
  return payload;
}

/**
 * Notifica al shell Rokola padre que esta celda terminó.
 * Safe to call outside Rokola (no-op).
 */
function notifyCompleted(summary) {
  var ctx = detect();
  if (!ctx) return false;
  if (!ctx.isIframe) {
    console.log('[rokola-client] notifyCompleted called but not in iframe (standalone test?)');
    return false;
  }

  try {
    global.parent.postMessage({
      type: 'rokola:cell_completed',
      cell_slug: ctx.cellSlug,
      session_id: ctx.sessionId,
      completed: summary && summary.completed !== false,
      session_summary: summary || null,
      ts: Date.now()
    }, '*');
    console.log('[rokola-client] cell_completed posted to parent for', ctx.cellSlug);
    return true;
  } catch (e) {
    console.warn('[rokola-client] notifyCompleted postMessage failed:', e && e.message);
    return false;
  }
}

// Expose
global.RokolaClient = {
  isInsideRokola: isInsideRokola,
  isForced: isForced,
  getContext: getContext,
  enrichPayload: enrichPayload,
  notifyCompleted: notifyCompleted
};

})(typeof window !== 'undefined' ? window : this);
