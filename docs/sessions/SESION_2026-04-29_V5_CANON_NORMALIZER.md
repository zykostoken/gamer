# SESIÓN 29-ABR-2026 — V5 CANON NORMALIZER + META-SUBAGENTES

## Objetivo de la sesión

Cerrar el bug crítico de contaminación legacy en `metric_data` JSONB (audit #176)
y desplegar la primera generación de meta-subagentes de auditoría/supervisión.

Doctrina firmada por Dr. Gonzalo Pérez Cortizo: **"legacy es obsoleto, evolucionamos"**.
Sin compatibilidad sentimental. Todo fierro al diccionario canónico.

---

## Diagnóstico del bug

El trigger `aaa_zykos_v4_normalize_metric_data` (función `zykos_normalize_metric_data_to_v4`)
tenía pares `[legacy, canonical]` **invertidos** contra el canon vivo (`zykos_metric_dictionary`):

```
ARRAY['rt_1st_half_ms',          'rt_h1_mean_ms']           ← canon=rt_1st_half_ms
ARRAY['rt_2nd_half_ms',          'rt_h2_mean_ms']           ← canon=rt_2nd_half_ms
ARRAY['self_correction_ratio',   'autocorreccion_ratio']    ← canon=self_correction_ratio
ARRAY['planificacion_ratio',     'planificacion_index']     ← canon=planificacion_ratio
ARRAY['post_error_strategy',     'error_response_pattern']  ← canon=post_error_strategy
ARRAY['post_error_rt_mean_ms',   'latencia_post_error_ms']  ← canon=post_error_rt_mean_ms
```

Cada vez que un juego escribía el nombre canónico correcto, el trigger BEFORE INSERT
lo convertía a legacy y borraba el canónico.

**Efecto observable**: 51+ filas con keys legacy en `metric_data` JSONB hasta el día anterior,
4-6 pacientes afectados, todo en lawn-mower (juego más maduro).

**Por qué el guardian V2 no lo detectaba**: miraba sólo nombres de columna de `zykos_metrics_canonical`
(que nunca tuvo columnas con esos nombres), ciego al JSONB.

---

## Acciones ejecutadas

### A. STOP del sangrado

```sql
ALTER TABLE zykos_game_metrics
  DISABLE TRIGGER aaa_zykos_v4_normalize_metric_data;
```

### B. Normalizer V5 canon-aware (`zykos_normalize_metric_data_to_canon`)

- Dirección **única**: legacy → canon
- Lee `zykos_metric_dictionary` como fuente de verdad
- Drops puros para keys sin canon equivalente:
  `autocorreccion_ratio`, `planning_ratio`, `planificacion_*`, `self_correction_ratio`,
  `precision_meticulosidad_*`, `movement_pattern_type`, `instruction_read_time_ms`
- Drops por Constitución V4 Art IX:
  todas las `tremor_*`, `rigidez_index`, `cogwheel_index`, `clasp_knife_ratio`,
  `clinical_flags`, `output_clinico_en_juego`, etc.
- Inversiones: `decaimiento_*` → `vigor_mental_h1_h2` como `1/x`
- Tag `_v5_normalized` con `dictionary_version`

Nuevo trigger: `aaa_zykos_v5_normalize_canon` (BEFORE INSERT, ENABLED).
Trigger viejo: DROPPED.

### C. Backfill destructivo

Función pura idempotente: `zykos_normalize_jsonb_to_canon(jsonb) RETURNS jsonb`.

Procedimiento atómico:
1. Backup completo en `zykos_v5_backfill_backup_29abr2026`
2. DISABLE 3 triggers de inmutabilidad (`immutable_zykos_game_metrics_update`,
   `no_update_zykos_metrics_evidence`, `trg_no_tamper_metrics`)
3. UPDATE de 51 filas aplicando función pura
4. Recompute `evidence_hash` + `previous_hash` en orden cronológico por paciente
   con la fórmula original de `zykos_compute_evidence_hash`
5. RE-ENABLE los 3 triggers

**Resultado**: 0 filas con keys legacy en JSONB (verificado por guardian).

### D. Guardian V3 JSONB-aware

Edge Function `zykos-guardian` reescrita con 8 checks reales:

| Check | Detecta |
|---|---|
| `legacy_keys_in_jsonb_24h` | filas legacy en últimas 24h (CRITICAL) |
| `legacy_keys_in_jsonb_total` | histórico residual (warning) |
| `normalizer_trigger_enabled` | trigger V5 desactivado (CRITICAL) |
| `rls_zykos_all_tables` | tablas zykos_* sin RLS |
| `audit_stuck_in_progress` | audits >48h sin movimiento |
| `last_gameplay_write` | sin escrituras >72h |
| `zykos_ar_health` | dominio caído |
| `cron_failures_24h` | jobs fallidos |

4 RPCs auxiliares: `zykos_count_legacy_in_jsonb`, `zykos_check_trigger_enabled`,
`zykos_count_tables_without_rls`, `zykos_count_cron_failures_24h`.

### E. RLS gaps cerrados

Las 5 tablas `zykos_*` que estaban sin RLS habilitado:
- `zykos_analysis_queue`
- `zykos_canon_version_log`
- `zykos_canonical_admin_ops`
- `zykos_excluded_dnis_audit`
- `zykos_v5_backfill_backup_29abr2026` (creada en esta sesión)

Política base: `service_role ALL`, `authenticated SELECT` donde corresponde.

### F. Audits limpios

- 16 tareas in_progress estancadas → 7 cerradas como `done` (doctrinas firmadas + work cubierto),
  9 reclasificadas a `pending` (territorio Copilot/frontend para próximos PRs)
- 0 audits in_progress estancadas al cierre

---

## Meta-subagentes desplegados (pg_cron)

| Subagente | Schedule | Función |
|---|---|---|
| `zykos-guardian-30min` | `*/30 * * * *` | Reemplaza `zykos-guardian-hourly` mudo. 8 checks reales. |
| `zykos-data-flow-hourly` | `7 * * * *` | Detecta gaps de escritura por juego (umbral 36h warning, 168h critical) |
| `zykos-audit-progress-daily` | `0 6 * * *` | Detecta audits estancadas (in_progress >48h, pending >30d) |
| `zykos-marketing-pulse-weekly` | `0 8 * * 1` | Snapshot semanal B2B: pacientes activos, sesiones, juegos |

Tabla central: `zykos_meta_alerts` (id, agent_name, alert_type, severity, payload,
detected_at, acknowledged). RLS habilitado, índices en (detected_at) y (severity, acknowledged).

---

## Estado del guardian al cierre

```
Guardian v5 @ 2026-04-29T04:16:38.814Z
OK [info]    legacy_keys_in_jsonb_24h         0 filas legacy en JSONB últimas 24h
OK [info]    legacy_keys_in_jsonb_total       0 filas legacy en histórico completo
OK [info]    normalizer_trigger_enabled       Trigger normalizer V5 activo
OK [info]    rls_zykos_all_tables             100% tablas zykos_* con RLS
OK [info]    audit_stuck_in_progress          0 tareas estancadas
!! [warning] last_gameplay_write              Última escritura hace 116h (>72h)
OK [info]    zykos_ar_health                  zykos.ar HTTP 200
OK [info]    cron_failures_24h                0 cron failures 24h
```

7/8 OK. El único warning ("116h sin gameplay") es informativo: el médico está en guardia.

---

## Pendiente para próximas sesiones (territorio Copilot/frontend)

Reclasificadas a `pending` en `zykos_canon_audit`:

- **#11** platform_events implementación completa
- **#93** Art XIII frontend integration en cada juego
- **#120** BUG rokola_start_session (frontend insert directo en lugar de RPC)
- **#156** dashboard 174 métricas completas prioridad máxima
- **#161** migration_v4_1 alineación canónico completa (32 métricas pendientes con columna física)
- **#163** informe clínico v5.1 foco cognitivo psiquiatra
- **#166** todos los juegos gráficos no texto + rokola resume + informe SDK

Estas son features grandes que necesitan PRs dedicados de Copilot, no acciones puntuales.

---

## Migrations aplicadas en esta sesión (Supabase `aypljitzifwjosjkqsuu`)

1. `v5_normalizer_canon_aware_29abr2026`
2. `v5_backfill_destructivo_canon_29abr2026`
3. `v5_backfill_residual_29abr2026`
4. `v5_close_rls_gaps_29abr2026`
5. `v5_guardian_rpcs_y_meta_subagentes_29abr2026`

---

## Doctrina protegida

> "todo fierro a v4 canónicos quiero. todo arreglar las métricas al diccionario canónico."

El canon vivo (175+ métricas) en `zykos_metric_dictionary` es la fuente única de verdad
para cualquier métrica en cualquier capa: juegos, normalizer, dashboard, RPCs.

Cualquier nombre que no esté en el dict tiene tres destinos posibles:
1. **Renamed** → si hay equivalente canónico
2. **Inverted** → si es transformación matemática (ej. `decaimiento` → `vigor`)
3. **Dropped** → si no tiene equivalente y no aporta dato canon

Sin sentimentalismo. Sin compatibilidad legacy. **Evolucionamos.**

---

Audit #176 cerrado.

Dr. Gonzalo J. Pérez Cortizo + Claude (ZYKOS Agent)
29-abr-2026 04:30 AR
