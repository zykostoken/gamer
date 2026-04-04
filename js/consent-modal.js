// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
// =============================================
// ZYKOS GAMER — Consent Modal
// Independent product — zero CJI references
// =============================================

var ZYKOS_CONSENT_VERSION = '1.0';

function showZykosConsent(onAccept) {
  if (localStorage.getItem('zykos_consent_v' + ZYKOS_CONSENT_VERSION)) {
    if (onAccept) onAccept();
    return;
  }

  var overlay = document.createElement('div');
  overlay.id = 'zykos-consent-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;';

  var card = document.createElement('div');
  card.style.cssText = 'background:#111633;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;';

  card.innerHTML =
    '<h2 style="font-family:Orbitron,monospace;font-size:1.2rem;margin-bottom:16px;background:linear-gradient(135deg,#00D4FF,#39FF14);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">ZYKOS GAMER</h2>' +
    '<h3 style="font-size:0.95rem;margin-bottom:12px;">Consentimiento Informado</h3>' +
    '<div style="font-size:0.8rem;color:#94a3b8;line-height:1.6;max-height:300px;overflow-y:auto;padding-right:8px;">' +
      '<p style="margin-bottom:10px;"><strong>1. RESPONSABLE:</strong> ZYKOS GAMER es una plataforma de evaluacion cognitiva gamificada operada por ZYKOS.</p>' +
      '<p style="margin-bottom:10px;"><strong>2. FINALIDAD:</strong> Los datos recolectados durante el uso de los juegos (metricas de rendimiento, tiempos de reaccion, patrones de movimiento) se utilizan para: (a) mostrarle sus resultados personales durante la sesion activa, y (b) construir valores normativos poblacionales anonimizados para investigacion cientifica.</p>' +
      '<p style="margin-bottom:10px;"><strong>3. DATOS DEMOGRAFICOS:</strong> Edad, sexo, nivel educativo y lateralidad se solicitan exclusivamente como variables de estratificacion estadistica. Su email y nombre NO se vinculan a los datos normativos.</p>' +
      '<p style="margin-bottom:10px;"><strong>4. ANONIMIZACION:</strong> Los datos normativos se almacenan de forma permanente, anonimizada e inmutable (hash chain SHA-256). No es posible vincular un dato normativo a una persona especifica una vez anonimizado.</p>' +
      '<p style="margin-bottom:10px;"><strong>5. RETENCION:</strong> Sus datos personales (email, nombre) se conservan mientras su cuenta este activa. Los datos de rendimiento (metricas de juego) se conservan anonimizados por un minimo de 10 anios con fines de validacion estadistica.</p>' +
      '<p style="margin-bottom:10px;"><strong>6. DERECHOS:</strong> Puede ejercer sus derechos de acceso, rectificacion y supresion de datos personales contactando a soporte@zykos.ar. La supresion de datos personales no afecta los datos normativos ya anonimizados.</p>' +
      '<p style="margin-bottom:10px;"><strong>7. SEGURIDAD:</strong> Encriptacion AES-256 en reposo, TLS 1.3 en transito, hash chain de integridad, audit logging automatico, triggers de inmutabilidad en todas las tablas de evidencia.</p>' +
      '<p><strong>8. BASE LEGAL:</strong> Ley 25.326 de Proteccion de Datos Personales (Argentina). Consentimiento libre, expreso e informado conforme Art. 5.</p>' +
    '</div>' +
    '<div style="margin-top:16px;display:flex;gap:10px;">' +
      '<button id="zykos-consent-accept" style="flex:1;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#00D4FF,#0099cc);color:#000;font-weight:700;font-size:0.95rem;cursor:pointer;">Acepto</button>' +
      '<button id="zykos-consent-decline" style="flex:1;padding:14px;border:none;border-radius:12px;background:transparent;border:1px solid rgba(255,255,255,0.15);color:#94a3b8;font-weight:600;font-size:0.95rem;cursor:pointer;">No acepto</button>' +
    '</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  document.getElementById('zykos-consent-accept').onclick = function() {
    localStorage.setItem('zykos_consent_v' + ZYKOS_CONSENT_VERSION, new Date().toISOString());
    overlay.remove();
    // Save consent to DB if possible
    try {
      var sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
      if (sb) {
        sb.from('digital_consents').insert({
          user_identifier: localStorage.getItem('zykos_token') || 'anonymous',
          consent_type: 'data_collection',
          consent_version: ZYKOS_CONSENT_VERSION,
          status: 'active',
          ip_address: null,
          created_at: new Date().toISOString()
        }).then(function(){}).catch(function(){});
      }
    } catch(e) {}
    if (onAccept) onAccept();
  };

  document.getElementById('zykos-consent-decline').onclick = function() {
    overlay.remove();
    // Redirect to landing
    window.location.href = '/';
  };
}


// ================================================================
// CONSENTIMIENTO DE CÁMARA Y MICRÓFONO
// Se muestra DESPUÉS del consentimiento de datos, UNA SOLA VEZ.
// El resultado se guarda en localStorage y el agente media lo lee.
// ================================================================

var ZYKOS_MEDIA_CONSENT_KEY = 'zykos_media_consent_v1';

function getMediaConsent() {
    try {
        var raw = localStorage.getItem(ZYKOS_MEDIA_CONSENT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

function saveMediaConsent(cam, mic) {
    var obj = { cam: !!cam, mic: !!mic, ts: new Date().toISOString(), skipped: (!cam && !mic) };
    localStorage.setItem(ZYKOS_MEDIA_CONSENT_KEY, JSON.stringify(obj));
    return obj;
}

// Inicializar y ARRANCAR agentes de media en el momento del consentimiento
// El agente corre desde aquí — antes del portal, antes del pre-game, antes del juego
// Captura estado basal: humor, presencia, audio ambiente desde el OK del modal
// Esto también provee comprobación implícita de identidad:
//   si quien consintió no es quien juega, habrá discontinuidad de presencia
function initMediaAgents(consent) {
    if (!consent || consent.skipped || (!consent.cam && !consent.mic)) return;

    // og-media: liviano, arranca siempre que haya cualquier consentimiento
    if (typeof window.ZykosOgMediaAgent !== 'undefined') {
        window.ZykosOgMediaAgent.setConsent(consent.cam, consent.mic);
        window.ZykosOgMediaAgent.start().then(function() {
            console.log('[ZYKOS media] og-media activo desde consentimiento — tier:', 
                window.ZykosOgMediaAgent._tier || 'iniciando');
        }).catch(function(e) {
            console.warn('[ZYKOS media] og-media no pudo arrancar:', e.message);
        });
    }

    // agent-media: solo si hay cam (requiere face-api 2.8MB — carga lazy)
    if (consent.cam && typeof window.ZykosMediaAgent !== 'undefined') {
        window.ZykosMediaAgent.setConsent(consent.cam, consent.mic);
        window.ZykosMediaAgent.start().then(function() {
            console.log('[ZYKOS media] agent-media activo — expresiones faciales capturando');
        }).catch(function(e) {
            console.warn('[ZYKOS media] agent-media no pudo arrancar:', e.message);
        });
    }

    // Marcar timestamp de inicio para el engine
    window.ZYKOS_MEDIA_CONSENT = consent;
    window.ZYKOS_MEDIA_START_TS = Date.now();
    localStorage.setItem('zykos_media_session_start', window.ZYKOS_MEDIA_START_TS);
    console.log('[ZYKOS media] sesion de captura iniciada:', new Date().toISOString());
}

function showMediaConsent(onComplete) {
    // Si ya fue respondido, inicializar directamente
    var existing = getMediaConsent();
    if (existing) {
        initMediaAgents(existing);
        if (onComplete) onComplete(existing);
        return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'zykos-media-consent-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;padding:16px;';

    overlay.innerHTML =
        '<div style="background:#111827;border:1px solid rgba(0,212,255,0.2);border-radius:16px;padding:28px;max-width:480px;width:100%;color:#e2e8f0;font-family:system-ui,sans-serif;">' +
            '<h3 style="font-size:1rem;font-weight:600;margin-bottom:6px;color:#00d4ff;">Biomarcadores opcionales</h3>' +
            '<p style="font-size:0.8rem;color:#94a3b8;line-height:1.6;margin-bottom:20px;">' +
                'ZYKOS GAMER puede capturar expresiones faciales y audio ambiental para enriquecer el perfil cognitivo. ' +
                'Todo el procesamiento ocurre <strong style="color:#e2e8f0;">en tu dispositivo</strong> — ningún video ni audio se envía al servidor. ' +
                'Solo se guardan métricas numéricas computadas localmente.' +
            '</p>' +
            '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">' +
                '<label style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer;">' +
                    '<input type="checkbox" id="consent-cam" style="width:16px;height:16px;accent-color:#00d4ff;">' +
                    '<div>' +
                        '<div style="font-size:0.85rem;font-weight:500;">Cámara — expresiones faciales</div>' +
                        '<div style="font-size:0.72rem;color:#94a3b8;">Action Units (Ekman 1978), sonrisa genuina, ceño fruncido, parpadeo</div>' +
                    '</div>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer;">' +
                    '<input type="checkbox" id="consent-mic" style="width:16px;height:16px;accent-color:#00d4ff;">' +
                    '<div>' +
                        '<div style="font-size:0.85rem;font-weight:500;">Micrófono — contexto sonoro</div>' +
                        '<div style="font-size:0.72rem;color:#94a3b8;">Nivel ambiental en dB, episodios de voz — sin grabar, sin transcribir</div>' +
                    '</div>' +
                '</label>' +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
                '<button id="media-consent-accept" style="flex:1;padding:13px;border:none;border-radius:10px;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#000;font-weight:700;font-size:0.9rem;cursor:pointer;">Confirmar selección</button>' +
                '<button id="media-consent-skip" style="padding:13px 18px;border:1px solid rgba(255,255,255,0.1);border-radius:10px;background:transparent;color:#94a3b8;font-size:0.85rem;cursor:pointer;">Sin biomarcadores</button>' +
            '</div>' +
            '<p style="font-size:0.68rem;color:#4b5563;margin-top:12px;line-height:1.5;">' +
                'Podés cambiar esta preferencia en cualquier momento desde tu perfil. ' +
                'El consentimiento se registra con timestamp y se puede revocar.' +
            '</p>' +
        '</div>';

    document.body.appendChild(overlay);

    document.getElementById('media-consent-accept').onclick = function() {
        var cam = document.getElementById('consent-cam').checked;
        var mic = document.getElementById('consent-mic').checked;
        var consent = saveMediaConsent(cam, mic);
        overlay.remove();
        initMediaAgents(consent);
        // Registrar en Supabase (no bloqueante)
        try {
            var sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            if (sb) {
                sb.from('digital_consents').insert({
                    user_identifier: localStorage.getItem('zykos_token') || 'anonymous',
                    consent_type: 'media_biomarcadores',
                    consent_version: 'v1',
                    status: 'active',
                    metadata: JSON.stringify({ cam: cam, mic: mic }),
                    created_at: new Date().toISOString()
                }).then(function(){}).catch(function(){});
            }
        } catch(e) {}
        if (onComplete) onComplete(consent);
    };

    document.getElementById('media-consent-skip').onclick = function() {
        var consent = saveMediaConsent(false, false);
        overlay.remove();
        if (onComplete) onComplete(consent);
    };
}
