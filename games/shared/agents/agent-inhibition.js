// ================================================================
// agent-inhibition.js — PIRATE AGENT: Executive / Inhibition
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Observa patrones de acción para detectar impulsividad,
// perseveración, capacidad inhibitoria, y economía cognitiva.
// No sabe qué está haciendo el juego — solo mira la conducta.
//
// Métricas canónicas:
// - errores_comision, errores_omision
// - perseveracion_count
// - impulsividad_ratio
// - count_drags_abortados
// - ratio_acciones_util
// - secuencia_correcta_pct
// - ratio_completados, eficacia_plan_propio
// - plan_failed_attempts
// ================================================================

(function() {
'use strict';

var state = {
    active: false,
    actions: [],           // {t, type, target_id, x, y}
    rapidActions: 0,       // clicks < 150ms apart
    totalActions: 0,
    stoppedActions: 0,     // mousedown without mouseup on same target (aborted)
    mouseDownTarget: null,
    mouseDownTime: 0,
    
    // Sequence tracking
    targetSequence: [],    // IDs of elements interacted with
    repeatedTargets: {},   // count per target_id
    
    // DOM tracking
    removedAfterClick: 0,  // elements removed shortly after click (correct actions)
    notRemovedAfterClick: 0, // clicked but nothing happened (wrong target / commission)
    
    observer: null
};

function getTargetId(el) {
    if (!el) return 'null';
    return el.id || el.className.split(' ')[0] || el.tagName.toLowerCase();
}

function onClick(e) {
    if (!state.active) return;
    var now = performance.now();
    var targetId = getTargetId(e.target);
    
    state.totalActions++;
    
    // Track action
    state.actions.push({ t: now, type: 'click', target_id: targetId, x: e.clientX, y: e.clientY });
    
    // Rapid action detection (impulsivity)
    if (state.actions.length >= 2) {
        var prev = state.actions[state.actions.length - 2];
        if (now - prev.t < 150) {
            state.rapidActions++;
        }
    }
    
    // Sequence tracking (perseveration)
    state.targetSequence.push(targetId);
    state.repeatedTargets[targetId] = (state.repeatedTargets[targetId] || 0) + 1;
    
    // Track if element gets removed after click (= correct action in most games)
    var clickedEl = e.target;
    setTimeout(function() {
        if (!clickedEl.parentNode || !document.contains(clickedEl)) {
            state.removedAfterClick++;
        } else {
            state.notRemovedAfterClick++;
        }
    }, 500);
}

function onMouseDown(e) {
    if (!state.active) return;
    state.mouseDownTarget = e.target;
    state.mouseDownTime = performance.now();
}

function onMouseUp(e) {
    if (!state.active) return;
    // If mouseup on different target than mousedown = inhibited/corrected action
    if (state.mouseDownTarget && state.mouseDownTarget !== e.target) {
        state.stoppedActions++;
    }
    state.mouseDownTarget = null;
}

function countPerseverations() {
    var seq = state.targetSequence;
    var persev = 0;
    for (var i = 2; i < seq.length; i++) {
        // 3+ consecutive same target = perseveration
        if (seq[i] === seq[i-1] && seq[i] === seq[i-2]) {
            persev++;
        }
    }
    return persev;
}

// ================================================================
// AGENT INTERFACE
// ================================================================
var agent = {
    start: function(meta) {
        state.active = true;
        state.actions = [];
        state.rapidActions = 0;
        state.totalActions = 0;
        state.stoppedActions = 0;
        state.targetSequence = [];
        state.repeatedTargets = {};
        state.removedAfterClick = 0;
        state.notRemovedAfterClick = 0;
        
        document.addEventListener('click', onClick, { passive: true, capture: true });
        document.addEventListener('mousedown', onMouseDown, { passive: true });
        document.addEventListener('mouseup', onMouseUp, { passive: true });
        document.addEventListener('touchstart', onMouseDown, { passive: true });
        document.addEventListener('touchend', onMouseUp, { passive: true });
    },
    
    collect: function() {
        var total = state.totalActions;
        var impulsivity = total > 0 ? state.rapidActions / total : 0;
        var inhibition = total > 0 ? state.stoppedActions / total : 0;
        
        // Economy: useful actions (removed element) / total actions
        var usefulActions = state.removedAfterClick;
        var economy = total > 0 ? usefulActions / total : 0;
        
        // Commission estimate: clicked but nothing happened
        var commissions = state.notRemovedAfterClick;
        
        // Eficacia: useful / (useful + wasted)
        var eficacia = (usefulActions + commissions) > 0 ? usefulActions / (usefulActions + commissions) : null;
        
        return {
            errores_comision:       commissions,
            perseveracion_count:    countPerseverations(),
            impulsividad_ratio:     +(impulsivity.toFixed(3)),
            count_drags_abortados:       +(inhibition.toFixed(3)),
            ratio_acciones_util:     +(economy.toFixed(3)),
            ratio_completados:      eficacia !== null ? +(eficacia.toFixed(3)) : null,
            total_actions:          total,
            
            _raw_inhibition: {
                rapid_actions: state.rapidActions,
                stopped_actions: state.stoppedActions,
                unique_targets: Object.keys(state.repeatedTargets).length,
                most_repeated: (function() {
                    var max = 0, id = null;
                    Object.keys(state.repeatedTargets).forEach(function(k) {
                        if (state.repeatedTargets[k] > max) { max = state.repeatedTargets[k]; id = k; }
                    });
                    return { id: id, count: max };
                })()
            }
        };
    },
    
    stop: function() {
        state.active = false;
        document.removeEventListener('click', onClick, { capture: true });
        document.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchstart', onMouseDown);
        document.removeEventListener('touchend', onMouseUp);
    }
};

if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('inhibition', agent);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('inhibition', agent);
    });
}

})();
