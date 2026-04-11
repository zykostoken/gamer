# ZYKOS GAMER

Plataforma B2B de semiología digital continua. Captura biomarcadores conductuales durante sesiones de juego terapéutico. No diagnostica. No reemplaza la evaluación clínica. Es un instrumento de fenotipado digital longitudinal.

Versión: **V4** | Repo: Psykostoken/gamer (privado) | Supabase: aypljitzifwjosjkqsuu | Dominio: zykos.ar

---

## Doctrina V4

1. **Semiología digital continua**, NO batería neuropsicológica.
2. **Captura crudo** en `zykos_raw_stream`. Análisis post-hoc en Edge Function `zykos-post-session-analyzer`.
3. **Temporalidad Q1-Q4 + H1-H2** — dos niveles de análisis temporal diferido.
4. **Cam/mic = identidad legal + FACS + cruce contextual**. NO evaluación cognitiva.
5. **Baseline individual** mínimo 5-10 sesiones. Cero cutoffs externos hardcodeados.
6. **El sistema mide. El clínico interpreta.** Cero diagnósticos algorítmicos.

---

## Stack

Frontend: HTML/CSS/JS vanilla sin frameworks
Deploy: Netlify auto-deploy desde GitHub main
Backend: Supabase PostgreSQL + RPC + RLS + Edge Functions
Auth: Custom bcrypt RPC — sin Supabase Auth
Dominio: zykos.ar

---

## Arquitectura del engine de métricas

Los juegos son instrumentos tontos. No saben que los miden. No escriben a Supabase directamente.

```
JUEGO (dumb HTML)
  ↓ expone métricas propias via ZYKOS.endSession(gameMetrics)
AGENTES PIRATAS (DOM observers externos al juego)
  ↓ capturan: RT, jitter, trayectoria, hesitaciones, contexto, FACS, rPPG
ZYKOS ENGINE (zykos-engine.js — único escritor)
  ↓ consolida agentes + gameMetrics + evidence hash
zykos_raw_stream + zykos_game_metrics (Supabase)
  ↓ metric_type = session_biomet | raw_events | session_summary
zykos-post-session-analyzer (Edge Function post-sesión)
  ↓ calcula temporalidad Q/H, composites, Z-scores, análisis FACS, llama Claude API
clinical_analysis (metric_type = clinical_analysis)
  ↓ texto descriptivo médico antes de que el clínico abra el perfil
DASHBOARD (games/portal/dashboard.html)
  ↓ Progressive Disclosure: análisis → dominios → métricas individuales
```

El engine es el único escritor. Los juegos aportan via `ZYKOS.endSession()`. Los agentes capturan todo lo observable desde afuera. El análisis es siempre post-hoc.

---

## Diccionario canónico V4 — 174 métricas, 22 dominios

Fuente de verdad: `engines/METRIC_DICTIONARY_V4.json`
Principio: Un constructo = un nombre = una columna. Si no está en el diccionario V4, no existe.

| Dominio | Métricas | Equivalente MATRICS/Estándar |
|---|---|---|
| MOTOR | 11 | Cogstate Finger Tapping |
| PRAXIS | 3 | Cogstate Detection |
| ATENCION | 13 | Speed of Processing + Vigilance |
| INHIBICION | 3 | Reasoning & Problem Solving |
| EJECUTIVO | 12 | Reasoning & Problem Solving |
| FATIGABILIDAD | 13 | Transversal (todos los dominios) |
| MEMORIA | 14 | Verbal & Visual Learning |
| CALCULO | 11 | NIH Toolbox Pattern Comparison |
| COMPRENSION | 6 | Extension ZYKOS |
| MEMORIA_TRABAJO | 3 | Working Memory (WAIS-IV Digit Span) |
| PLANIFICACION | 5 | Tower of London / ToH |
| SDT | 6 | CPT-IP (d-prime) |
| RT_DIST | 6 | Simple/Choice RT |
| ESPACIAL | 8 | BVMT-R / Visual Learning |
| AFEC | 7 | Social Cognition (MSCEIT) |
| FACS | 14 | FACS (Ekman & Friesen 1978) — identidad + contexto afectivo |
| IDENTIDAD | 5 | Biometría legal (cam/mic) |
| PRESENCIA | 6 | Engagement (Kaliouby 2005) |
| OG_MEDIA | 14 | rPPG (Verkruysse 2008) |
| PLATAFORMA | 7 | Extension ZYKOS (conducta portal) |
| META | 5 | Metadata normalización |
| HARDWARE | 2 | Hardware correction baseline |

Métricas clave: `jitter_reposo_px`, `vel_cv`, `vel_oscilacion_index`, `precision_deposito_px`, `rt_mean_ms`, `rt_cv`, `decaimiento_vigilancia`, `perseveracion_count`, `d_prime`, `hit_rate`, `evocacion_libre_count`, `consolidacion_pct`, `calculo_correcto_count`, `razonamiento_proporcional_pct`, `tiempo_planificacion_ms`, `facs_genuine_smile_pct`, `identity_session_verified`

Métricas **prohibidas** (nunca en código activo): `tremor_*`, `rigidez_index`, `espasticidad_index`, `cogwheel_index`, `clasp_knife_ratio`, `interferencia_ratio`, `economia_cognitiva`, `eficacia_plan_propio`, `decaimiento_mitades`.

---

## Temporalidad Q1-Q4 + H1-H2

Las métricas marcadas `temporal: true` en el diccionario tienen variantes calculadas post-hoc:
- **Q1-Q4**: cuartiles del tiempo de sesión (0-25%, 25-50%, 50-75%, 75-100%)
- **H1-H2**: mitades del tiempo de sesión (0-50%, 50-100%)

Convención de nombre: `rt_mean_ms_Q1`, `rt_mean_ms_H2`, etc. Calculadas por `zykos-post-session-analyzer`.

---

## Cam/mic — Identidad Legal + FACS + Contexto Afectivo

La cámara y el micrófono tienen **tres roles distintos** (ninguno cognitivo):

1. **IDENTIDAD** (dominio IDENTIDAD): verificación de autoría de la sesión. `identity_face_present_pct`, `identity_session_verified`, `identity_anomaly_count`.
2. **FACS** (dominio FACS): fenómenos faciales observables (Action Units). Cruce contextual con rendimiento — `affect_reactivity`, `affect_smile_during_hits_pct`. Nunca diagnóstico.
3. **OG_MEDIA** (dominio OG_MEDIA): señales raw — luminancia, canal verde (proxy rPPG), audio ambiental.

Todo el procesamiento ocurre en el browser. Ningún frame ni audio sale del dispositivo.

---

## Juegos (15 en portal)

Activos: lawn-mower, pill-organizer, super-market, neuro-chef, medication-memory, fridge-logic, reflejos, daily-routine, ferretería, almacén, electrodomésticos, librería, carnicería, mercería.
En reparación: inkblot.

Modos en packs classify-and-place: clasificar, armar kit, calcular, semejanzas, ordenar (seriación), razonar (inferencia).

---

## Base de datos (Supabase: aypljitzifwjosjkqsuu)

Tablas: `zykos_users` (45 cols, RLS), `zykos_game_metrics` (hash chain SHA-256), `zykos_game_sessions`, `zykos_calibrations`, `zykos_audit_log`, `zykos_raw_stream`.

RPCs: `zykos_register`, `zykos_login`, `zykos_validate_session`, `zykos_consume_session`, `zykos_get_metric_zscores`, `zykos_get_oscillations`, `zykos_get_concomitants`.

Registro: 15 sesiones iniciales por usuario. Notificación mail al admin en cada registro.

---

## Seguridad

HSTS, X-Frame-Options DENY, CSP estricta, XSS-Protection en todos los headers.
Evidence hash chain SHA-256 en `zykos_game_metrics` (inmutabilidad — trigger `prevent_delete_evidence` activo).
RLS: cada usuario solo ve sus propios datos. Admin solo accesible a superadmin.
Anon key pública segura por RLS (no permite acceso directo a tablas).

---

## Variables de entorno

`RESEND_API_KEY` — envío de mails de registro (notify-registration)

---

## Propiedad intelectual

DNDA Argentina — obra inédita (en trámite)
INPI Argentina — PSYKooD Clase 44 (en trámite)
Copyright en /COPYRIGHT | Licencia propietaria en /LICENSE

---

## Deudas técnicas declaradas

- neuro-chef: biometrics.js propio, no migrado al engine canónico
- daily-routine, fridge-logic, super-market: sin engine canónico ni agentes activos
- inkblot: en reparación, rediseño pendiente
- d-prime: requiere corrección loglineal de Hautus para hit_rate=1.0 o FAR=0.0
- SEM por métrica: no calculado aún — requiere estudio test-retest
- Validación clínica pendiente: test-retest ICC, validez convergente, normas poblacionales (mínimo 300 sujetos)
- zykos-post-session-analyzer: análisis temporal Q1-Q4/H1-H2 pendiente de implementación en Edge Function

---

## Nota epistemológica

ZYKOS GAMER no diagnostica. Las métricas son observaciones conductuales digitales.
La nomenclatura evita deliberadamente términos diagnósticos nosológicos (DSM/CIE).
Los outputs son descriptores funcionales. La interpretación clínica es post-hoc humana, no algorítmica.
Los estudios requeridos antes de uso clínico estandarizado incluyen test-retest ICC por métrica,
validez convergente contra baterías estándar (MATRICS, CANTAB, NIH Toolbox),
y normas poblacionales por edad, sexo, escolaridad y lateralidad (mínimo 300 sujetos).
