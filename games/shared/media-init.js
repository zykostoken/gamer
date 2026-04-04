// ================================================================
// media-init.js — Inicializador de agentes de media
// Se carga en cada juego. Lee el consentimiento guardado en el portal.
// El portal es el punto de CONSENTIMIENTO.
// Este script es el punto de EJECUCIÓN dentro de cada juego.
//
// Flujo:
//   Portal → showMediaConsent() → localStorage.zykos_media_consent
//   Juego  → media-init.js → lee consentimiento → arranca agentes
//   Engine → endSession() → collect() de todos los agentes
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

function initMedia() {
    var consent = getConsent();
    // Sin consentimiento o consentimiento negativo — no arrancar
    if (!consent || consent.skipped || (!consent.cam && !consent.mic)) return;

    // Esperar a que los agentes estén disponibles (carga asíncrona)
    var maxWait = 3000; // ms
    var start = Date.now();

    function tryInit() {
        var ogReady  = typeof window.ZykosOgMediaAgent !== 'undefined';
        var medReady = typeof window.ZykosMediaAgent   !== 'undefined';

        if (ogReady) {
            window.ZykosOgMediaAgent.setConsent(consent.cam, consent.mic);
        }
        if (medReady && consent.cam) {
            // agent-media solo si hay consentimiento explícito de cámara
            window.ZykosMediaAgent.setConsent(consent.cam, consent.mic);
        }

        if (!ogReady && !medReady && Date.now() - start < maxWait) {
            setTimeout(tryInit, 100);
        }
    }

    // Arrancar inmediatamente o cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
}

// Exponer para que el engine pueda verificar el estado
window.ZYKOS_MEDIA_INIT = { getConsent: getConsent };

initMedia();

})();
