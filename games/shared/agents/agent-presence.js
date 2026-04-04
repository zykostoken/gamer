// ================================================================
// agent-presence.js — AGENTE DE PRESENCIA ACTIVA
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Detecta si el usuario está realmente frente a la pantalla.
// Distingue tres estados: ACTIVO, IDLE, AUSENTE.
//
// Desktop:
//   mousemove / keydown / scroll → ACTIVO
//   sin eventos N ms → IDLE
//   visibilitychange hidden / window blur → AUSENTE
//
// Mobile/touch:
//   touchstart / touchmove / devicemotion → ACTIVO
//   sin touch N ms → IDLE
//   visibilitychange hidden / pagehide → AUSENTE
//
// Métricas que produce (nombres canónicos del METRIC_DICTIONARY):
//   presencia_activa_pct     — % del tiempo con actividad real
//   presencia_idle_pct       — % del tiempo idle (presente pero sin acción)
//   presencia_ausente_pct    — % del tiempo ausente (otra ventana / pantalla off)
//   presencia_segmentos_activos — cantidad de ráfagas de actividad continua
//   presencia_duracion_media_activa_ms — duración media de cada ráfaga activa
//   presencia_idle_max_ms    — idle más largo de la sesión
// ================================================================

(function() {
'use strict';

// Thresholds
var IDLE_THRESHOLD_MS   = 3000;  // 3s sin evento → IDLE
var ABSENT_CONFIRM_MS   = 500;   // visibilitychange debe persistir N ms para contar

var STATES = { ACTIVO: 'activo', IDLE: 'idle', AUSENTE: 'ausente' };

var state = {
    active: false,
    current: STATES.ACTIVO,
    sessionStart: 0,

    // Acumuladores de tiempo por estado (ms)
    tiempo_activo:  0,
    tiempo_idle:    0,
    tiempo_ausente: 0,

    // Segmentos de actividad continua
    segmentos_activos: [],   // [{start_ms, end_ms}]
    segmento_actual_start: 0,

    // Idle tracking
    idle_timer: null,
    idle_start: 0,
    idle_max_ms: 0,
    ultimo_evento: 0,

    // Ausencia tracking
    ausencia_start: 0,

    // Estado anterior al cambio
    prev_state_ts: 0,

    // Device type detectado
    is_touch: false
};

// ----------------------------------------------------------------
// TRANSICIONES DE ESTADO
// ----------------------------------------------------------------
function setEstado(nuevo, ahora) {
    if (state.current === nuevo) return;
    var duracion = ahora - state.prev_state_ts;

    // Acumular tiempo del estado que termina
    if (state.current === STATES.ACTIVO) {
        state.tiempo_activo += duracion;
        // Cerrar segmento activo
        if (state.segmento_actual_start > 0) {
            state.segmentos_activos.push({
                start_ms: Math.round(state.segmento_actual_start - state.sessionStart),
                end_ms:   Math.round(ahora - state.sessionStart),
                dur_ms:   Math.round(duracion)
            });
            state.segmento_actual_start = 0;
        }
    } else if (state.current === STATES.IDLE) {
        state.tiempo_idle += duracion;
        if (duracion > state.idle_max_ms) state.idle_max_ms = duracion;
    } else if (state.current === STATES.AUSENTE) {
        state.tiempo_ausente += duracion;
    }

    // Entrar al nuevo estado
    state.current = nuevo;
    state.prev_state_ts = ahora;

    if (nuevo === STATES.ACTIVO) {
        state.segmento_actual_start = ahora;
    }

    // Push al raw stream para análisis SQL por segmento
    if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw) {
        ZYKOS._pushRaw('presence_change', {
            estado: nuevo,
            t_ms: Math.round(ahora - state.sessionStart)
        });
    }
}

// ----------------------------------------------------------------
// RESET DEL TIMER DE IDLE
// ----------------------------------------------------------------
function resetIdleTimer() {
    var ahora = performance.now();
    state.ultimo_evento = ahora;

    // Si veníamos de idle o ausente → volver a activo
    if (state.current !== STATES.ACTIVO) {
        clearTimeout(state.idle_timer);
        setEstado(STATES.ACTIVO, ahora);
    }

    // Armar el próximo idle
    clearTimeout(state.idle_timer);
    state.idle_timer = setTimeout(function() {
        if (state.active && state.current === STATES.ACTIVO) {
            setEstado(STATES.IDLE, performance.now());
        }
    }, IDLE_THRESHOLD_MS);
}

// ----------------------------------------------------------------
// EVENTOS DE ACTIVIDAD — desktop
// ----------------------------------------------------------------
function onActivity(e) {
    if (!state.active) return;
    // Filtrar eventos sintéticos (isTrusted garantiza evento humano real)
    if (e && e.isTrusted === false) return;
    resetIdleTimer();
}

// ----------------------------------------------------------------
// EVENTOS DE ACTIVIDAD — touch / mobile
// ----------------------------------------------------------------
function onTouch(e) {
    if (!state.active) return;
    state.is_touch = true;
    resetIdleTimer();
}

// ----------------------------------------------------------------
// VISIBILITYCHANGE — pantalla apagada, app en background, alt-tab
// ----------------------------------------------------------------
function onVisibility() {
    if (!state.active) return;
    var ahora = performance.now();

    if (document.hidden) {
        // Pantalla oculta → AUSENTE
        // Ya manejado también por el engine, pero el agente lo registra
        // desde su propia perspectiva de presencia
        clearTimeout(state.idle_timer);
        if (state.current !== STATES.AUSENTE) {
            setEstado(STATES.AUSENTE, ahora);
        }
        state.ausencia_start = ahora;
    } else {
        // Pantalla visible → volver a ACTIVO
        if (state.current === STATES.AUSENTE) {
            setEstado(STATES.ACTIVO, ahora);
            // Rearmar idle timer
            state.idle_timer = setTimeout(function() {
                if (state.active) setEstado(STATES.IDLE, performance.now());
            }, IDLE_THRESHOLD_MS);
        }
    }
}

// ----------------------------------------------------------------
// PAGEHIDE — mobile: app va a background (más confiable que unload)
// ----------------------------------------------------------------
function onPageHide() {
    if (!state.active) return;
    setEstado(STATES.AUSENTE, performance.now());
}

// ----------------------------------------------------------------
// WINDOW BLUR / FOCUS — usuario cambia de app en desktop
// ----------------------------------------------------------------
function onBlur() {
    if (!state.active) return;
    var ahora = performance.now();
    clearTimeout(state.idle_timer);
    if (state.current !== STATES.AUSENTE) {
        setEstado(STATES.AUSENTE, ahora);
    }
}

function onFocus() {
    if (!state.active) return;
    if (state.current === STATES.AUSENTE) {
        setEstado(STATES.ACTIVO, performance.now());
        resetIdleTimer();
    }
}

// ----------------------------------------------------------------
// AGENT INTERFACE
// ----------------------------------------------------------------
var agent = {
    start: function() {
        var ahora = performance.now();
        state.active = true;
        state.current = STATES.ACTIVO;
        state.sessionStart = ahora;
        state.prev_state_ts = ahora;
        state.segmento_actual_start = ahora;
        state.tiempo_activo = 0;
        state.tiempo_idle = 0;
        state.tiempo_ausente = 0;
        state.segmentos_activos = [];
        state.idle_max_ms = 0;
        state.ultimo_evento = ahora;
        state.is_touch = 'ontouchstart' in window;

        // Detectar touch vs mouse
        if (state.is_touch) {
            document.addEventListener('touchstart',  onTouch,    { passive: true });
            document.addEventListener('touchmove',   onTouch,    { passive: true });
        } else {
            document.addEventListener('mousemove',   onActivity, { passive: true });
            document.addEventListener('mousedown',   onActivity, { passive: true });
            document.addEventListener('keydown',     onActivity, { passive: true });
            document.addEventListener('scroll',      onActivity, { passive: true });
        }

        // Eventos de ausencia — ambas plataformas
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('blur',     onBlur);
        window.addEventListener('focus',    onFocus);
        window.addEventListener('pagehide', onPageHide);

        // Arrancar el timer de idle
        state.idle_timer = setTimeout(function() {
            if (state.active) setEstado(STATES.IDLE, performance.now());
        }, IDLE_THRESHOLD_MS);
    },

    pause: function() {
        // Desde visibilitychange del engine — marcar ausente
        clearTimeout(state.idle_timer);
        if (state.active && state.current !== STATES.AUSENTE) {
            setEstado(STATES.AUSENTE, performance.now());
        }
    },

    resume: function() {
        if (state.active && state.current === STATES.AUSENTE) {
            setEstado(STATES.ACTIVO, performance.now());
            resetIdleTimer();
        }
    },

    collect: function() {
        var ahora = performance.now();
        var duracion_total = ahora - state.sessionStart;

        // Cerrar el estado actual
        var acumulado = state.tiempo_activo + state.tiempo_idle + state.tiempo_ausente;
        var restante  = Math.max(0, duracion_total - acumulado);
        if      (state.current === STATES.ACTIVO)  state.tiempo_activo  += restante;
        else if (state.current === STATES.IDLE)    state.tiempo_idle    += restante;
        else if (state.current === STATES.AUSENTE) state.tiempo_ausente += restante;

        var total = state.tiempo_activo + state.tiempo_idle + state.tiempo_ausente;
        if (total < 1) total = 1; // evitar div/0

        var n_segs = state.segmentos_activos.length;
        var dur_media = 0;
        if (n_segs > 0) {
            var suma = 0;
            for (var i = 0; i < n_segs; i++) suma += state.segmentos_activos[i].dur_ms;
            dur_media = Math.round(suma / n_segs);
        }

        return {
            presencia_activa_pct:              +(state.tiempo_activo  / total * 100).toFixed(1),
            presencia_idle_pct:                +(state.tiempo_idle    / total * 100).toFixed(1),
            presencia_ausente_pct:             +(state.tiempo_ausente / total * 100).toFixed(1),
            presencia_segmentos_activos:       n_segs,
            presencia_duracion_media_activa_ms: dur_media,
            presencia_idle_max_ms:             Math.round(state.idle_max_ms),
            presencia_device:                  state.is_touch ? 'touch' : 'mouse',
            // Raw para análisis longitudinal
            _raw_presencia: {
                activo_ms:  Math.round(state.tiempo_activo),
                idle_ms:    Math.round(state.tiempo_idle),
                ausente_ms: Math.round(state.tiempo_ausente),
                segmentos:  state.segmentos_activos.slice(-20) // ultimos 20
            }
        };
    },

    stop: function() {
        state.active = false;
        clearTimeout(state.idle_timer);
        document.removeEventListener('touchstart',      onTouch);
        document.removeEventListener('touchmove',       onTouch);
        document.removeEventListener('mousemove',       onActivity);
        document.removeEventListener('mousedown',       onActivity);
        document.removeEventListener('keydown',         onActivity);
        document.removeEventListener('scroll',          onActivity);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('blur',     onBlur);
        window.removeEventListener('focus',    onFocus);
        window.removeEventListener('pagehide', onPageHide);
    }
};

// Auto-registrar con el engine
if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('presence', agent);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('presence', agent);
    });
}

})();

// Señal al engine: agente listo
if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
