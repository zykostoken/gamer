/**
 * hw-calibration.js — Calibracion hardware por sesion V4.2
 *
 * (c) 2026 Dr. Gonzalo Perez Cortizo. Audit #162.
 *
 * DOCTRINA:
 * - Cada vez que el paciente ingresa a la plataforma, se calibra el hardware
 *   DE ESA SESION. Puede estar en otro dispositivo/red/momento.
 * - Sin baseline de jitter idle, las metricas motoras no tienen referencia
 *   para normalizar (el jitter del mouse del paciente vs el jitter residual
 *   del dispositivo).
 * - La calibracion es INVISIBLE al paciente: no se le dice que se quede quieto.
 *   Se aprovechan los primeros segundos de DOM cargado sin movimiento activo.
 *
 * FLOW:
 * 1. Al cargar rokola.html o portal index, espera 500ms de estabilizacion
 * 2. Captura muestras de mousemove/touchmove por 3 segundos
 * 3. Si no hay movimiento espontaneo, asume hw_idle_jitter_px = 0 (ideal)
 * 4. Si hay samples, calcula la desviacion media
 * 5. Mide latencia frame con requestAnimationFrame
 * 6. Envia RPC zykos_record_hw_calibration
 *
 * Se carga en rokola.html y en games/portal/index.html, post auth.
 */
(function(global) {
'use strict';

var CALIBRATION_DURATION_MS = 3000;  // 3 segundos
var SAMPLE_INTERVAL_MS = 50;         // muestrear cada 50ms

function detectDeviceType() {
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    return /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : 'mobile';
  }
  return 'desktop';
}

function detectInputDevice() {
  if ('ontouchstart' in window && navigator.maxTouchPoints > 0) {
    return (window.matchMedia('(hover: hover)').matches) ? 'hybrid' : 'touch';
  }
  return 'mouse';
}

function measureFrameLatency(onDone) {
  var samples = [];
  var start = performance.now();
  function frame() {
    var t = performance.now();
    samples.push(t);
    if (samples.length < 30) {
      requestAnimationFrame(frame);
    } else {
      var deltas = [];
      for (var i = 1; i < samples.length; i++) {
        deltas.push(samples[i] - samples[i-1]);
      }
      var mean = deltas.reduce(function(a,b){return a+b;}, 0) / deltas.length;
      // Frame latency idealmente 16.67ms (60fps). mayor = lag.
      onDone(mean);
    }
  }
  requestAnimationFrame(frame);
}

function captureIdleJitter(onDone) {
  var samples = [];
  var started = performance.now();

  function handler(e) {
    var x, y;
    if (e.touches && e.touches[0]) {
      x = e.touches[0].clientX; y = e.touches[0].clientY;
    } else {
      x = e.clientX; y = e.clientY;
    }
    if (typeof x === 'number' && typeof y === 'number') {
      samples.push({ x: x, y: y, t: performance.now() });
    }
  }

  document.addEventListener('mousemove', handler, { passive: true });
  document.addEventListener('touchmove', handler, { passive: true });

  setTimeout(function() {
    document.removeEventListener('mousemove', handler);
    document.removeEventListener('touchmove', handler);

    var jitter = 0;
    if (samples.length >= 5) {
      var dxs = [], dys = [];
      for (var i = 1; i < samples.length; i++) {
        dxs.push(Math.abs(samples[i].x - samples[i-1].x));
        dys.push(Math.abs(samples[i].y - samples[i-1].y));
      }
      var meanDx = dxs.reduce(function(a,b){return a+b;}, 0) / dxs.length;
      var meanDy = dys.reduce(function(a,b){return a+b;}, 0) / dys.length;
      // Jitter = dispersion euclidea media en idle (asumimos idle si dispersion < 3px)
      jitter = Math.sqrt(meanDx*meanDx + meanDy*meanDy);
      // Si es > 30px, no es idle real (paciente estaba moviendo). Truncar.
      if (jitter > 30) jitter = null;
    }
    onDone({ jitter: jitter, samples_count: samples.length });
  }, CALIBRATION_DURATION_MS);
}

function runCalibration() {
  if (!global.ZYKOS_DNI) {
    console.log('[hw-calibration] No DNI available — skipping');
    return;
  }
  // Evitar duplicados por recarga rapida
  var lastCal = 0;
  try { lastCal = parseInt(sessionStorage.getItem('zykos_hw_cal_ts') || '0', 10); } catch(e){}
  if (Date.now() - lastCal < 30000) {
    console.log('[hw-calibration] Already calibrated <30s ago — skipping');
    return;
  }

  console.log('[hw-calibration] Starting calibration (3s)...');
  var rokolaSessionId = null;
  try {
    rokolaSessionId = new URLSearchParams(location.search).get('rokola_session_id') 
                   || sessionStorage.getItem('zykos_rokola_session_id');
  } catch(e){}

  var startedAt = performance.now();
  captureIdleJitter(function(idleResult) {
    measureFrameLatency(function(latency) {
      var durationMs = Math.round(performance.now() - startedAt);
      var payload = {
        p_dni: global.ZYKOS_DNI,
        p_rokola_session_id: rokolaSessionId || null,
        p_idle_jitter_px: idleResult.jitter,
        p_latency_ms: latency,
        p_device_type: detectDeviceType(),
        p_input_device: detectInputDevice(),
        p_pointer_type: detectInputDevice(),
        p_screen_resolution: window.innerWidth + 'x' + window.innerHeight,
        p_screen_dpr: window.devicePixelRatio || 1,
        p_user_agent: navigator.userAgent.substring(0, 255),
        p_duration_ms: durationMs,
        p_samples_count: idleResult.samples_count
      };

      var sb = (typeof global.getSupabaseClient === 'function') ? global.getSupabaseClient() : null;
      if (!sb) {
        console.warn('[hw-calibration] No Supabase client');
        return;
      }

      sb.rpc('zykos_record_hw_calibration', payload).then(function(r) {
        if (r.error) {
          console.warn('[hw-calibration] RPC error:', r.error.message);
        } else {
          console.log('[hw-calibration] Calibrated:', {
            idle_jitter_px: idleResult.jitter,
            latency_ms: latency.toFixed(2),
            device: payload.p_device_type,
            input: payload.p_input_device,
            id: r.data
          });
          try { sessionStorage.setItem('zykos_hw_cal_ts', Date.now().toString()); } catch(e){}
          // Expose para que el corsario pueda restar baseline
          global.ZYKOS_HW_CAL = {
            idle_jitter_px: idleResult.jitter,
            latency_ms: latency,
            calibrated_at: Date.now()
          };
        }
      });
    });
  });
}

function hwCalibrationInit() {
  // Esperar DNI y un pequeño delay de estabilizacion
  var tries = 0;
  var iv = setInterval(function() {
    if (global.ZYKOS_DNI || tries > 60) {
      clearInterval(iv);
      if (global.ZYKOS_DNI) {
        setTimeout(runCalibration, 500);  // 500ms mas para que todo cargue
      }
    }
    tries++;
  }, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hwCalibrationInit);
} else {
  hwCalibrationInit();
}

global.ZykosHwCalibration = { runCalibration: runCalibration };

})(typeof window !== 'undefined' ? window : this);
