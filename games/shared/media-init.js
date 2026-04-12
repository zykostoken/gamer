// ================================================================
// media-init.js — Integración de agentes de media en cada juego
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// ARQUITECTURA:
//   Los agentes arrancan en el PORTAL al momento del OK al consentimiento.
//   Este script NO los vuelve a arrancar si ya están corriendo.
//   Solo registra el consentimiento con el engine canónico.
//
// FLUJO CORRECTO:
//   Portal → showMediaConsent() → OK → initMediaAgents() → .start()
//   Juego  → media-init.js → verifica agentes → registra en engine
//   Engine → endSession() → collect() de todos los agentes
//
// FALLBACK:
//   Si el usuario entró directo al juego (sin pasar por el portal),
//   este script arranca los agentes usando el consentimiento guardado.
//
// IDENTIDAD IMPLÍCITA:
//   Como los agentes corren desde el momento del consentimiento,
//   cualquier discontinuidad de presencia entre el modal y el juego
//   queda registrada como dato clínico (og_cam_blackout_*).
//   No es biometría de identidad formal, pero es una señal.
// ================================================================

(function() {
'use strict';

var CONSENT_KEY = 'zykos_media_consent_v1';

function getConsent() {
    try {
        var raw = localStorage.getItem(CONSENT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

function registerWithEngine(consent) {
    // Registrar agentes en el engine canónico para que endSession() los colecte
    if (typeof ZYKOS === 'undefined' || !ZYKOS.registerAgent) return;

    if (consent.cam || consent.mic) {
        if (typeof window.ZykosOgMediaAgent !== 'undefined') {
            ZYKOS.registerAgent('og-media', window.ZykosOgMediaAgent);
        }
    }
    if (consent.cam && typeof window.ZykosMediaAgent !== 'undefined') {
        ZYKOS.registerAgent('media', window.ZykosMediaAgent);
    }
}

function run() {
    var consent = getConsent();
    if (!consent || consent.skipped || (!consent.cam && !consent.mic)) return;

    var ogRunning  = typeof window.ZykosOgMediaAgent !== 'undefined'
                     && window.ZykosOgMediaAgent._active;
    var medRunning = typeof window.ZykosMediaAgent !== 'undefined'
                     && window.ZykosMediaAgent._active;

    if (ogRunning || medRunning) {
        // Ya están corriendo desde el portal — solo registrar con el engine
        console.log('[media-init] agentes ya activos desde portal — registrando en engine');
        registerWithEngine(consent);
        return;
    }

    // FALLBACK: arranca los agentes si entraron directo al juego
    console.log('[media-init] fallback: arrancando agentes desde juego');
    if (typeof window.ZykosOgMediaAgent !== 'undefined') {
        window.ZykosOgMediaAgent.setConsent(consent.cam, consent.mic);
        window.ZykosOgMediaAgent.start().then(function() {
            registerWithEngine(consent);
        }).catch(function(){});
    }
    if (consent.cam && typeof window.ZykosMediaAgent !== 'undefined') {
        window.ZykosMediaAgent.setConsent(consent.cam, consent.mic);
        window.ZykosMediaAgent.start().catch(function(){});
    }
}

// Esperar a que el DOM y los agentes estén disponibles
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
} else {
    run();
}

// También escuchar el evento de agentes listos (por si face-api carga después)
document.addEventListener('zykos:agents-ready', run);

window.ZYKOS_MEDIA_INIT = { getConsent: getConsent };

})();
