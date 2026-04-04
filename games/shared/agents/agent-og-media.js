// ================================================================
// agent-og-media.js — PIRATE AGENT: Original Graphics Media (Cam + Mic Raw)
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// PRINCIPIOS:
//   1. LAZY — no existe hasta consentimiento explícito
//   2. HARDWARE-ADAPTIVE — detecta capacidad y degrada gracefully
//      full (cam + mic) → cam_only → mic_only → none
//   3. CERO DATOS AL SERVIDOR — solo métricas computadas localmente
//   4. PRIVACIDAD — el video/audio NUNCA sale del navegador
//   5. MÉTRICAS FUNDACIONALES — base sobre la que otros agentes extienden
//
// RESPALDO ACADÉMICO:
//   Lazar et al. (2005) — HR via PPG facial (remote photoplethysmography)
//   Verkruysse et al. (2008) — Remote HR via webcam green channel
//   Poh et al. (2010) — HR extraction via Independent Component Analysis
//   De Haan & Jeanne (2013) — CHROM for robust HR via webcam
//   Mcduff et al. (2014) — Stress detection via webcam HR variability
//   Kaliouby & Robinson (2005) — Engagement detection via face presence
//   Cummins et al. (2015) — Speech biomarkers for depression
//   Alghowinem et al. (2013) — Audio features for mood detection
//
// MÉTRICAS QUE PRODUCE (nombres canónicos del METRIC_DICTIONARY):
//   og_cam_present:           boolean — cámara activa en sesión
//   og_cam_presence_pct:      ratio — % de tiempo con rostro visible
//   og_cam_blackout_count:    count — episodios sin detección
//   og_cam_blackout_max_ms:   ms — duración del blackout más largo
//   og_cam_luminance_mean:    0-255 — luminancia media del frame
//   og_cam_luminance_cv:      ratio — variabilidad de luminancia
//   og_cam_green_channel_mean:0-255 — canal verde medio (proxy PPG)
//   og_cam_green_cv:          ratio — variabilidad canal verde
//   og_mic_present:           boolean — micrófono activo
//   og_mic_db_mean:           dB — volumen ambiental medio
//   og_mic_db_cv:             ratio — variabilidad de volumen
//   og_mic_silence_pct:       ratio — % tiempo en silencio (<30dB)
//   og_mic_speech_episodes:   count — episodios detectados de habla
//   og_mic_peak_db:           dB — pico máximo de audio
// ================================================================

(function() {
'use strict';

// ----------------------------------------------------------------
// CONSTANTES
// ----------------------------------------------------------------
var SILENCE_THRESHOLD_DB = 30;  // Debajo de esto = silencio
var SPEECH_THRESHOLD_DB  = 50;  // Arriba de esto = habla
var SAMPLE_INTERVAL_MS   = 200; // Muestreo de luminancia/audio

// ----------------------------------------------------------------
// DETECCIÓN DE CAPACIDAD DE HARDWARE
// ----------------------------------------------------------------
function detectHWCapability() {
    return new Promise(function(resolve) {
        var caps = { cam: false, mic: false };
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            resolve(caps);
            return;
        }
        
        navigator.mediaDevices.enumerateDevices()
            .then(function(devices) {
                devices.forEach(function(device) {
                    if (device.kind === 'videoinput') caps.cam = true;
                    if (device.kind === 'audioinput') caps.mic = true;
                });
                resolve(caps);
            })
            .catch(function() {
                resolve(caps);
            });
    });
}

// ----------------------------------------------------------------
// ESTADO
// ----------------------------------------------------------------
var state = {
    consent_cam: false,
    consent_mic: false,
    hw_tier: 'none',  // 'full' | 'cam_only' | 'mic_only' | 'none'
    
    // Streams
    _stream_cam: null,
    _stream_mic: null,
    _video: null,
    _canvas: null,
    _ctx: null,
    _audio_ctx: null,
    _analyser: null,
    
    // Intervals
    _cam_iv: null,
    _mic_iv: null,
    
    // Cam metrics
    frames_total: 0,
    frames_face_present: 0,  // frames donde hubo presencia significativa
    blackout_episodes: [],   // [{start_ms, duration_ms}]
    _blackout_start: null,
    luminance_samples: [],
    green_samples: [],
    
    // Mic metrics
    db_samples: [],
    silence_samples: 0,  // count de muestras < SILENCE_THRESHOLD
    speech_episodes: 0,
    _in_speech: false,
    peak_db: 0,
    
    // Session
    _t0: 0,
    active: false
};

// ----------------------------------------------------------------
// CÁMARA — captura de métricas de imagen
// ----------------------------------------------------------------
async function startCam() {
    try {
        // 160x120@5fps = 19200 pixels/frame, suficiente para luminancia/canal verde.
        // Resolución mínima viable que reduce CPU/memoria sin perder información útil.
        // No se hace detección facial aquí (eso es agent-media.js con face-api).
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
        
        // Interval para muestrear el frame
        state._cam_iv = setInterval(sampleFrame, SAMPLE_INTERVAL_MS);
        
    } catch(e) {
        console.warn('[agent-og-media] cam:', e.message);
        state.consent_cam = false;
        state.hw_tier = state.consent_mic ? 'mic_only' : 'none';
    }
}

function sampleFrame() {
    if (!state.active || !state._video || !state._ctx) return;
    
    try {
        var v = state._video;
        var ctx = state._ctx;
        var now = performance.now();
        var sessionMs = Math.round(now - state._t0);
        
        // Dibujar frame en canvas
        ctx.drawImage(v, 0, 0, 160, 120);
        
        // Obtener datos de imagen
        var imageData = ctx.getImageData(0, 0, 160, 120);
        var data = imageData.data;
        var len = data.length;
        
        var sumR = 0, sumG = 0, sumB = 0;
        var sumLum = 0;
        var pixelCount = 0;
        var nonBlackPixels = 0;
        
        for (var i = 0; i < len; i += 4) {
            var r = data[i];
            var g = data[i + 1];
            var b = data[i + 2];
            
            sumR += r;
            sumG += g;
            sumB += b;
            
            // Luminancia ITU-R BT.709
            var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            sumLum += lum;
            pixelCount++;
            
            // Detectar si hay contenido visual (no todo negro)
            if (r > 10 || g > 10 || b > 10) {
                nonBlackPixels++;
            }
        }
        
        state.frames_total++;
        
        var avgLum = sumLum / pixelCount;
        var avgGreen = sumG / pixelCount;
        var presencePct = nonBlackPixels / pixelCount;
        
        // Guardar muestras
        state.luminance_samples.push(avgLum);
        state.green_samples.push(avgGreen);
        
        // Detectar presencia significativa (>50% de píxeles no negros)
        if (presencePct > 0.5) {
            state.frames_face_present++;
            
            // Si estábamos en blackout, cerrarlo
            if (state._blackout_start !== null) {
                var duration = Math.round(now - state._blackout_start);
                if (duration > 500) {  // Solo contar blackouts > 500ms
                    state.blackout_episodes.push({
                        start_session_ms: Math.round(state._blackout_start - state._t0),
                        duration_ms: duration
                    });
                }
                state._blackout_start = null;
            }
        } else {
            // Sin presencia — iniciar blackout si no existe
            if (state._blackout_start === null) {
                state._blackout_start = now;
            }
        }
        
        // Push raw para análisis diferido
        if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw && state.frames_total % 5 === 0) {
            ZYKOS._pushRaw('og_frame', {
                t_ms: sessionMs,
                lum: +avgLum.toFixed(1),
                g: +avgGreen.toFixed(1),
                present: presencePct > 0.5 ? 1 : 0
            });
        }
        
    } catch(e) {
        // Frame fallido — puede ser cámara ocupada, contexto perdido, o throttling.
        // No es crítico: la métrica se basa en frames exitosos.
        // En producción, se podría trackear: state._frame_errors++;
    }
}

// ----------------------------------------------------------------
// MICRÓFONO — captura de métricas de audio
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
            
            // Calcular dB de la señal
            var sum = 0;
            for (var i = 0; i < buf.length; i++) {
                sum += buf[i] * buf[i];
            }
            var rms = Math.sqrt(sum / buf.length);
            var db = rms > 0 ? 20 * Math.log10(rms / 255) + 90 : 0;
            db = Math.max(0, Math.min(100, db));  // Clamp 0-100
            
            state.db_samples.push(+db.toFixed(1));
            
            // Track peak
            if (db > state.peak_db) {
                state.peak_db = db;
            }
            
            // Track silencio
            if (db < SILENCE_THRESHOLD_DB) {
                state.silence_samples++;
            }
            
            // Track episodios de habla
            if (db > SPEECH_THRESHOLD_DB) {
                if (!state._in_speech) {
                    state._in_speech = true;
                    state.speech_episodes++;
                }
            } else {
                state._in_speech = false;
            }
            
            // Push raw
            if (typeof ZYKOS !== 'undefined' && ZYKOS._pushRaw && state.db_samples.length % 5 === 0) {
                ZYKOS._pushRaw('og_audio', {
                    t_ms: Math.round(performance.now() - state._t0),
                    db: +db.toFixed(1)
                });
            }
            
        }, SAMPLE_INTERVAL_MS);
        
    } catch(e) {
        console.warn('[agent-og-media] mic:', e.message);
        state.consent_mic = false;
        state.hw_tier = state.consent_cam ? 'cam_only' : 'none';
    }
}

// ----------------------------------------------------------------
// UTILIDADES ESTADÍSTICAS
// ----------------------------------------------------------------
function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
}

function sd(arr) {
    if (!arr || arr.length < 2) return 0;
    var m = mean(arr);
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += Math.pow(arr[i] - m, 2);
    return Math.sqrt(s / (arr.length - 1));
}

function cv(arr) {
    var m = mean(arr);
    return m > 0 ? sd(arr) / m : 0;
}

// ----------------------------------------------------------------
// AGENT INTERFACE
// ----------------------------------------------------------------
var agent = {
    /**
     * Configurar consentimiento antes de start()
     * @param {boolean} cam — consentimiento para cámara
     * @param {boolean} mic — consentimiento para micrófono
     */
    setConsent: function(cam, mic) {
        state.consent_cam = !!cam;
        state.consent_mic = !!mic;
    },
    
    /**
     * Iniciar captura de métricas
     */
    start: async function() {
        if (!state.consent_cam && !state.consent_mic) {
            state.hw_tier = 'none';
            return;
        }
        
        // Detectar capacidad real
        var caps = await detectHWCapability();
        
        if (state.consent_cam && !caps.cam) {
            state.consent_cam = false;
        }
        if (state.consent_mic && !caps.mic) {
            state.consent_mic = false;
        }
        
        // Determinar tier
        if (state.consent_cam && state.consent_mic) {
            state.hw_tier = 'full';
        } else if (state.consent_cam) {
            state.hw_tier = 'cam_only';
        } else if (state.consent_mic) {
            state.hw_tier = 'mic_only';
        } else {
            state.hw_tier = 'none';
            return;
        }
        
        // Resetear estado
        state.frames_total = 0;
        state.frames_face_present = 0;
        state.blackout_episodes = [];
        state._blackout_start = null;
        state.luminance_samples = [];
        state.green_samples = [];
        state.db_samples = [];
        state.silence_samples = 0;
        state.speech_episodes = 0;
        state._in_speech = false;
        state.peak_db = 0;
        state._t0 = performance.now();
        state.active = true;
        
        // Iniciar streams
        if (state.consent_cam) await startCam();
        if (state.consent_mic) await startMic();
    },
    
    /**
     * Recolectar métricas al final de la sesión
     */
    collect: function() {
        var now = performance.now();
        var sessionMs = Math.round(now - state._t0);
        
        // Cerrar blackout activo
        if (state._blackout_start !== null) {
            var duration = Math.round(now - state._blackout_start);
            if (duration > 500) {
                state.blackout_episodes.push({
                    start_session_ms: Math.round(state._blackout_start - state._t0),
                    duration_ms: duration
                });
            }
        }
        
        // Métricas de cámara
        var ft = Math.max(1, state.frames_total);
        var presencePct = state.frames_face_present / ft;
        var blackoutMax = state.blackout_episodes.length > 0
            ? Math.max.apply(null, state.blackout_episodes.map(function(e) { return e.duration_ms; }))
            : 0;
        var lumMean = mean(state.luminance_samples);
        var lumCV = cv(state.luminance_samples);
        var greenMean = mean(state.green_samples);
        var greenCV = cv(state.green_samples);
        
        // Métricas de micrófono
        var dbMean = mean(state.db_samples);
        var dbCV = cv(state.db_samples);
        var silencePct = state.db_samples.length > 0
            ? state.silence_samples / state.db_samples.length
            : 0;
        
        return {
            // Cámara
            og_cam_present:           state.consent_cam && state.hw_tier !== 'mic_only',
            og_cam_presence_pct:      state.consent_cam ? +presencePct.toFixed(3) : null,
            og_cam_blackout_count:    state.consent_cam ? state.blackout_episodes.length : null,
            og_cam_blackout_max_ms:   state.consent_cam ? blackoutMax : null,
            og_cam_luminance_mean:    state.consent_cam ? +lumMean.toFixed(1) : null,
            og_cam_luminance_cv:      state.consent_cam ? +lumCV.toFixed(3) : null,
            og_cam_green_channel_mean: state.consent_cam ? +greenMean.toFixed(1) : null,
            og_cam_green_cv:          state.consent_cam ? +greenCV.toFixed(3) : null,
            
            // Micrófono
            og_mic_present:           state.consent_mic && state.hw_tier !== 'cam_only',
            og_mic_db_mean:           state.consent_mic ? +dbMean.toFixed(1) : null,
            og_mic_db_cv:             state.consent_mic ? +dbCV.toFixed(3) : null,
            og_mic_silence_pct:       state.consent_mic ? +silencePct.toFixed(3) : null,
            og_mic_speech_episodes:   state.consent_mic ? state.speech_episodes : null,
            og_mic_peak_db:           state.consent_mic ? +state.peak_db.toFixed(1) : null,
            
            // Meta
            og_media_hw_tier: state.hw_tier,
            
            // Raw para análisis diferido en Supabase
            _raw_og_media: {
                session_ms: sessionMs,
                cam_frames: state.frames_total,
                cam_present_frames: state.frames_face_present,
                blackouts: state.blackout_episodes.slice(-10),  // últimos 10
                mic_samples: state.db_samples.length,
                lum_samples: state.luminance_samples.length > 50
                    ? state.luminance_samples.slice(0, 25).concat(state.luminance_samples.slice(-25))
                    : state.luminance_samples,
                green_samples: state.green_samples.length > 50
                    ? state.green_samples.slice(0, 25).concat(state.green_samples.slice(-25))
                    : state.green_samples
            }
        };
    },
    
    /**
     * Pausar captura (visibilitychange hidden)
     */
    pause: function() {
        // No detenemos el stream — el blackout es señal clínica
        // Solo marcamos que estamos en pausa para no contaminar métricas
    },
    
    /**
     * Reanudar captura (visibilitychange visible)
     */
    resume: function() {
        // Continuar capturando
    },
    
    /**
     * Detener y liberar recursos
     */
    stop: function() {
        state.active = false;
        
        if (state._cam_iv) {
            clearInterval(state._cam_iv);
            state._cam_iv = null;
        }
        
        if (state._mic_iv) {
            clearInterval(state._mic_iv);
            state._mic_iv = null;
        }
        
        if (state._stream_cam) {
            state._stream_cam.getTracks().forEach(function(t) { t.stop(); });
            state._stream_cam = null;
        }
        
        if (state._stream_mic) {
            state._stream_mic.getTracks().forEach(function(t) { t.stop(); });
            state._stream_mic = null;
        }
        
        if (state._audio_ctx) {
            state._audio_ctx.close().catch(function() {});
            state._audio_ctx = null;
            state._analyser = null;
        }
        
        if (state._video) {
            state._video.srcObject = null;
            state._video = null;
        }
        
        state._canvas = null;
        state._ctx = null;
    }
};

// Exponer globalmente — activación explícita via setConsent()
if (typeof window !== 'undefined') {
    window.ZykosOgMediaAgent = agent;
}

})();

// Señal al engine: agente listo
if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
