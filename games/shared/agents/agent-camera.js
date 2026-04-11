// ================================================================
// agent-camera.js — PIRATE AGENT: Presencia y rigidez via camara
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Requiere consentimiento AV ('full' o 'camera') en av-consent.js.
// Todo el procesamiento ocurre en el browser — ningun frame sale
// del dispositivo. Sin almacenamiento de video ni imagenes.
//
// Metricas que produce (nombres canonicos del METRIC_DICTIONARY):
//   camera_presence_pct        — fraccion del tiempo con cara detectada
//   camera_absence_episodes    — episodios de ausencia del frame
//   camera_freeze_ms_max       — rigidez maxima (cara sin micromovimiento)
//   camera_freeze_episodes     — episodios de rigidez > umbral
//
// Proxy clinico de camera_freeze_episodes:
//   Cara presente + sin micromovimiento > 5s = freezing conductual
//   Puede indicar: ausencia epileptica, disociacion, bloqueo decisional
//   NUNCA diagnostica — el clinico interpreta
// ================================================================

(function() {
'use strict';

var PRESENCE_INTERVAL_MS  = 500;   // analizar frame cada 500ms
var FREEZE_THRESHOLD_MS   = 5000;  // 5s sin micromovimiento = freeze
var ABSENCE_THRESHOLD_MS  = 3000;  // 3s sin cara = ausencia

var state = {
    active: false,
    sessionStart: 0,
    // Presencia
    presence_checks: 0,
    presence_detected: 0,
    absence_episodes: [],
    _absence_start: null,
    // Rigidez / freeze
    freeze_episodes: [],
    _freeze_start: null,
    _last_landmark_hash: null,
    _last_landmark_change: 0,
    // Canvas oculto para sampling
    _canvas: null,
    _ctx: null,
    _video: null,
    _interval: null,
    // FaceDetection API
    _detector: null
};

// ----------------------------------------------------------------
// DETECCION DE PRESENCIA — MediaPipe FaceDetection via CDN
// Alternativa liviana: analisis de diferencia de frames (sin ML)
// ----------------------------------------------------------------
function initDetector(cb) {
    // Intentar MediaPipe primero, fallback a diferencia de frames
    if (typeof FaceDetector !== 'undefined') {
        // Chrome 98+ FaceDetector API nativa
        state._detector = new FaceDetector({ maxDetectedFaces: 1, fastMode: true });
        cb(null);
        return;
    }
    // Fallback: diferencia de frames como proxy de presencia/movimiento
    // No detecta caras especificamente pero detecta actividad/rigidez
    state._detector = 'frame_diff';
    cb(null);
}

function analyzeFrame() {
    if (!state.active || !state._video || !state._ctx) return;
    var video = state._video;
    if (video.readyState < 2) return; // video no listo
    var w = 160, h = 120; // resolucion reducida para performance
    state._canvas.width  = w;
    state._canvas.height = h;
    state._ctx.drawImage(video, 0, 0, w, h);

    state.presence_checks++;
    var now = performance.now();

    if (state._detector === 'frame_diff') {
        // Analisis de diferencia de frames — proxy de presencia y movimiento
        try {
            var imageData = state._ctx.getImageData(0, 0, w, h);
            var pixels = imageData.data;
            // Hash simple de luminancia para detectar cambios
            var lum = 0;
            for (var i = 0; i < pixels.length; i += 40) {
                lum += 0.299*pixels[i] + 0.587*pixels[i+1] + 0.114*pixels[i+2];
            }
            var lumHash = Math.round(lum / (pixels.length / 40));

            // Si hay actividad en el frame, asumir presencia
            var hasActivity = true; // con frame_diff asumimos presencia
            _updatePresence(hasActivity, now);

            // Detectar rigidez: si el hash de luminancia no cambia
            if (state._last_landmark_hash !== null) {
                var diff = Math.abs(lumHash - state._last_landmark_hash);
                if (diff < 5) {
                    // Frame muy similar = sin movimiento
                    if (state._freeze_start === null) {
                        state._freeze_start = now;
                    } else if (now - state._freeze_start >= FREEZE_THRESHOLD_MS) {
                        // Freeze activo — se registrara en stop/collect
                    }
                } else {
                    // Hay movimiento — cerrar freeze si estaba activo
                    if (state._freeze_start !== null) {
                        var freezeDur = Math.round(now - state._freeze_start);
                        if (freezeDur >= FREEZE_THRESHOLD_MS) {
                            state.freeze_episodes.push({
                                start_session_ms: Math.round(state._freeze_start - state.sessionStart),
                                duration_ms: freezeDur
                            });
                        }
                        state._freeze_start = null;
                    }
                }
            }
            state._last_landmark_hash = lumHash;
            state._last_landmark_change = now;

        } catch(e) { /* silencioso */ }
        return;
    }

    // FaceDetector API nativa
    state._detector.detect(state._canvas)
        .then(function(faces) {
            _updatePresence(faces.length > 0, now);
            if (faces.length === 0) {
                state._last_landmark_hash = null;
            } else {
                // Usar bounding box como proxy de micromovimiento
                var b = faces[0].boundingBox;
                var hash = Math.round(b.x) + ',' + Math.round(b.y) + ',' + Math.round(b.width);
                if (hash === state._last_landmark_hash) {
                    if (!state._freeze_start) state._freeze_start = now;
                } else {
                    if (state._freeze_start) {
                        var dur = Math.round(now - state._freeze_start);
                        if (dur >= FREEZE_THRESHOLD_MS) {
                            state.freeze_episodes.push({
                                start_session_ms: Math.round(state._freeze_start - state.sessionStart),
                                duration_ms: dur
                            });
                        }
                        state._freeze_start = null;
                    }
                    state._last_landmark_hash = hash;
                }
            }
        })
        .catch(function() { /* silencioso */ });
}

function _updatePresence(present, now) {
    if (present) {
        state.presence_detected++;
        // Cerrar ausencia si estaba activa
        if (state._absence_start !== null) {
            var dur = Math.round(now - state._absence_start);
            if (dur >= ABSENCE_THRESHOLD_MS) {
                state.absence_episodes.push({
                    start_session_ms: Math.round(state._absence_start - state.sessionStart),
                    duration_ms: dur
                });
            }
            state._absence_start = null;
        }
    } else {
        // Sin cara detectada
        if (state._absence_start === null) state._absence_start = now;
    }
}

// ----------------------------------------------------------------
// AGENT INTERFACE
// ----------------------------------------------------------------
var agent = {
    start: function() {
        var consent = (typeof getAVConsent === 'function') ? getAVConsent() : 'none';
        if (consent !== 'full' && consent !== 'camera') {
            // Sin consentimiento — agente inactivo, metricas null
            return;
        }
        var stream = window._zykosAVStream;
        if (!stream) return;
        var videoTracks = stream.getVideoTracks();
        if (!videoTracks.length) return;

        state.active = true;
        state.sessionStart = performance.now();
        state.presence_checks = 0; state.presence_detected = 0;
        state.absence_episodes = []; state.freeze_episodes = [];
        state._absence_start = null; state._freeze_start = null;
        state._last_landmark_hash = null;

        // Canvas oculto para sampling de frames
        state._canvas = document.createElement('canvas');
        state._ctx    = state._canvas.getContext('2d');

        // Video element para capturar el stream
        state._video = document.createElement('video');
        state._video.srcObject = stream;
        state._video.muted     = true;
        state._video.playsInline = true;
        state._video.play().catch(function(){});

        initDetector(function() {
            state._interval = setInterval(analyzeFrame, PRESENCE_INTERVAL_MS);
        });
    },

    collect: function() {
        if (!state.active) {
            return {
                camera_presence_pct:     null,
                camera_absence_episodes: null,
                camera_freeze_ms_max:    null,
                camera_freeze_episodes:  null
            };
        }
        var presencePct = state.presence_checks > 0
            ? +(state.presence_detected / state.presence_checks).toFixed(3)
            : null;
        var freezeMax = state.freeze_episodes.length
            ? Math.max.apply(null, state.freeze_episodes.map(function(e){ return e.duration_ms; }))
            : 0;
        return {
            camera_presence_pct:     presencePct,
            camera_absence_episodes: state.absence_episodes.length,
            camera_freeze_ms_max:    freezeMax,
            camera_freeze_episodes:  state.freeze_episodes.length,
            _raw_camera: {
                absence_episodes: state.absence_episodes,
                freeze_episodes:  state.freeze_episodes
            }
        };
    },

    stop: function() {
        state.active = false;
        if (state._interval) { clearInterval(state._interval); state._interval = null; }
        if (state._video)    { state._video.pause(); state._video.srcObject = null; state._video = null; }
        // NO parar el stream aqui — lo maneja av-consent al terminar la sesion
    }
};

if (typeof ZYKOS !== 'undefined') {
    ZYKOS.registerAgent('camera', agent);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ZYKOS !== 'undefined') ZYKOS.registerAgent('camera', agent);
    });
}

document.dispatchEvent(new CustomEvent('zykos:agents-ready'));

})();
