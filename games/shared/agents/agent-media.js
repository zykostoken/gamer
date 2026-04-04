// ================================================================
// agent-media.js — PIRATE AGENT: Cámara + Micrófono
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// PRINCIPIOS:
//   1. LAZY — no existe hasta consentimiento explícito
//   2. HARDWARE-ADAPTIVE — detecta capacidad y baja gracefully
//      full (cam 5fps + mic) → low (cam 2fps + mic) → mic_only → none
//   3. INTEGRADO — métricas van al mismo payload que el resto
//      no hay tabla separada, son biomarcadores del mismo evento
//   4. CERO DATOS AL SERVIDOR — solo índices computados localmente
//
// RESPALDO ACADÉMICO:
//   Ekman & Friesen (1978) FACS — Action Units faciales
//   Duchenne (1862) — sonrisa genuina AU6+AU12
//   Gross (2002) — supresión emocional y orbicular labios
//   Nijenhuis (2004) — freeze facial y disociación
//   Literatura neuroftalmología — blink rate normativa 15-20/min
// ================================================================

(function() {
'use strict';

var FACE_CDN  = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
var MODELS    = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/';
var FREEZE_MS = 3000;
var BLINK_MS  = 300;
var NOISE_DB  = 70;
var SPEECH_DB = 55;

// ----------------------------------------------------------------
// DETECCIÓN DE CAPACIDAD DE HARDWARE
// Antes de pedir permisos, testear si el dispositivo puede sostener
// el procesamiento. No penalizar al paciente con un juego lento.
// ----------------------------------------------------------------
function detectHWTier() {
    return new Promise(function(resolve) {
        // Test rápido de framerate disponible
        var frames = 0;
        var start = performance.now();
        function countFrame() {
            frames++;
            if (performance.now() - start < 500) requestAnimationFrame(countFrame);
            else {
                var fps = frames / 0.5;
                if (fps >= 45) resolve('full');       // 5fps detección → OK
                else if (fps >= 25) resolve('low');   // 2fps detección → OK reducido
                else resolve('degraded');              // solo mic
            }
        }
        requestAnimationFrame(countFrame);
    });
}

// ----------------------------------------------------------------
// ESTADO
// ----------------------------------------------------------------
var state = {
    consent_cam: false,
    consent_mic: false,
    hw_tier: 'none',
    detect_interval_ms: 200,  // ajustado por hw_tier

    _stream_cam: null,
    _stream_mic: null,
    _video:      null,
    _detect_iv:  null,
    _audio_ctx:  null,
    _analyser:   null,
    _mic_iv:     null,

    // Acumuladores cámara
    frames_total:       0,
    frames_face:        0,
    face_absent_eps:    0,
    _face_was:          false,
    freeze_eps:         [],
    _lm_last:           null,
    _freeze_start:      null,

    // AUs
    AU4_eps: 0, _AU4_on: false, _AU4_t: null, AU4_ms: 0,
    AU9_eps: 0,
    AU23_eps: 0, _AU23_on: false, _AU23_t: null, AU23_max: 0,
    blink_ts: [], _blink_t: null, blink_bursts: 0,
    duchenne: 0, social_smile: 0,

    // Acumuladores mic
    mic_db: [], speech_eps: 0, _in_speech: false, noise_count: 0,

    _t0: 0,
    active: false
};

// ----------------------------------------------------------------
// FACE-API — carga lazy, una sola vez
// ----------------------------------------------------------------
var _faceApiReady = false;
function loadFaceApi() {
    return new Promise(function(resolve, reject) {
        if (_faceApiReady && window.faceapi) { resolve(); return; }
        var s = document.createElement('script');
        s.src = FACE_CDN;
        s.onload = function() {
            Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODELS),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS),
                faceapi.nets.faceExpressionNet.loadFromUri(MODELS)
            ]).then(function(){ _faceApiReady = true; resolve(); }).catch(reject);
        };
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

// ----------------------------------------------------------------
// CÁMARA
// ----------------------------------------------------------------
async function startCam() {
    try {
        state._stream_cam = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, frameRate: 15 }
        });
        await loadFaceApi();
        state._video = document.createElement('video');
        state._video.srcObject = state._stream_cam;
        state._video.autoplay = true;
        state._video.muted = true;
        state._video.playsInline = true;
        state._video.width = 320;
        state._video.height = 240;
        await state._video.play();
        state._detect_iv = setInterval(detect, state.detect_interval_ms);
    } catch(e) {
        console.warn('[agent-media] cam:', e.message);
        state.consent_cam = false;
        if (state.hw_tier === 'full') state.hw_tier = 'mic_only';
    }
}

async function detect() {
    if (!state.active || !state._video || !window.faceapi) return;
    try {
        var r = await faceapi
            .detectSingleFace(state._video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks(true)
            .withFaceExpressions();

        state.frames_total++;
        var now = performance.now();

        if (!r) {
            if (state._face_was) { state.face_absent_eps++; state._face_was = false; }
            if (state._freeze_start) { state._freeze_start = null; state._lm_last = null; }
            return;
        }

        state.frames_face++;
        state._face_was = true;
        var lm = r.landmarks.positions;

        // FREEZE — landmarks quietos
        if (state._lm_last) {
            var delta = lmDelta(lm, state._lm_last);
            if (delta < 1.5) {
                if (!state._freeze_start) state._freeze_start = now;
            } else {
                if (state._freeze_start) {
                    var fd = Math.round(now - state._freeze_start);
                    if (fd >= FREEZE_MS) state.freeze_eps.push(fd);
                    state._freeze_start = null;
                }
            }
        }
        state._lm_last = lm;

        var ex = r.expressions;

        // AU4 — corrugador (ceño fruncido)
        if (browsGap(lm) > 0.65) {
            if (!state._AU4_on) { state._AU4_on = true; state._AU4_t = now; state.AU4_eps++; }
        } else {
            if (state._AU4_on) { state.AU4_ms += Math.round(now - state._AU4_t); state._AU4_on = false; }
        }

        // AU9 — nariz (aversión)
        if (ex.disgusted > 0.3) state.AU9_eps++;

        // AU23/24 — boca apretada
        if (mouthOpen(lm) < 0.05) {
            if (!state._AU23_on) { state._AU23_on = true; state._AU23_t = now; state.AU23_eps++; }
        } else {
            if (state._AU23_on) {
                var d = Math.round(now - state._AU23_t);
                if (d > state.AU23_max) state.AU23_max = d;
                state._AU23_on = false;
            }
        }

        // AU43 — parpadeo (EAR)
        if (ear(lm) < 0.2) {
            if (!state._blink_t) state._blink_t = now;
        } else {
            if (state._blink_t) {
                if (now - state._blink_t < BLINK_MS) state.blink_ts.push(now);
                state._blink_t = null;
            }
        }
        // Ráfaga: >3 parpadeos en <2s
        var recent = state.blink_ts.filter(function(t){ return now - t < 2000; });
        if (recent.length >= 3 && recent.length > (state._last_burst_count || 0)) {
            state.blink_bursts++;
            state._last_burst_count = recent.length;
        } else if (recent.length === 0) {
            state._last_burst_count = 0;
        }

        // Sonrisa Duchenne vs social
        if (ex.happy > 0.5) {
            if (cheekUp(lm) > 0.55) state.duchenne++;
            else state.social_smile++;
        }

    } catch(e) { /* frame fallido — silencioso */ }
}

// Geometría facial — landmarks 68 puntos
function lmDelta(a, b) {
    var s = 0, n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) s += Math.abs(a[i].x-b[i].x) + Math.abs(a[i].y-b[i].y);
    return s / n;
}
function browsGap(lm) {
    var l = lm[21]||{x:0,y:0}, r = lm[22]||{x:0,y:0};
    var w = Math.abs((lm[16]||{x:100}).x - (lm[0]||{x:0}).x)||100;
    return 1 - (Math.sqrt(Math.pow(r.x-l.x,2)+Math.pow(r.y-l.y,2)) / w);
}
function mouthOpen(lm) {
    var t=lm[62]||{y:0}, b=lm[66]||{y:0};
    var h=Math.abs((lm[8]||{y:100}).y-(lm[27]||{y:0}).y)||100;
    return Math.abs(b.y-t.y)/h;
}
function ear(lm) {
    var p1=lm[36]||{x:0,y:0},p2=lm[37]||{x:0,y:0},p3=lm[38]||{x:0,y:0},
        p4=lm[39]||{x:0,y:0},p5=lm[40]||{x:0,y:0},p6=lm[41]||{x:0,y:0};
    return (Math.abs(p2.y-p6.y)+Math.abs(p3.y-p5.y))/(2*(Math.abs(p1.x-p4.x)||1));
}
function cheekUp(lm) {
    var c=lm[1]||{y:0}, e=lm[36]||{y:0}, chin=lm[8]||{y:100};
    return 1-(Math.abs(c.y-e.y)/(Math.abs(chin.y-e.y)||1));
}

// ----------------------------------------------------------------
// MICRÓFONO
// ----------------------------------------------------------------
async function startMic() {
    try {
        state._stream_mic = await navigator.mediaDevices.getUserMedia({ audio:true, video:false });
        state._audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
        var src = state._audio_ctx.createMediaStreamSource(state._stream_mic);
        state._analyser = state._audio_ctx.createAnalyser();
        state._analyser.fftSize = 256;
        src.connect(state._analyser);
        var buf = new Uint8Array(state._analyser.frequencyBinCount);

        state._mic_iv = setInterval(function() {
            if (!state.active) return;
            state._analyser.getByteFrequencyData(buf);
            var sum = 0;
            for (var i = 0; i < buf.length; i++) sum += buf[i]*buf[i];
            var db = sum > 0 ? 20*Math.log10(Math.sqrt(sum/buf.length)/255)+90 : 0;
            state.mic_db.push(+(db.toFixed(1)));
            if (db > SPEECH_DB) {
                if (!state._in_speech) { state._in_speech = true; state.speech_eps++; }
            } else { state._in_speech = false; }
            if (db > NOISE_DB) state.noise_count++;
        }, 100);

    } catch(e) {
        console.warn('[agent-media] mic:', e.message);
        state.consent_mic = false;
        if (state.hw_tier === 'full') state.hw_tier = 'cam_only';
        if (state.hw_tier === 'mic_only') state.hw_tier = 'none';
    }
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
        if (!state.consent_cam && !state.consent_mic) return;

        // Detectar capacidad de hardware antes de cargar nada
        var tier = await detectHWTier();
        if (tier === 'degraded' && !state.consent_mic) { state.hw_tier = 'none'; return; }
        if (tier === 'degraded') { state.hw_tier = 'mic_only'; state.consent_cam = false; }
        else if (tier === 'low')  { state.hw_tier = 'low';  state.detect_interval_ms = 500; }
        else                      { state.hw_tier = 'full'; state.detect_interval_ms = 200; }

        // Resetear
        Object.assign(state, {
            frames_total:0, frames_face:0, face_absent_eps:0, _face_was:false,
            freeze_eps:[], _lm_last:null, _freeze_start:null,
            AU4_eps:0, _AU4_on:false, AU4_ms:0,
            AU9_eps:0, AU23_eps:0, _AU23_on:false, AU23_max:0,
            blink_ts:[], _blink_t:null, blink_bursts:0, _last_burst_count:0,
            duchenne:0, social_smile:0,
            mic_db:[], speech_eps:0, _in_speech:false, noise_count:0,
            _t0: performance.now(), active: true
        });

        if (state.consent_cam && state.hw_tier !== 'mic_only') await startCam();
        if (state.consent_mic && state.hw_tier !== 'cam_only') await startMic();
    },

    collect: function() {
        // Cerrar AUs activas
        var now = performance.now();
        if (state._AU4_on)  state.AU4_ms += Math.round(now - state._AU4_t);
        if (state._AU23_on) { var d=Math.round(now-state._AU23_t); if(d>state.AU23_max)state.AU23_max=d; }
        if (state._freeze_start) {
            var fd = Math.round(now - state._freeze_start);
            if (fd >= FREEZE_MS) state.freeze_eps.push(fd);
        }

        var sessionMin = (now - state._t0) / 60000 || 1;
        var ft = state.frames_total || 1;

        // Parpadeo
        var blinkRate = null, blinkCV = null;
        if (state.blink_ts.length > 1) {
            blinkRate = +(state.blink_ts.length / sessionMin).toFixed(1);
            var ivs = [];
            for (var i=1;i<state.blink_ts.length;i++) ivs.push(state.blink_ts[i]-state.blink_ts[i-1]);
            var mn = ivs.reduce(function(a,b){return a+b;},0)/ivs.length;
            var sd = Math.sqrt(ivs.map(function(v){return Math.pow(v-mn,2);}).reduce(function(a,b){return a+b;},0)/ivs.length);
            blinkCV = mn > 0 ? +(sd/mn).toFixed(3) : null;
        }

        // Mic
        var micMean = null, micCV = null;
        if (state.mic_db.length > 0) {
            micMean = +(state.mic_db.reduce(function(a,b){return a+b;},0)/state.mic_db.length).toFixed(1);
            var msd = Math.sqrt(state.mic_db.map(function(v){return Math.pow(v-micMean,2);}).reduce(function(a,b){return a+b;},0)/state.mic_db.length);
            micCV = micMean > 0 ? +(msd/micMean).toFixed(3) : null;
        }

        var freezeMax = state.freeze_eps.length > 0 ? Math.max.apply(null, state.freeze_eps) : 0;

        // Retorna métricas en el mismo formato que el resto de agentes
        // El engine las mezcla con jitter_reposo_px, rt_mean_ms, etc.
        return {
            consent_cam:                state.consent_cam,
            consent_mic:                state.consent_mic,
            media_hw_tier:              state.hw_tier,

            // Presencia
            cam_face_present_pct:       state.consent_cam ? +(state.frames_face/ft).toFixed(3) : null,
            cam_face_absent_episodes:   state.consent_cam ? state.face_absent_eps : null,
            cam_face_freeze_episodes:   state.consent_cam ? state.freeze_eps.length : null,
            cam_face_freeze_max_ms:     state.consent_cam ? freezeMax : null,

            // Expresión (Ekman 1978)
            cam_brow_furrow_episodes:   state.consent_cam ? state.AU4_eps   : null,
            cam_brow_furrow_ms:         state.consent_cam ? state.AU4_ms    : null,
            cam_nose_wrinkle_episodes:  state.consent_cam ? state.AU9_eps   : null,
            cam_lip_compression_episodes: state.consent_cam ? state.AU23_eps : null,
            cam_lip_compression_max_ms: state.consent_cam ? state.AU23_max  : null,
            cam_blink_rate_mean:        state.consent_cam ? blinkRate  : null,
            cam_blink_rate_cv:          state.consent_cam ? blinkCV    : null,
            cam_blink_burst_count:      state.consent_cam ? state.blink_bursts : null,
            cam_genuine_smile_pct:      state.consent_cam ? +(state.duchenne/ft).toFixed(3) : null,
            cam_social_smile_pct:       state.consent_cam ? +(state.social_smile/ft).toFixed(3) : null,

            // Micrófono
            mic_ambient_db_mean:        state.consent_mic ? micMean : null,
            mic_ambient_db_cv:          state.consent_mic ? micCV   : null,
            mic_speech_episodes:        state.consent_mic ? state.speech_eps   : null,
            mic_external_noise_count:   state.consent_mic ? state.noise_count  : null
        };
    },

    stop: function() {
        // LIBERACIÓN COMPLETA — sin residuos
        state.active = false;
        if (state._detect_iv)  { clearInterval(state._detect_iv);  state._detect_iv = null; }
        if (state._mic_iv)     { clearInterval(state._mic_iv);     state._mic_iv    = null; }
        if (state._stream_cam) { state._stream_cam.getTracks().forEach(function(t){t.stop();}); state._stream_cam = null; }
        if (state._stream_mic) { state._stream_mic.getTracks().forEach(function(t){t.stop();}); state._stream_mic = null; }
        if (state._audio_ctx)  { state._audio_ctx.close().catch(function(){}); state._audio_ctx = null; state._analyser = null; }
        if (state._video)      { state._video.srcObject = null; state._video = null; }
        state._lm_last = null;
    }
};

// Exponer globalmente — activación explícita via setConsent()
// No se auto-registra en ZYKOS.registerAgent() — requiere consentimiento previo
if (typeof window !== 'undefined') window.ZykosMediaAgent = agent;

})();

if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
