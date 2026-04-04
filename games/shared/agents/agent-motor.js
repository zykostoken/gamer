// ================================================================
// agent-motor.js — PIRATE AGENT: Captura motora (jitter, velocidad, trayectoria)
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Arquitectura Web Worker (Pilar 2 del Blueprint de Escalabilidad):
//   HILO PRINCIPAL: captura eventos DOM, acumula datos raw. Cero cómputo.
//   WEB WORKER:     todo el cómputo matemático (mean, sd, jitter, CV, oscilaciones).
//   BENEFICIO:      los timestamps de mousemove no se contaminan con cómputo
//                   de JSON pesado, hash chains o render del juego.
//
// Métricas que produce (nombres canónicos del METRIC_DICTIONARY):
//   jitter_reposo_px, jitter_inicio_px, jitter_terminal_px
//   precision_deposito_px
//   vel_peak_mean, vel_peak_sd, vel_cv
//   vel_uniformidad_index, vel_oscilacion_index
//   vel_caida_brusca_ratio, vel_perfil_abrupto
// ================================================================

(function() {
'use strict';

var SAMPLE_MS = 16;
var REPOSO_MIN_MS = 500;

// ----------------------------------------------------------------
// WEB WORKER — lógica matemática completa como blob inline
// El worker no toca el DOM. Recibe datos, devuelve métricas.
// ----------------------------------------------------------------
var WORKER_CODE = [
'function mean(a){if(!a||!a.length)return 0;var s=0;for(var i=0;i<a.length;i++)s+=a[i];return s/a.length;}',
'function sd(a){if(!a||a.length<2)return 0;var m=mean(a),s=0;for(var i=0;i<a.length;i++)s+=Math.pow(a[i]-m,2);return Math.sqrt(s/(a.length-1));}',
'self.onmessage=function(e){',
'  var d=e.data;',
'  var velMean=mean(d.velocities);',
'  var velSd=sd(d.velocities);',
'  var velCv=velMean>0?velSd/velMean:0;',
'  // Velocity oscillations (cogwheel proxy)',
'  var oscCount=0;',
'  var v=d.velocities;',
'  for(var i=2;i<v.length;i++){',
'    if((v[i]-v[i-1])*(v[i-1]-v[i-2])<0&&Math.abs(v[i]-v[i-1])>0.05) oscCount++;',
'  }',
'  var cogwheel=v.length>0?Math.min(1,oscCount/(v.length/10)):0;',
'  // Clasp-knife (acceleration drop ratio)',
'  var claspKnife=1;',
'  if(d.accel_drops.length>0){',
'    var meanDrop=mean(d.accel_drops);',
'    var meanAccel=mean(d.accelerations.map(function(a){return Math.abs(a);}));',
'    claspKnife=meanAccel>0?meanDrop/meanAccel:1;',
'  }',
'  self.postMessage({',
'    jitter_reposo_px:+mean(d.reposo_jitters).toFixed(2),',
'    jitter_inicio_px:+mean(d.inicio_jitters).toFixed(2),',
'    jitter_terminal_px:+mean(d.terminal_jitters).toFixed(2),',
'    precision_deposito_px:+mean(d.click_distances).toFixed(2),',
'    vel_peak_mean:+velMean.toFixed(4),',
'    vel_peak_sd:+velSd.toFixed(4),',
'    vel_cv:+velCv.toFixed(3),',
'    vel_uniformidad_index:+Math.max(0,1-velCv).toFixed(3),',
'    vel_oscilacion_index:+cogwheel.toFixed(3),',
'    vel_caida_brusca_ratio:+claspKnife.toFixed(3),',
'    vel_perfil_abrupto:+Math.min(1,Math.max(0,(claspKnife-1)/4)).toFixed(3),',
'    _raw_tremor_samples:{reposo:d.reposo_jitters.length,inicio:d.inicio_jitters.length,terminal:d.terminal_jitters.length}',
'  });',
'};'
].join('\n');

var _worker = null;
var _pendingResolve = null;
var _workerReady = false;

function getWorker() {
    if (_worker && _workerReady) return _worker;
    try {
        var blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        var url = URL.createObjectURL(blob);
        _worker = new Worker(url);
        URL.revokeObjectURL(url);
        _worker.onmessage = function(e) {
            if (_pendingResolve) {
                _pendingResolve(e.data);
                _pendingResolve = null;
            }
        };
        _worker.onerror = function(err) {
            console.warn('[agent-motor] Worker error:', err.message, '— fallback a hilo principal');
            _worker = null;
            _workerReady = false;
        };
        _workerReady = true;
    } catch(e) {
        console.warn('[agent-motor] Web Workers no disponibles — usando hilo principal');
        _worker = null;
    }
    return _worker;
}

// ----------------------------------------------------------------
// ESTADO — solo datos raw, cero cómputo en el hilo principal
// ----------------------------------------------------------------
var state = {
    active: false,
    lastSample: null,
    lastMoveTime: 0,
    phase: 'reposo',
    phaseStart: 0,

    // Acumuladores raw (no computados en hilo principal)
    reposo_jitters: [],
    inicio_jitters: [],
    terminal_jitters: [],
    velocities: [],
    accelerations: [],
    accel_drops: [],
    click_distances: [],
    moveStartSamples: [],
    preClickSamples: []
};

// Fallback síncrono si Web Workers no están disponibles
function computeFallback(data) {
    function mean(a){if(!a||!a.length)return 0;var s=0;for(var i=0;i<a.length;i++)s+=a[i];return s/a.length;}
    function sd(a){if(!a||a.length<2)return 0;var m=mean(a),s=0;for(var i=0;i<a.length;i++)s+=Math.pow(a[i]-m,2);return Math.sqrt(s/(a.length-1));}
    var velMean=mean(data.velocities), velSd=sd(data.velocities), velCv=velMean>0?velSd/velMean:0;
    var oscCount=0, v=data.velocities;
    for(var i=2;i<v.length;i++) if((v[i]-v[i-1])*(v[i-1]-v[i-2])<0&&Math.abs(v[i]-v[i-1])>0.05) oscCount++;
    var cogwheel=v.length>0?Math.min(1,oscCount/(v.length/10)):0;
    var claspKnife=1;
    if(data.accel_drops.length>0){
        var md=mean(data.accel_drops), ma=mean(data.accelerations.map(function(a){return Math.abs(a);}));
        claspKnife=ma>0?md/ma:1;
    }
    return {
        jitter_reposo_px:+mean(data.reposo_jitters).toFixed(2),
        jitter_inicio_px:+mean(data.inicio_jitters).toFixed(2),
        jitter_terminal_px:+mean(data.terminal_jitters).toFixed(2),
        precision_deposito_px:+mean(data.click_distances).toFixed(2),
        vel_peak_mean:+velMean.toFixed(4), vel_peak_sd:+velSd.toFixed(4), vel_cv:+velCv.toFixed(3),
        vel_uniformidad_index:+Math.max(0,1-velCv).toFixed(3),
        vel_oscilacion_index:+cogwheel.toFixed(3),
        vel_caida_brusca_ratio:+claspKnife.toFixed(3),
        vel_perfil_abrupto:+Math.min(1,Math.max(0,(claspKnife-1)/4)).toFixed(3),
        _raw_tremor_samples:{reposo:data.reposo_jitters.length,inicio:data.inicio_jitters.length,terminal:data.terminal_jitters.length}
    };
}

// ----------------------------------------------------------------
// CAPTURA DE EVENTOS — hilo principal, solo timestamps y posición
// ----------------------------------------------------------------
function onMove(e) {
    if (!state.active) return;
    var now = performance.now();
    var x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    var y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    if (!state.lastSample) { state.lastSample = {x:x,y:y,t:now}; return; }

    var dt = now - state.lastSample.t;
    if (dt < SAMPLE_MS * 0.5) return;

    var dx = x - state.lastSample.x;
    var dy = y - state.lastSample.y;
    var dist = Math.sqrt(dx*dx + dy*dy);  // sqrt es barato, queda en hilo principal
    var speed = dt > 0 ? dist / dt : 0;
    var prevSpeed = state.velocities.length > 0 ? state.velocities[state.velocities.length-1] : 0;
    var accel = dt > 0 ? (speed - prevSpeed) / dt : 0;

    state.velocities.push(speed);
    state.accelerations.push(accel);
    if (accel < -0.01 && prevSpeed > 0.1) state.accel_drops.push(Math.abs(accel));

    var timeSinceMove = now - state.lastMoveTime;
    if (dist > 2) {
        if (state.phase === 'reposo' && timeSinceMove > REPOSO_MIN_MS) {
            state.phase = 'movimiento';
            state.phaseStart = now;
            state.moveStartSamples = [];
        }
        state.lastMoveTime = now;
        if (state.phase === 'movimiento' && (now - state.phaseStart) < 150) {
            state.moveStartSamples.push(dist);
        }
        state.preClickSamples.push({dist:dist, t:now});
        if (state.preClickSamples.length > 20) state.preClickSamples.shift();
    } else {
        if (state.phase === 'movimiento') { state.phase = 'reposo'; state.phaseStart = now; }
        if (timeSinceMove > REPOSO_MIN_MS && dist > 0.1) state.reposo_jitters.push(dist);
    }

    state.lastSample = {x:x, y:y, t:now};

    if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw && state.velocities.length % 5 === 0) {
        ZYKOS._pushRaw('move', {x:Math.round(x), y:Math.round(y), s:+(speed.toFixed(3)), a:+(accel.toFixed(4))});
    }
}

function onClick(e) {
    if (!state.active) return;
    var x = e.clientX, y = e.clientY;

    if (state.preClickSamples.length >= 3) {
        var last5 = state.preClickSamples.slice(-5);
        var tj = 0;
        for (var i=1; i<last5.length; i++) tj += last5[i].dist;
        if (last5.length > 1) state.terminal_jitters.push(tj/(last5.length-1));
    }
    if (state.moveStartSamples.length >= 2) {
        var si = 0;
        for (var j=0; j<state.moveStartSamples.length; j++) si += state.moveStartSamples[j];
        state.inicio_jitters.push(si/state.moveStartSamples.length);
    }
    state.moveStartSamples = [];

    var target = document.elementFromPoint(x, y);
    if (target) {
        var r = target.getBoundingClientRect();
        var cx = r.left + r.width/2, cy = r.top + r.height/2;
        state.click_distances.push(Math.sqrt(Math.pow(x-cx,2) + Math.pow(y-cy,2)));
    }

    if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw) {
        ZYKOS._pushRaw('click', {x:Math.round(x), y:Math.round(y)});
    }
}

// ----------------------------------------------------------------
// AGENT INTERFACE
// ----------------------------------------------------------------
var agent = {
    start: function() {
        state.active = true;
        state.lastSample = null; state.lastMoveTime = 0;
        state.phase = 'reposo'; state.phaseStart = 0;
        state.reposo_jitters = []; state.inicio_jitters = [];
        state.terminal_jitters = []; state.velocities = [];
        state.accelerations = []; state.accel_drops = [];
        state.click_distances = []; state.preClickSamples = [];
        state.moveStartSamples = [];
        // Pre-inicializar el worker para que esté listo cuando se necesite
        getWorker();
        document.addEventListener('mousemove', onMove, {passive:true});
        document.addEventListener('touchmove', onMove, {passive:true});
        document.addEventListener('click', onClick, {passive:true});
        document.addEventListener('touchstart', onClick, {passive:true});
    },

    collect: function() {
        // Retorna una Promise — el cómputo ocurre en el worker
        var data = {
            reposo_jitters:   state.reposo_jitters.slice(),
            inicio_jitters:   state.inicio_jitters.slice(),
            terminal_jitters: state.terminal_jitters.slice(),
            velocities:       state.velocities.slice(),
            accelerations:    state.accelerations.slice(),
            accel_drops:      state.accel_drops.slice(),
            click_distances:  state.click_distances.slice()
        };
        var w = getWorker();
        if (!w) return Promise.resolve(computeFallback(data));
        return new Promise(function(resolve) {
            _pendingResolve = resolve;
            w.postMessage(data);
        });
    },

    stop: function() {
        state.active = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('click', onClick);
        document.removeEventListener('touchstart', onClick);
        if (_worker) { _worker.terminate(); _worker = null; _workerReady = false; }
    }
};

if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('motor', agent);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('motor', agent);
    });
}

})();

// Señal al engine: este agente está listo
if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
