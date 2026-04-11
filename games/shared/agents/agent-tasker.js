// ================================================================
// agent-tasker.js — PIRATE AGENT: Actividad del dispositivo fuera del juego
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// El tasker corre SIEMPRE — no se pausa con el juego.
// Captura actividad del dispositivo durante gaps de visibilidad:
//   El paciente siguio tocando el touchpad mientras el juego estaba pausado?
//   Disparo caracteres en el teclado?
//   Siguio moviendo el mouse?
//
// Esto distingue:
//   - Pausa real (paciente se fue del dispositivo)
//   - Pausa con actividad (otra ventana, distractor activo)
//   - Pausa con teclado (escritura, mensajes)
//
// Metricas canonicas producidas:
//   tasker_gap_count          — cantidad de gaps de visibilidad en la sesion
//   tasker_gap_total_ms       — tiempo total fuera del juego
//   tasker_active_gap_count   — gaps donde hubo actividad del dispositivo
//   tasker_keystrokes_in_gap  — teclas disparadas durante gaps
//   tasker_mouse_in_gap       — movimientos de mouse durante gaps
//   tasker_touch_in_gap       — eventos touch durante gaps
//   tasker_activity_ratio     — ratio gaps_activos / gaps_totales (0-1)
// ================================================================

(function() {
'use strict';

var state = {
    active:        false,
    inGap:         false,
    gapStart:      0,
    gaps:          [],
    currentGap:    null,
    gapKeystrokes: 0,
    gapMouseMoves: 0,
    gapTouchEvents:0
};

function onKeydown(e) {
    if (!state.inGap) return;
    if (e.key && e.key.length === 1) state.gapKeystrokes++;
}
function onMouseMove() {
    if (!state.inGap) return;
    state.gapMouseMoves++;
}
function onTouch() {
    if (!state.inGap) return;
    state.gapTouchEvents++;
}

var agent = {

    start: function() {
        state.active = true;
        state.inGap = false;
        state.gaps = [];
        state.currentGap = null;
        state.gapKeystrokes = 0;
        state.gapMouseMoves = 0;
        state.gapTouchEvents = 0;
        document.addEventListener('keydown',    onKeydown,   { passive: true });
        document.addEventListener('mousemove',  onMouseMove, { passive: true });
        document.addEventListener('touchstart', onTouch,     { passive: true });
        document.addEventListener('touchmove',  onTouch,     { passive: true });
    },

    enterGap: function(t) {
        if (!state.active) return;
        state.inGap = true;
        state.gapStart = t || performance.now();
        state.gapKeystrokes = 0;
        state.gapMouseMoves = 0;
        state.gapTouchEvents = 0;
        var sessionStart = window._ZYKOS_SESSION_START || state.gapStart;
        state.currentGap = { start_ms: Math.round(state.gapStart - sessionStart) };
    },

    exitGap: function(t) {
        if (!state.active || !state.inGap) return;
        state.inGap = false;
        var now = t || performance.now();
        var duration = Math.round(now - state.gapStart);
        var sessionStart = window._ZYKOS_SESSION_START || now;
        var gap = Object.assign(state.currentGap || {}, {
            end_ms:       Math.round(now - sessionStart),
            duration_ms:  duration,
            keystrokes:   state.gapKeystrokes,
            mouse_moves:  state.gapMouseMoves,
            touch_events: state.gapTouchEvents,
            was_active:   (state.gapKeystrokes + state.gapMouseMoves + state.gapTouchEvents) > 0
        });
        state.gaps.push(gap);
        state.currentGap = null;
    },

    // El tasker NO se pausa — el gap ES la informacion clinica
    pause:  function() { agent.enterGap(); },
    resume: function() { agent.exitGap(); },

    collect: function() {
        if (state.inGap) agent.exitGap();
        var total   = state.gaps.length;
        var active  = state.gaps.filter(function(g){ return g.was_active; }).length;
        var totalMs = state.gaps.reduce(function(s,g){ return s+g.duration_ms; }, 0);
        var keys    = state.gaps.reduce(function(s,g){ return s+g.keystrokes; }, 0);
        var mouse   = state.gaps.reduce(function(s,g){ return s+g.mouse_moves; }, 0);
        var touch   = state.gaps.reduce(function(s,g){ return s+g.touch_events; }, 0);
        return {
            tasker_gap_count:         total,
            tasker_gap_total_ms:      totalMs,
            tasker_active_gap_count:  active,
            tasker_keystrokes_in_gap: keys,
            tasker_mouse_in_gap:      mouse,
            tasker_touch_in_gap:      touch,
            tasker_activity_ratio:    total > 0 ? +(active/total).toFixed(3) : 0,
            _raw_gaps: state.gaps
        };
    },

    stop: function() {
        if (state.inGap) agent.exitGap();
        state.active = false;
        document.removeEventListener('keydown',    onKeydown);
        document.removeEventListener('mousemove',  onMouseMove);
        document.removeEventListener('touchstart', onTouch);
        document.removeEventListener('touchmove',  onTouch);
    }
};

if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('tasker', agent);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('tasker', agent);
    });
}

window._ZykosTasker = agent;

})();

if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
