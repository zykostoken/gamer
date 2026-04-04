// ================================================================
// agent-media.js — PIRATE AGENT: Cámara + Micrófono + Humor Facial
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// PRINCIPIOS:
//   1. LAZY — no existe hasta consentimiento explícito
//   2. HARDWARE-ADAPTIVE — detecta capacidad y baja gracefully
//      full (cam 5fps + mic) → low (cam 2fps) → mic_only → none
//   3. INTEGRADO — métricas van al mismo payload que el resto
//   4. CERO DATOS AL SERVIDOR — solo índices computados localmente
//   5. SERIE TEMPORAL DE HUMOR — cada evento afectivo timestampeado
//      permite cruzar "¿sonrió cuando acertó?" contra eficacia
//
// RESPALDO ACADÉMICO:
//   Ekman & Friesen (1978) FACS — Action Units faciales
//   Duchenne (1862) — sonrisa genuina AU6+AU12
//   Gross (2002) — supresión emocional y orbicular labios
//   Nijenhuis (2004) — freeze facial y disociación
//   Russell (1980) — modelo circumplejo del afecto (valencia/arousal)
//   Cohn & Ekman (2005) — AU temporal dynamics
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

// Intervalo mínimo entre eventos de humor en la timeline (ms)
// Evita flooding — un evento por segundo como máximo por tipo
var HUMOR_MIN_INTERVAL_MS = 1000;

// ----------------------------------------------------------------
// DETECCIÓN DE CAPACIDAD DE HARDWARE
// ----------------------------------------------------------------
function detectHWTier() {
    return new Promise(function(resolve) {
        var frames = 0, start = performance.now();
        function countFrame() {
            frames++;
            if (performance.now() - start < 500) requestAnimationFrame(countFrame);
            else {
                var fps = frames / 0.5;
                if (fps >= 45) resolve('full');
                else if (fps >= 25) resolve('low');
                else resolve('degraded');
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
    detect_interval_ms: 200,

    _stream_cam: null,
    _stream_mic: null,
    _video:      null,
    _detect_iv:  null,
    _audio_ctx:  null,
    _analyser:   null,
    _mic_iv:     null,

    // Acumuladores cámara
    frames_total: 0,
    frames_face:  0,
    face_absent_eps: 0,
    _face_was:    false,
    freeze_eps:   [],
    _lm_last:     null,
    _freeze_start: null,

    // AUs
    AU4_eps: 0, _AU4_on: false, _AU4_t: null, AU4_ms: 0,
    AU9_eps: 0,
    AU23_eps: 0, _AU23_on: false, _AU23_t: null, AU23_max: 0,
    blink_ts: [], _blink_t: null, blink_bursts: 0, _last_burst_count: 0,
    duchenne: 0, social_smile: 0,

    // ============================================================
    // SERIE TEMPORAL DE HUMOR — núcleo del cruce con eficacia
    // Cada evento: { t_session_ms, type, duration_ms, intensity }
    // type: 'genuine_smile' | 'social_smile' | 'brow_furrow' |
    //       'lip_compression' | 'nose_wrinkle' | 'freeze'
    // ============================================================
    humor_timeline: [],

    // Estado de humor activo para calcular duración de episodios
    _humor_active: {
        genuine_smile:   null,  // timestamp de inicio
        social_smile:    null,
        brow_furrow:     null,
        lip_compression: null,
        nose_wrinkle:    null
    },

    // Última vez que se emitió cada tipo (anti-flood)
    _humor_last_emit: {
        genuine_smile:   0,
        social_smile:    0,
        brow_furrow:     0,
        lip_compression: 0,
        nose_wrinkle:    0
    },

    // Correlación humor-rendimiento: los juegos reportan eventos
    // de acierto/error via reportGameEvent() — el agente los cruza
    // con el humor activo en ese momento
    performance_events: [],  // { t_session_ms, type: 'hit'|'error'|'level_up', humor_at_moment }

    // Micrófono
    mic_db: [], speech_eps: 0, _in_speech: false, noise_count: 0,

    _t0: 0,
    active: false
};

// ----------------------------------------------------------------
// INTERFAZ PÚBLICA para que los juegos reporten eventos
// El juego llama ZykosMediaAgent.reportGameEvent('hit') cuando
// el paciente acierta, para cruzar con el humor activo
// ----------------------------------------------------------------
function reportGameEvent(type) {
    if (!state.active || !state.consent_cam) return;
    var sessionMs = Math.round(performance.now() - state._t0);
    var currentHumor = getCurrentHumorState();
    state.performance_events.push({
        t_session_ms:   sessionMs,
        event_type:     type,  // 'hit' | 'error' | 'level_up' | 'level_fail'
        humor_at_moment: currentHumor
    });
}

// Devuelve el estado de humor en el momento actual
function getCurrentHumorState() {
    return {
        genuine_smile:   state._humor_active.genuine_smile !== null,
        social_smile:    state._humor_active.social_smile  !== null,
        brow_furrow:     state._humor_active.brow_furrow   !== null,
        lip_compression: state._humor_active.lip_compression !== null,
        nose_wrinkle:    state._humor_active.nose_wrinkle  !== null,
        freeze_active:   state._freeze_start !== null
    };
}

// Emitir evento en la timeline (con control anti-flood)
function emitHumorEvent(type, startMs, endMs, intensity) {
    var now = performance.now();
    if (now - state._humor_last_emit[type] < HUMOR_MIN_INTERVAL_MS) return;
    state._humor_last_emit[type] = now;
    state.humor_timeline.push({
        t_session_ms:  startMs,
        duration_ms:   endMs - startMs,
        type:          type,
        intensity:     +(intensity || 0).toFixed(3)
    });
}

// ----------------------------------------------------------------
// FACE-API — carga lazy
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
        var sessionMs = Math.round(now - state._t0);

        if (!r) {
            if (state._face_was) { state.face_absent_eps++; state._face_was = false; }
            if (state._freeze_start) { state._freeze_start = null; state._lm_last = null; }
            // Cerrar todos los episodios de humor activos
            closeAllHumorEpisodes(sessionMs);
            return;
        }

        state.frames_face++;
        state._face_was = true;
        var lm = r.landmarks.positions;
        var ex = r.expressions;

        // FREEZE — landmarks quietos (proxy de rigidez/ausencia)
        if (state._lm_last) {
            var delta = lmDelta(lm, state._lm_last);
            if (delta < 1.5) {
                if (!state._freeze_start) state._freeze_start = now;
            } else {
                if (state._freeze_start) {
                    var fd = Math.round(now - state._freeze_start);
                    if (fd >= FREEZE_MS) {
                        state.freeze_eps.push(fd);
                        state.humor_timeline.push({
                            t_session_ms: Math.round(state._freeze_start - state._t0),
                            duration_ms:  fd,
                            type:         'freeze',
                            intensity:    Math.min(1, fd / 10000)
                        });
                    }
                    state._freeze_start = null;
                }
            }
        }
        state._lm_last = lm;

        // --------------------------------------------------------
        // ACTION UNITS — detección y registro en timeline
        // --------------------------------------------------------

        // AU4 — corrugador superciliar (ceño fruncido)
        // Lit: esfuerzo cognitivo, frustración (Ekman 1978)
        var brows = browsGap(lm);
        if (brows > 0.65) {
            if (!state._humor_active.brow_furrow) {
                state._humor_active.brow_furrow = now;
                state.AU4_eps++;
                if (!state._AU4_on) { state._AU4_on = true; state._AU4_t = now; }
            }
        } else {
            if (state._humor_active.brow_furrow) {
                var dur = Math.round(now - state._humor_active.brow_furrow);
                emitHumorEvent('brow_furrow',
                    Math.round(state._humor_active.brow_furrow - state._t0),
                    sessionMs, brows);
                state._humor_active.brow_furrow = null;
                if (state._AU4_on) { state.AU4_ms += dur; state._AU4_on = false; }
            }
        }

        // AU9 — elevador ala nariz (aversión)
        if (ex.disgusted > 0.3) {
            if (!state._humor_active.nose_wrinkle) {
                state._humor_active.nose_wrinkle = now;
                state.AU9_eps++;
            }
        } else {
            if (state._humor_active.nose_wrinkle) {
                emitHumorEvent('nose_wrinkle',
                    Math.round(state._humor_active.nose_wrinkle - state._t0),
                    sessionMs, ex.disgusted);
                state._humor_active.nose_wrinkle = null;
            }
        }

        // AU23/24 — orbicular labios (boca apretada)
        // Lit: supresión emocional, control inhibitorio (Gross 2002)
        var mouth = mouthOpen(lm);
        if (mouth < 0.05) {
            if (!state._humor_active.lip_compression) {
                state._humor_active.lip_compression = now;
                state.AU23_eps++;
                if (!state._AU23_on) { state._AU23_on = true; state._AU23_t = now; }
            }
        } else {
            if (state._humor_active.lip_compression) {
                var ld = Math.round(now - state._humor_active.lip_compression);
                if (ld > state.AU23_max) state.AU23_max = ld;
                emitHumorEvent('lip_compression',
                    Math.round(state._humor_active.lip_compression - state._t0),
                    sessionMs, 1 - mouth);
                state._humor_active.lip_compression = null;
                if (state._AU23_on) { state._AU23_on = false; }
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
        var recent = state.blink_ts.filter(function(t){ return now - t < 2000; });
        if (recent.length >= 3 && recent.length > (state._last_burst_count || 0)) {
            state.blink_bursts++;
            state._last_burst_count = recent.length;
        } else if (recent.length === 0) {
            state._last_burst_count = 0;
        }

        // SONRISA — Duchenne vs social
        // Lit: Duchenne genuina = AU6+AU12 con correlato parasimpático (Duchenne 1862)
        //      Diferencia fisiológica documentada vs sonrisa social/voluntaria
        if (ex.happy > 0.5) {
            var chk = cheekUp(lm);
            if (chk > 0.55) {
                // Sonrisa genuina (Duchenne)
                if (!state._humor_active.genuine_smile) {
                    state._humor_active.genuine_smile = now;
                    state.duchenne++;
                }
                if (state._humor_active.social_smile) {
                    // Transición social → genuina
                    emitHumorEvent('social_smile',
                        Math.round(state._humor_active.social_smile - state._t0),
                        sessionMs, ex.happy);
                    state._humor_active.social_smile = null;
                }
            } else {
                // Sonrisa social (voluntaria)
                if (!state._humor_active.social_smile) {
                    state._humor_active.social_smile = now;
                    state.social_smile++;
                }
                if (state._humor_active.genuine_smile) {
                    emitHumorEvent('genuine_smile',
                        Math.round(state._humor_active.genuine_smile - state._t0),
                        sessionMs, ex.happy * chk);
                    state._humor_active.genuine_smile = null;
                }
            }
        } else {
            // No hay sonrisa — cerrar los activos
            if (state._humor_active.genuine_smile) {
                emitHumorEvent('genuine_smile',
                    Math.round(state._humor_active.genuine_smile - state._t0),
                    sessionMs, ex.happy);
                state._humor_active.genuine_smile = null;
            }
            if (state._humor_active.social_smile) {
                emitHumorEvent('social_smile',
                    Math.round(state._humor_active.social_smile - state._t0),
                    sessionMs, ex.happy);
                state._humor_active.social_smile = null;
            }
        }

    } catch(e) { /* frame fallido — silencioso */ }
}

function closeAllHumorEpisodes(sessionMs) {
    var types = Object.keys(state._humor_active);
    types.forEach(function(type) {
        if (state._humor_active[type]) {
            emitHumorEvent(type,
                Math.round(state._humor_active[type] - state._t0),
                sessionMs, 0);
            state._humor_active[type] = null;
        }
    });
}

// Geometría facial — landmarks 68 puntos
function lmDelta(a, b) {
    var s=0, n=Math.min(a.length,b.length);
    for (var i=0;i<n;i++) s+=Math.abs(a[i].x-b[i].x)+Math.abs(a[i].y-b[i].y);
    return s/n;
}
function browsGap(lm) {
    var l=lm[21]||{x:0,y:0}, r=lm[22]||{x:0,y:0};
    var w=Math.abs((lm[16]||{x:100}).x-(lm[0]||{x:0}).x)||100;
    return 1-(Math.sqrt(Math.pow(r.x-l.x,2)+Math.pow(r.y-l.y,2))/w);
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
    var c=lm[1]||{y:0},e=lm[36]||{y:0},chin=lm[8]||{y:100};
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
            var sum=0;
            for (var i=0;i<buf.length;i++) sum+=buf[i]*buf[i];
            var db = sum>0 ? 20*Math.log10(Math.sqrt(sum/buf.length)/255)+90 : 0;
            state.mic_db.push(+(db.toFixed(1)));
            if (db > SPEECH_DB) {
                if (!state._in_speech) { state._in_speech=true; state.speech_eps++; }
            } else { state._in_speech=false; }
            if (db > NOISE_DB) state.noise_count++;
        }, 100);
    } catch(e) {
        console.warn('[agent-media] mic:', e.message);
        state.consent_mic = false;
    }
}

// ----------------------------------------------------------------
// ANÁLISIS DE CORRELACIÓN HUMOR-RENDIMIENTO
// Cómputo local de si el paciente sonrió durante los aciertos
// Produce índices de correlación para el dashboard longitudinal
// ----------------------------------------------------------------
function computeAffectPerformanceCorrelation() {
    var events = state.performance_events;
    if (events.length === 0) return null;

    var hits   = events.filter(function(e){ return e.event_type === 'hit'; });
    var errors = events.filter(function(e){ return e.event_type === 'error'; });

    // Porcentaje de aciertos con sonrisa genuina activa
    var hits_with_smile = hits.filter(function(e){
        return e.humor_at_moment.genuine_smile;
    }).length;
    var smile_during_hits_pct = hits.length > 0
        ? +(hits_with_smile / hits.length).toFixed(3) : null;

    // Porcentaje de errores con ceño fruncido activo
    var errors_with_brow = errors.filter(function(e){
        return e.humor_at_moment.brow_furrow;
    }).length;
    var brow_during_errors_pct = errors.length > 0
        ? +(errors_with_brow / errors.length).toFixed(3) : null;

    // Porcentaje de errores con boca apretada (supresión emocional post-error)
    var errors_with_lip = errors.filter(function(e){
        return e.humor_at_moment.lip_compression;
    }).length;
    var lip_during_errors_pct = errors.length > 0
        ? +(errors_with_lip / errors.length).toFixed(3) : null;

    // Reactividad afectiva: ¿hay diferencia en el estado facial
    // entre momentos de acierto vs error?
    // > 0: más expresividad en aciertos
    // < 0: más expresividad en errores
    // ~ 0: no hay correlación (afecto plano o independiente del rendimiento)
    var smile_hit_ratio  = hits.length > 0
        ? hits_with_smile / hits.length : 0;
    var smile_error_ratio = errors.length > 0
        ? errors.filter(function(e){ return e.humor_at_moment.genuine_smile; }).length / errors.length : 0;
    var affect_reactivity = +(smile_hit_ratio - smile_error_ratio).toFixed(3);

    return {
        smile_during_hits_pct:    smile_during_hits_pct,
        brow_during_errors_pct:   brow_during_errors_pct,
        lip_during_errors_pct:    lip_during_errors_pct,
        affect_reactivity:        affect_reactivity,
        // Clínico: > 0.3 = afecto reactivo al rendimiento (sano)
        //          ~ 0   = afecto plano independiente del resultado
        //          < -0.1 = sonríe más en los errores (raro, requiere atención)
        hits_total:   hits.length,
        errors_total: errors.length
    };
}

// ----------------------------------------------------------------
// AGENT INTERFACE
// ----------------------------------------------------------------
var agent = {
    setConsent: function(cam, mic) {
        state.consent_cam = !!cam;
        state.consent_mic = !!mic;
    },

    // Los juegos llaman esto al registrar un acierto o error
    // para cruzar con el humor facial activo en ese momento
    reportGameEvent: reportGameEvent,

    start: async function() {
        if (!state.consent_cam && !state.consent_mic) return;

        var tier = await detectHWTier();
        if (tier === 'degraded' && !state.consent_mic) { state.hw_tier='none'; return; }
        if (tier === 'degraded') { state.hw_tier='mic_only'; state.consent_cam=false; }
        else if (tier === 'low') { state.hw_tier='low'; state.detect_interval_ms=500; }
        else                     { state.hw_tier='full'; state.detect_interval_ms=200; }

        // Resetear todo
        Object.assign(state, {
            frames_total:0, frames_face:0, face_absent_eps:0, _face_was:false,
            freeze_eps:[], _lm_last:null, _freeze_start:null,
            AU4_eps:0, _AU4_on:false, AU4_ms:0,
            AU9_eps:0, AU23_eps:0, _AU23_on:false, AU23_max:0,
            blink_ts:[], _blink_t:null, blink_bursts:0, _last_burst_count:0,
            duchenne:0, social_smile:0,
            humor_timeline: [],
            performance_events: [],
            mic_db:[], speech_eps:0, _in_speech:false, noise_count:0,
            _t0: performance.now(), active: true
        });
        // Resetear humor activo
        Object.keys(state._humor_active).forEach(function(k){ state._humor_active[k]=null; });
        Object.keys(state._humor_last_emit).forEach(function(k){ state._humor_last_emit[k]=0; });

        if (state.consent_cam && state.hw_tier !== 'mic_only') await startCam();
        if (state.consent_mic && state.hw_tier !== 'cam_only') await startMic();
    },

    collect: function() {
        var now = performance.now();
        var sessionMs = Math.round(now - state._t0);

        // Cerrar episodios activos
        closeAllHumorEpisodes(sessionMs);
        if (state._AU4_on)  state.AU4_ms += Math.round(now - state._AU4_t);
        if (state._AU23_on) {
            var d=Math.round(now-state._AU23_t);
            if(d>state.AU23_max) state.AU23_max=d;
        }
        if (state._freeze_start) {
            var fd=Math.round(now-state._freeze_start);
            if(fd>=FREEZE_MS) {
                state.freeze_eps.push(fd);
                state.humor_timeline.push({
                    t_session_ms: Math.round(state._freeze_start-state._t0),
                    duration_ms: fd, type:'freeze', intensity: Math.min(1,fd/10000)
                });
            }
        }

        var sessionMin = (now - state._t0) / 60000 || 1;
        var ft = state.frames_total || 1;

        // Parpadeo
        var blinkRate=null, blinkCV=null;
        if (state.blink_ts.length > 1) {
            blinkRate = +(state.blink_ts.length/sessionMin).toFixed(1);
            var ivs=[];
            for(var i=1;i<state.blink_ts.length;i++) ivs.push(state.blink_ts[i]-state.blink_ts[i-1]);
            var mn=ivs.reduce(function(a,b){return a+b;},0)/ivs.length;
            var sd=Math.sqrt(ivs.map(function(v){return Math.pow(v-mn,2);})
                               .reduce(function(a,b){return a+b;},0)/ivs.length);
            blinkCV = mn>0 ? +(sd/mn).toFixed(3) : null;
        }

        // Micrófono
        var micMean=null, micCV=null;
        if (state.mic_db.length > 0) {
            micMean=+(state.mic_db.reduce(function(a,b){return a+b;},0)/state.mic_db.length).toFixed(1);
            var msd=Math.sqrt(state.mic_db.map(function(v){return Math.pow(v-micMean,2);})
                                          .reduce(function(a,b){return a+b;},0)/state.mic_db.length);
            micCV = micMean>0 ? +(msd/micMean).toFixed(3) : null;
        }

        var freezeMax = state.freeze_eps.length>0 ? Math.max.apply(null,state.freeze_eps) : 0;

        // Correlación humor-rendimiento
        var affectCorr = computeAffectPerformanceCorrelation();

        return {
            consent_cam:     state.consent_cam,
            consent_mic:     state.consent_mic,
            media_hw_tier:   state.hw_tier,

            // Presencia
            cam_face_present_pct:      state.consent_cam ? +(state.frames_face/ft).toFixed(3) : null,
            cam_face_absent_episodes:  state.consent_cam ? state.face_absent_eps : null,
            cam_face_freeze_episodes:  state.consent_cam ? state.freeze_eps.length : null,
            cam_face_freeze_max_ms:    state.consent_cam ? freezeMax : null,

            // Expresión (Ekman 1978, Duchenne 1862, Gross 2002)
            cam_brow_furrow_episodes:  state.consent_cam ? state.AU4_eps  : null,
            cam_brow_furrow_ms:        state.consent_cam ? state.AU4_ms   : null,
            cam_nose_wrinkle_episodes: state.consent_cam ? state.AU9_eps  : null,
            cam_lip_compression_episodes: state.consent_cam ? state.AU23_eps : null,
            cam_lip_compression_max_ms:   state.consent_cam ? state.AU23_max : null,
            cam_blink_rate_mean:       state.consent_cam ? blinkRate : null,
            cam_blink_rate_cv:         state.consent_cam ? blinkCV   : null,
            cam_blink_burst_count:     state.consent_cam ? state.blink_bursts : null,
            cam_genuine_smile_pct:     state.consent_cam ? +(state.duchenne/ft).toFixed(3) : null,
            cam_social_smile_pct:      state.consent_cam ? +(state.social_smile/ft).toFixed(3) : null,

            // Correlación humor-rendimiento — el núcleo del cruce
            // Lit: Russell (1980) afecto circunflejo, Cohn & Ekman (2005)
            affect_smile_during_hits_pct:   affectCorr ? affectCorr.smile_during_hits_pct  : null,
            affect_brow_during_errors_pct:  affectCorr ? affectCorr.brow_during_errors_pct : null,
            affect_lip_during_errors_pct:   affectCorr ? affectCorr.lip_during_errors_pct  : null,
            affect_reactivity:              affectCorr ? affectCorr.affect_reactivity       : null,
            // affect_reactivity > 0.3: afecto reactivo al rendimiento (sano, comprometido)
            // affect_reactivity ~ 0:   afecto independiente del resultado (plano, disociado?)
            // affect_reactivity < -0.1: patrón atípico (clínicamente relevante)

            // Micrófono
            mic_ambient_db_mean:       state.consent_mic ? micMean : null,
            mic_ambient_db_cv:         state.consent_mic ? micCV   : null,
            mic_speech_episodes:       state.consent_mic ? state.speech_eps  : null,
            mic_external_noise_count:  state.consent_mic ? state.noise_count : null,

            // Raw para análisis diferido en Supabase
            _raw_humor_timeline:      state.consent_cam ? state.humor_timeline.slice()  : null,
            _raw_performance_events:  state.consent_cam ? state.performance_events.slice() : null
        };
    },

    stop: function() {
        state.active = false;
        if (state._detect_iv)  { clearInterval(state._detect_iv);  state._detect_iv=null; }
        if (state._mic_iv)     { clearInterval(state._mic_iv);     state._mic_iv=null; }
        if (state._stream_cam) { state._stream_cam.getTracks().forEach(function(t){t.stop();}); state._stream_cam=null; }
        if (state._stream_mic) { state._stream_mic.getTracks().forEach(function(t){t.stop();}); state._stream_mic=null; }
        if (state._audio_ctx)  { state._audio_ctx.close().catch(function(){}); state._audio_ctx=null; state._analyser=null; }
        if (state._video)      { state._video.srcObject=null; state._video=null; }
        state._lm_last = null;
    }
};

// Exponer globalmente — activación explícita via setConsent()
if (typeof window !== 'undefined') window.ZykosMediaAgent = agent;

})();

if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zykos:agents-ready'));
}
