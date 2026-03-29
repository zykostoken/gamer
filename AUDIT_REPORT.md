# ZYKOS GAMER — AUDITORÍA COMPLETA DEL REPOSITORIO
## Repo: zykostoken/gamer | Site: zykos.ar
## Fecha: 2026-03-29 | Auditor: Claude Opus 4.6

---

## RESUMEN EJECUTIVO

El repo tiene 83 archivos. La arquitectura es sólida: motor de juegos cognitivos con biometrías clínicas, sistema auth propio via Supabase RPC, framework compartido (biomet.js, telemetry.js, auto-save.js, mood-modals.js, show-metrics.js), y un motor genérico de clasificación (engines/classify-and-place/) con 5 packs de contenido temático de Necochea.

### ESTADO GENERAL: FUNCIONAL CON ISSUES CRÍTICOS DE SEPARACIÓN

---

## ISSUES ENCONTRADOS

### CRÍTICO-1: CONTAMINACIÓN cautious-carnival ↔ ZYKOS
**Severidad: CRÍTICA** — Viola la consigna fundamental de separación.

Archivos con referencias directas a "Clínica José Ingenieros" o "/hdd/":

| Archivo | Tipo de contaminación |
|---------|----------------------|
| `games/shared/mood-modals.js` | Comentarios: "Clínica José Ingenieros" (líneas 2, 9) |
| `games/portal/dashboard.html` | Título: "Dashboard Biométrico HDD - Clínica José Ingenieros" |
| `games/play/fridge-logic.html` | Texto visible: "Clínica Psiquiátrica José Ingenieros · HDD" (línea 99) |
| `games/play/fridge-logic.html` | Redirect a `/hdd/portal/` (líneas 669, 724) |
| `games/play/super-market.html` | Texto visible: "Clínica Psiquiátrica José Ingenieros · HDD" (línea 96) |
| `games/play/medication-memory.html` | Links a `/hdd/portal/`, `/hdd/admin`, `/api/hdd/games` |
| `hdd/admin/informe-clinico.html` | Archivo entero es de HDD |
| `dashboard/index.html` | Redirect a `/hdd/admin/informe-clinico.html` |
| `netlify.toml` | Redirects `/dashboard` y `/informe` a `/hdd/` paths |
| `shared/telemetry.js` | Tablas: `hdd_platform_sessions`, `hdd_game_sessions`, `hdd_clinical_alerts` |
| `migrations/001_unified_telemetry.sql` | Todas las tablas prefijo `hdd_` |

**FIX REQUERIDO:**
1. Renombrar tablas `hdd_*` → `zykos_*` en migration, telemetry.js, y todos los juegos
2. Eliminar texto "Clínica José Ingenieros" de todos los archivos ZYKOS
3. Eliminar `/hdd/` directory completo del repo ZYKOS
4. Actualizar redirects en netlify.toml
5. Cambiar back-links de `/hdd/portal/` a `/games/portal/`
6. El informe clínico debe vivir en `/dashboard/` o `/report/`, no en `/hdd/`

### CRÍTICO-2: BUG REGISTRO (FIXEADO)
**Estado: RESUELTO** — Commit 58666d3

`auth/index.html` línea 234: `var pid` → `var dni`. La variable `pid` no existía en el scope de validación, causando que `!dni` siempre fuera `true` y el formulario nunca llegara a Supabase.

### ALTO-1: SUPABASE CONFIG DUPLICADA
**Severidad: ALTA**

Hay DOS archivos de config Supabase idénticos:
- `js/supabase-config.js` (usado por todos los HTML)
- `shared/supabase-config.js` (sin referencias)

Además, `shared/telemetry.js` tiene las credenciales HARDCODEADAS en línea 21-22 en vez de usar el config centralizado.

**FIX:** Eliminar `shared/supabase-config.js`, hacer que `telemetry.js` importe de `js/supabase-config.js`.

### ALTO-2: ENGINES NO CONECTADOS AL PORTAL
**Severidad: ALTA**

`engines/classify-and-place/` (353 líneas) y `engines/kitchen/` (349 líneas) son motores genéricos completos con 5 packs de contenido (346 items totales: ferretería, almacén, electrodomésticos, librería, supermercado). NINGUNO aparece en el portal de juegos ni tiene redirect en netlify.toml.

Packs disponibles:
- **La Ferretería de Berugo** — 90 items, 9 categorías, 7 misiones
- **El Almacén de Don Tito** — 79 items, 9 categorías, 7 misiones
- **Electrodomésticos El Rayo** — 61 items, 8 categorías, 7 misiones
- **La Librería de la Seño Marta** — 72 items, 8 categorías, 7 misiones
- **Desafío Milanesas (supermarket)** — 44 items, 6 categorías, 0 misiones

**FIX:** Agregar estos juegos al portal y crear redirects.

### ALTO-3: localStorage INCONSISTENTE
**Severidad: ALTA**

Hay dos sistemas de sesión paralelos:
- `zykos_token` / `zykos_user` (sistema nuevo, auth RPC)
- `games_session` / `games_user` (sistema viejo?)
- `hdd_patient_dni` / `hdd_patient_id` / `hdd_admin_session` (sistema HDD)

Los juegos checkean las tres variantes con fallbacks encadenados. Esto genera confusión y posibles bugs de sesión.

**FIX:** Unificar en `zykos_*` exclusivamente.

### MEDIO-1: MIGRATION SQL APUNTA A PROYECTO EQUIVOCADO
**Severidad: MEDIA**

`migrations/001_unified_telemetry.sql` línea 4: `Supabase project: buzblnkpfydeheingzgn`

El proyecto ZYKOS real es `aypljitzifwjosjkqsuu`. El ID en el comentario es de otro proyecto (posiblemente cautious-carnival).

### MEDIO-2: biomet.js SOLO USADO EN 2 ARCHIVOS
**Severidad: MEDIA**

`games/shared/biomet.js` (718 líneas, framework sofisticado de biometrías) solo se importa en:
- `games/play/daily-routine.html`
- `index.html` (landing page, no un juego)

Los demás juegos implementan sus propias métricas ad-hoc. Oportunidad de unificar.

### MEDIO-3: original-code/ DIRECTORY
**Severidad: BAJA**

30+ archivos en `original-code/` que son copias anteriores de los juegos y migraciones. Peso muerto en el repo.

**FIX:** Mover a un branch `archive` o eliminar.

### MEDIO-4: CSS Y JS HUÉRFANOS
**Severidad: BAJA**

- `css/hdd-portal.css` — no referenciado en ningún HTML activo
- `css/main.css` — no referenciado
- `js/core.js` — no referenciado
- `scripts/obfuscate-production.mjs` — script de ofuscación, no se usa en CI

### INFO-1: NEURO-CHEF ESTRUCTURA SEPARADA
Neuro-chef es el único juego con estructura multi-archivo (5 JS + 1 CSS + 2 HTML). Todos los demás son HTML single-file. No es un bug pero es inconsistente.

---

## ESTRUCTURA DEL REPO

```
zykostoken/gamer (83 archivos)
├── .gitignore
├── README.md
├── package.json
├── netlify.toml                          ← REDIRECTS (7 reglas + headers)
├── robots.txt
├── sitemap.xml
├── index.html                            ← Landing page ZYKOS GAMER
│
├── auth/
│   └── index.html                        ← Login/Registro (FIXEADO)
│
├── js/
│   ├── supabase-config.js                ← Config centralizada Supabase
│   ├── sanitize.js
│   ├── consent-modal.js
│   └── core.js                           ← ¿HUÉRFANO?
│
├── css/
│   ├── main.css                          ← ¿HUÉRFANO?
│   └── hdd-portal.css                    ← ¿HUÉRFANO?
│
├── games/
│   ├── index.html                        ← Games index
│   ├── portal/
│   │   ├── index.html                    ← Portal del jugador
│   │   └── dashboard.html                ← Dashboard biométrico
│   ├── play/
│   │   ├── lawn-mower.html               ← Cortadora de Césped (5500+ líneas)
│   │   ├── pill-organizer.html           ← Organizador de Medicación
│   │   ├── super-market.html             ← Desafío Milanesas
│   │   ├── fridge-logic.html             ← Heladera Inteligente
│   │   ├── medication-memory.html        ← Memoria de Medicación
│   │   ├── daily-routine.html            ← Mi Rutina Diaria
│   │   └── neuro-chef/                   ← Cocinero Neuronal (multi-file)
│   │       ├── index.html
│   │       ├── dashboard.html
│   │       ├── css/styles.css
│   │       └── js/ (biometrics, config, educational-tips, game, levels)
│   └── shared/
│       ├── biomet.js                     ← Framework biométrico universal (718 líneas)
│       ├── auto-save.js                  ← Captura eventos de sesión
│       ├── show-metrics.js               ← Modal post-juego
│       ├── mood-modals.js                ← Registro de humor por color
│       ├── mood-modals.html
│       └── input-calibration.js          ← Calibración de input
│
├── engines/                              ← MOTORES GENÉRICOS (NO CONECTADOS)
│   ├── classify-and-place/
│   │   ├── index.html                    ← Motor de clasificación (353 líneas)
│   │   └── pack-schema.json              ← Schema JSON para packs
│   └── kitchen/
│       └── index.html                    ← Motor de cocina (349 líneas)
│
├── packs/                                ← CONTENIDO TEMÁTICO (5 PACKS)
│   └── classify-and-place/
│       ├── ferreteria/pack.json          ← 90 items, 9 cats, 7 misiones
│       ├── almacen-general/pack.json     ← 79 items, 9 cats, 7 misiones
│       ├── electrodomesticos/pack.json   ← 61 items, 8 cats, 7 misiones
│       ├── libreria-escolar/pack.json    ← 72 items, 8 cats, 7 misiones
│       └── supermarket/pack.json         ← 44 items, 6 cats, 0 misiones
│
├── shared/
│   ├── supabase-config.js                ← DUPLICADO de js/supabase-config.js
│   ├── telemetry.js                      ← Telemetría unificada (credenciales hardcoded)
│   └── biomet/
│       └── session-telemetry.json
│
├── migrations/
│   └── 001_unified_telemetry.sql         ← Schema tablas hdd_* (debe ser zykos_*)
│
├── hdd/                                  ← NO DEBERÍA EXISTIR EN ZYKOS
│   └── admin/
│       └── informe-clinico.html          ← Informe clínico (400 líneas)
│
├── dashboard/
│   └── index.html                        ← Redirect a /hdd/ (11 líneas)
│
├── original-code/                        ← ARCHIVO HISTÓRICO (peso muerto)
│   ├── games/ (copias anteriores)
│   ├── migrations/ (7 archivos SQL)
│   ├── shared/ (copias anteriores)
│   └── sql/ (4 archivos SQL)
│
└── scripts/
    └── obfuscate-production.mjs          ← Script ofuscación (no usado en CI)
```

---

## SUPABASE STATUS

**Proyecto ZYKOS:** `aypljitzifwjosjkqsuu.supabase.co`
- `zykos_register` RPC: ✅ FUNCIONAL
- `zykos_login` RPC: ✅ FUNCIONAL
- `zykos_validate_session` RPC: ✅ FUNCIONAL
- Tablas de telemetría (`hdd_*`): ⚠️ NO VERIFICADAS (requiere service_role key)
- Usuarios registrados: al menos 11 (user_id secuencial)
- **Nota:** hay un usuario test (test@test.com, DNI 99999999, user_id 11) — borrar

---

## PLAN DE ACCIÓN (PRIORIDAD)

### FASE 1: DESCONTAMINACIÓN (URGENTE)
1. Renombrar todas las tablas `hdd_*` → `zykos_*` en Supabase
2. Actualizar `shared/telemetry.js` con nuevos nombres
3. Actualizar todos los juegos que referencian `hdd_*`
4. Eliminar texto "Clínica José Ingenieros" de todos los archivos
5. Reemplazar links `/hdd/portal/` → `/games/portal/`
6. Mover `hdd/admin/informe-clinico.html` → `dashboard/report.html` (o similar)
7. Actualizar netlify.toml redirects
8. Unificar localStorage a `zykos_*` exclusivamente

### FASE 2: MOTORIZAR ENGINES
1. Conectar `engines/classify-and-place/` al portal
2. Agregar los 5 packs como juegos seleccionables
3. Conectar telemetría del engine a Supabase
4. Agregar redirects en netlify.toml

### FASE 3: JUEGO RORSCHACH
1. Crear `engines/inkblot/` — generador algorítmico de manchas simétricas
2. Pack de mecánica cognitiva: clasificación/asociación
3. Pack de mecánica creativa: generador de manchas propias

### FASE 4: LIMPIEZA
1. Eliminar `shared/supabase-config.js` (duplicado)
2. Eliminar `original-code/` o mover a branch archive
3. Eliminar `css/hdd-portal.css`, `css/main.css`, `js/core.js` si no se usan
4. Unificar credenciales Supabase en un solo punto

---

## MÉTRICAS DEL REPO

| Métrica | Valor |
|---------|-------|
| Archivos totales | 83 |
| Juegos live en portal | 7 (6 + neuro-chef) |
| Engines no conectados | 2 (classify-and-place, kitchen) |
| Packs de contenido | 5 (346 items, 36 categorías, 28 misiones) |
| Líneas de código estimadas | ~25,000+ |
| Issues críticos | 2 (1 resuelto) |
| Issues altos | 3 |
| Issues medios | 4 |

---

*Auditoría realizada sobre commit 58666d3 (main)*
*Siguiente paso: ejecutar Fase 1 (descontaminación)*
