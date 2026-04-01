// ================================================================
// agent-rt.js — PIRATE AGENT: Reaction Time & Attention
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Observa cambios en el DOM (elementos que aparecen/desaparecen)
// y mide el tiempo hasta que el usuario responde.
// No sabe qué es un "estímulo" — solo detecta nuevos elementos
// visibles y cronometra hasta el siguiente click.
//
// Métricas canónicas:
// - rt_mean_ms, rt_sd_ms, rt_cv
// - decaimiento_vigilancia
// - hesitaciones_count, hesitacion_mean_ms
// - first_action_latency_ms
// ================================================================

(function() {
'use strict';

var state = {
    active: false,
    observer: null,
    
    // Stimulus tracking
    pendingStimuli: [],    // Elements that appeared, waiting for response
    reactionTimes: [],     // All measured RTs
    
    // Hesitation
    lastActionTime: 0,
    hesitations: [],       // {start_ms, duration_ms}
    
    // First action
    sessionStart: 0,
    firstActionTime: null,
    
    // Action stream
    actionTimestamps: []   // all click/tap timestamps
};

// Detect new visible elements appearing in the DOM
function onMutation(mutations) {
    if (!state.active) return;
    var now = performance.now();
    
    mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
            if (node.nodeType !== 1) return; // Only elements
            
            // Check if it's visible and significant (not tiny, not hidden)
            var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
            if (!rect || rect.width < 15 || rect.height < 15) return;
            if (rect.top < 0 || rect.left < 0) return;
            
            // Check if it has interactive properties
            var isInteractive = (
                node.onclick ||
                node.style.cursor === 'pointer' ||
                node.classList.contains('stimulus') ||
                node.classList.contains('item-card') ||
                node.classList.contains('draggable') ||
                node.tagName === 'BUTTON' ||
                (node.style.animation && node.style.animation.length > 0)
            );
            
            if (isInteractive || rect.width >= 30) {
                state.pendingStimuli.push({
                    element: node,
                    appearedAt: now,
                    rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }
                });
            }
        });
    });
}

function onAction(e) {
    if (!state.active) return;
    var now = performance.now();
    
    // First action latency
    if (!state.firstActionTime) {
        state.firstActionTime = now;
    }
    
    // Hesitation detection
    if (state.lastActionTime > 0) {
        var gap = now - state.lastActionTime;
        if (gap > 200 && gap < 30000) { // Between 200ms and 30s
            state.hesitations.push({ start_ms: state.lastActionTime - state.sessionStart, duration_ms: Math.round(gap) });
        }
    }
    state.lastActionTime = now;
    state.actionTimestamps.push(now);
    
    // Match click to nearest pending stimulus
    if (state.pendingStimuli.length > 0) {
        var x = e.clientX;
        var y = e.clientY;
        
        // Find the closest pending stimulus to this click
        var bestIdx = -1;
        var bestDist = Infinity;
        
        state.pendingStimuli.forEach(function(stim, idx) {
            var cx = stim.rect.x + stim.rect.w / 2;
            var cy = stim.rect.y + stim.rect.h / 2;
            var dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
            if (dist < bestDist && dist < 300) { // Within 300px
                bestDist = dist;
                bestIdx = idx;
            }
        });
        
        if (bestIdx >= 0) {
            var stim = state.pendingStimuli[bestIdx];
            var rt = now - stim.appearedAt;
            
            if (rt > 50 && rt < 10000) { // Valid RT range
                state.reactionTimes.push(rt);
            }
            
            // Remove matched stimulus
            state.pendingStimuli.splice(bestIdx, 1);
        }
    }
    
    // Clean old pending stimuli (>5 seconds old = probably missed)
    state.pendingStimuli = state.pendingStimuli.filter(function(s) {
        return (now - s.appearedAt) < 5000;
    });
    
    if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw) {
        ZYKOS._pushRaw('action', { x: Math.round(e.clientX), y: Math.round(e.clientY) });
    }
}

function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce(function(a,b) { return a+b; }, 0) / arr.length;
}

function sd(arr) {
    if (!arr || arr.length < 2) return 0;
    var m = mean(arr);
    return Math.sqrt(arr.map(function(v) { return Math.pow(v-m, 2); }).reduce(function(a,b) { return a+b; }, 0) / (arr.length-1));
}

// ================================================================
// AGENT INTERFACE
// ================================================================
var agent = {
    start: function(meta) {
        state.active = true;
        state.pendingStimuli = [];
        state.reactionTimes = [];
        state.hesitations = [];
        state.actionTimestamps = [];
        state.firstActionTime = null;
        state.lastActionTime = 0;
        state.sessionStart = performance.now();
        
        // MutationObserver to detect new elements
        state.observer = new MutationObserver(onMutation);
        state.observer.observe(document.body, { childList: true, subtree: true });
        
        // Listen for all clicks/taps
        document.addEventListener('click', onAction, { passive: true, capture: true });
        document.addEventListener('touchstart', onAction, { passive: true, capture: true });
    },
    
    collect: function() {
        var rts = state.reactionTimes;
        var rtMean = mean(rts);
        var rtSd = sd(rts);
        var rtCv = rtMean > 0 ? rtSd / rtMean : 0;
        
        // Vigilance decrement: compare first half vs second half RTs
        var decaimiento = 1;
        if (rts.length >= 6) {
            var mid = Math.floor(rts.length / 2);
            var first = mean(rts.slice(0, mid));
            var second = mean(rts.slice(mid));
            decaimiento = first > 0 ? second / first : 1;
        }
        
        // First action latency
        var firstLatency = (state.firstActionTime && state.sessionStart) 
            ? Math.round(state.firstActionTime - state.sessionStart) 
            : null;
        
        return {
            rt_mean_ms:               rts.length > 0 ? +(rtMean.toFixed(1)) : null,
            rt_sd_ms:                 rts.length > 0 ? +(rtSd.toFixed(1)) : null,
            rt_cv:                    rts.length > 0 ? +(rtCv.toFixed(3)) : null,
            decaimiento_vigilancia:   +(decaimiento.toFixed(3)),
            hesitaciones_count:       state.hesitations.length,
            hesitacion_mean_ms:       state.hesitations.length > 0 
                ? +(mean(state.hesitations.map(function(h) { return h.duration_ms; })).toFixed(0)) 
                : null,
            first_action_latency_ms:  firstLatency,
            
            _raw_rt: {
                count: rts.length,
                all_rts: rts.map(function(r) { return Math.round(r); })
            }
        };
    },
    
    stop: function() {
        state.active = false;
        if (state.observer) { state.observer.disconnect(); state.observer = null; }
        document.removeEventListener('click', onAction, { capture: true });
        document.removeEventListener('touchstart', onAction, { capture: true });
    }
};

if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('rt', agent);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('rt', agent);
    });
}

})();
