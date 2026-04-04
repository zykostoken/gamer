// ================================================================
// agent-scroll.js — PIRATE AGENT: Comportamiento de scroll y navegacion espacial
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Captura comportamiento de scroll sin interferir en el juego.
// Proxy de exploracion visual, busqueda espacial y agitacion motora.
//
// Metricas que produce (nombres canonicos del METRIC_DICTIONARY):
//   scroll_depth_max_px      — profundidad maxima alcanzada
//   scroll_velocity_mean     — velocidad media de scroll (px/ms)
//   scroll_reversals_count   — cambios de direccion (agitacion)
//   scroll_total_distance_px — distancia total recorrida
//   scroll_time_at_bottom_ms — tiempo en zona inferior (busqueda)
// ================================================================

(function() {
'use strict';

var state = {
    active: false,
    lastScrollY: 0,
    lastScrollTime: 0,
    maxDepth: 0,
    totalDistance: 0,
    velocities: [],
    reversals: 0,
    lastDirection: 0,       // 1=down, -1=up
    timeAtBottom: 0,
    lastBottomEntry: null,
    sessionStart: 0
};

var _ticking = false;

function onScroll() {
    if (!state.active) return;
    if (_ticking) return;
    _ticking = true;
    requestAnimationFrame(function() {
        _ticking = false;
        var now = performance.now();
        var y = window.scrollY || document.documentElement.scrollTop || 0;
        var dt = now - state.lastScrollTime;
        var dy = y - state.lastScrollY;
        var dist = Math.abs(dy);

        if (dt > 0 && dt < 500) {   // ignora gaps grandes (pausa real)
            var vel = dist / dt;
            if (vel > 0) state.velocities.push(vel);
            state.totalDistance += dist;

            var dir = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
            if (dir !== 0 && dir !== state.lastDirection && state.lastDirection !== 0) {
                state.reversals++;
            }
            if (dir !== 0) state.lastDirection = dir;
        }

        if (y > state.maxDepth) state.maxDepth = y;

        // Zona inferior: ultimo 15% del documento
        var docH = Math.max(
            document.body.scrollHeight, document.documentElement.scrollHeight
        );
        var atBottom = (y + window.innerHeight) >= (docH * 0.85);
        if (atBottom && !state.lastBottomEntry) {
            state.lastBottomEntry = now;
        } else if (!atBottom && state.lastBottomEntry) {
            state.timeAtBottom += now - state.lastBottomEntry;
            state.lastBottomEntry = null;
        }

        state.lastScrollY = y;
        state.lastScrollTime = now;
    });
}

var agent = {
    start: function() {
        state.active = true;
        state.lastScrollY = window.scrollY || 0;
        state.lastScrollTime = performance.now();
        state.sessionStart = state.lastScrollTime;
        state.maxDepth = 0;
        state.totalDistance = 0;
        state.velocities = [];
        state.reversals = 0;
        state.lastDirection = 0;
        state.timeAtBottom = 0;
        state.lastBottomEntry = null;
        window.addEventListener('scroll', onScroll, { passive: true });
    },

    collect: function() {
        // Cerrar zona inferior si sigue activa
        if (state.lastBottomEntry) {
            state.timeAtBottom += performance.now() - state.lastBottomEntry;
        }
        var velMean = 0;
        if (state.velocities.length > 0) {
            var s = 0;
            for (var i = 0; i < state.velocities.length; i++) s += state.velocities[i];
            velMean = s / state.velocities.length;
        }
        return {
            scroll_depth_max_px:      Math.round(state.maxDepth),
            scroll_velocity_mean:     +velMean.toFixed(4),
            scroll_reversals_count:   state.reversals,
            scroll_total_distance_px: Math.round(state.totalDistance),
            scroll_time_at_bottom_ms: Math.round(state.timeAtBottom)
        };
    },

    stop: function() {
        state.active = false;
        window.removeEventListener('scroll', onScroll);
    }
};

if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('scroll', agent);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('scroll', agent);
    });
}

})();

if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
