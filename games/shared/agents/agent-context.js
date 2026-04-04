// ================================================================
// agent-context.js — PIRATE AGENT: Session Context & Environment
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Captura contexto ambiental y conductual:
// - Tab switches (distractibilidad)
// - Instruction reading time and scrollbacks
// - Window focus/blur patterns
// - Device orientation changes
// - Connection status
// - Session timing
//
// Métricas canónicas:
// - instruction_time_ms, instruction_scrollbacks
// - total_clicks, session_duration_ms
// ================================================================

(function() {
'use strict';

var state = {
    active: false,
    tabSwitches: 0,
    focusEvents: [],     // {t, type: 'hidden'|'visible'|'blur'|'focus'}
    gaps: [],            // {start_ms, end_ms, duration_ms} — cada interrupcion
    sessionStart: 0,     // para calcular first_gap_session_pct
    instructionStart: null,
    instructionTime: 0,
    scrollbacks: 0,
    lastScrollY: 0,
    totalClicks: 0,
    connectionLost: 0,
    orientationChanges: 0,
    errors: []
};

function onVisibility() {
    if (!state.active) return;
    var now = performance.now();
    if (document.hidden) {
        state.tabSwitches++;
        state.focusEvents.push({ t: now, type: 'hidden' });
        // Registrar inicio del gap para calcular duracion al volver
        state._currentGapStart = now;
        state._currentGapSessionMs = Math.round(now - state.sessionStart);
    } else {
        state.focusEvents.push({ t: now, type: 'visible' });
        // Cerrar el gap con su duracion y posicion en la sesion
        if (state._currentGapStart) {
            var gapDuration = Math.round(now - state._currentGapStart);
            state.gaps.push({
                start_session_ms: state._currentGapSessionMs,
                duration_ms: gapDuration,
                start_session_pct: state._currentGapSessionMs / Math.max(1, now - state.sessionStart)
            });
            state._currentGapStart = null;
        }
    }
}

function onFocus() {
    if (!state.active) return;
    state.focusEvents.push({ t: performance.now(), type: 'focus' });
}

function onBlur() {
    if (!state.active) return;
    state.focusEvents.push({ t: performance.now(), type: 'blur' });
}

function onScroll() {
    if (!state.active) return;
    var y = window.scrollY || window.pageYOffset || 0;
    if (y < state.lastScrollY - 20) {
        state.scrollbacks++;
    }
    state.lastScrollY = y;
}

function onClick() {
    if (!state.active) return;
    state.totalClicks++;
    // End instruction tracking on first click (game started)
    if (state.instructionStart && !state.instructionTime) {
        state.instructionTime = performance.now() - state.instructionStart;
        state.instructionStart = null;
    }
}

function onOffline() { if (state.active) state.connectionLost++; }
function onOrientation() { if (state.active) state.orientationChanges++; }
function onError(e) { if (state.active) state.errors.push({ t: performance.now(), msg: e.message || String(e) }); }

var agent = {
    start: function(meta) {
        state.active = true;
        state.tabSwitches = 0;
        state.focusEvents = [];
        state.gaps = [];
        state.sessionStart = performance.now();
        state.instructionStart = performance.now();
        state.instructionTime = 0;
        state.scrollbacks = 0;
        state.lastScrollY = 0;
        state.totalClicks = 0;
        state.connectionLost = 0;
        state.orientationChanges = 0;
        state.errors = [];
        
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);
        window.addEventListener('scroll', onScroll, { passive: true });
        document.addEventListener('click', onClick, { passive: true, capture: true });
        window.addEventListener('offline', onOffline);
        window.addEventListener('orientationchange', onOrientation);
        window.addEventListener('error', onError);
    },
    
    collect: function() {
        // If instruction time was never ended by a click, estimate
        if (state.instructionStart && !state.instructionTime) {
            state.instructionTime = performance.now() - state.instructionStart;
        }
        
        // Calculate time spent with tab hidden
        var hiddenTime = 0;
        var lastHide = null;
        state.focusEvents.forEach(function(e) {
            if (e.type === 'hidden') lastHide = e.t;
            if (e.type === 'visible' && lastHide) { hiddenTime += e.t - lastHide; lastHide = null; }
        });
        
        // Métricas de navegación — el multitasking es conducta atencional real
        var gapDurations = state.gaps.map(function(g){ return g.duration_ms; });
        var gapMean = gapDurations.length > 0
            ? Math.round(gapDurations.reduce(function(a,b){return a+b;},0) / gapDurations.length)
            : 0;
        var gapMax = gapDurations.length > 0 ? Math.max.apply(null, gapDurations) : 0;
        var firstGapPct = state.gaps.length > 0 ? +(state.gaps[0].start_session_pct.toFixed(3)) : null;
        var sessionNow = performance.now() - state.sessionStart;
        var focusAwayPct = sessionNow > 0 ? +(hiddenTime / sessionNow).toFixed(3) : 0;

        return {
            // Métricas canónicas del METRIC_DICTIONARY
            instruction_time_ms:      state.instructionTime ? Math.round(state.instructionTime) : null,
            instruction_scrollbacks:  state.scrollbacks,
            total_clicks:             state.totalClicks,

            // Dominio ATENCION — interrupciones como métrica conductual
            focus_interruptions_count: state.tabSwitches,
            focus_time_away_ms:        Math.round(hiddenTime),
            focus_time_away_max_ms:    gapMax,
            focus_away_pct:            focusAwayPct,

            // Sub-métricas de navegación (raw para análisis diferido)
            _raw_navigation: {
                tab_switches:       state.tabSwitches,
                gaps:               state.gaps,           // cada interrupcion individual
                gap_mean_ms:        gapMean,
                gap_max_ms:         gapMax,
                first_gap_pct:      firstGapPct,          // cuando ocurrio la primera salida
                connection_lost:    state.connectionLost,
                orientation_changes: state.orientationChanges,
                errors:             state.errors.length
            }
        };
    },
    
    pause: function() {
        state.active = false;
    },

    resume: function() {
        state.active = true;
    },

        stop: function() {
        state.active = false;
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('scroll', onScroll);
        document.removeEventListener('click', onClick, { capture: true });
        window.removeEventListener('offline', onOffline);
        window.removeEventListener('orientationchange', onOrientation);
        window.removeEventListener('error', onError);
    }
};

if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('context', agent);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('context', agent);
    });
}

})();

// Señal al engine: este agente está listo
if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}

