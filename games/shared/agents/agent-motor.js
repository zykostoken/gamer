// ================================================================
// agent-motor.js — PIRATE AGENT: Captura motora (jitter, velocidad, trayectoria)
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
// 
// Captura irregularidad motora, velocidad y precision desde mousemove/touchmove/click.
// No le pide nada al juego. Solo observa cómo se mueve el dedo/mouse.
//
// Métricas que produce (nombres canónicos del METRIC_DICTIONARY):
// - jitter_reposo_px, jitter_inicio_px, jitter_terminal_px
// - precision_deposito_px
// - vel_peak_mean, vel_peak_sd, vel_cv
// - vel_uniformidad_index, vel_oscilacion_index
// - vel_caida_brusca_ratio, vel_perfil_abrupto
// ================================================================

(function() {
'use strict';

var SAMPLE_MS = 16; // ~60fps
var HESITACION_THRESHOLD_MS = 200;
var REPOSO_MIN_MS = 500;
var TREMOR_WINDOW = 10; // samples for jitter calculation

var state = {
    active: false,
    samples: [],           // {x, y, t, vx, vy, speed, accel}
    lastSample: null,
    lastMoveTime: 0,
    
    // Tremor buckets
    reposo_jitters: [],    // jitter during stillness
    inicio_jitters: [],    // jitter in first 100ms of movement
    terminal_jitters: [],  // jitter in last 100ms before click
    
    // Velocity profile
    velocities: [],
    accelerations: [],
    velocity_oscillations: [],
    accel_drops: [],
    
    // Click precision
    click_distances: [],   // distance from click to nearest interactive element center
    
    // Movement phases
    phase: 'reposo',       // reposo | movimiento
    phaseStart: 0,
    moveStartSamples: [],
    preClickSamples: []
};

function onMove(e) {
    if (!state.active) return;
    var now = performance.now();
    var x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    var y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    if (!state.lastSample) {
        state.lastSample = { x:x, y:y, t:now };
        return;
    }
    
    var dt = now - state.lastSample.t;
    if (dt < SAMPLE_MS * 0.5) return; // Skip if too soon
    
    var dx = x - state.lastSample.x;
    var dy = y - state.lastSample.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    var speed = dt > 0 ? dist / dt : 0;
    
    var prevSpeed = state.samples.length > 0 ? state.samples[state.samples.length-1].speed : 0;
    var accel = dt > 0 ? (speed - prevSpeed) / dt : 0;
    
    var sample = { x:x, y:y, t:now, dx:dx, dy:dy, dist:dist, speed:speed, accel:accel };
    state.samples.push(sample);
    state.velocities.push(speed);
    state.accelerations.push(accel);
    
    // Phase detection
    var timeSinceLastMove = now - state.lastMoveTime;
    if (dist > 2) {
        // Moving
        if (state.phase === 'reposo' && timeSinceLastMove > REPOSO_MIN_MS) {
            // Transition: reposo → movimiento
            state.phase = 'movimiento';
            state.phaseStart = now;
            state.moveStartSamples = [];
        }
        state.lastMoveTime = now;
        
        // Collect inicio samples (first 150ms of movement)
        if (state.phase === 'movimiento' && (now - state.phaseStart) < 150) {
            state.moveStartSamples.push(sample);
        }
        
        // Pre-click buffer (last 20 samples before any click)
        state.preClickSamples.push(sample);
        if (state.preClickSamples.length > 20) state.preClickSamples.shift();
        
        // Velocity oscillations detection (cogwheel)
        if (state.velocities.length >= 3) {
            var v = state.velocities;
            var i = v.length - 1;
            if ((v[i] - v[i-1]) * (v[i-1] - v[i-2]) < 0 && Math.abs(v[i] - v[i-1]) > 0.05) {
                state.velocity_oscillations.push({ t: now, amplitude: Math.abs(v[i] - v[i-1]) });
            }
        }
        
        // Acceleration drops (clasp-knife)
        if (accel < -0.01 && prevSpeed > 0.1) {
            state.accel_drops.push({ t: now, drop: Math.abs(accel), prevSpeed: prevSpeed });
        }
        
    } else {
        // Stillness
        if (state.phase === 'movimiento') {
            state.phase = 'reposo';
            state.phaseStart = now;
        }
        
        // Reposo jitter (micro-movements during stillness)
        if (timeSinceLastMove > REPOSO_MIN_MS && dist > 0.1) {
            state.reposo_jitters.push(dist);
        }
    }
    
    state.lastSample = { x:x, y:y, t:now };
    
    // Push raw to engine
    if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw) {
        // Only push every 5th sample to avoid flooding
        if (state.samples.length % 5 === 0) {
            ZYKOS._pushRaw('move', { x:Math.round(x), y:Math.round(y), s:+(speed.toFixed(3)), a:+(accel.toFixed(4)) });
        }
    }
}

function onClick(e) {
    if (!state.active) return;
    var x = e.clientX;
    var y = e.clientY;
    
    // Terminal tremor: jitter in the pre-click samples
    if (state.preClickSamples.length >= 3) {
        var last5 = state.preClickSamples.slice(-5);
        var jitters = [];
        for (var i = 1; i < last5.length; i++) {
            jitters.push(last5[i].dist);
        }
        if (jitters.length > 0) {
            state.terminal_jitters.push(mean(jitters));
        }
    }
    
    // Inicio tremor from collected start samples
    if (state.moveStartSamples.length >= 2) {
        var startJitters = state.moveStartSamples.map(function(s) { return s.dist; });
        state.inicio_jitters.push(mean(startJitters));
    }
    state.moveStartSamples = [];
    
    // Click distance to nearest interactive element
    var target = document.elementFromPoint(x, y);
    if (target) {
        var rect = target.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var clickDist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        state.click_distances.push(clickDist);
    }
    
    if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw) {
        ZYKOS._pushRaw('click', { x:Math.round(x), y:Math.round(y) });
    }
}

function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce(function(a,b) { return a+b; }, 0) / arr.length;
}

function sd(arr) {
    if (!arr || arr.length < 2) return 0;
    var m = mean(arr);
    var sqDiffs = arr.map(function(v) { return Math.pow(v - m, 2); });
    return Math.sqrt(sqDiffs.reduce(function(a,b) { return a+b; }, 0) / (arr.length - 1));
}

// ================================================================
// AGENT INTERFACE (registered with zykos-engine.js)
// ================================================================
var agent = {
    start: function(meta) {
        state.active = true;
        state.samples = [];
        state.lastSample = null;
        state.reposo_jitters = [];
        state.inicio_jitters = [];
        state.terminal_jitters = [];
        state.velocities = [];
        state.accelerations = [];
        state.velocity_oscillations = [];
        state.accel_drops = [];
        state.click_distances = [];
        state.preClickSamples = [];
        state.moveStartSamples = [];
        state.phase = 'reposo';
        state.lastMoveTime = 0;
        
        document.addEventListener('mousemove', onMove, { passive: true });
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('click', onClick, { passive: true });
        document.addEventListener('touchstart', onClick, { passive: true });
    },
    
    collect: function() {
        // Compute canonical metrics from collected data
        var velMean = mean(state.velocities);
        var velSd = sd(state.velocities);
        var velCv = velMean > 0 ? velSd / velMean : 0;
        
        var cogwheel = 0;
        if (state.velocity_oscillations.length > 0 && state.samples.length > 0) {
            cogwheel = Math.min(1, state.velocity_oscillations.length / (state.samples.length / 10));
        }
        
        var claspKnife = 1;
        if (state.accel_drops.length > 0) {
            var meanDrop = mean(state.accel_drops.map(function(d) { return d.drop; }));
            var meanAccel = mean(state.accelerations.map(function(a) { return Math.abs(a); }));
            claspKnife = meanAccel > 0 ? meanDrop / meanAccel : 1;
        }
        
        // Return ONLY canonical metric names
        return {
            jitter_reposo_px:       +(mean(state.reposo_jitters).toFixed(2)),
            jitter_inicio_px:       +(mean(state.inicio_jitters).toFixed(2)),
            jitter_terminal_px:     +(mean(state.terminal_jitters).toFixed(2)),
            precision_deposito_px:      +(mean(state.click_distances).toFixed(2)),
            vel_peak_mean:          +(velMean.toFixed(4)),
            vel_peak_sd:            +(velSd.toFixed(4)),
            vel_cv:                 +(velCv.toFixed(3)),
            vel_uniformidad_index:          +(Math.max(0, 1 - velCv).toFixed(3)),
            vel_oscilacion_index:         +(cogwheel.toFixed(3)),
            vel_caida_brusca_ratio:      +(claspKnife.toFixed(3)),
            vel_perfil_abrupto:     +(Math.min(1, Math.max(0, (claspKnife - 1) / 4)).toFixed(3)),
            
            // Raw sub-data for deep analysis
            _raw_tremor_samples: {
                reposo: state.reposo_jitters.length,
                inicio: state.inicio_jitters.length,
                terminal: state.terminal_jitters.length
            }
        };
    },
    
    stop: function() {
        state.active = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('click', onClick);
        document.removeEventListener('touchstart', onClick);
    }
};

// Auto-register with engine
if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('motor', agent);
} else {
    // Engine not loaded yet, wait
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('motor', agent);
    });
}

})();

// Señal al engine: este agente está listo
if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}

