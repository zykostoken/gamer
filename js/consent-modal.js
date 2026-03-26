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
