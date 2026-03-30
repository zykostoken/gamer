# ZYKOS GAMER — Plantilla de Clonación Institucional
## "Big Mac Template" — Mismo producto, distinta franquicia

---

## QUÉ ES ESTO

Esta plantilla permite desplegar una instancia completa de ZYKOS GAMER
para cualquier institución de salud mental en menos de 2 horas.
Mismo código, mismas métricas, misma arquitectura.
La institución solo cambia: nombre, logo, Supabase, dominio.

---

## CHECKLIST DE DEPLOY (2 horas)

### 1. SUPABASE (30 min)
- [ ] Crear proyecto nuevo en Supabase (región: São Paulo o más cercana)
- [ ] Anotar: `PROJECT_URL` y `ANON_KEY`
- [ ] Correr migration SQL: `migrations/001_unified_telemetry.sql`
- [ ] Correr RPCs: copiar funciones de `sql/` (register, login, validate_session, consume_session, logout, compute_evidence_hash, auto_audit)
- [ ] Verificar tablas creadas: zykos_users, zykos_game_metrics, zykos_game_sessions, etc.
- [ ] Habilitar RLS en todas las tablas
- [ ] Crear trigger `prevent_delete_evidence` en zykos_users y zykos_game_metrics

### 2. REPOSITORIO (15 min)
- [ ] Fork privado de `zykostoken/gamer`
- [ ] Renombrar en `package.json`: name → nombre de la institución
- [ ] Editar `js/supabase-config.js`: cambiar URL y ANON_KEY
- [ ] Editar `shared/telemetry.js`: cambiar URL y ANON_KEY (líneas 21-22)
- [ ] Editar `LICENSE`: cambiar titularidad si corresponde (o mantener licencia ZYKOS)

### 3. BRANDING (20 min)
- [ ] `index.html`: cambiar título, descripción, nombre de institución en footer
- [ ] `auth/index.html`: cambiar título y textos de consentimiento
- [ ] `games/portal/index.html`: cambiar logo y nombre
- [ ] `games/shared/mood-modals.js`: cambiar nombre en comentarios
- [ ] `engines/*/index.html`: cambiar título en header
- [ ] Opcional: cambiar colores CSS (--neon, --neon2, --accent)

### 4. NETLIFY (15 min)
- [ ] Crear site en Netlify, conectar al fork de GitHub
- [ ] Asignar dominio custom (o usar .netlify.app)
- [ ] Verificar auto-deploy desde main
- [ ] Verificar headers de seguridad (netlify.toml ya los tiene)

### 5. VERIFICACIÓN (20 min)
- [ ] Registrar usuario test
- [ ] Jugar cada juego, verificar que guarda métricas
- [ ] Verificar pre-game: calibración + color + preguntas
- [ ] Verificar post-game: color + métricas modal
- [ ] Verificar sesiones: contador baja, bloqueo al agotar
- [ ] Verificar dashboard: carga métricas del test user
- [ ] Borrar usuario test (si no hay prevent_delete, agregarlo)

### 6. ENTREGA (20 min)
- [ ] Entregar credenciales Supabase al cliente (o gestionar nosotros)
- [ ] Configurar email de contacto en portal (sesiones agotadas)
- [ ] Documentar: URL del site, URL de Supabase, repo del fork
- [ ] Capacitación básica: cómo registrar pacientes, cómo ver dashboard

---

## ARCHIVOS QUE CAMBIAN POR INSTITUCIÓN

| Archivo | Qué cambiar |
|---------|-------------|
| `js/supabase-config.js` | URL y ANON_KEY del Supabase propio |
| `shared/telemetry.js` | URL y ANON_KEY (hardcoded líneas 21-22) |
| `index.html` | Nombre institución, footer, contacto |
| `auth/index.html` | Nombre institución en consentimientos |
| `games/portal/index.html` | Logo, nombre, email contacto |
| `LICENSE` | Licenciatario (si venta de licencia) |
| `netlify.toml` | Dominio (si custom headers) |

**TODO LO DEMÁS ES IDÉNTICO.** Juegos, métricas, shared scripts, engines, packs.

---

## MODELO DE PRICING

### Opción A: SaaS (recomendado)
- Institución paga mensualidad
- ZYKOS gestiona Supabase y hosting
- Updates automáticos
- Soporte incluido

### Opción B: Licencia On-Premise
- Institución compra licencia perpetua
- Recibe fork del repo + SQL migrations
- Gestiona su propio Supabase/hosting
- Updates opcionales con fee

### Opción C: Profesional Autónomo (efecto perdigón)
- Psiquiatra/psicólogo individual
- Usa zykos.ar directamente (sin fork)
- Membresía profesional mensual
- N pacientes bajo su cuenta
- Sin infraestructura propia

---

## ARQUITECTURA DE DATOS

Cada instancia tiene su propio Supabase.
Los datos NUNCA se cruzan entre instancias.
Cada institución es soberana sobre sus datos.

```
ZYKOS GAMER (motor)
├── Instancia 1: Clínica José Ingenieros (carnival)
│   └── Supabase: buzblnkpfydeheingzgn
├── Instancia 2: Hospital X (fork)
│   └── Supabase: propio
├── Instancia 3: Consultorio Dr. Y (zykos.ar SaaS)
│   └── Supabase: aypljitzifwjosjkqsuu (compartido, RLS por profesional)
└── Instancia N: ...
```

La base normativa poblacional se construye agregando datos ANONIMIZADOS
de todas las instancias. Ninguna instancia accede a datos de otra.

---

## QUÉ INCLUYE CADA INSTANCIA

- 12 juegos cognitivos (7 standalone + 4 classify-and-place + 1 inkblot)
- 5 packs de contenido (346 items, 35 misiones, 24 eventos)
- Framework biométrico: 140+ métricas por sesión
- Calibración de hardware pre-partida
- Color proyectivo pre/post game
- Evidence hash chain (integridad criptográfica)
- Guarda eterna de datos (prevent_delete triggers)
- Sistema de sesiones (free 15 / ilimitado con membresía)
- Dashboard clínico con 14 constructos x 7 dominios
- Compliance packages: GDPR, HIPAA, ReNaPDiS (templates)

---

## QUÉ NO INCLUYE (SOLO EN CARNIVAL/INSTITUCIONAL COMPLETO)

- Historia Clínica Electrónica (HCE)
- Telemedicina (Daily.co)
- Receta electrónica
- MercadoPago
- Gestión de turnos
- Portal de familiares
- Firma digital
- Panel de profesionales
- Netlify functions (auth, hdd-admin, etc.)

Estos módulos son el "plan integral" que se vende por separado
como sistema de gestión institucional completo.

---

*ZYKOS GAMER es propiedad de Gonzalo Pérez Cortizo.*
*Clínica Psiquiátrica Privada José Ingenieros SRL · CUIT 30-61202984-5*
*Registro DNDA/INPI pendiente.*
