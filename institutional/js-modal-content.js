// modal-content.js — Contenido de modales para clinicajoseingenieros.ar
// Cargado dinámicamente por core.js → ensureModalContent()

window.modalContent = {

  telemedicina: `
    <h2 style="margin-bottom:1.5rem;font-family:'Playfair Display',serif;">Telemedicina</h2>
    
    <div id="telemed-step-register" class="telemed-step">
      <p style="margin-bottom:1rem;color:var(--text-secondary);font-size:.9rem;">
        Videoconsulta profesional con especialistas en salud mental.
        Complete el formulario para iniciar.
      </p>
      <form onsubmit="telemedRegister(event)">
        <div style="display:grid;gap:.75rem;">
          <input type="text" id="telemed-fullname" placeholder="Nombre completo" required
            style="padding:.7rem 1rem;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:.9rem;">
          <input type="email" id="telemed-email" placeholder="Email" required
            style="padding:.7rem 1rem;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:.9rem;">
          <input type="tel" id="telemed-phone" placeholder="Telefono (opcional)"
            style="padding:.7rem 1rem;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-size:.9rem;">
          <div id="telemed-register-error" style="display:none;color:#ef4444;font-size:.82rem;"></div>
          <button type="submit" style="padding:.75rem;background:var(--accent-blue);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:.9rem;">
            Continuar
          </button>
        </div>
      </form>
    </div>

    <div id="telemed-step-services" class="telemed-step" style="display:none;">
      <p style="margin-bottom:.5rem;font-size:.85rem;color:var(--text-secondary);">
        Conectado como: <strong id="telemed-user-name"></strong>
        <a href="#" onclick="telemedLogout(); return false;" style="margin-left:.5rem;font-size:.8rem;color:var(--text-secondary);">Salir</a>
      </p>
      <div id="telemed-price-display" style="margin-bottom:1rem;padding:.75rem;background:var(--bg-secondary);border-radius:8px;font-size:.85rem;"></div>
      <div style="display:grid;gap:.75rem;">
        <button onclick="telemedSelectService('queue')" style="padding:1rem;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;cursor:pointer;text-align:left;color:var(--text-primary);">
          <strong style="display:block;margin-bottom:.25rem;">Consulta General</strong>
          <span style="font-size:.8rem;color:var(--text-secondary);">Atencion por orden de llegada</span>
        </button>
        <button onclick="telemedSelectService('priority')" style="padding:1rem;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;cursor:pointer;text-align:left;color:var(--text-primary);">
          <strong style="display:block;margin-bottom:.25rem;">Consulta Prioritaria</strong>
          <span style="font-size:.8rem;color:var(--text-secondary);">Atencion preferencial</span>
        </button>
      </div>
    </div>

    <div id="telemed-step-payment" class="telemed-step" style="display:none;">
      <p style="margin-bottom:1rem;font-size:.9rem;">Confirme el pago para iniciar la consulta.</p>
      <div style="padding:1rem;background:var(--bg-secondary);border-radius:8px;margin-bottom:1rem;">
        <div style="font-size:1.5rem;font-weight:700;" id="telemed-pay-price"></div>
        <div style="font-size:.8rem;color:var(--text-secondary);" id="telemed-pay-timeslot"></div>
      </div>
      <a id="telemed-mp-link" href="#" target="_blank" style="display:block;padding:.75rem;background:#009ee3;color:#fff;border-radius:8px;text-align:center;text-decoration:none;font-weight:600;">
        Pagar con MercadoPago
      </a>
      <div id="telemed-payment-timer" style="margin-top:.75rem;text-align:center;font-size:.8rem;color:var(--text-secondary);"></div>
      <button onclick="telemedVerifyPayment()" style="margin-top:.75rem;width:100%;padding:.6rem;background:transparent;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;color:var(--text-primary);font-size:.85rem;">
        Ya pague, verificar
      </button>
    </div>

    <div id="telemed-step-waiting" class="telemed-step" style="display:none;">
      <div style="text-align:center;padding:2rem 0;">
        <div style="width:40px;height:40px;border:3px solid var(--border-color);border-top-color:var(--accent-blue);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 1rem;"></div>
        <p style="font-size:.9rem;">Conectando con un profesional...</p>
        <p style="font-size:.8rem;color:var(--text-secondary);margin-top:.5rem;">Sera atendido en breve.</p>
      </div>
    </div>

    <div id="telemed-step-call" class="telemed-step" style="display:none;">
      <div id="telemed-call-container" style="width:100%;min-height:400px;border-radius:8px;overflow:hidden;background:#000;"></div>
      <div style="margin-top:.75rem;display:flex;justify-content:space-between;align-items:center;">
        <span id="telemed-call-duration" style="font-size:.85rem;color:var(--text-secondary);">00:00</span>
        <button onclick="telemedEndCall()" style="padding:.5rem 1.5rem;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
          Finalizar
        </button>
      </div>
    </div>
  `,

  internacion: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Internacion</h2>
    <p>54 camas con atencion las 24 horas, los 7 dias de la semana. Modelo de puertas abiertas con comunidad terapeutica.</p>
    <ul style="margin:1rem 0;padding-left:1.5rem;color:var(--text-secondary);font-size:.9rem;">
      <li>Internacion aguda y subaguda</li>
      <li>Atencion medica y psiquiatrica permanente</li>
      <li>Equipo interdisciplinario de guardia</li>
      <li>Cobertura de todas las obras sociales y prepagas</li>
    </ul>
  `,

  guardia: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Guardia Permanente</h2>
    <p>Guardia psiquiatrica interna las 24 horas con derivacion de guardia clinica general.</p>
    <p style="margin-top:.75rem;font-size:.9rem;color:var(--text-secondary);">Telefono de guardia: <strong>2262-301515</strong></p>
  `,

  externos: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Consultorios Externos</h2>
    <p>Atencion ambulatoria en Psiquiatria, Psicologia, Terapia Ocupacional y Estimulacion Neurocognitiva.</p>
    <p style="margin-top:.75rem;font-size:.9rem;color:var(--text-secondary);">Turnos: <strong>2262-301515</strong> o por email a <strong>direccionmedica@clinicajoseingenieros.ar</strong></p>
  `,

  hospitalnoche: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Hospital de Tarde y Noche</h2>
    <p>Dispositivo de reinsercion laboral y social. Actividades terapeuticas en horario vespertino y nocturno para pacientes en proceso de externacion.</p>
  `,

  talleres: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Talleres Terapeuticos</h2>
    <p>Dispositivos de rehabilitacion psicosocial orientados a la recuperacion de habilidades y la reinsercion comunitaria.</p>
    <ul style="margin:1rem 0;padding-left:1.5rem;color:var(--text-secondary);font-size:.9rem;">
      <li>Escuela de Rock (musica terapeutica)</li>
      <li>Huerta terapeutica</li>
      <li>Carpinteria</li>
      <li>Cocina</li>
      <li>Expresion corporal</li>
      <li>Estimulacion neurocognitiva</li>
    </ul>
  `,

  'talleres-serv': `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Talleres Terapeuticos</h2>
    <p>Dispositivos de rehabilitacion psicosocial orientados a la recuperacion de habilidades y la reinsercion comunitaria.</p>
  `,

  psiquiatria: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Psiquiatria</h2>
    <p>Abordaje psicofarmacologico de precision con enfoque neurobiologico. Diagnostico clinico y plan farmacologico individualizado.</p>
  `,

  psicologia: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Psicologia Clinica</h2>
    <p>Evaluacion psicodiagnostica, intervencion en crisis y psicoterapia en patologias graves. Abordaje individual y grupal.</p>
  `,

  clinica: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Clinica Medica</h2>
    <p>Seguimiento integral del estado clinico general. Evaluacion de comorbilidades y control de salud fisica de pacientes internados.</p>
  `,

  enfermeria: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Enfermeria Psiquiatrica</h2>
    <p>Cuidado integral las 24 horas. Observacion clinica, control de signos vitales y contencion terapeutica.</p>
  `,

  servicios: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Servicios Generales</h2>
    <p>Equipo que sostiene el funcionamiento cotidiano de la institucion: cocina, roperia, lavanderia y limpieza.</p>
  `,

  metodologia: `
    <h2 style="margin-bottom:1rem;font-family:'Playfair Display',serif;">Comunidad Terapeutica</h2>
    <p>El dispositivo de Comunidad Terapeutica constituye el eje vertebrador de nuestra practica institucional. Un modelo donde el ambiente mismo es agente de cambio.</p>
    <p style="margin-top:.75rem;font-size:.9rem;color:var(--text-secondary);">Basado en el modelo de Maxwell Jones y la tradicion de Franco Basaglia. La convivencia estructurada, los roles definidos y la participacion activa del paciente son pilares del tratamiento.</p>
  `

};
