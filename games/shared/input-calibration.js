// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
// ================================================================
// input-calibration.js — Calibracion de hardware pre-sesion
// ZYKOS GAMER
//
// Proposito: medir las caracteristicas del dispositivo de input
// (mouse, trackpad, touch) y generar un perfil de hardware que
// se resta de las metricas clinicas para aislar la senal del
// paciente del ruido del dispositivo.
//
// Analogia: como la calibracion de 9 puntos de un eye-tracker.
//
// Flujo:
//   1. Se muestra pantalla de calibracion (8 targets)
//   2. Paciente clickea/toca cada target lo mas rapido y preciso
//   3. Se extrae: jitter basal, latencia, offset sistematico,
//      velocidad de cursor, precision de posicionamiento
//   4. Se guarda en localStorage + Supabase como hardware_profile
//   5. biomet.js y pill-organizer restan estos valores basales
//
// Duracion: ~25-35 segundos
// Frecuencia: 1 vez por sesion (se invalida si cambia dispositivo)
// ================================================================

(function(global) {
'use strict';

var CALIB = {
    active: false,
    targets: [],
    currentTargetIndex: 0,
    results: [],
    stationaryBuffer: [],
    stationaryStart: null,
    idleJitterSamples: [],
    moveProfiles: [],
    startTime: null,
    lastMousePos: null,
    sampleInterval: null,
    onComplete: null,
    containerEl: null,
    inputDevice: 'unknown'
};

// 8 targets en posiciones distribuidas (porcentaje del viewport)
var TARGET_POSITIONS = [
    { xPct: 25, yPct: 25 },   // top-left
    { xPct: 75, yPct: 25 },   // top-right
    { xPct: 50, yPct: 50 },   // center
    { xPct: 25, yPct: 75 },   // bottom-left
    { xPct: 75, yPct: 75 },   // bottom-right
    { xPct: 50, yPct: 25 },   // top-center
    { xPct: 50, yPct: 75 },   // bottom-center
    { xPct: 12, yPct: 50 }    // left-center
];

var TARGET_RADIUS = 22; // px

// ================================================================
// HELPERS
// ================================================================
function mean(a) { return a.length ? a.reduce(function(s,v){return s+v},0) / a.length : 0; }
function sd(a) {
    if (a.length < 2) return 0;
    var m = mean(a);
    return Math.sqrt(a.reduce(function(s,v){return s + Math.pow(v-m,2)},0) / (a.length-1));
}
function dist(a, b) { return Math.sqrt(Math.pow(a.x-b.x,2) + Math.pow(a.y-b.y,2)); }
function percentile(arr, p) {
    var s = arr.slice().sort(function(a,b){return a-b});
    var i = Math.floor(s.length * p);
    return s[Math.min(i, s.length-1)];
}

// ================================================================
// UI
// ================================================================
function createUI(container) {
    var el = document.createElement('div');
    el.id = 'input-calibration-overlay';
    el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;' +
        'background:rgba(10,15,30,0.95);display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;font-family:system-ui,sans-serif;color:#e2e8f0;';

    el.innerHTML =
        '<div id="calib-instructions" style="text-align:center;max-width:420px;padding:2rem;">' +
            '<div style="font-size:1.5rem;font-weight:700;margin-bottom:1rem;color:#60a5fa;">Calibracion del dispositivo</div>' +
            '<p style="font-size:.95rem;line-height:1.6;color:rgba(255,255,255,.7);margin-bottom:1.5rem;">' +
                'Para obtener mediciones precisas, necesitamos calibrar tu mouse/trackpad/pantalla tactil.<br><br>' +
                'Aparecera un circulo azul. Hacele click o tocalo lo mas rapido y preciso posible.<br>' +
                'Son 8 circulos, tarda menos de 30 segundos.' +
            '</p>' +
            '<button id="calib-start-btn" style="padding:.8rem 2rem;font-size:1rem;font-weight:600;' +
                'background:#3b82f6;color:#fff;border:none;border-radius:10px;cursor:pointer;' +
                'transition:transform .1s;box-shadow:0 4px 15px rgba(59,130,246,.4);">' +
                'Comenzar calibracion</button>' +
        '</div>' +
        '<div id="calib-area" style="display:none;position:relative;width:100%;height:100%;">' +
            '<div id="calib-progress" style="position:absolute;top:16px;left:50%;transform:translateX(-50%);' +
                'font-size:.85rem;color:rgba(255,255,255,.5);"></div>' +
            '<div id="calib-target" style="display:none;position:absolute;width:' + (TARGET_RADIUS*2) + 'px;' +
                'height:' + (TARGET_RADIUS*2) + 'px;border-radius:50%;background:radial-gradient(circle,#60a5fa,#3b82f6);' +
                'box-shadow:0 0 20px rgba(59,130,246,.6),0 0 40px rgba(59,130,246,.3);cursor:pointer;' +
                'transition:opacity .15s;"></div>' +
            '<div id="calib-idle-prompt" style="display:none;position:absolute;top:50%;left:50%;' +
                'transform:translate(-50%,-50%);font-size:1rem;color:rgba(255,255,255,.5);text-align:center;">' +
                'No muevas el cursor/dedo por 3 segundos...</div>' +
        '</div>' +
        '<div id="calib-done" style="display:none;text-align:center;padding:2rem;">' +
            '<div style="font-size:1.3rem;font-weight:700;color:#34d399;margin-bottom:.5rem;">Calibracion completada</div>' +
            '<div id="calib-summary" style="font-size:.8rem;color:rgba(255,255,255,.5);"></div>' +
        '</div>';

    (container || document.body).appendChild(el);
    CALIB.containerEl = el;

    document.getElementById('calib-start-btn').addEventListener('click', function() {
        document.getElementById('calib-instructions').style.display = 'none';
        startIdlePhase();
    });

    return el;
}

// ================================================================
// PHASE 1: IDLE JITTER (3 seconds, cursor still)
// ================================================================
function startIdlePhase() {
    var area = document.getElementById('calib-area');
    area.style.display = 'block';
    var prompt = document.getElementById('calib-idle-prompt');
    prompt.style.display = 'block';

    CALIB.idleJitterSamples = [];
    CALIB.stationaryBuffer = [];
    var idleStart = Date.now();
    var idleDuration = 3000;

    function onIdleMove(e) {
        var x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        var y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        CALIB.stationaryBuffer.push({ x: x, y: y, t: Date.now() });
        CALIB.inputDevice = e.touches ? 'touch' : 'mouse';
    }

    document.addEventListener('mousemove', onIdleMove);
    document.addEventListener('touchmove', onIdleMove);

    setTimeout(function() {
        document.removeEventListener('mousemove', onIdleMove);
        document.removeEventListener('touchmove', onIdleMove);
        prompt.style.display = 'none';

        // Calcular jitter basal del idle
        if (CALIB.stationaryBuffer.length >= 5) {
            var xs = CALIB.stationaryBuffer.map(function(p){return p.x});
            var ys = CALIB.stationaryBuffer.map(function(p){return p.y});
            CALIB.idleJitterSamples.push({
                jitter_x: sd(xs),
                jitter_y: sd(ys),
                jitter_combined: (sd(xs) + sd(ys)) / 2,
                n_samples: CALIB.stationaryBuffer.length,
                duration_ms: Date.now() - idleStart
            });
        }

        startTargetPhase();
    }, idleDuration);
}

// ================================================================
// PHASE 2: TARGET ACQUISITION (8 targets)
// ================================================================
function startTargetPhase() {
    CALIB.currentTargetIndex = 0;
    CALIB.results = [];
    CALIB.moveProfiles = [];
    CALIB.startTime = Date.now();
    showNextTarget();
}

function showNextTarget() {
    if (CALIB.currentTargetIndex >= TARGET_POSITIONS.length) {
        finishCalibration();
        return;
    }

    var pos = TARGET_POSITIONS[CALIB.currentTargetIndex];
    var area = document.getElementById('calib-area');
    var areaRect = area.getBoundingClientRect();
    var targetEl = document.getElementById('calib-target');
    var progressEl = document.getElementById('calib-progress');

    var targetX = (pos.xPct / 100) * areaRect.width;
    var targetY = (pos.yPct / 100) * areaRect.height;

    targetEl.style.left = (targetX - TARGET_RADIUS) + 'px';
    targetEl.style.top = (targetY - TARGET_RADIUS) + 'px';
    targetEl.style.display = 'block';
    targetEl.style.opacity = '1';
    progressEl.textContent = (CALIB.currentTargetIndex + 1) + ' / ' + TARGET_POSITIONS.length;

    // Track movement to this target
    var moveData = {
        targetX: targetX + areaRect.left,
        targetY: targetY + areaRect.top,
        targetIndex: CALIB.currentTargetIndex,
        t_shown: Date.now(),
        path: [],
        t_click: null,
        clickX: null,
        clickY: null
    };

    function onMove(e) {
        var x = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        var y = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        moveData.path.push({ x: x, y: y, t: Date.now() });
    }

    function onClick(e) {
        var x = e.clientX || (e.changedTouches ? e.changedTouches[0].clientX : 0);
        var y = e.clientY || (e.changedTouches ? e.changedTouches[0].clientY : 0);

        var distToCenter = Math.sqrt(
            Math.pow(x - moveData.targetX, 2) +
            Math.pow(y - moveData.targetY, 2)
        );

        // Accept click within 2x target radius (generous for calibration)
        if (distToCenter > TARGET_RADIUS * 3) return;

        e.preventDefault();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('click', onClick);
        document.removeEventListener('touchend', onClick);

        moveData.t_click = Date.now();
        moveData.clickX = x;
        moveData.clickY = y;

        // Calculate metrics for this target
        var rt = moveData.t_click - moveData.t_shown;
        var offsetX = x - moveData.targetX;
        var offsetY = y - moveData.targetY;
        var offsetPx = distToCenter;
        var pathLength = 0;
        for (var i = 1; i < moveData.path.length; i++) {
            pathLength += dist(moveData.path[i-1], moveData.path[i]);
        }
        var directDist = moveData.path.length > 0
            ? dist(moveData.path[0], { x: x, y: y }) : 0;
        var pathEfficiency = pathLength > 0 ? directDist / pathLength : 1;

        // Jitter during approach (last 80px)
        var approachPts = [];
        for (var j = moveData.path.length - 1; j >= 0; j--) {
            if (dist(moveData.path[j], { x: moveData.targetX, y: moveData.targetY }) <= 80) {
                approachPts.push(moveData.path[j]);
            } else if (approachPts.length > 0) break;
        }
        var approachJitter = 0;
        if (approachPts.length >= 3) {
            var axs = approachPts.map(function(p){return p.x});
            var ays = approachPts.map(function(p){return p.y});
            approachJitter = (sd(axs) + sd(ays)) / 2;
        }

        CALIB.results.push({
            targetIndex: CALIB.currentTargetIndex,
            rt_ms: rt,
            offset_px: parseFloat(offsetPx.toFixed(1)),
            offset_x: parseFloat(offsetX.toFixed(1)),
            offset_y: parseFloat(offsetY.toFixed(1)),
            path_length: Math.round(pathLength),
            direct_distance: Math.round(directDist),
            path_efficiency: parseFloat(pathEfficiency.toFixed(3)),
            approach_jitter: parseFloat(approachJitter.toFixed(2)),
            n_path_points: moveData.path.length
        });

        CALIB.moveProfiles.push(moveData);

        // Flash target green
        targetEl.style.background = 'radial-gradient(circle, #34d399, #059669)';
        targetEl.style.boxShadow = '0 0 20px rgba(52,211,153,.6)';

        setTimeout(function() {
            targetEl.style.display = 'none';
            targetEl.style.background = 'radial-gradient(circle, #60a5fa, #3b82f6)';
            targetEl.style.boxShadow = '0 0 20px rgba(59,130,246,.6),0 0 40px rgba(59,130,246,.3)';
            CALIB.currentTargetIndex++;
            // Brief pause between targets
            setTimeout(showNextTarget, 300);
        }, 200);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('click', onClick);
    document.addEventListener('touchend', onClick);
}

// ================================================================
// FINALIZATION: compute hardware profile
// ================================================================
function finishCalibration() {
    var totalTime = Date.now() - CALIB.startTime;

    var rts = CALIB.results.map(function(r){return r.rt_ms});
    var offsets = CALIB.results.map(function(r){return r.offset_px});
    var offsetsX = CALIB.results.map(function(r){return r.offset_x});
    var offsetsY = CALIB.results.map(function(r){return r.offset_y});
    var efficiencies = CALIB.results.map(function(r){return r.path_efficiency});
    var jitters = CALIB.results.map(function(r){return r.approach_jitter});

    var idleJitter = CALIB.idleJitterSamples.length > 0
        ? CALIB.idleJitterSamples[0].jitter_combined : 0;

    var profile = {
        // Metadata
        timestamp: new Date().toISOString(),
        input_device: CALIB.inputDevice,
        total_duration_ms: totalTime,
        n_targets: CALIB.results.length,
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
        pixel_ratio: window.devicePixelRatio || 1,
        user_agent: navigator.userAgent,

        // Idle jitter (tremor basal del hardware)
        idle_jitter_px: parseFloat(idleJitter.toFixed(2)),
        idle_jitter_x: CALIB.idleJitterSamples.length > 0
            ? parseFloat(CALIB.idleJitterSamples[0].jitter_x.toFixed(2)) : 0,
        idle_jitter_y: CALIB.idleJitterSamples.length > 0
            ? parseFloat(CALIB.idleJitterSamples[0].jitter_y.toFixed(2)) : 0,

        // Reaction time baseline
        rt_mean_ms: Math.round(mean(rts)),
        rt_sd_ms: Math.round(sd(rts)),
        rt_min_ms: Math.min.apply(null, rts),
        rt_p10_ms: Math.round(percentile(rts, 0.10)),
        rt_p90_ms: Math.round(percentile(rts, 0.90)),

        // Positioning precision (offset sistematico)
        offset_mean_px: parseFloat(mean(offsets).toFixed(1)),
        offset_sd_px: parseFloat(sd(offsets).toFixed(1)),
        offset_bias_x: parseFloat(mean(offsetsX).toFixed(1)),
        offset_bias_y: parseFloat(mean(offsetsY).toFixed(1)),

        // Path efficiency baseline
        path_efficiency_mean: parseFloat(mean(efficiencies).toFixed(3)),
        path_efficiency_sd: parseFloat(sd(efficiencies).toFixed(3)),

        // Approach jitter (tremor terminal basal del hardware)
        approach_jitter_mean: parseFloat(mean(jitters).toFixed(2)),
        approach_jitter_sd: parseFloat(sd(jitters).toFixed(2)),

        // Raw per-target results
        targets: CALIB.results
    };

    // Store in localStorage for current session
    try {
        localStorage.setItem('zykos_hw_profile', JSON.stringify(profile));
        localStorage.setItem('zykos_hw_profile_ts', profile.timestamp);
    } catch(e) {}

    // Show summary
    var area = document.getElementById('calib-area');
    if (area) area.style.display = 'none';
    var done = document.getElementById('calib-done');
    if (done) {
        done.style.display = 'block';
        var summary = document.getElementById('calib-summary');
        if (summary) {
            summary.innerHTML =
                'Dispositivo: ' + profile.input_device +
                ' | Jitter basal: ' + profile.idle_jitter_px + 'px' +
                ' | RT medio: ' + profile.rt_mean_ms + 'ms' +
                ' | Offset medio: ' + profile.offset_mean_px + 'px' +
                ' | Eficiencia: ' + (profile.path_efficiency_mean * 100).toFixed(0) + '%';
        }
    }

    // Save to Supabase if available
    var client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
    var dni = profile._patientDni || null;
    if (client && dni) {
        (async function() {
            try {
                var r = await client.from('zykos_game_metrics').insert({
                    patient_dni: dni,
                    game_slug: 'calibration',
                    metric_type: 'hardware_profile',
                    metric_value: profile.idle_jitter_px,
                    metric_data: profile
                });
                if (r.error) console.warn('[calibration] save:', r.error.message);
            } catch(e) { console.warn('[calibration] save:', e.message); }
        })();
    }

    // Auto-dismiss after 2 seconds
    setTimeout(function() {
        if (CALIB.containerEl) {
            CALIB.containerEl.remove();
            CALIB.containerEl = null;
        }
        if (typeof CALIB.onComplete === 'function') {
            CALIB.onComplete(profile);
        }
    }, 2000);

    return profile;
}

// ================================================================
// PUBLIC API
// ================================================================

/**
 * Run calibration. Returns a Promise that resolves with the hardware profile.
 * @param {Object} opts
 * @param {string} opts.patientDni - DNI del paciente
 * @param {HTMLElement} opts.container - Container element (default: document.body)
 * @param {boolean} opts.force - Force recalibration even if recent profile exists
 * @param {number} opts.maxAgeMs - Max age of cached profile (default: 4 hours)
 * @returns {Promise<Object>} hardware_profile
 */
function run(opts) {
    opts = opts || {};
    var maxAge = opts.maxAgeMs || (4 * 60 * 60 * 1000); // 4 hours default

    // Check if we have a recent calibration
    if (!opts.force) {
        try {
            var cached = localStorage.getItem('zykos_hw_profile');
            var cachedTs = localStorage.getItem('zykos_hw_profile_ts');
            if (cached && cachedTs) {
                var age = Date.now() - new Date(cachedTs).getTime();
                if (age < maxAge) {
                    var profile = JSON.parse(cached);
                    return Promise.resolve(profile);
                }
            }
        } catch(e) {}
    }

    return new Promise(function(resolve) {
        CALIB.onComplete = resolve;
        CALIB.active = true;
        if (opts.patientDni) {
            // Store for Supabase save
            var tempProfile = { _patientDni: opts.patientDni };
            Object.keys(tempProfile).forEach(function(k) {
                CALIB[k] = tempProfile[k];
            });
        }
        createUI(opts.container || null);
    });
}

/**
 * Get cached hardware profile (no UI, returns null if not available)
 * @returns {Object|null}
 */
function getProfile() {
    try {
        var cached = localStorage.getItem('zykos_hw_profile');
        return cached ? JSON.parse(cached) : null;
    } catch(e) { return null; }
}

/**
 * Adjust a raw metric value using hardware baseline
 * @param {string} metricType - 'tremor', 'rt', 'offset', 'efficiency'
 * @param {number} rawValue - The raw value from the game
 * @param {Object} [hwProfile] - Hardware profile (default: from localStorage)
 * @returns {Object} { adjusted, raw, baseline, adjustment_pct }
 */
function adjust(metricType, rawValue, hwProfile) {
    var hw = hwProfile || getProfile();
    if (!hw || rawValue == null) return { adjusted: rawValue, raw: rawValue, baseline: 0, adjustment_pct: 0 };

    var baseline, adjusted, desc;

    switch (metricType) {
        case 'jitter':
        case 'jitter_reposo':
        case 'jitter_inicio':
        case 'jitter_terminal':
        // Legacy aliases for backward compatibility
        case 'tremor':
        case 'tremor_reposo':
        case 'tremor_inicio':
        case 'tremor_terminal':
            // Subtract idle hardware jitter from jitter measurement
            baseline = hw.idle_jitter_px || 0;
            adjusted = Math.max(0, rawValue - baseline);
            desc = 'Jitter basal hardware restado';
            break;

        case 'approach_jitter':
            // Subtract approach jitter baseline
            baseline = hw.approach_jitter_mean || 0;
            adjusted = Math.max(0, rawValue - baseline);
            desc = 'Jitter de aproximacion basal restado';
            break;

        case 'rt':
        case 'rt_ms':
        case 'mean_rt_ms':
        case 'reaction_time_ms':
            // Subtract hardware latency (p10 of calibration RT = pure hardware lag)
            baseline = hw.rt_p10_ms || 0;
            adjusted = Math.max(50, rawValue - baseline);
            desc = 'Latencia hardware (p10) restada';
            break;

        case 'offset':
        case 'drop_offset':
        case 'dismetria':
            // Subtract systematic offset bias
            baseline = hw.offset_mean_px || 0;
            adjusted = Math.max(0, rawValue - baseline);
            desc = 'Offset sistematico restado';
            break;

        case 'efficiency':
        case 'path_efficiency':
            // Adjust by baseline efficiency (hardware path overhead)
            baseline = hw.path_efficiency_mean || 1;
            // If hardware baseline is 0.85, and patient got 0.7,
            // adjusted = 0.7 / 0.85 = 0.82 (patient's real efficiency)
            adjusted = baseline > 0 ? Math.min(1, rawValue / baseline) : rawValue;
            desc = 'Eficiencia normalizada por baseline hardware';
            break;

        default:
            return { adjusted: rawValue, raw: rawValue, baseline: 0, adjustment_pct: 0 };
    }

    var adjustment_pct = rawValue > 0 ? Math.round(((rawValue - adjusted) / rawValue) * 100) : 0;

    return {
        adjusted: typeof adjusted === 'number' ? parseFloat(adjusted.toFixed(3)) : adjusted,
        raw: rawValue,
        baseline: parseFloat(baseline.toFixed(2)),
        adjustment_pct: adjustment_pct,
        desc: desc
    };
}

/**
 * Check if calibration is needed
 * @param {number} [maxAgeMs] - Max age in ms (default: 4 hours)
 * @returns {boolean}
 */
function needsCalibration(maxAgeMs) {
    var maxAge = maxAgeMs || (4 * 60 * 60 * 1000);
    try {
        var ts = localStorage.getItem('zykos_hw_profile_ts');
        if (!ts) return true;
        // Expirado por tiempo
        if ((Date.now() - new Date(ts).getTime()) > maxAge) return true;
        // Cambio de tipo de dispositivo (touch vs mouse)
        var profile = getProfile();
        if (!profile) return true;
        var currentIsMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        var profileIsMobile = profile.input_device === 'touch';
        if (currentIsMobile !== profileIsMobile) return true;
        return false;
    } catch(e) { return true; }
}

// ================================================================
// EXPORT
// ================================================================
global.InputCalibration = {
    run: run,
    getProfile: getProfile,
    adjust: adjust,
    needsCalibration: needsCalibration,
    isNeeded: needsCalibration,  // alias usado en pill-organizer y otros juegos
    // For testing
    _CALIB: CALIB
};

})(typeof window !== 'undefined' ? window : this);
