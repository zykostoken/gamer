// ================================================================
// audio.js — ZYKOS GAMER Audio Engine
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// TRES CAPAS:
//
// 1. CONSIGNA ORAL
//    - Texto a voz (Web Speech API SpeechSynthesis)
//    - Boton "repetir consigna" siempre disponible
//    - Registra: consigna_repeticiones_count, rt_post_audio_ms
//
// 2. ESTIMULOS AUDITIVOS (eventos del juego)
//    - Sons que requieren reaccion del jugador
//    - Alarmas, alertas, instrucciones dinamicas
//    - Registra: rt_post_estimulo_audio_ms, omision_post_alerta
//
// 3. FEEDBACK SONORO
//    - Correcto / incorrecto / completado
//    - Generado por Web Audio API (sin archivos externos)
//    - No registra metricas — es UI puro
//
// USO:
//    ZykosAudio.init({ patientDni: '12345678' })
//    ZykosAudio.consigna('Cortá el pasto sin tocar las esquinas.')
//    ZykosAudio.estimulo('perro', 'El perro se escapa — reaccioná!')
//    ZykosAudio.feedback('ok')
//    ZykosAudio.feedback('error')
//    ZykosAudio.feedback('complete')
//    ZykosAudio.getMetrics()  // retorna objeto con todas las metricas
//
// INTEGRACION CON ENGINE:
//    Al llamar ZYKOS.endSession(), el engine llama ZykosAudio.flush()
//    que agrega las metricas de audio al payload automaticamente.
// ================================================================

(function(global) {
'use strict';

// ── Estado interno ───────────────────────────────────────────────
var state = {
    active:         false,
    patientDni:     null,
    sessionStart:   null,
    lang:           'es-AR',

    // Consigna oral
    consignaText:   null,
    consignaCount:  0,          // veces que se reprodujo la consigna
    consignaTs:     [],         // timestamps de cada reproduccion
    lastAudioEnd:   null,       // when la consigna termino de sonar

    // Estimulos auditivos
    stimuli:        [],         // { type, text, ts_start, ts_end, reacted, rt_ms }
    pendingStimulus: null,      // estimulo esperando reaccion

    // Metricas computadas
    metrics: {
        consigna_repeticiones_count:    0,
        rt_primer_click_post_consigna_ms: null,
        rt_post_estimulo_audio_ms:      null,   // mean RT a estimulos
        omisiones_estimulo_count:       0,       // estimulos sin reaccion en 3s
        estimulos_total:                0,
    }
};

// ── Web Audio API context (lazy init) ────────────────────────────
var _ctx = null;
function getCtx() {
    if (!_ctx) {
        try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch(e) { console.warn('[audio] Web Audio no disponible'); }
    }
    return _ctx;
}

// ── Tonos de feedback ────────────────────────────────────────────
var TONES = {
    ok:       { freq: 880,  dur: 0.12, type: 'sine',   gain: 0.18 },
    error:    { freq: 200,  dur: 0.25, type: 'sawtooth',gain: 0.12 },
    complete: { freq: 1046, dur: 0.35, type: 'sine',   gain: 0.20 },
    alert:    { freq: 660,  dur: 0.08, type: 'square', gain: 0.15 },
    warning:  { freq: 440,  dur: 0.20, type: 'triangle',gain: 0.15 },
};

function playTone(preset) {
    var ctx = getCtx();
    if (!ctx) return;
    try {
        var t = TONES[preset] || TONES.ok;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = t.type;
        osc.frequency.setValueAtTime(t.freq, ctx.currentTime);
        gain.gain.setValueAtTime(t.gain, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.dur);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + t.dur + 0.05);
        // Doble tono para completado
        if (preset === 'complete') {
            setTimeout(function() {
                try {
                    var o2 = ctx.createOscillator();
                    var g2 = ctx.createGain();
                    o2.connect(g2); g2.connect(ctx.destination);
                    o2.type = 'sine';
                    o2.frequency.setValueAtTime(1318, ctx.currentTime);
                    g2.gain.setValueAtTime(0.18, ctx.currentTime);
                    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                    o2.start(ctx.currentTime); o2.stop(ctx.currentTime + 0.4);
                } catch(e) {}
            }, 180);
        }
    } catch(e) { console.warn('[audio] playTone error:', e.message); }
}

// ── TTS — Web Speech API ─────────────────────────────────────────
function speak(text, onEnd) {
    if (!window.speechSynthesis) {
        console.warn('[audio] SpeechSynthesis no disponible');
        if (onEnd) onEnd();
        return;
    }
    window.speechSynthesis.cancel();
    var utt = new SpeechSynthesisUtterance(text);
    utt.lang  = state.lang;
    utt.rate  = 0.92;
    utt.pitch = 1.0;
    utt.volume = 0.95;

    // Seleccionar voz en español si disponible
    var voices = window.speechSynthesis.getVoices();
    var esVoice = voices.find(function(v) {
        return v.lang.startsWith('es') && !v.name.toLowerCase().includes('compact');
    });
    if (esVoice) utt.voice = esVoice;

    utt.onend = function() {
        state.lastAudioEnd = performance.now();
        if (onEnd) onEnd();
    };
    utt.onerror = function(e) {
        console.warn('[audio] TTS error:', e.error);
        if (onEnd) onEnd();
    };
    window.speechSynthesis.speak(utt);
}

// ── Listener de primer click post-consigna ───────────────────────
var _postConsignaListener = null;
function attachPostConsignaRT() {
    if (_postConsignaListener) return;
    _postConsignaListener = function() {
        if (state.lastAudioEnd && state.metrics.rt_primer_click_post_consigna_ms === null) {
            var rt = Math.round(performance.now() - state.lastAudioEnd);
            if (rt > 0 && rt < 60000) {
                state.metrics.rt_primer_click_post_consigna_ms = rt;
            }
        }
    };
    document.addEventListener('click',      _postConsignaListener, { once: false, passive: true });
    document.addEventListener('touchstart', _postConsignaListener, { once: false, passive: true });
}

// ── Listener de reaccion a estimulo ─────────────────────────────
function attachStimulusReactionListener(stimulus) {
    var timeout = setTimeout(function() {
        // Sin reaccion en 3s = omision
        stimulus.reacted = false;
        stimulus.rt_ms   = null;
        state.metrics.omisiones_estimulo_count++;
        state.pendingStimulus = null;
    }, 3000);

    var handler = function() {
        if (!stimulus.reacted && state.pendingStimulus === stimulus) {
            clearTimeout(timeout);
            var rt = Math.round(performance.now() - stimulus.ts_start);
            stimulus.reacted = true;
            stimulus.rt_ms   = rt;
            state.pendingStimulus = null;
            // Actualizar media de RT post-estimulo
            var rts = state.stimuli.filter(function(s) { return s.rt_ms !== null; })
                                    .map(function(s) { return s.rt_ms; });
            state.metrics.rt_post_estimulo_audio_ms = rts.length
                ? Math.round(rts.reduce(function(a,b){return a+b;},0) / rts.length)
                : null;
        }
    };
    document.addEventListener('click',      handler, { once: true, passive: true });
    document.addEventListener('touchstart', handler, { once: true, passive: true });
    document.addEventListener('keydown',    handler, { once: true, passive: true });
}

// ── API PUBLICA ───────────────────────────────────────────────────
var ZykosAudio = {

    /**
     * Inicializar el modulo de audio.
     * @param {Object} opts
     * @param {string} opts.patientDni
     * @param {string} [opts.lang='es-AR']
     */
    init: function(opts) {
        opts = opts || {};
        state.active       = true;
        state.patientDni   = opts.patientDni || null;
        state.sessionStart = performance.now();
        state.lang         = opts.lang || 'es-AR';
        // Reset metricas
        state.consignaCount = 0;
        state.consignaTs    = [];
        state.stimuli       = [];
        state.pendingStimulus = null;
        state.metrics = {
            consigna_repeticiones_count:      0,
            rt_primer_click_post_consigna_ms: null,
            rt_post_estimulo_audio_ms:        null,
            omisiones_estimulo_count:         0,
            estimulos_total:                  0,
        };
        // Pre-cargar voces
        if (window.speechSynthesis) {
            window.speechSynthesis.getVoices();
        }
    },

    /**
     * Reproducir consigna oral. Agrega boton "Repetir" si se pasa containerId.
     * @param {string} text — texto a leer
     * @param {string} [containerId] — ID del elemento donde agregar boton repetir
     */
    consigna: function(text, containerId) {
        if (!state.active) return;
        state.consignaText = text;
        state.consignaCount++;
        state.consignaTs.push(performance.now());
        state.metrics.consigna_repeticiones_count = state.consignaCount;
        // Reset RT post-consigna para esta reproduccion
        state.lastAudioEnd = null;
        state.metrics.rt_primer_click_post_consigna_ms = null;
        speak(text, function() {
            attachPostConsignaRT();
        });
        // Inyectar boton "Repetir indicacion" en el DOM
        if (containerId) {
            ZykosAudio._injectRepeatBtn(containerId, text);
        }
    },

    /**
     * Disparar un estimulo auditivo que espera reaccion del jugador.
     * @param {string} type — identificador del estimulo ('perro', 'alarma', etc.)
     * @param {string} text — texto a leer como estimulo
     */
    estimulo: function(type, text) {
        if (!state.active) return;
        var stimulus = {
            type:     type,
            text:     text,
            ts_start: performance.now(),
            ts_end:   null,
            reacted:  null,
            rt_ms:    null,
        };
        state.stimuli.push(stimulus);
        state.pendingStimulus = stimulus;
        state.metrics.estimulos_total++;
        playTone('alert');
        speak(text, function() {
            stimulus.ts_end = performance.now();
            attachStimulusReactionListener(stimulus);
        });
    },

    /**
     * Reproducir tono de feedback.
     * @param {'ok'|'error'|'complete'|'alert'|'warning'} type
     */
    feedback: function(type) {
        playTone(type || 'ok');
    },

    /**
     * Obtener metricas acumuladas de esta sesion.
     * @returns {Object}
     */
    getMetrics: function() {
        return {
            consigna_repeticiones_count:         state.metrics.consigna_repeticiones_count,
            rt_primer_click_post_consigna_ms:    state.metrics.rt_primer_click_post_consigna_ms,
            rt_post_estimulo_audio_ms:           state.metrics.rt_post_estimulo_audio_ms,
            omisiones_estimulo_count:            state.metrics.omisiones_estimulo_count,
            estimulos_total:                     state.metrics.estimulos_total,
            _raw_stimuli:                        state.stimuli.map(function(s) {
                return {
                    type:    s.type,
                    reacted: s.reacted,
                    rt_ms:   s.rt_ms,
                    ts:      Math.round(s.ts_start - state.sessionStart),
                };
            }),
        };
    },

    /**
     * Flush: llamado por ZYKOS.endSession() automaticamente.
     * Retorna las metricas para incorporar al payload.
     */
    flush: function() {
        return ZykosAudio.getMetrics();
    },

    /**
     * Detener todo audio en curso.
     */
    stop: function() {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        state.pendingStimulus = null;
    },

    // ── Interno: inyectar boton repetir ──────────────────────────
    _injectRepeatBtn: function(containerId, text) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var existing = container.querySelector('.zykos-audio-repeat-btn');
        if (existing) return; // ya existe
        var btn = document.createElement('button');
        btn.className = 'zykos-audio-repeat-btn';
        btn.innerHTML = '[&#9654;] Repetir indicacion';
        btn.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:6px',
            'padding:4px 14px',
            'border-radius:20px',
            'border:1px solid rgba(255,255,255,0.25)',
            'background:rgba(255,255,255,0.08)',
            'color:rgba(255,255,255,0.7)',
            'font-size:0.72rem',
            'font-weight:500',
            'cursor:pointer',
            'margin-top:8px',
            'font-family:inherit',
            'transition:all 0.2s',
        ].join(';');
        btn.onmouseenter = function() { btn.style.background = 'rgba(255,255,255,0.15)'; };
        btn.onmouseleave = function() { btn.style.background = 'rgba(255,255,255,0.08)'; };
        btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            ZykosAudio.consigna(text); // no pasa containerId para no duplicar boton
        };
        container.appendChild(btn);
    },
};

// ── Auto-integrar con ZYKOS engine si existe ─────────────────────
document.addEventListener('DOMContentLoaded', function() {
    if (typeof ZYKOS !== 'undefined' && ZYKOS.registerAudioModule) {
        ZYKOS.registerAudioModule(ZykosAudio);
    }
});

global.ZykosAudio = ZykosAudio;

})(typeof window !== 'undefined' ? window : this);
