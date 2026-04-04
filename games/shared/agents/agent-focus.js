// ================================================================
// agent-focus.js — PIRATE AGENT: Atencion dividida y contexto ambiental
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Captura interrupciones de foco sin interferir en el juego.
// Proxy de atencion sostenida, distraccion y contexto real de uso.
//
// Metricas que produce (nombres canonicos del METRIC_DICTIONARY):
//   focus_interruptions_count  — veces que el usuario salio de la ventana
//   focus_time_away_ms         — tiempo total fuera de foco
//   focus_time_away_max_ms     — interrupcion mas larga
//   focus_away_pct             — % de sesion fuera de foco
//   tab_switches_count         — cambios de pestaña detectados
// ================================================================

(function() {
'use strict';

var state = {
    active: false,
    sessionStart: 0,
    focusLostAt: null,
    interruptions: 0,
    timeAway: 0,
    maxAway: 0,
    tabSwitches: 0
};

function onVisibilityChange() {
    if (!state.active) return;
    var now = performance.now();
    if (document.hidden) {
        state.focusLostAt = now;
        state.interruptions++;
        if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw) {
            ZYKOS._pushRaw('tab_hidden', { t: Math.round(now - state.sessionStart) });
        }
    } else {
        if (state.focusLostAt !== null) {
            var away = now - state.focusLostAt;
            state.timeAway += away;
            if (away > state.maxAway) state.maxAway = away;
            state.focusLostAt = null;
            if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw) {
                ZYKOS._pushRaw('tab_visible', { t: Math.round(now - state.sessionStart), away_ms: Math.round(away) });
            }
        }
    }
}

function onBlur() {
    if (!state.active || state.focusLostAt !== null) return;
    state.focusLostAt = performance.now();
    state.tabSwitches++;
}

function onFocus() {
    if (!state.active || state.focusLostAt === null) return;
    var now = performance.now();
    var away = now - state.focusLostAt;
    state.timeAway += away;
    if (away > state.maxAway) state.maxAway = away;
    state.focusLostAt = null;
}

var agent = {
    start: function() {
        state.active = true;
        state.sessionStart = performance.now();
        state.focusLostAt = null;
        state.interruptions = 0;
        state.timeAway = 0;
        state.maxAway = 0;
        state.tabSwitches = 0;
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
    },

    collect: function() {
        // Cerrar interrupcion activa si sigue fuera de foco
        var extraAway = 0;
        if (state.focusLostAt !== null) {
            extraAway = performance.now() - state.focusLostAt;
        }
        var totalAway = state.timeAway + extraAway;
        var sessionDuration = performance.now() - state.sessionStart;
        var awayPct = sessionDuration > 0 ? totalAway / sessionDuration : 0;

        return {
            focus_interruptions_count: state.interruptions,
            focus_time_away_ms:        Math.round(totalAway),
            focus_time_away_max_ms:    Math.round(Math.max(state.maxAway, extraAway)),
            focus_away_pct:            +awayPct.toFixed(3),
            tab_switches_count:        state.tabSwitches
        };
    },

    stop: function() {
        state.active = false;
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('focus', onFocus);
    }
};

if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('focus', agent);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('focus', agent);
    });
}

})();

if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
