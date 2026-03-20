/* ============================================================
   CONSENTIMIENTO INFORMADO DIGITAL
   js/consent-modal.js
   
   Modal obligatorio que bloquea acceso hasta aceptar.
   Uso:
     // Telemedicina (cada sesión):
     await ConsentModal.require('telemedicine_session', { email, fullName, dni });
     
     // Gaming (una vez al registrarse):
     await ConsentModal.require('gaming_registration', { email, fullName, dni });
   
   Retorna true si aceptó, false si rechazó.
   Si rechaza, no puede continuar.
   ============================================================ */

const ConsentModal = (() => {
  const SUPABASE_URL = typeof window.SUPABASE_URL !== 'undefined' ? window.SUPABASE_URL :
    'https://buzblnkpfydeheingzgn.supabase.co';
  const SUPABASE_KEY = typeof window.SUPABASE_ANON_KEY !== 'undefined' ? window.SUPABASE_ANON_KEY : '';

  // Textos de consentimiento por tipo
  const CONSENT_TEXTS = {
    telemedicine_session: {
      title: 'Consentimiento Informado - Telemedicina',
      version: '1.0',
      body: `CONSENTIMIENTO INFORMADO PARA TELECONSULTA MEDICA

Clinica Psiquiatrica Privada Jose Ingenieros SRL
Calle 52 N 2950, Necochea, Buenos Aires
CUIT: 30-71744441-0

En cumplimiento de la Ley 27.553 de Recetas Electronicas y Telemedicina, la Ley 26.529 de Derechos del Paciente y la Resolucion 3316/2023 del Ministerio de Salud:

1. NATURALEZA DEL SERVICIO: La teleconsulta es una modalidad de atencion medica a distancia mediante videollamada. No reemplaza la consulta presencial cuando esta sea clinicamente necesaria.

2. LIMITACIONES: El profesional podra determinar que la consulta requiere atencion presencial. La conexion depende de la calidad de internet de ambas partes.

3. CONFIDENCIALIDAD: La sesion es confidencial y se rige por el secreto medico (art. 156 Codigo Penal, Ley 26.529). La plataforma utiliza comunicacion cifrada.

4. GRABACION: La sesion NO sera grabada salvo autorizacion expresa. Los datos clinicos se registran en la Historia Clinica Electronica.

5. EMERGENCIAS: En caso de emergencia durante la teleconsulta, el profesional indicara el procedimiento a seguir. La teleconsulta no sustituye la atencion de emergencias.

6. DATOS PERSONALES: Sus datos se tratan conforme la Ley 25.326 de Proteccion de Datos Personales. Puede ejercer sus derechos de acceso, rectificacion y supresion.

7. HONORARIOS: Los honorarios seran informados previamente. El pago no garantiza la realizacion de la consulta si el profesional determina que no es adecuada por esta via.

Al aceptar, declaro haber leido y comprendido los terminos, y presto mi consentimiento libre e informado para la realizacion de la teleconsulta.`,
      checkboxLabel: 'He leido y acepto los terminos del consentimiento informado para telemedicina'
    },

    gaming_registration: {
      title: 'Consentimiento Informado - Plataforma de Juegos Terapeuticos',
      version: '1.0',
      body: `CONSENTIMIENTO INFORMADO PARA USO DE PLATAFORMA DE JUEGOS TERAPEUTICOS

Clinica Psiquiatrica Privada Jose Ingenieros SRL
Hospital de Dia Digital

En cumplimiento de la Ley 26.529 de Derechos del Paciente y la Ley 25.326 de Proteccion de Datos Personales:

1. FINALIDAD: Los juegos terapeuticos son herramientas de evaluacion y rehabilitacion cognitiva. No son juegos recreativos. Los datos generados se utilizan con fines clinicos.

2. DATOS RECOPILADOS: Durante el uso de los juegos se registran metricas de rendimiento cognitivo, tiempos de respuesta, patrones de interaccion y datos biometricos de movimiento del cursor. Estos datos forman parte de su evaluacion clinica.

3. CONFIDENCIALIDAD: Los datos son confidenciales y solo accesibles por los profesionales de salud asignados a su tratamiento y por el director medico de la institucion.

4. USO CLINICO: Los resultados se integran a su Historia Clinica Electronica y pueden ser utilizados para ajustar su plan terapeutico.

5. VOLUNTARIEDAD: La participacion en los juegos es voluntaria. Puede interrumpir una sesion en cualquier momento sin que esto afecte su tratamiento.

6. DATOS PERSONALES: Puede ejercer sus derechos de acceso, rectificacion y supresion contactando a direccionmedica@clinicajoseingenieros.ar.

Al aceptar, declaro haber leido y comprendido los terminos, y presto mi consentimiento para el uso de la plataforma de juegos terapeuticos y el registro de mis datos de rendimiento.`,
      checkboxLabel: 'He leido y acepto los terminos del consentimiento informado para juegos terapeuticos'
    },

    data_processing: {
      title: 'Consentimiento de Tratamiento de Datos Personales',
      version: '1.0',
      body: `CONSENTIMIENTO PARA TRATAMIENTO DE DATOS PERSONALES

En cumplimiento de la Ley 25.326 de Proteccion de Datos Personales, autorizo a Clinica Psiquiatrica Privada Jose Ingenieros SRL al tratamiento de mis datos personales y datos sensibles de salud con fines exclusivamente asistenciales.

Responsable: Clinica Psiquiatrica Privada Jose Ingenieros SRL
Contacto DPO: direccionmedica@clinicajoseingenieros.ar
Finalidad: Atencion clinica, facturacion, comunicaciones vinculadas al tratamiento.
Derechos: Acceso, rectificacion, supresion (Ley 25.326, art. 14).`,
      checkboxLabel: 'Autorizo el tratamiento de mis datos personales con fines asistenciales'
    }
  };

  // Computar hash SHA-256
  async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Verificar si ya tiene consentimiento vigente
  async function hasConsent(consentType, userEmail) {
    try {
      const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
      if (!sb) return false;

      const { data } = await sb
        .from('digital_consents')
        .select('id, consent_version, accepted_at, revoked_at')
        .eq('consent_type', consentType)
        .eq('user_email', userEmail)
        .eq('accepted', true)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!data || data.length === 0) return false;

      const current = CONSENT_TEXTS[consentType];
      if (!current) return false;

      // Si la version cambio, necesita reconsentir
      if (data[0].consent_version !== current.version) return false;

      // Telemedicina requiere consentimiento por sesion
      if (consentType === 'telemedicine_session') return false;

      return true;
    } catch (e) {
      console.error('[consent] Error checking consent:', e);
      return false;
    }
  }

  // Guardar consentimiento
  async function saveConsent(consentType, userData, consentText) {
    const timestamp = new Date().toISOString();
    const hashInput = JSON.stringify({
      type: consentType,
      email: userData.email,
      dni: userData.dni,
      text: consentText,
      timestamp
    });
    const integrityHash = await sha256(hashInput);
    const firmaHash = await sha256(
      (userData.fullName || '') + '|' + (userData.dni || '') + '|' + timestamp
    );

    try {
      const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
      if (!sb) return false;

      const { error } = await sb.from('digital_consents').insert({
        user_type: consentType.startsWith('telemed') ? 'telemedicine_user' :
                   consentType.startsWith('gaming') ? 'gaming_user' : 'patient',
        user_email: userData.email || null,
        user_dni: userData.dni || null,
        user_full_name: userData.fullName || null,
        consent_type: consentType,
        consent_version: CONSENT_TEXTS[consentType]?.version || '1.0',
        consent_text: consentText,
        accepted: true,
        firma_hash: firmaHash,
        ip_address: null,
        user_agent: navigator.userAgent,
        integrity_hash: integrityHash
      });

      if (error) { console.error('[consent] Save error:', error); return false; }
      return true;
    } catch (e) {
      console.error('[consent] Save error:', e);
      return false;
    }
  }

  // Mostrar modal y esperar respuesta
  function showModal(consentType) {
    return new Promise((resolve) => {
      const config = CONSENT_TEXTS[consentType];
      if (!config) { resolve(false); return; }

      // Crear overlay
      const overlay = document.createElement('div');
      overlay.id = 'consent-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);';

      overlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;max-width:700px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div style="padding:1.25rem 1.5rem;border-bottom:1px solid #e5e7eb;flex-shrink:0;">
            <h2 style="margin:0;font-size:1.1rem;font-weight:700;color:#1a1a1a;">${config.title}</h2>
            <span style="font-size:.7rem;color:#9ca3af;">Version ${config.version} | ${new Date().toLocaleDateString('es-AR')}</span>
          </div>
          <div style="padding:1.5rem;overflow-y:auto;flex:1;">
            <pre style="white-space:pre-wrap;font-family:inherit;font-size:.82rem;line-height:1.6;color:#374151;margin:0;">${config.body}</pre>
          </div>
          <div style="padding:1rem 1.5rem;border-top:1px solid #e5e7eb;flex-shrink:0;">
            <label style="display:flex;align-items:flex-start;gap:.5rem;cursor:pointer;font-size:.82rem;margin-bottom:1rem;">
              <input type="checkbox" id="consent-check" style="margin-top:3px;accent-color:#1d4ed8;">
              <span>${config.checkboxLabel}</span>
            </label>
            <div style="display:flex;gap:.75rem;justify-content:flex-end;">
              <button id="consent-reject" style="padding:.5rem 1.25rem;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;font-size:.82rem;font-family:inherit;">Rechazar</button>
              <button id="consent-accept" disabled style="padding:.5rem 1.25rem;border:none;border-radius:6px;background:#93c5fd;color:#fff;cursor:not-allowed;font-size:.82rem;font-weight:600;font-family:inherit;">Aceptar y Continuar</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const check = overlay.querySelector('#consent-check');
      const acceptBtn = overlay.querySelector('#consent-accept');
      const rejectBtn = overlay.querySelector('#consent-reject');

      check.addEventListener('change', () => {
        if (check.checked) {
          acceptBtn.disabled = false;
          acceptBtn.style.background = '#1d4ed8';
          acceptBtn.style.cursor = 'pointer';
        } else {
          acceptBtn.disabled = true;
          acceptBtn.style.background = '#93c5fd';
          acceptBtn.style.cursor = 'not-allowed';
        }
      });

      acceptBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });

      rejectBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });
    });
  }

  // API pública
  return {
    /**
     * Requiere consentimiento. Bloquea hasta que acepte o rechace.
     * @param {string} consentType - 'telemedicine_session' | 'gaming_registration' | 'data_processing'
     * @param {object} userData - { email, fullName, dni }
     * @returns {Promise<boolean>} true si aceptó
     */
    async require(consentType, userData = {}) {
      // Verificar si ya tiene consentimiento vigente (excepto telemedicina que es por sesión)
      if (userData.email && consentType !== 'telemedicine_session') {
        const existing = await hasConsent(consentType, userData.email);
        if (existing) return true;
      }

      // Mostrar modal
      const accepted = await showModal(consentType);

      if (accepted) {
        const config = CONSENT_TEXTS[consentType];
        await saveConsent(consentType, userData, config?.body || '');
      }

      return accepted;
    },

    // Verificar sin mostrar modal
    async check(consentType, userEmail) {
      return hasConsent(consentType, userEmail);
    },

    // Acceso a los textos (para debugging/admin)
    getTexts() { return CONSENT_TEXTS; }
  };
})();
