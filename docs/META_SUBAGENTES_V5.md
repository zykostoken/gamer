# META-SUBAGENTES ZYKOS V5

**Versión:** 5.0.0
**Promulgado:** 29-abr-2026
**Autor:** Dr. Gonzalo J. Pérez Cortizo + Claude

## Distinción crítica

**Subagentes piratas** (capa cognitiva, ya operativos):
agentes 1:1 dominio que leen `zykos_metric_dictionary` y producen análisis clínico
post-sesión. Definidos por la Constitución V4 Art VIII. Lista actual:

- `agent-rt` (atención/RT)
- `agent-executive` (ejecutivo)
- `agent-tremor` (motor)
- `agent-memory` (memoria)
- `agent-context` (sensopercepción)
- `agent-comprehension` (comprensión)
- `agent-navigation` (navegación)

**Meta-subagentes** (capa de gestión, ESTOS son los nuevos):
agentes de auditoría, supervisión, mantenimiento y marketing del proyecto en sí.
NO leen métricas clínicas, vigilan la salud técnica del sistema.

---

## TIER 1 — pg_cron (Supabase, ya desplegados)

### `agent-canon-watch` (`zykos-guardian-30min`)

- **Schedule:** cada 30 minutos
- **Implementación:** Edge Function `zykos-guardian` v3 + cron trigger
- **Reemplaza:** `zykos-guardian-hourly` (v2 mudo, sólo detectó 1 alerta en 18 días)
- **Escribe a:** `zykos_guardian_alerts`
- **Checks (8):**
  1. Legacy keys en `metric_data` JSONB últimas 24h (CRITICAL si >0)
  2. Legacy keys en histórico completo (warning)
  3. Trigger normalizer V5 enabled (CRITICAL si OFF)
  4. RLS habilitado en TODAS las tablas zykos_* (CRITICAL si <100%)
  5. Audits in_progress estancadas >48h (warning)
  6. Última escritura de gameplay >72h (warning)
  7. zykos.ar HEAD HTTP (CRITICAL si !=200)
  8. Cron job failures últimas 24h (warning)

### `agent-data-flow` (`zykos-data-flow-hourly`)

- **Schedule:** cada hora minuto 7 (offset para no chocar con guardian)
- **Implementación:** SQL puro, función `zykos_meta_check_data_flow()`
- **Escribe a:** `zykos_guardian_alerts` (alert_type=data_flow_gap)
- **Detecta:** juegos esperados (lawn-mower, pill-organizer, super-market,
  medication-memory, fridge-logic, daily-routine, neuro-chef, reflejos)
  sin escrituras de session_summary/session_complete:
  - >36h = info
  - >168h = warning
  - sin escrituras nunca = critical

### `agent-audit-progress` (`zykos-audit-progress-daily`)

- **Schedule:** diario 06:00 UTC (03:00 AR)
- **Escribe a:** `zykos_meta_alerts` (alert_type=stuck_task)
- **Detecta:**
  - `zykos_canon_audit.status='in_progress'` con created_at >48h = warning
  - `zykos_canon_audit.status='in_progress'` con created_at >7d = critical
  - `zykos_canon_audit.status='pending'` con created_at >30d = warning

### `agent-marketing-pulse` (`zykos-marketing-pulse-weekly`)

- **Schedule:** lunes 08:00 UTC (05:00 AR)
- **Escribe a:** `zykos_meta_alerts` (alert_type=weekly_snapshot)
- **Genera:** `zykos_marketing_pulse_snapshot()` returns jsonb con:
  - `unique_patients_active` (últimos 7 días, excluyendo zykos_excluded_dnis)
  - `sessions_completed`
  - `games_played` (objeto con conteo por slug)
  - `canonical_metrics_count` (métricas no deprecated en dict)
  - `legacy_contamination` (filas con keys legacy en últimos 7d, debería ser 0)

---

## TIER 2 — GitHub Actions (workflows.yml, próximos PRs)

### `agent-pr-curator` (workflow daily)

Detectar PRs estancados, branches huérfanas, dependabot alerts open.
Crear issue resumen semanal.

### `agent-deploy-sentry` (workflow on push to main)

Validar que netlify deploy funcionó. Smoke test:
- `zykos.ar/portal` carga
- Dashboard responde
- RPCs canónicas existen

Si falla: rollback issue automático.

### `agent-codeql` (ya existe, falta refinar)

CodeQL scan ya configurado (default GitHub). Falta:
- Reportar a un canal (email/Slack)
- Linkear con `zykos_meta_alerts`

---

## TIER 3 — Edge Functions on-demand

### `agent-stuck-alert` (PR #32 pendiente decisión)

Cuando paciente acumula 3 fallos consecutivos >49% error rate, alerta a dirección médica.
Decisión pendiente:
- A. merge as-is
- B. refactor threshold configurable
- C. close (no se necesita ahora)
- D. log-only sin SMTP por 30 días para validar

### `agent-marketing-content` (futuro)

Cuando `zykos_marketing_pulse_snapshot` muestre milestones (100 pacientes,
1000 sesiones, etc.), generar borrador de post B2B con datos. NO publicar
automáticamente. Sólo borrador en `zykos_meta_alerts` para revisión humana.

---

## Tabla central `zykos_meta_alerts`

```sql
CREATE TABLE zykos_meta_alerts (
  id BIGSERIAL PRIMARY KEY,
  agent_name text NOT NULL,            -- 'agent-canon-watch', etc.
  alert_type text NOT NULL,             -- 'stuck_task', 'data_flow_gap', etc.
  severity text NOT NULL CHECK (...),   -- 'critical' | 'warning' | 'info'
  payload jsonb NOT NULL,
  detected_at timestamptz DEFAULT now(),
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by text
);
```

RLS: service_role ALL, authenticated SELECT.
Índices: (detected_at DESC), (severity, acknowledged) WHERE acknowledged=false.

Esta tabla **survives chat cuts**. Cualquier instancia de Claude que entre nueva
puede leer `SELECT * FROM zykos_meta_alerts WHERE acknowledged=false ORDER BY detected_at DESC`
y entender qué está pasando.

---

## Dashboard de salud (futuro: `/admin/health.html`)

UI mínima que muestra:

- Últimas 24h de alertas no reconocidas
- Estado de los 4+ meta-subagentes (last_run, last_alert)
- Estado del normalizer V5 (filas procesadas hoy)
- Estado del canon (versión vigente, métricas activas)
- Botón "acknowledge" por alerta

No urgente. La tabla `zykos_meta_alerts` es accesible vía SQL hasta que exista UI.

---

## Doctrina

> "Subagentes de gestión, supervisión, auditoría y mantenimiento del código
> o del portal. De marketing inclusive."
>
> — Dr. Gonzalo, 29-abr-2026

Estos meta-subagentes NO son IA generativa. Son automatismos de Postgres + cron
que no pueden alucinar, no pueden inventar datos y no requieren supervisión humana
constante. Cumplen el principio Constitución V4 Art XII: auditoría interna continua.

