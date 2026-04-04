// ================================================================
// zykos-engine.js — CORE ENGINE
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
// ZYKOS GAMER · Metric Capture Platform
//
// ARCHITECTURE:
// This is the ONE AND ONLY script that writes to Supabase.
// Games NEVER write to the DB. Games are dumb HTML.
// Pirate agents observe DOM events and extract metrics.
// This core collects from all agents and persists.
//
// PRINCIPLES:
// 1. Metrics are the monarchy, games are servants
// 2. Each metric has ONE canonical name, ONE definition
// 3. Raw events are sacred (Capa 0) — never modified
// 4. Computed metrics (Capa 2) are always re-derivable from raw
// 5. No metric without a clinical construct
// 6. No construct without a validated measurement method
// ================================================================

(function(global) {
'use strict';

// ================================================================
// METRIC DICTIONARY — THE CANONICAL VOCABULARY
// Every metric that exists in ZYKOS is defined here.
// If it's not here, it doesn't exist.
// ================================================================
var METRIC_DICTIONARY = {

    // === TREMOR (Motor - Extrapiramidal) ===
    jitter_reposo_px:       { domain:'MOTOR', construct:'Jitter de reposo (micro-movimiento en quietud)', unit:'px', range:[0,50], desc:'Jitter basal con input quieto. Correlato: parkinsonismo, ansiedad basal.' },
    jitter_inicio_px:       { domain:'MOTOR', construct:'Jitter de inicio (irregularidad al iniciar movimiento)', unit:'px', range:[0,50], desc:'Jitter al iniciar movimiento hacia target.' },
    jitter_terminal_px:     { domain:'MOTOR', construct:'Jitter terminal (irregularidad al aproximar target)', unit:'px', range:[0,50], desc:'Jitter al llegar al target. Correlato: cerebeloso.' },
    precision_deposito_px:      { domain:'MOTOR', construct:'Precisión de depósito (error de punto final)', unit:'px', range:[0,200], desc:'Distancia media del click/touch al centro del target.' },

    // === VELOCIDAD MOTORA ===
    vel_peak_mean:          { domain:'MOTOR', construct:'Velocidad pico', unit:'px/ms', range:[0,5], desc:'Velocidad pico media del cursor durante movimientos.' },
    vel_peak_sd:            { domain:'MOTOR', construct:'Variabilidad velocidad pico', unit:'px/ms', range:[0,3], desc:'SD de velocidad pico.' },
    vel_cv:                 { domain:'MOTOR', construct:'Coeficiente variación velocidad', unit:'ratio', range:[0,2], desc:'CV de velocidad. Alto = irregular.' },
    vel_uniformidad_index:          { domain:'MOTOR', construct:'Uniformidad de velocidad (1 - CV velocidad)', unit:'index', range:[0,1], desc:'1 - vel_cv. Alto = movimiento rígido, uniforme.' },
    vel_oscilacion_index:         { domain:'MOTOR', construct:'Oscilación rítmica de velocidad', unit:'index', range:[0,1], desc:'Oscilaciones de velocidad durante movimiento. Correlato: extrapiramidal.' },
    vel_caida_brusca_ratio:      { domain:'MOTOR', construct:'Caídas bruscas de aceleración (ratio)', unit:'ratio', range:[0,10], desc:'Caídas bruscas de aceleración. Correlato: espasticidad.' },
    vel_perfil_abrupto:     { domain:'MOTOR', construct:'Perfil abrupto de velocidad (derivado de caídas)', unit:'index', range:[0,1], desc:'Derivado de clasp_knife. 0=normal, 1=espástico.' },

    // === TRAYECTORIA / PRAXIS ===
    eficiencia_trayectoria: { domain:'PRAXIS', construct:'Eficiencia de trayectoria', unit:'ratio', range:[0,1], desc:'Path recto / path real. 1=perfecto.' },
    rectificaciones_count:  { domain:'PRAXIS', construct:'Rectificaciones', unit:'count', range:[0,500], desc:'Cambios bruscos de dirección (>45°) durante arrastre.' },
    falsos_clicks:          { domain:'PRAXIS', construct:'Clicks erráticos', unit:'count', range:[0,200], desc:'Clicks fuera de elementos interactivos.' },

    // === ERRORES (Signal Detection) ===
    errores_omision:        { domain:'ATENCION', construct:'Errores de omisión', unit:'count', range:[0,100], desc:'No respondió cuando debía. Correlato: inatención.' },
    errores_comision:       { domain:'INHIBICION', construct:'Errores de comisión', unit:'count', range:[0,100], desc:'Respondió cuando no debía. Correlato: impulsividad.' },
    perseveracion_count:    { domain:'EJECUTIVO', construct:'Perseveración', unit:'count', range:[0,50], desc:'Repetición estereotipada. Correlato: rigidez cognitiva, frontal.' },

    // === SECUENCIA / PLANIFICACIÓN ===
    secuencia_correcta_pct: { domain:'EJECUTIVO', construct:'Secuenciación', unit:'pct', range:[0,100], desc:'% de acciones en orden correcto.' },
    eficacia_objetivo:      { domain:'EJECUTIVO', construct:'Eficacia de objetivo', unit:'ratio', range:[0,1], desc:'Objetivos completados / esperados.' },
    eficacia_plan_propio:   { domain:'EJECUTIVO', construct:'Economía de plan', unit:'ratio', range:[0,1], desc:'Acciones útiles / acciones totales.' },
    plan_failed_attempts:   { domain:'EJECUTIVO', construct:'Intentos fallidos', unit:'count', range:[0,50], desc:'Planes iniciados pero no completados.' },

    // === TIEMPO DE REACCIÓN / ATENCIÓN ===
    rt_mean_ms:             { domain:'ATENCION', construct:'Tiempo de reacción medio', unit:'ms', range:[100,5000], desc:'RT medio sobre todos los estímulos respondidos.' },
    rt_sd_ms:               { domain:'ATENCION', construct:'Variabilidad RT', unit:'ms', range:[0,2000], desc:'SD del RT. Alto = inconsistente.' },
    rt_cv:                  { domain:'ATENCION', construct:'Coeficiente variación RT', unit:'ratio', range:[0,2], desc:'CV del RT. Estándar: <0.25 bueno.' },
    decaimiento_mitades: { domain:'ATENCION', construct:'Decaimiento por mitades (RT 2da/1ra mitad)', unit:'ratio', range:[0.5,3], desc:'RT 2da mitad / RT 1ra mitad. >1 = fatiga.' },

    // === HESITACIÓN ===
    hesitaciones_count:     { domain:'EJECUTIVO', construct:'Hesitaciones', unit:'count', range:[0,200], desc:'Pausas >200ms durante acción motora activa.' },
    hesitacion_mean_ms:     { domain:'EJECUTIVO', construct:'Duración hesitación', unit:'ms', range:[0,5000], desc:'Duración media de cada hesitación.' },

    // === CONTROL EJECUTIVO ===
    impulsividad_ratio:     { domain:'INHIBICION', construct:'Impulsividad', unit:'ratio', range:[0,1], desc:'Ratio de acciones rápidas (<150ms) sin pausa previa.' },
    inhibicion_motor:       { domain:'INHIBICION', construct:'Inhibición motora', unit:'ratio', range:[0,1], desc:'Capacidad de frenar acción ya iniciada.' },
    economia_cognitiva:     { domain:'EJECUTIVO', construct:'Economía cognitiva', unit:'ratio', range:[0,1], desc:'Acciones mínimas necesarias / acciones reales. 1=óptimo.' },

    // === INSTRUCCIONES / COMPRENSIÓN ===
    instruction_time_ms:    { domain:'COMPRENSION', construct:'Tiempo de lectura', unit:'ms', range:[0,60000], desc:'Tiempo total leyendo instrucciones.' },
    instruction_scrollbacks:{ domain:'COMPRENSION', construct:'Re-lecturas', unit:'count', range:[0,50], desc:'Scrollbacks en pantalla de instrucciones.' },
    first_action_latency_ms:{ domain:'EJECUTIVO', construct:'Latencia de inicio', unit:'ms', range:[0,30000], desc:'Tiempo desde que aparece el juego hasta 1ra acción.' },

    // === META / SESIÓN ===
    session_duration_ms:    { domain:'META', construct:'Duración sesión', unit:'ms', range:[0,3600000], desc:'Duración total de la sesión de juego.' },
    total_clicks:           { domain:'META', construct:'Total clicks', unit:'count', range:[0,10000], desc:'Total de clicks/taps en la sesión.' },
    total_actions:          { domain:'META', construct:'Total acciones', unit:'count', range:[0,10000], desc:'Total de acciones significativas.' },

    // === HARDWARE CORRECTION ===
    hw_idle_jitter_px:      { domain:'HARDWARE', construct:'Jitter basal del dispositivo', unit:'px', range:[0,20], desc:'Ruido del input device en reposo.' },
    hw_latency_ms:          { domain:'HARDWARE', construct:'Latencia del dispositivo', unit:'ms', range:[0,100], desc:'Delay inherente del input device.' }
};

// Count
var _dictCount = Object.keys(METRIC_DICTIONARY).length;

// ================================================================
// EVENT BUS — Raw event stream (Capa 0)
// ================================================================
var _eventBuffer = [];
var _sessionId = null;
var _sessionStart = null;
var _agents = {};

var ZYKOS = {

    // --- Session management ---
    startSession: function(gameSlug, patientDni, patientId) {
        _sessionId = 'zs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        _sessionStart = performance.now();
        _eventBuffer = [];
        
        ZYKOS.meta = {
            game_slug: gameSlug,
            patient_dni: patientDni,
            patient_id: patientId,
            session_id: _sessionId,
            started_at: new Date().toISOString(),
            user_agent: navigator.userAgent,
            screen: { w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 }
        };

        // Activate all registered agents
        Object.keys(_agents).forEach(function(name) {
            try { _agents[name].start(ZYKOS.meta); } catch(e) { console.warn('[zykos-engine] Agent ' + name + ' start error:', e.message); }
        });

        ZYKOS._pushRaw('session_start', { game_slug: gameSlug });
        console.log('[zykos-engine] Session started: ' + _sessionId + ' | Agents: ' + Object.keys(_agents).join(', '));
    },

    endSession: function() {
        if (!_sessionId) return;
        var duration = performance.now() - _sessionStart;
        ZYKOS._pushRaw('session_end', { duration_ms: Math.round(duration) });

        // Collect from all agents
        var agentResults = {};
        Object.keys(_agents).forEach(function(name) {
            try { 
                agentResults[name] = _agents[name].collect(); 
                _agents[name].stop();
            } catch(e) { 
                console.warn('[zykos-engine] Agent ' + name + ' collect error:', e.message); 
            }
        });

        // Merge into unified metric record
        var metrics = ZYKOS._mergeAgentResults(agentResults, duration);

        // Persist to Supabase
        ZYKOS._persist(metrics);
        
        _sessionId = null;
        return metrics;
    },

    // --- Agent registration ---
    registerAgent: function(name, agent) {
        if (!agent.start || !agent.collect || !agent.stop) {
            console.error('[zykos-engine] Agent "' + name + '" must implement start(), collect(), stop()');
            return;
        }
        _agents[name] = agent;
    },

    // --- Raw event push (Capa 0) ---
    _pushRaw: function(type, data) {
        _eventBuffer.push({
            t: Math.round(performance.now() - (_sessionStart || 0)),
            type: type,
            data: data
        });
    },

    // --- Merge agent results into canonical metrics ---
    _mergeAgentResults: function(agentResults, duration) {
        var unified = {
            session_id: _sessionId,
            game_slug: ZYKOS.meta.game_slug,
            patient_dni: ZYKOS.meta.patient_dni,
            patient_id: ZYKOS.meta.patient_id,
            session_duration_ms: Math.round(duration),
            agents_active: Object.keys(agentResults),
            timestamp: new Date().toISOString()
        };

        // Each agent returns an object with ONLY canonical metric names
        Object.keys(agentResults).forEach(function(agentName) {
            var result = agentResults[agentName];
            if (!result) return;
            Object.keys(result).forEach(function(key) {
                if (METRIC_DICTIONARY[key]) {
                    // Validate range
                    var def = METRIC_DICTIONARY[key];
                    var val = result[key];
                    if (val !== null && val !== undefined) {
                        if (typeof val === 'number' && (val < def.range[0] * 0.5 || val > def.range[1] * 2)) {
                            // Out of expected range — flag but still record
                            unified['_flag_' + key] = 'out_of_range';
                        }
                        unified[key] = val;
                    }
                } else if (key.startsWith('_raw_')) {
                    // Raw sub-data allowed with _raw_ prefix
                    unified[key] = result[key];
                } else {
                    console.warn('[zykos-engine] Agent "' + agentName + '" returned unknown metric: ' + key);
                }
            });
        });

        return unified;
    },

    // --- Persist to Supabase (THE ONLY WRITER) ---
    _persist: async function(metrics) {
        try {
            var sb = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
            if (!sb) { console.warn('[zykos-engine] No Supabase client'); return; }
            
            // Evidence hash chain
            var payload = {
                patient_dni: metrics.patient_dni,
                user_id: metrics.patient_id,
                game_slug: metrics.game_slug,
                metric_type: 'session_biomet',
                metric_data: metrics,
                session_id: metrics.session_id,
                session_date: new Date().toISOString().slice(0, 10)
            };

            if (typeof ZykosEvidence !== 'undefined') {
                payload = await ZykosEvidence.prepare(payload);
            }

            var { error } = await sb.from('zykos_game_metrics').insert(payload);
            if (error) console.warn('[zykos-engine] Persist error:', error.message);
            else console.log('[zykos-engine] Metrics persisted: ' + Object.keys(metrics).length + ' fields');

            // Also persist raw event buffer (Capa 0)
            if (_eventBuffer.length > 0) {
                var rawPayload = {
                    patient_dni: metrics.patient_dni,
                    user_id: metrics.patient_id,
                    game_slug: metrics.game_slug,
                    metric_type: 'raw_events',
                    metric_data: { events: _eventBuffer, count: _eventBuffer.length },
                    session_id: metrics.session_id,
                    session_date: new Date().toISOString().slice(0, 10)
                };
                if (typeof ZykosEvidence !== 'undefined') {
                    rawPayload = await ZykosEvidence.prepare(rawPayload);
                }
                await sb.from('zykos_game_metrics').insert(rawPayload);
            }
        } catch(e) {
            console.error('[zykos-engine] Critical persist error:', e.message);
        }
    },

    // --- Public API ---
    getDictionary: function() { return METRIC_DICTIONARY; },
    getMetricCount: function() { return _dictCount; },
    getSessionId: function() { return _sessionId; },
    isActive: function() { return _sessionId !== null; },
    meta: null
};

// ================================================================
// AUTO-ATTACH: Start session when game loads, end on unload
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Extract patient info from URL/localStorage
    var params = new URLSearchParams(window.location.search);
    var dni = params.get('dni') || localStorage.getItem('zykos_patient_dni') || null;
    var userId = null;
    try { userId = JSON.parse(localStorage.getItem('zykos_user') || '{}').user_id || null; } catch(e) {}
    
    // Detect game slug from URL
    var path = window.location.pathname;
    var slug = path.split('/').pop().replace('.html', '').replace('index', '') || 'unknown';
    if (path.includes('classify-and-place')) slug = 'classify-' + (params.get('pack') || 'unknown');
    if (path.includes('inkblot')) slug = 'inkblot';

    if (dni) {
        // Small delay to let agents register
        setTimeout(function() {
            ZYKOS.startSession(slug, dni, userId);
        }, 100);
    }
});

window.addEventListener('beforeunload', function() {
    if (ZYKOS.isActive()) {
        ZYKOS.endSession();
    }
});

// Visibility change — track tab switches
document.addEventListener('visibilitychange', function() {
    if (ZYKOS.isActive()) {
        ZYKOS._pushRaw(document.hidden ? 'tab_hidden' : 'tab_visible', {});
    }
});

// Export
global.ZYKOS = ZYKOS;
global.METRIC_DICTIONARY = METRIC_DICTIONARY;

console.log('[zykos-engine] Core loaded. Dictionary: ' + _dictCount + ' metrics defined.');

})(typeof window !== 'undefined' ? window : this);
