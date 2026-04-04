// ================================================================
// agent-media.js — PIRATE AGENT: Cámara + Micrófono
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// ARQUITECTURA LAZY:
//   El agente no existe hasta que el usuario consiente explícitamente.
//   No carga face-api.js hasta que start() es llamado.
//   stop() libera TODOS los streams, workers y objetos — sin residuos.
//
// PROCESAMIENTO 100% EN BROWSER:
//   Cero frames al servidor. Solo índices computados localmente.
//   face-api.js corre detección de landmarks sobre canvas offscreen.
//   AudioContext procesa el mic en tiempo real sin guardar audio.
//
// MÉTRICAS — fenómenos observables con validación empírica (FACS/literatura):
//
// Los nombres describen lo que se mide, no un diagnóstico.
// Las asociaciones clínicas son de la literatura publicada (Ekman 1978+,
// Duchenne 1862, Nijenhuis 2004, neuroftalmología, psicofisiología).
//
//   cam_brow_furrow_episodes     AU4 corrugador activo — ceño fruncido
//                                lit: frustración, esfuerzo cognitivo, dolor (Ekman)
//   cam_brow_furrow_ms           tiempo total con ceño fruncido en sesión
//   cam_nose_wrinkle_episodes    AU9 elevador ala nariz — arruga nasal
//                                lit: expresión aversiva (Ekman)
//   cam_lip_compression_episodes AU23+AU24 orbicular — boca apretada
//                                lit: supresión emocional, control inhibitorio (Gross)
//   cam_lip_compression_max_ms   tensión labial máxima sostenida
//   cam_blink_rate_mean          parpadeos/minuto (norma: 15-20)
//                                lit: bajo=hiperfoco/Parkinson; alto=fatiga/stress
//   cam_blink_rate_cv            variabilidad del parpadeo
//   cam_blink_burst_count        ráfagas >3 en <2s
//                                lit: tic ocular, stress agudo
//   cam_genuine_smile_pct        AU6+AU12 — sonrisa de Duchenne (1862)
//                                lit: afecto positivo genuino, correlato parasimpático
//   cam_social_smile_pct         AU12 sin AU6 — sonrisa voluntaria
//                                lit: regulación social, diferente correlato fisiológico
//   cam_face_present_pct         fracción del tiempo con cara en frame
//   cam_face_absent_episodes     salidas del encuadre
//   cam_face_freeze_episodes     cara presente + landmarks inmóviles >3s
//                                lit: disociación (Nijenhuis), catatonía, ausencia epiléptica
//   cam_face_freeze_max_ms       freeze más largo
//   mic_ambient_db_mean          nivel sonoro ambiental (contexto de sesión)
//   mic_ambient_db_cv            variabilidad sonora
//   mic_speech_episodes          episodios de vocalización
//   mic_external_noise_count     picos de ruido externo >70dB
// ================================================================

(function() {
'use strict';

// ----------------------------------------------------------------
// CONSTANTES
// ----------------------------------------------------------------
var FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
var MODELS_URL   = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/';
var DETECT_MS    = 200;   // detección facial cada 200ms (5fps — suficiente, bajo CPU)
var FREEZE_MS    = 3000;  // landmarks quietos > 3s = episodio de freeze
var BLINK_MS     = 300;   // AU43 activo < 300ms = parpadeo
var NOISE_DB     = 70;    // dB sobre el que se cuenta como ruido externo

// ----------------------------------------------------------------
// ESTADO — vacío hasta que start() es llamado
// ----------------------------------------------------------------
var state = {
    // Consentimiento (seteado antes de start() por el portal de consentimiento)
    consent_cam: false,
    consent_mic: false,

    // Streams
    _stream_cam: null,
    _stream_mic: null,
    _video_el:   null,
    _canvas_el:  null,
    _detect_interval: null,
    _audio_ctx:  null,
    _analyser:   null,
    _mic_interval: null,

    // Acumuladores cámara
    frames_total: 0,
    frames_with_face: 0,
    face_absent_episodes: 0,
    _face_was_present: false,
    freeze_episodes: [],
    _last_landmarks: null,
    _freeze_start: null,

    // Action Units acumuladas
    AU4_episodes:   0,  _AU4_active: false, _AU4_start: null, AU4_duration_ms: 0,
    AU9_episodes:   0,
    AU23_episodes:  0,  _AU23_active: false, _AU23_start: null, AU23_max_ms: 0,
    blink_times:    [],  _blink_start: null,
    blink_bursts:   0,
    duchenne_frames: 0,
    social_smile_frames: 0,

    // Acumuladores micrófono
    mic_samples:     [],
    mic_speech_eps:  0, _in_speech: false,
    mic_noise_count: 0,

    // Tiempo
    _session_start: 0,

    active: false
};

// ----------------------------------------------------------------
// CONSENT — llamar antes de start()
// ----------------------------------------------------------------
function setConsent(cam, mic) {
    state.consent_cam = !!cam;
    state.consent_mic = !!mic;
}

// ----------------------------------------------------------------
// FACE-API LOADER — lazy, solo cuando se necesita
// ----------------------------------------------------------------
var _faceApiLoaded = false;
function loadFaceApi() {
    return new Promise(function(resolve, reject) {
        if (_faceApiLoaded && window.faceapi) { resolve(); return; }
        var s = document.createElement('script');
        s.src = FACE_API_CDN;
        s.onload = function() {
            // Cargar solo los modelos necesarios: landmarks + expresiones
            Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL)
            ]).then(function() {
                _faceApiLoaded = true;
                resolve();
            }).catch(reject);
        };
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

// ----------------------------------------------------------------
// CÁMARA — detección facial y Action Units
// ----------------------------------------------------------------
async function startCamera() {
    try {
        state._stream_cam = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, frameRate: 15 }
        });

        await loadFaceApi();

        // Crear elementos de video/canvas fuera del DOM (offscreen)
        state._video_el = document.createElement('video');
        state._video_el.srcObject = state._stream_cam;
        state._video_el.autoplay = true;
        state._video_el.muted = true;
        state._video_el.playsInline = true;
        state._video_el.width = 320;
        state._video_el.height = 240;

        state._canvas_el = document.createElement('canvas');
        state._canvas_el.width = 320;
        state._canvas_el.height = 240;

        await state._video_el.play();

        // Loop de detección a 5fps (cada 200ms)
        state._detect_interval = setInterval(detectFace, DETECT_MS);

    } catch(e) {
        console.warn('[agent-media] Camera init error:', e.message);
        state.consent_cam = false;
    }
}

async function detectFace() {
    if (!state.active || !state._video_el || !window.faceapi) return;
    try {
        var result = await faceapi
            .detectSingleFace(state._video_el, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks(true)
            .withFaceExpressions();

        state.frames_total++;
        var now = performance.now();

        if (!result) {
            // Sin cara en frame
            if (state._face_was_present) {
                state.face_absent_episodes++;
                state._face_was_present = false;
            }
            // Cerrar freeze si estaba activo (se fue del frame)
            if (state._freeze_start) {
                state._freeze_start = null;
                state._last_landmarks = null;
            }
            return;
        }

        state.frames_with_face++;
        state._face_was_present = true;

        // --- FREEZE detection (cara presente + landmarks quietos) ---
        var landmarks = result.landmarks.positions;
        if (state._last_landmarks) {
            var delta = landmarkDelta(landmarks, state._last_landmarks);
            if (delta < 1.5) {
                // Landmarks prácticamente inmóviles
                if (!state._freeze_start) state._freeze_start = now;
            } else {
                // Movimiento detectado — cerrar freeze si existía
                if (state._freeze_start) {
                    var freezeDur = Math.round(now - state._freeze_start);
                    if (freezeDur >= FREEZE_MS) {
                        state.freeze_episodes.push(freezeDur);
                    }
                    state._freeze_start = null;
                }
            }
        }
        state._last_landmarks = landmarks;

        // --- ACTION UNITS desde landmarks y expresiones ---
        var exps = result.expressions;
        var lm = landmarks;

        // AU4 — corrugador superciliar (ceño fruncido)
        // Proxy: distancia entre cejas vs línea base
        var browsClose = browsDistance(lm);
        if (browsClose > 0.7) {
            if (!state._AU4_active) {
                state._AU4_active = true;
                state._AU4_start = now;
                state.AU4_episodes++;
            }
        } else {
            if (state._AU4_active) {
                state.AU4_duration_ms += Math.round(now - state._AU4_start);
                state._AU4_active = false;
            }
        }

        // AU9 — elevación ala nariz (arruga nasal)
        // Proxy desde expresión 'disgusted' (comparte AU9+AU17)
        if (exps.disgusted > 0.3) state.AU9_episodes++;

        // AU23/AU24 — boca cerrada apretada (orbicular labios)
        // Proxy: apertura bucal muy pequeña
        var mouthOpen = mouthOpenness(lm);
        if (mouthOpen < 0.05) {
            if (!state._AU23_active) {
                state._AU23_active = true;
                state._AU23_start = now;
                state.AU23_episodes++;
            }
        } else {
            if (state._AU23_active) {
                var dur = Math.round(now - state._AU23_start);
                if (dur > state.AU23_max_ms) state.AU23_max_ms = dur;
                state._AU23_active = false;
            }
        }

        // AU43 — parpadeo (detección por ratio ojo)
        var eyeRatio = eyeAspectRatio(lm);
        if (eyeRatio < 0.2) {
            if (!state._blink_start) state._blink_start = now;
        } else {
            if (state._blink_start) {
                var blinkDur = now - state._blink_start;
                if (blinkDur < BLINK_MS) state.blink_times.push(now);
                state._blink_start = null;
            }
        }

        // Ráfagas de parpadeo: >3 parpadeos en <2s
        var recentBlinks = state.blink_times.filter(function(t){ return now - t < 2000; });
        if (recentBlinks.length >= 3 && (state.blink_times.length === 0 ||
            now - state.blink_times[state.blink_times.length - 1] > 2000)) {
            state.blink_bursts++;
        }

        // Sonrisa Duchenne (AU6+AU12) vs social (AU12 sin AU6)
        var isSmiling = exps.happy > 0.5;
        if (isSmiling) {
            var cheekRise = cheekRaiser(lm); // proxy AU6
            if (cheekRise > 0.6) state.duchenne_frames++;
            else state.social_smile_frames++;
        }

    } catch(e) {
        // Error silencioso — la detección puede fallar por frame oscuro, etc
    }
}

// --- Helpers de geometría facial ---
function landmarkDelta(a, b) {
    var sum = 0;
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) {
        sum += Math.abs(a[i].x - b[i].x) + Math.abs(a[i].y - b[i].y);
    }
    return sum / n;
}

function browsDistance(lm) {
    // Landmarks 19-23: ceja izquierda, 24-28: ceja derecha
    // Distancia horizontal entre los puntos internos de las cejas
    var leftInner  = lm[21] || {x:0,y:0};
    var rightInner = lm[22] || {x:0,y:0};
    var faceWidth  = Math.abs((lm[16] || {x:100}).x - (lm[0] || {x:0}).x) || 100;
    var dist = Math.sqrt(Math.pow(rightInner.x - leftInner.x, 2) +
                         Math.pow(rightInner.y - leftInner.y, 2));
    return 1 - (dist / faceWidth); // mayor = cejas más juntas
}

function mouthOpenness(lm) {
    // Landmarks 62 (labio sup central) y 66 (labio inf central)
    var top = lm[62] || {x:0,y:0};
    var bot = lm[66] || {x:0,y:0};
    var faceH = Math.abs((lm[8] || {y:100}).y - (lm[27] || {y:0}).y) || 100;
    return Math.abs(bot.y - top.y) / faceH;
}

function eyeAspectRatio(lm) {
    // EAR = (|p2-p6| + |p3-p5|) / (2*|p1-p4|) para ojo izquierdo
    var p1 = lm[36]||{x:0,y:0}, p2 = lm[37]||{x:0,y:0},
        p3 = lm[38]||{x:0,y:0}, p4 = lm[39]||{x:0,y:0},
        p5 = lm[40]||{x:0,y:0}, p6 = lm[41]||{x:0,y:0};
    var v1 = Math.abs(p2.y - p6.y), v2 = Math.abs(p3.y - p5.y);
    var h  = Math.abs(p1.x - p4.x) || 1;
    return (v1 + v2) / (2 * h);
}

function cheekRaiser(lm) {
    // Proxy AU6: mejillas suben cuando hay sonrisa genuina
    // Landmark 1-2 (malar derecho) vs posición relativa al ojo
    var cheek = lm[1]  || {y:0};
    var eye   = lm[36] || {y:0};
    var chin  = lm[8]  || {y:100};
    var faceH = Math.abs(chin.y - eye.y) || 1;
    return 1 - (Math.abs(cheek.y - eye.y) / faceH);
}

// ----------------------------------------------------------------
// MICRÓFONO — análisis de audio sin grabar
// ----------------------------------------------------------------
async function startMic() {
    try {
        state._stream_mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        state._audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
        var source = state._audio_ctx.createMediaStreamSource(state._stream_mic);
        state._analyser = state._audio_ctx.createAnalyser();
        state._analyser.fftSize = 256;
        source.connect(state._analyser);
        var bufLen = state._analyser.frequencyBinCount;
        var buf = new Uint8Array(bufLen);

        // Sampling cada 100ms
        state._mic_interval = setInterval(function() {
            if (!state.active) return;
            state._analyser.getByteFrequencyData(buf);
            // RMS → dB
            var sum = 0;
            for (var i = 0; i < bufLen; i++) sum += buf[i] * buf[i];
            var rms = Math.sqrt(sum / bufLen);
            var db  = rms > 0 ? 20 * Math.log10(rms / 255) + 90 : 0;
            state.mic_samples.push(+(db.toFixed(1)));
            // Vocalización: > 55dB sostenido
            if (db > 55) {
                if (!state._in_speech) { state._in_speech = true; state.mic_speech_eps++; }
            } else {
                state._in_speech = false;
            }
            // Ruido externo: pico > umbral
            if (db > NOISE_DB) state.mic_noise_count++;
        }, 100);

    } catch(e) {
        console.warn('[agent-media] Mic init error:', e.message);
        state.consent_mic = false;
    }
}

// ----------------------------------------------------------------
// AGENT INTERFACE
// ----------------------------------------------------------------
var agent = {
    setConsent: setConsent,

    start: async function() {
        if (!state.consent_cam && !state.consent_mic) return;
        state.active = true;
        state._session_start = performance.now();

        // Resetear acumuladores
        state.frames_total = 0; state.frames_with_face = 0;
        state.face_absent_episodes = 0; state._face_was_present = false;
        state.freeze_episodes = []; state._last_landmarks = null; state._freeze_start = null;
        state.AU4_episodes = 0; state._AU4_active = false; state.AU4_duration_ms = 0;
        state.AU9_episodes = 0;
        state.AU23_episodes = 0; state._AU23_active = false; state.AU23_max_ms = 0;
        state.blink_times = []; state._blink_start = null; state.blink_bursts = 0;
        state.duchenne_frames = 0; state.social_smile_frames = 0;
        state.mic_samples = []; state.mic_speech_eps = 0;
        state._in_speech = false; state.mic_noise_count = 0;

        if (state.consent_cam) await startCamera();
        if (state.consent_mic) await startMic();
    },

    collect: function() {
        var sessionMs = Math.round(performance.now() - state._session_start) || 1;

        // Cámara — métricas canónicas
        var facePresentPct  = state.frames_total > 0
            ? +(state.frames_with_face / state.frames_total).toFixed(3) : null;
        var blinkRate       = null, blinkCV = null;
        if (state.blink_times.length > 1) {
            var sessionMin = sessionMs / 60000;
            blinkRate = +(state.blink_times.length / sessionMin).toFixed(1);
            var intervals = [];
            for (var i = 1; i < state.blink_times.length; i++) {
                intervals.push(state.blink_times[i] - state.blink_times[i-1]);
            }
            var mean = intervals.reduce(function(a,b){return a+b;},0)/intervals.length;
            var sd   = Math.sqrt(intervals.map(function(v){return Math.pow(v-mean,2);})
                                          .reduce(function(a,b){return a+b;},0)/intervals.length);
            blinkCV = mean > 0 ? +(sd/mean).toFixed(3) : null;
        }
        var freezeMax = state.freeze_episodes.length > 0
            ? Math.max.apply(null, state.freeze_episodes) : 0;

        // Cierre de AUs que pueden estar activas al terminar
        var now = performance.now();
        if (state._AU4_active)  state.AU4_duration_ms += Math.round(now - state._AU4_start);
        if (state._AU23_active) {
            var d = Math.round(now - state._AU23_start);
            if (d > state.AU23_max_ms) state.AU23_max_ms = d;
        }

        // Micrófono
        var micMean = null, micCV = null;
        if (state.mic_samples.length > 0) {
            var msum = state.mic_samples.reduce(function(a,b){return a+b;},0);
            micMean = +(msum / state.mic_samples.length).toFixed(1);
            var msd  = Math.sqrt(state.mic_samples
                .map(function(v){return Math.pow(v-micMean,2);})
                .reduce(function(a,b){return a+b;},0) / state.mic_samples.length);
            micCV = micMean > 0 ? +(msd/micMean).toFixed(3) : null;
        }

        return {
            // Metadatos de consentimiento
            consent_cam: state.consent_cam,
            consent_mic: state.consent_mic,

            // CÁMARA — presencia
            cam_face_present_pct:       facePresentPct,
            cam_face_absent_episodes:   state.face_absent_episodes,
            cam_face_freeze_episodes:   state.freeze_episodes.length,
            cam_face_freeze_max_ms:     freezeMax,

            // CÁMARA — Action Units observables (sin etiquetas diagnósticas)
            cam_brow_furrow_episodes:    state.AU4_episodes,        // corrugador (ceño)
            cam_brow_furrow_ms:          state.AU4_duration_ms,     // tiempo con ceño
            cam_nose_wrinkle_episodes:   state.AU9_episodes,        // elevación ala nariz
            cam_lip_compression_episodes: state.AU23_episodes,       // boca apretada
            cam_lip_compression_max_ms:  state.AU23_max_ms,         // tensión labial máxima
            cam_blink_rate_mean:        blinkRate,
            cam_blink_rate_cv:          blinkCV,
            cam_blink_burst_count:      state.blink_bursts,
            cam_genuine_smile_pct:       state.frames_total > 0
                ? +(state.duchenne_frames / state.frames_total).toFixed(3) : null,
            cam_social_smile_pct:        state.frames_total > 0
                ? +(state.social_smile_frames / state.frames_total).toFixed(3) : null,

            // MICRÓFONO
            mic_ambient_db_mean:        micMean,
            mic_ambient_db_cv:          micCV,
            mic_speech_episodes:        state.mic_speech_eps,
            mic_external_noise_count:   state.mic_noise_count,

            // Raw para análisis diferido
            _raw_media: {
                frames_total:     state.frames_total,
                frames_with_face: state.frames_with_face,
                freeze_episodes:  state.freeze_episodes,
                blink_count:      state.blink_times.length,
                mic_samples_n:    state.mic_samples.length
            }
        };
    },

    stop: function() {
        // LIBERACIÓN COMPLETA — sin residuos en memoria ni streams activos
        state.active = false;

        // Detener interval de detección
        if (state._detect_interval) {
            clearInterval(state._detect_interval);
            state._detect_interval = null;
        }

        // Detener interval de micrófono
        if (state._mic_interval) {
            clearInterval(state._mic_interval);
            state._mic_interval = null;
        }

        // Liberar stream de cámara
        if (state._stream_cam) {
            state._stream_cam.getTracks().forEach(function(t){ t.stop(); });
            state._stream_cam = null;
        }

        // Liberar stream de micrófono
        if (state._stream_mic) {
            state._stream_mic.getTracks().forEach(function(t){ t.stop(); });
            state._stream_mic = null;
        }

        // Cerrar AudioContext
        if (state._audio_ctx) {
            state._audio_ctx.close().catch(function(){});
            state._audio_ctx = null;
            state._analyser = null;
        }

        // Limpiar elementos DOM temporales
        if (state._video_el) {
            state._video_el.srcObject = null;
            state._video_el = null;
        }
        state._canvas_el = null;
        state._last_landmarks = null;
    }
};

// Auto-registro — solo si ZYKOS está disponible
// agent-media NO se auto-registra en DOMContentLoaded:
// requiere consentimiento explícito previo via agent.setConsent()
if (typeof window !== 'undefined') {
    window.ZykosMediaAgent = agent;
}

})();

// Señal al engine
if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
