// ================================================================
// agent-og-media.js — PIRATE AGENT: Original Graphics Media (Cam + Mic Raw)
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// PRINCIPIOS:
//   1. LAZY — no existe hasta consentimiento explícito via setConsent()
//   2. HARDWARE-ADAPTIVE — full → cam_only → mic_only → none
//   3. CERO DATOS AL SERVIDOR — solo métricas computadas localmente
//   4. PRIVACIDAD — el video/audio NUNCA sale del navegador
//   5. FUNDACIONAL — base sobre la que agent-media.js extiende
//
// vs agent-media.js:
//   og-media: sin face-api, vanilla JS, bajo CPU, presencia/luz/audio
//   media:    face-api (2.8MB), AU faciales, humor, correlación rendimiento
//   Usar og-media cuando se quiere impacto mínimo en performance.
//   Usar ambos para análisis completo.
//
// RESPALDO ACADÉMICO:
//   Verkruysse et al. (2008) — HR via webcam green channel (rPPG)
//   Poh et al. (2010) — HR extraction via ICA
//   De Haan & Jeanne (2013) — CHROM for robust HR via webcam
//   Mcduff et al. (2014) — Stress detection via webcam HR variability
//   Kaliouby & Robinson (2005) — Engagement via face presence
//   Cummins et al. (2015) — Speech biomarkers for depression
//   Alghowinem et al. (2013) — Audio features for mood detection
//
// MÉTRICAS (nombres canónicos del METRIC_DICTIONARY):
//   og_cam_present            bool  — cámara activa en sesión
//   og_cam_presence_pct       ratio — % tiempo con contenido visual
//   og_cam_blackout_count     count — episodios sin detección
//   og_cam_blackout_max_ms    ms    — blackout más largo
//   og_cam_luminance_mean     0-255 — luminancia media del frame
//   og_cam_luminance_cv       ratio — variabilidad de luminancia
//   og_cam_green_channel_mean 0-255 — canal verde medio (proxy PPG)
//   og_cam_green_cv           ratio — variabilidad canal verde (rPPG)
//   og_mic_present            bool  — micrófono activo
//   og_mic_db_mean            dB    — volumen ambiental medio
//   og_mic_db_cv              ratio — variabilidad de volumen
//   og_mic_silence_pct        ratio — % tiempo en silencio (<30dB)
//   og_mic_speech_episodes    count — episodios de habla (>50dB)
//   og_mic_peak_db            dB    — pico máximo de audio
// ================================================================

(function() {
'use strict';

var SILENCE_DB  = 30;
var SPEECH_DB   = 50;
var SAMPLE_MS   = 200;  // 5fps para luminancia/audio — bajo CPU

// ----------------------------------------------------------------
// DETECCIÓN DE HARDWARE
// ----------------------------------------------------------------
function detectHWCapability() {
    return new Promise(function(resolve) {
        var caps = { cam: false, mic: false };
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            resolve(caps); return;
        }
        navigator.mediaDevices.enumerateDevices()
            .then(function(devices) {
                devices.forEach(function(d) {
                    if (d.kind === 'videoinput')  caps.cam = true;
                    if (d.kind === 'audioinput') caps.mic = true;
                });
                resolve(caps);
            }).catch(function() { resolve(caps); });
    });
}

// ----------------------------------------------------------------
// ESTADO
// ----------------------------------------------------------------
var state = {
    consent_cam: false,
    consent_mic: false,
    hw_tier: 'none',

    _stream_cam:  null,
    _stream_mic:  null,
    _video:       null,
    _canvas:      null,
    _ctx:         null,
    _audio_ctx:   null,
    _analyser:    null,
    _cam_iv:      null,
    _mic_iv:      null,

    // Cámara
    frames_total:        0,
    frames_present:      0,
    blackout_episodes:   [],
    _blackout_start:     null,
    luminance_samples:   [],
    green_samples:       [],

    // Micrófono
    db_samples:          [],
    silence_samples:     0,
    speech_episodes:     0,
    _in_speech:          false,
    peak_db:             0,

    _t0:    0,
    active: false
};

// ----------------------------------------------------------------
// CÁMARA — captura de luminancia y canal verde (proxy PPG)
// Resolución mínima 160x120@5fps — suficiente para métricas de luz
// No hace detección facial — eso es agent-media.js con face-api
// ----------------------------------------------------------------
async function startCam() {
    try {
        state._stream_cam = await navigator.mediaDevices.getUserMedia({
            video: { width: 160, height: 120, frameRate: 5 }
        });
        state._video = document.createElement('video');
        state._video.srcObject = state._stream_cam;
        state._video.autoplay = true;
        state._video.muted = true;
        state._video.playsInline = true;
        state._video.width = 160;
        state._video.height = 120;
        state._canvas = document.createElement('canvas');
        state._canvas.width = 160;
        state._canvas.height = 120;
        state._ctx = state._canvas.getContext('2d', { willReadFrequently: true });
        await state._video.play();
        state._cam_iv = setInterval(sampleFrame, SAMPLE_MS);
    } catch(e) {
        console.warn('[agent-og-media] cam:', e.message);
        state.consent_cam = false;
        state.hw_tier = state.consent_mic ? 'mic_only' : 'none';
    }
}

function sampleFrame() {
    if (!state.active || !state._video || !state._ctx) return;
    try {
        var now = performance.now();
        state._ctx.drawImage(state._video, 0, 0, 160, 120);
        var data = state._ctx.getImageData(0, 0, 160, 120).data;
        var len = data.length;
        var sumR = 0, sumG = 0, sumB = 0, sumLum = 0, nonBlack = 0;
        for (var i = 0; i < len; i += 4) {
            var r = data[i], g = data[i+1], b = data[i+2];
            sumR += r; sumG += g; sumB += b;
            sumLum += 0.2126*r + 0.7152*g + 0.0722*b;
            if (r > 10 || g > 10 || b > 10) nonBlack++;
        }
        var px = len / 4;
        var presencePct = nonBlack / px;
        state.luminance_samples.push(sumLum / px);
        state.green_samples.push(sumG / px);
        state.frames_total++;

        if (presencePct > 0.5) {
            state.frames_present++;
            if (state._blackout_start !== null) {
                var dur = Math.round(now - state._blackout_start);
                if (dur > 500) state.blackout_episodes.push({
                    start_session_ms: Math.round(state._blackout_start - state._t0),
                    duration_ms: dur
                });
                state._blackout_start = null;
            }
        } else {
            if (state._blackout_start === null) state._blackout_start = now;
        }

        if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw && state.frames_total % 5 === 0) {
            ZYKOS._pushRaw('og_frame', {
                t_ms: Math.round(now - state._t0),
                lum:  +(sumLum/px).toFixed(1),
                g:    +(sumG/px).toFixed(1),
                p:    presencePct > 0.5 ? 1 : 0
            });
        }
    } catch(e) { /* frame fallido — silencioso */ }
}

// ----------------------------------------------------------------
// MICRÓFONO — nivel de audio sin grabar
// ----------------------------------------------------------------
async function startMic() {
    try {
        state._stream_mic = await navigator.mediaDevices.getUserMedia({
            audio: true, video: false
        });
        state._audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
        var src = state._audio_ctx.createMediaStreamSource(state._stream_mic);
        state._analyser = state._audio_ctx.createAnalyser();
        state._analyser.fftSize = 256;
        src.connect(state._analyser);
        var buf = new Uint8Array(state._analyser.frequencyBinCount);

        state._mic_iv = setInterval(function() {
            if (!state.active || !state._analyser) return;
            state._analyser.getByteFrequencyData(buf);
            var sum = 0;
            for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            var db = sum > 0 ? Math.max(0, Math.min(100,
                20 * Math.log10(Math.sqrt(sum/buf.length)/255) + 90)) : 0;
            state.db_samples.push(+(db.toFixed(1)));
            if (db > state.peak_db) state.peak_db = db;
            if (db < SILENCE_DB) state.silence_samples++;
            if (db > SPEECH_DB) {
                if (!state._in_speech) { state._in_speech = true; state.speech_episodes++; }
            } else { state._in_speech = false; }
            if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw && state.db_samples.length % 5 === 0) {
                ZYKOS._pushRaw('og_audio', {
                    t_ms: Math.round(performance.now() - state._t0),
                    db: +(db.toFixed(1))
                });
            }
        }, SAMPLE_MS);
    } catch(e) {
        console.warn('[agent-og-media] mic:', e.message);
        state.consent_mic = false;
        state.hw_tier = state.consent_cam ? 'cam_only' : 'none';
    }
}

// ----------------------------------------------------------------
// ESTADÍSTICAS
// ----------------------------------------------------------------
function mean(a) {
    if (!a || !a.length) return 0;
    var s = 0; for (var i=0;i<a.length;i++) s+=a[i]; return s/a.length;
}
function cv(a) {
    var m = mean(a); if (m <= 0) return 0;
    var s = 0; for (var i=0;i<a.length;i++) s+=Math.pow(a[i]-m,2);
    return Math.sqrt(s/(a.length||1)) / m;
}

// ----------------------------------------------------------------
// AGENT INTERFACE
// ----------------------------------------------------------------
var agent = {

    setConsent: function(cam, mic) {
        state.consent_cam = !!cam;
        state.consent_mic = !!mic;
    },

    start: async function() {
        if (!state.consent_cam && !state.consent_mic) { state.hw_tier='none'; return; }

        var caps = await detectHWCapability();
        if (state.consent_cam && !caps.cam) state.consent_cam = false;
        if (state.consent_mic && !caps.mic) state.consent_mic = false;

        if      (state.consent_cam && state.consent_mic) state.hw_tier = 'full';
        else if (state.consent_cam)                      state.hw_tier = 'cam_only';
        else if (state.consent_mic)                      state.hw_tier = 'mic_only';
        else { state.hw_tier = 'none'; return; }

        // Reset
        state.frames_total=0; state.frames_present=0;
        state.blackout_episodes=[]; state._blackout_start=null;
        state.luminance_samples=[]; state.green_samples=[];
        state.db_samples=[]; state.silence_samples=0;
        state.speech_episodes=0; state._in_speech=false; state.peak_db=0;
        state._t0 = performance.now();
        state.active = true;

        if (state.consent_cam) await startCam();
        if (state.consent_mic) await startMic();
    },

    collect: function() {
        var now = performance.now();

        // Cerrar blackout activo
        if (state._blackout_start !== null) {
            var dur = Math.round(now - state._blackout_start);
            if (dur > 500) state.blackout_episodes.push({
                start_session_ms: Math.round(state._blackout_start - state._t0),
                duration_ms: dur
            });
        }

        var ft = Math.max(1, state.frames_total);
        var blackoutMax = state.blackout_episodes.length > 0
            ? Math.max.apply(null, state.blackout_episodes.map(function(e){ return e.duration_ms; }))
            : 0;
        var dbSamples = state.db_samples.length;

        return {
            // Cámara
            og_cam_present:            state.consent_cam && state.hw_tier !== 'mic_only',
            og_cam_presence_pct:       state.consent_cam ? +(state.frames_present/ft).toFixed(3) : null,
            og_cam_blackout_count:     state.consent_cam ? state.blackout_episodes.length : null,
            og_cam_blackout_max_ms:    state.consent_cam ? blackoutMax : null,
            og_cam_luminance_mean:     state.consent_cam ? +mean(state.luminance_samples).toFixed(1) : null,
            og_cam_luminance_cv:       state.consent_cam ? +cv(state.luminance_samples).toFixed(3) : null,
            og_cam_green_channel_mean: state.consent_cam ? +mean(state.green_samples).toFixed(1) : null,
            og_cam_green_cv:           state.consent_cam ? +cv(state.green_samples).toFixed(3) : null,

            // Micrófono
            og_mic_present:            state.consent_mic && state.hw_tier !== 'cam_only',
            og_mic_db_mean:            state.consent_mic ? +mean(state.db_samples).toFixed(1) : null,
            og_mic_db_cv:              state.consent_mic ? +cv(state.db_samples).toFixed(3) : null,
            og_mic_silence_pct:        state.consent_mic && dbSamples > 0
                                           ? +(state.silence_samples/dbSamples).toFixed(3) : null,
            og_mic_speech_episodes:    state.consent_mic ? state.speech_episodes : null,
            og_mic_peak_db:            state.consent_mic ? +state.peak_db.toFixed(1) : null,

            og_media_hw_tier: state.hw_tier,

            // Raw para análisis diferido
            _raw_og_media: {
                session_ms:       Math.round(now - state._t0),
                cam_frames:       state.frames_total,
                cam_present_frames: state.frames_present,
                blackouts:        state.blackout_episodes.slice(-10),
                mic_samples:      dbSamples,
                lum_samples:      state.luminance_samples.length > 50
                    ? state.luminance_samples.slice(0,25).concat(state.luminance_samples.slice(-25))
                    : state.luminance_samples,
                green_samples:    state.green_samples.length > 50
                    ? state.green_samples.slice(0,25).concat(state.green_samples.slice(-25))
                    : state.green_samples
            }
        };
    },

    pause:  function() { /* blackout es señal clínica — no pausar el stream */ },
    resume: function() { /* continuar */ },

    stop: function() {
        state.active = false;
        if (state._cam_iv)    { clearInterval(state._cam_iv);   state._cam_iv   = null; }
        if (state._mic_iv)    { clearInterval(state._mic_iv);   state._mic_iv   = null; }
        if (state._stream_cam){ state._stream_cam.getTracks().forEach(function(t){t.stop();}); state._stream_cam=null; }
        if (state._stream_mic){ state._stream_mic.getTracks().forEach(function(t){t.stop();}); state._stream_mic=null; }
        if (state._audio_ctx) { state._audio_ctx.close().catch(function(){}); state._audio_ctx=null; state._analyser=null; }
        if (state._video)     { state._video.srcObject=null; state._video=null; }
        state._canvas=null; state._ctx=null;
    }
};

// Exposición global — activación explícita via setConsent()
if (typeof window !== 'undefined') window.ZykosOgMediaAgent = agent;

})();

if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
