/**
 * ZYKOS V4 BOOTSTRAP — el wiring que enchufa todo el pipeline canonico.
 * (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary.
 *
 * PROBLEMA QUE RESUELVE:
 * Los juegos HTML cargaban zykos-engine.js + 11 agentes + teoricamente corsario,
 * pero NINGUNO invocaba ZYKOS.startSession() ni ZYKOS.endSession(), y ademas
 * corsario.js no estaba cargado en ningun HTML. Resultado: cero filas en
 * zykos_raw_stream ever, cero filas en zykos_metrics_canonical de juegos que
 * no fueran lawn-mower (que escribe por flujo legacy pre-V4).
 *
 * Auditoria 23-abr 2026: audit #110.
 *
 * SOLUCION:
 * Una sola funcion que el juego llama al iniciar y al terminar, que:
 *   - Activa ZYKOS.startSession con el gameSlug + DNI + userId reales.
 *   - Inicializa ZykosCorsario con el mismo sessionId del engine.
 *   - Al terminar, llama ZYKOS.endSession (recolecta agentes + persiste) y
 *     stop del corsario (flush final del raw stream).
 *
 * NO HACE:
 *   - No escribe metric_type=session_summary que los juegos ya escriben (ese
 *     es el flujo propio del juego, sigue igual). El engine escribe su propia
 *     fila con metric_type=session_biomet.
 *   - No cambia ningun agente, ningun engine, ninguna metrica canonica.
 *   - No calcula nada. Solo enchufa.
 *
 * USO EN UN JUEGO:
 *   <script src="/games/shared/zykos-bootstrap.js"></script>
 *
 *   // Al iniciar el juego:
 *   ZykosBootstrap.start('reflejos');  // el slug del juego
 *
 *   // Al terminar (cuando el nivel se completa y se va a mostrar resultados):
 *   await ZykosBootstrap.end();
 *
 * El bootstrap se autodescubre:
 *   - Lee el DNI desde window.ZYKOS_DNI (seteado por require-auth.js) o
 *     desde ?dni= en la URL.
 *   - Lee el userId desde localStorage.zykos_user.
 *   - Obtiene el Supabase client via window.getSupabaseClient().
 *
 * Si falta algo, NO revienta: loguea un warning y sigue. Los juegos tienen que
 * poder seguir jugando aunque el engine falle.
 */
(function(global) {
'use strict';

var _booted = false;
var _bootContext = null;

/**
 * Bootstrap del pipeline V4 al iniciar un juego.
 * @param {string} gameSlug - slug canonico del juego (ej: 'reflejos', 'pill-organizer')
 */
function start(gameSlug) {
    if (_booted) {
        console.warn('[zykos-bootstrap] start() already booted, ignoring');
        return;
    }
    if (!gameSlug) {
        console.error('[zykos-bootstrap] start(): gameSlug is required');
        return;
    }

    // --- Autodiscovery: DNI, userId, Supabase client ---
    var dni = null;
    try {
        dni = global.ZYKOS_DNI ||
              new URLSearchParams(location.search).get('dni') ||
              null;
    } catch (e) {}

    var userId = null;
    try {
        var rawUser = localStorage.getItem('zykos_user');
        if (rawUser) {
            var user = JSON.parse(rawUser);
            userId = user.user_id || user.id || null;
        }
    } catch (e) {}

    var sb = null;
    try {
        sb = (typeof global.getSupabaseClient === 'function') ? global.getSupabaseClient() : null;
    } catch (e) {
        console.warn('[zykos-bootstrap] getSupabaseClient threw:', e && e.message);
    }

    // Si no hay DNI, no iniciamos el engine. El juego puede seguir funcionando
    // en modo "demo sin registro". No es error.
    if (!dni) {
        console.log('[zykos-bootstrap] No DNI — skipping V4 pipeline (demo mode)');
        return;
    }

    // --- Start engine (activa agentes registrados) ---
    if (typeof global.ZYKOS !== 'undefined' && typeof global.ZYKOS.startSession === 'function') {
        try {
            global.ZYKOS.startSession(gameSlug, dni, userId);
            _bootContext = {
                gameSlug: gameSlug,
                dni: dni,
                userId: userId,
                sessionId: (global.ZYKOS.meta && global.ZYKOS.meta.session_id) || null,
                startedAt: Date.now()
            };
            console.log('[zykos-bootstrap] ZYKOS engine started for', gameSlug);
        } catch (e) {
            console.error('[zykos-bootstrap] ZYKOS.startSession threw:', e && e.message);
            return;
        }
    } else {
        console.warn('[zykos-bootstrap] ZYKOS engine not available — skipping');
        return;
    }

    // --- Start corsario (DOM events a zykos_raw_stream) ---
    if (typeof global.ZykosCorsario !== 'undefined' &&
        typeof global.ZykosCorsario.init === 'function' &&
        sb &&
        _bootContext &&
        _bootContext.sessionId) {
        try {
            global.ZykosCorsario.init({
                supabaseClient: sb,
                sessionId: _bootContext.sessionId,
                patientDni: dni
            });
            console.log('[zykos-bootstrap] Corsario started, sessionId:', _bootContext.sessionId);
        } catch (e) {
            console.warn('[zykos-bootstrap] Corsario.init threw:', e && e.message);
        }
    } else if (typeof global.ZykosCorsario === 'undefined') {
        console.warn('[zykos-bootstrap] ZykosCorsario not loaded — raw_stream will be empty');
    }

    _booted = true;
}

/**
 * Cierra el pipeline V4 al terminar el juego/nivel.
 * Async: el engine persiste a Supabase antes de retornar.
 */
async function end() {
    if (!_booted) {
        return; // nada que cerrar
    }

    // --- Stop corsario primero (flush final del raw_stream) ---
    if (typeof global.ZykosCorsario !== 'undefined' &&
        typeof global.ZykosCorsario.stop === 'function') {
        try {
            global.ZykosCorsario.stop();
            console.log('[zykos-bootstrap] Corsario stopped');
        } catch (e) {
            console.warn('[zykos-bootstrap] Corsario.stop threw:', e && e.message);
        }
    }

    // --- End engine (recolecta agentes + persiste session_biomet) ---
    var engineMetrics = null;
    if (typeof global.ZYKOS !== 'undefined' && typeof global.ZYKOS.endSession === 'function') {
        try {
            engineMetrics = await global.ZYKOS.endSession();
            console.log('[zykos-bootstrap] ZYKOS engine ended, persisted session_biomet');
        } catch (e) {
            console.error('[zykos-bootstrap] ZYKOS.endSession threw:', e && e.message);
        }
    }

    _booted = false;
    _bootContext = null;
    return engineMetrics;
}

/**
 * Notificar contexto al corsario (opcional, util en transiciones dentro del juego).
 */
function setContext(ctx) {
    if (typeof global.ZykosCorsario !== 'undefined' &&
        typeof global.ZykosCorsario.setContext === 'function') {
        try {
            global.ZykosCorsario.setContext(ctx);
        } catch (e) {}
    }
}

/**
 * Utility: permite a un juego saber si esta booted (para no llamar end sin haber llamado start).
 */
function isBooted() {
    return _booted;
}

// --- Expose ---
global.ZykosBootstrap = {
    start: start,
    end: end,
    setContext: setContext,
    isBooted: isBooted
};

})(typeof window !== 'undefined' ? window : this);
