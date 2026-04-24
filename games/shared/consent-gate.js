/**
 * consent-gate.js — Gate de consentimiento informado digital V4.2
 *
 * (c) 2026 Dr. Gonzalo Perez Cortizo. Audit #162.
 *
 * DOCTRINA:
 * - Sin consent firmado, la plataforma NO debe operar (Ley 25.326, Ley 26.529,
 *   Res. 1959/2024 ReNaPDiS).
 * - Una sola vez por paciente (persistente via hash en DB).
 * - Consent separable por capacidad: cam / mic / clinical_metrics / legal_defense.
 * - El unico obligatorio para entrar es clinical_metrics_authorized — sin eso,
 *   no hay metricas, no hay plataforma.
 *
 * FLOW:
 * 1. Al cargar, consulta zykos_get_consent_status(dni)
 * 2. Si status == 'OK' → no bloquea, expone flags al resto del sistema
 *    window.ZYKOS_CONSENT = { cam: bool, mic: bool, clinical_metrics: bool, legal_defense: bool }
 * 3. Si status == 'REQUIRED' o 'UPDATE_REQUIRED' → muestra modal, bloquea UI
 * 4. Usuario firma → zykos_sign_consent → localStorage cache + reload
 *
 * Se carga DESPUES de require-auth.js (necesita ZYKOS_DNI).
 */
(function(global) {
'use strict';

var CONSENT_VERSION = 'V1_2026_04';
var CONSENT_TEXT = {
  intro: 'Antes de comenzar, necesitamos tu autorizacion expresa para operar la plataforma ZYKOS.',
  legal: 'Ley 25.326 (Proteccion de Datos Personales), Ley 26.529 (Derechos del Paciente), Res. 1959/2024 (ReNaPDiS). Tu consentimiento queda registrado con hash de inmutabilidad.',
  items: [
    {
      key: 'clinical_metrics',
      required: true,
      title: 'Metricas clinicas (OBLIGATORIO)',
      text: 'Autorizo el registro de mis interacciones con la plataforma (clicks, movimientos del cursor, tiempos de reaccion, errores y aciertos en los juegos) como datos clinicos de caracter personal, para seguimiento terapeutico por profesionales matriculados de la Clinica Psiquiatrica Privada Jose Ingenieros.'
    },
    {
      key: 'cam',
      required: false,
      title: 'Camara (OPCIONAL)',
      text: 'Autorizo que ZYKOS use la camara web para detectar presencia facial y expresiones (sorpresa, enojo, risa). La camara NO graba video ni imagenes. Solo eventos marcados temporalmente. Puedo revocar esta autorizacion cuando quiera.'
    },
    {
      key: 'mic',
      required: false,
      title: 'Microfono (OPCIONAL)',
      text: 'Autorizo que ZYKOS use el microfono para detectar tono ambiente y voz. NO graba audio. Solo niveles y episodios. Puedo revocar esta autorizacion cuando quiera.'
    },
    {
      key: 'legal_defense',
      required: false,
      title: 'Auditoria de identidad para defensa legal (OPCIONAL)',
      text: 'Autorizo que en caso de auditoria medico-legal, ZYKOS pueda demostrar que las sesiones fueron realizadas por mi persona (coincidencia de datos biometricos vs enrollment inicial). Esto protege al profesional y a mi propia identidad clinica.'
    },
    {
      key: 'data_export',
      required: false,
      title: 'Exportacion de datos para investigacion (OPCIONAL)',
      text: 'Autorizo que mis datos anonimizados (sin DNI ni nombre) puedan ser usados en trabajos cientificos publicados por el equipo investigador. Mi identidad nunca sera revelada.'
    }
  ]
};

function consentGateInit() {
  // Esperar a que ZYKOS_DNI este seteado por require-auth
  var tries = 0;
  var iv = setInterval(function() {
    if (global.ZYKOS_DNI || tries > 60) {
      clearInterval(iv);
      if (global.ZYKOS_DNI) checkConsent(global.ZYKOS_DNI);
      else console.warn('[consent-gate] DNI not available after 30s — skipping consent check');
    }
    tries++;
  }, 500);
}

function checkConsent(dni) {
  // Cache local: si ya sabemos que firmo la version vigente, no re-pregunta
  try {
    var cached = localStorage.getItem('zykos_consent_' + dni);
    if (cached) {
      var c = JSON.parse(cached);
      if (c.version === CONSENT_VERSION && c.status === 'OK') {
        global.ZYKOS_CONSENT = c.flags;
        console.log('[consent-gate] OK cached:', c.flags);
        return;
      }
    }
  } catch(e){}

  // Consultar DB
  var sb = (typeof global.getSupabaseClient === 'function') ? global.getSupabaseClient() : null;
  if (!sb) {
    console.warn('[consent-gate] No Supabase client — skipping (fallback mode)');
    return;
  }
  sb.rpc('zykos_get_consent_status', { p_dni: dni }).then(function(r) {
    if (r.error) {
      console.warn('[consent-gate] RPC error:', r.error.message);
      return;
    }
    var data = r.data || {};
    if (data.status === 'OK') {
      global.ZYKOS_CONSENT = {
        cam: !!data.cam_authorized,
        mic: !!data.mic_authorized,
        clinical_metrics: !!data.clinical_metrics_authorized,
        legal_defense: !!data.legal_defense_authorized
      };
      try {
        localStorage.setItem('zykos_consent_' + dni, JSON.stringify({
          version: CONSENT_VERSION, status: 'OK', flags: global.ZYKOS_CONSENT,
          signed_at: data.signed_at
        }));
      } catch(e){}
      console.log('[consent-gate] OK from DB:', global.ZYKOS_CONSENT);
    } else {
      console.log('[consent-gate] consent REQUIRED — showing modal');
      showConsentModal(dni);
    }
  });
}

function showConsentModal(dni) {
  if (document.getElementById('zykos-consent-overlay')) return;

  // Bloquear scroll
  document.body.style.overflow = 'hidden';

  var overlay = document.createElement('div');
  overlay.id = 'zykos-consent-overlay';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:rgba(10,10,15,0.92)', 'backdrop-filter:blur(10px)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:20px', 'font-family:system-ui,sans-serif'
  ].join(';');

  var card = document.createElement('div');
  card.style.cssText = [
    'background:#1a1f2e', 'border-radius:16px',
    'padding:24px 26px', 'max-width:600px', 'width:100%',
    'max-height:90vh', 'overflow-y:auto',
    'box-shadow:0 20px 80px rgba(0,0,0,0.6)',
    'border:1px solid rgba(255,255,255,0.12)',
    'color:#e2e8f0'
  ].join(';');

  var itemsHtml = CONSENT_TEXT.items.map(function(item, idx) {
    var requiredBadge = item.required 
      ? '<span style="color:#ef4444;font-weight:600;font-size:0.72rem;margin-left:6px;">REQUERIDO</span>'
      : '<span style="color:#64748b;font-weight:500;font-size:0.72rem;margin-left:6px;">OPCIONAL</span>';
    return [
      '<div style="border-top:1px solid rgba(255,255,255,0.08);padding:14px 0;">',
        '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">',
          '<input type="checkbox" id="consent-' + item.key + '" ',
            (item.required ? 'checked ' : ''),
            'style="margin-top:4px;width:18px;height:18px;accent-color:#4f46e5;flex-shrink:0;"/>',
          '<div>',
            '<div style="font-weight:600;color:#f1f5f9;font-size:0.92rem;">',
              item.title, requiredBadge,
            '</div>',
            '<div style="color:#94a3b8;font-size:0.82rem;line-height:1.45;margin-top:4px;">',
              item.text,
            '</div>',
          '</div>',
        '</label>',
      '</div>'
    ].join('');
  }).join('');

  card.innerHTML = [
    '<h2 style="margin:0 0 4px;color:#f1f5f9;font-size:1.3rem;">Consentimiento informado</h2>',
    '<p style="color:#94a3b8;font-size:0.85rem;margin:0 0 14px;">', CONSENT_TEXT.intro, '</p>',
    itemsHtml,
    '<div style="border-top:1px solid rgba(255,255,255,0.08);padding:12px 0 0;margin-top:8px;">',
      '<p style="color:#64748b;font-size:0.72rem;line-height:1.4;margin:0 0 12px;">',
        CONSENT_TEXT.legal,
      '</p>',
      '<div id="consent-error" style="display:none;color:#ef4444;font-size:0.82rem;margin-bottom:10px;"></div>',
      '<button id="consent-sign-btn" style="width:100%;padding:12px;background:#4f46e5;color:white;border:none;border-radius:8px;font-size:0.95rem;font-weight:600;cursor:pointer;transition:background 0.15s;">',
        'Firmar y continuar',
      '</button>',
    '</div>'
  ].join('');

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  var btn = document.getElementById('consent-sign-btn');
  btn.onmouseover = function(){ btn.style.background = '#6366f1'; };
  btn.onmouseout = function(){ btn.style.background = '#4f46e5'; };
  btn.onclick = function() { signConsent(dni, overlay); };
}

function signConsent(dni, overlay) {
  var get = function(k){ var el = document.getElementById('consent-'+k); return !!(el && el.checked); };
  var clinical = get('clinical_metrics');
  if (!clinical) {
    var err = document.getElementById('consent-error');
    err.textContent = 'El consentimiento de metricas clinicas es obligatorio para usar la plataforma.';
    err.style.display = 'block';
    return;
  }

  var btn = document.getElementById('consent-sign-btn');
  btn.disabled = true;
  btn.textContent = 'Firmando...';

  var sb = (typeof global.getSupabaseClient === 'function') ? global.getSupabaseClient() : null;
  if (!sb) { console.warn('[consent-gate] No sb for sign'); return; }

  sb.rpc('zykos_sign_consent', {
    p_dni: dni,
    p_cam: get('cam'),
    p_mic: get('mic'),
    p_clinical_metrics: clinical,
    p_legal_defense: get('legal_defense'),
    p_data_export: get('data_export'),
    p_user_agent: navigator.userAgent.substring(0, 255)
  }).then(function(r) {
    if (r.error) {
      console.error('[consent-gate] sign error:', r.error.message);
      var err = document.getElementById('consent-error');
      err.textContent = 'Error al firmar: ' + r.error.message;
      err.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Reintentar';
      return;
    }
    // Exito
    global.ZYKOS_CONSENT = {
      cam: get('cam'), mic: get('mic'),
      clinical_metrics: clinical, legal_defense: get('legal_defense')
    };
    try {
      localStorage.setItem('zykos_consent_' + dni, JSON.stringify({
        version: CONSENT_VERSION, status: 'OK',
        flags: global.ZYKOS_CONSENT, signed_at: new Date().toISOString()
      }));
      // LEGACY COMPAT: escribir zykos_media_consent_v1 para que media-init.js
      // arranque agent-media y agent-og-media automaticamente (cam/mic).
      // Sin esto, aunque el paciente autorice cam/mic, los agents no se activan.
      localStorage.setItem('zykos_media_consent_v1', JSON.stringify({
        cam: get('cam'), mic: get('mic'),
        skipped: false,
        signed_at: new Date().toISOString(),
        version: 'V1_2026_04'
      }));
    } catch(e){}
    console.log('[consent-gate] SIGNED:', global.ZYKOS_CONSENT);

    // Arrancar agents de cam/mic inmediatamente si el paciente los autorizo
    // y los scripts estan cargados en la pagina
    try {
      if (get('cam') || get('mic')) {
        if (typeof global.ZykosOgMediaAgent !== 'undefined' && global.ZykosOgMediaAgent.setConsent) {
          global.ZykosOgMediaAgent.setConsent(get('cam'), get('mic'));
          global.ZykosOgMediaAgent.start().catch(function(e){ console.warn('[consent-gate] og start:', e && e.message); });
          console.log('[consent-gate] ZykosOgMediaAgent started');
        }
        if (get('cam') && typeof global.ZykosMediaAgent !== 'undefined' && global.ZykosMediaAgent.setConsent) {
          global.ZykosMediaAgent.setConsent(get('cam'), get('mic'));
          global.ZykosMediaAgent.start().catch(function(e){ console.warn('[consent-gate] media start:', e && e.message); });
          console.log('[consent-gate] ZykosMediaAgent started');
        }
      }
    } catch(e) { console.warn('[consent-gate] agent bootstrap failed:', e); }

    overlay.remove();
    document.body.style.overflow = '';
  });
}

// Autostart en DOMContentLoaded (o inmediato si ya esta)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', consentGateInit);
} else {
  consentGateInit();
}

// Expose para inspection manual
global.ZykosConsentGate = {
  checkConsent: checkConsent,
  showModal: showConsentModal,
  VERSION: CONSENT_VERSION
};

})(typeof window !== 'undefined' ? window : this);
