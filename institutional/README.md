# ZYKOS GAMER — Paquete Institucional Completo
## "Sistema Integral de Gestión Sanitaria + Gaming Cognitivo"

---

## QUÉ INCLUYE

### Módulo Gaming (ZYKOS GAMER core — branch main)
- 12 juegos cognitivos con 140+ biometrías
- 5 packs de contenido (346 items)
- Motor genérico classify-and-place
- Motor inkblot (manchas algorítmicas)
- Calibración de hardware pre-sesión
- Color proyectivo pre/post game
- Evidence hash chain (integridad criptográfica)
- Dashboard de métricas clínicas

### Módulo HCE (Historia Clínica Electrónica)
- Registro de pacientes (internos/externos)
- Evoluciones con firma digital
- Hash chain inmutable (auditoría ministerial)
- Antecedentes, diagnósticos, medicación
- Signos vitales
- Consentimientos informados
- Número de historia clínica auto-generado
- Protección contra borrado (Ley 26.529: 10 años retención)

### Módulo Telemedicina
- Videoconsulta HD via Daily.co (sin límite de tiempo, sin apps)
- Cola de espera
- Créditos de sesión
- Registro de sesiones de video

### Módulo Receta Electrónica
- Prescripción digital
- Auditoría de dispensación
- Firma del profesional

### Módulo Gestión de Pacientes
- Portal del paciente
- Dashboard de métricas individuales
- Comunidad (posts, likes, comments)
- Actividades y cronograma
- Asistencia
- Alertas de crisis
- Notificaciones

### Módulo Profesional
- Panel del profesional
- Roles y permisos (admin, médico, psicólogo, etc.)
- Auditoría de acceso
- Firma y sello digital

### Módulo Administrativo
- Gestión de turnos
- Obras sociales
- Planes de servicio
- MercadoPago (pagos online)
- Configuración del establecimiento
- Analytics de uso

### Compliance
- Ley 26.529 (derechos del paciente)
- Ley 25.506 (firma digital)
- ReNaPDiS (registro nacional)
- Habilitación ministerial
- Dossier técnico para ministerio

---

## DEPLOY PARA CLIENTE (2-3 horas)

### 1. Supabase
- Crear proyecto nuevo
- Correr migrations en orden (001 → 042)
- Verificar tablas, triggers, RLS

### 2. Netlify
- Crear site nuevo
- Conectar al fork de este repo (branch institutional-package)
- Configurar environment variables:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - DAILY_API_KEY (telemedicina)
  - MERCADOPAGO_ACCESS_TOKEN (pagos)
  - SMTP credentials (Zoho o similar)

### 3. Branding
- Cambiar nombre de institución en todos los HTML
- Logo
- Colores CSS
- Datos de contacto
- Dominio custom

### 4. Datos iniciales
- Cargar profesionales
- Configurar establecimiento
- Crear pacientes iniciales
- Configurar obras sociales/planes

---

## PRICING SUGERIDO

| Paquete | Incluye | Setup | Mensual |
|---------|---------|-------|---------|
| GAMER Solo | 12 juegos + dashboard | $500 USD | $50/mes |
| GAMER + HCE | Gaming + historia clínica | $1.500 USD | $150/mes |
| Integral | Todo (gaming + HCE + telemedicina + receta + gestión) | $3.000 USD | $300/mes |
| Mantenimiento | Updates + soporte + hosting | incluido | incluido en mensual |

---

## NOTA IMPORTANTE

Este branch (institutional-package) NO se deploya en zykos.ar.
zykos.ar es solo el motor gamer B2B puro (branch main).

Este branch existe como paquete listo para clonar y desplegar
cuando un cliente institucional requiere el sistema completo.

Cada instancia es soberana: propio Supabase, propio Netlify, propios datos.

---

*Propiedad intelectual de Gonzalo Pérez Cortizo*
*Clínica Psiquiátrica Privada José Ingenieros SRL*
*CUIT 30-61202984-5*
