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
    focusEvents: [],     // {t, type: 'blur'|'focus'}
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
    if (document.hidden) {
        state.tabSwitches++;
        state.focusEvents.push({ t: performance.now(), type: 'hidden' });
    } else {
        state.focusEvents.push({ t: performance.now(), type: 'visible' });
    }
    if (typeof ZYKOS !== 'undefined') ZYKOS._pushRaw(document.hidden ? 'tab_hidden' : 'tab_visible', {});
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
        state.instructionStart = performance.now(); // Assume instructions shown at start
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
        
        return {
            instruction_time_ms:      state.instructionTime ? Math.round(state.instructionTime) : null,
            instruction_scrollbacks:  state.scrollbacks,
            total_clicks:             state.totalClicks,
            
            _raw_context: {
                tab_switches: state.tabSwitches,
                hidden_time_ms: Math.round(hiddenTime),
                connection_lost: state.connectionLost,
                orientation_changes: state.orientationChanges,
                errors: state.errors.length,
                focus_events: state.focusEvents.length
            }
        };
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

