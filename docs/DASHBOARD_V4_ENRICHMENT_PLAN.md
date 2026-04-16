# PLAN · Dashboard V4 Enriquecido — Transparencia + Baseline individual + Cam/Mic

**Fecha:** 16-Abr-2026 · **Autor:** Gonzalo + Claude Opus 4.6
**Branch:** `fix/v4-canonical-audit-dashboard`
**Estado:** Planificacion · lista la RPC granular de lawn-mower. Falta todo lo demas.

---

## PROBLEMA

El dashboard actual muestra numeros (rt_cv=1.13, fatiga_h2_h1=1.34) pero:

1. **Nadie entiende que significan** sin ser el que los definio. `rt_cv` es jerga.
2. **Se comparan contra nada**. Un 1.13 puede ser normal o catastrofico — depende de la historia del propio paciente, no de cutoffs universales (Constitucion V4 prohibe normas poblacionales importadas).
3. **No se resta el hardware**. `hw_idle_jitter_px` mide el jitter del dispositivo en reposo sin paciente — es baseline a restar. Hoy se ignora.
4. **Las capas cam/mic estan invisibles**. face-api.js genera 17 metricas canonicas V4 (BIOMETRICA_CAM_FACS + BIOMETRICA_OG_MEDIA + afecto cruzado con contexto) que el dashboard no muestra. Sin esto no hay defensa legal de identidad ni semiologia afectiva.
5. **Visualizacion generica**. Graficos de linea Chart.js por metrica, sin distincion entre lo clinicamente importante y lo decorativo.

---

## OBJETIVO

Dashboard al nivel de un papel peer-reviewed de neuropsicologia digital. Cada metrica:
- **Definida** inline (hover o subtitulo): que mide, como se calcula, que significa alto/bajo.
- **Contextualizada contra el propio paciente** (baseline individual, nunca normas externas).
- **Con calibracion hardware restada** cuando corresponde.
- **Presentada como la presentaria un estadistico**: distribuciones, no solo medias; bandas de confianza del propio baseline; tendencias con IC95%; small multiples; destacar lo clinicamente informativo.

---

## FASES DE EJECUCION

### FASE A — Backend: RPC de baseline individual

**`zykos_dashboard_baseline(p_dni, p_days_back)`**

Calcula, para cada metrica canonica V4, la distribucion historica del propio paciente:
- `median`, `iqr_low` (p25), `iqr_high` (p75), `p10`, `p90`
- `n_sessions` que contribuyeron
- `first_seen`, `last_seen`

Estos valores son el "self-benchmark". El dashboard compara la sesion de hoy contra la banda intercuartilica del propio paciente.

Requisito: minimo 3 sesiones historicas. Si no, mostrar "baseline insuficiente, se necesitan al menos 3 sesiones para contexto intra-individual".

### FASE B — Backend: RPC granular V2 con cam/mic

Extender `zykos_dashboard_granular` para agregar tambien desde:
- `metric_type = 'cam_sample'` (si existe) → face_detected_pct, identity_match_mean, FACS events
- `metric_type = 'facs_event'` → conteos de sonrisas Duchenne/sociales, brow furrow, lip compression con timestamp
- Cruce `facs_event` ↔ contexto (`objective_rt` mismo timestamp ± 500ms) → `affect_smile_during_hits_pct`, `affect_brow_during_errors_pct`, `affect_lip_during_errors_pct`

Si no hay samples cam aun (fase temprana), devolver columnas NULL — el dashboard muestra bloque vacio con mensaje "cam/mic no registrados en esta sesion".

### FASE C — Backend: RPC de calibracion

**`zykos_dashboard_calibration(p_dni)`**

Devuelve el ultimo `hw_idle_jitter_px`, `hw_device_type`, `hw_input_device`, `hw_screen_resolution`, `hw_calibration_timestamp` del paciente. El dashboard muestra los jitter_* con una banda gris (jitter del hardware) que se deberia restar visualmente.

### FASE D — Frontend: Diccionario de metricas en JS

Un objeto `METRIC_DICTIONARY` embebido en el dashboard con, por cada metrica canonica V4:
- `label_human`: nombre en castellano llano ("Variabilidad de tiempo de reaccion")
- `what`: que mide en una oracion
- `how`: formula
- `interpret_high`: que implica un valor alto (ejemplo: "variabilidad atencional aumentada, compatible con fatiga, inatencion, o fluctuacion de conciencia")
- `interpret_low`: que implica un valor bajo
- `domain`: dominio semiologico V4
- `agent`: quien lo produce
- `unit`, `decimals`
- `direction`: `higher_worse` | `lower_worse` | `neither`

Se renderiza como tooltip al hover sobre el nombre de la metrica en cualquier lugar del dashboard.

### FASE E — Frontend: Visualizacion estadistica

Por cada sesion con datos granulares:

1. **Distribucion de RT intra-sesion** — box plot horizontal con whiskers p10-p90, caja p25-p75, linea mediana, outliers marcados. No linea temporal: DISTRIBUCION.
2. **Evolucion temporal por cuartos** — small multiples Q1|Q2|Q3|Q4 lado a lado, cada uno con su media como barra y error bar con IC95%. El ojo compara las 4 barras.
3. **Sesion vs propio baseline** — dot plot con:
   - Dot de la sesion de hoy
   - Banda IQR (p25-p75) del propio paciente en gris claro
   - Linea de mediana historica
   - Si el dot cae fuera de la banda, pill rojo: "fuera de IQR propia"
   Esto es el equivalente del SRB/Reliable Change Index visualmente.
4. **Trayectoria motora** — sparkline de las coordenadas (x,y) con overlay de trayectoria directa ideal (linea recta origen→destino). La relacion visual = eficiencia_trayectoria.
5. **CAM panel** — timeline horizontal de la sesion:
   - Banda verde cuando `cam_face_detected=true`
   - Banda roja cuando no
   - Puntos de eventos FACS con su tipo (sonrisa, ceno, sorpresa)
   - Puntos de errores del juego debajo
   - Permite leer visualmente: "aqui fallo y fruncio el ceno" vs "aqui acerto y no sonrio"

### FASE F — Frontend: reorganizacion visual

Orden de bloques segun prioridad clinica:

1. **Hero card** — nombre, DNI, numero de sesiones, dias activos, alertas criticas (baseline insuficiente, deuda V4, sin cam/mic)
2. **Presencia y identidad (CAM)** — porque si del otro lado no habia nadie, el resto no vale. Identity match score, face present %, FACS events overview.
3. **Analisis de esta sesion** — granular post-hoc, con box plots y small multiples Q1-Q4, cruce FACS×contexto.
4. **Longitudinal vs baseline propio** — todas las metricas canonicas V4 con su banda IQR personal. Highlight lo que salio del rango propio.
5. **Datos crudos** — tabla ultimos 20 registros con todos los campos, igual que hoy, como respaldo forense.
6. **DCAT / Colores proyectivos** — igual que hoy.
7. **Glosario** — expansion permanente del diccionario al final, para referencia.

---

## CRITERIOS DE ACEPTACION

- Cero nombres prohibidos V4 como encabezado canonico (tremor_*, rigidez_index, etc).
- Cada metrica visible tiene tooltip con `what`, `how`, `interpret_high`, `interpret_low`.
- Toda metrica visible se compara contra el propio baseline si hay ≥3 sesiones historicas.
- El jitter se visualiza con la banda hw_idle restada.
- Panel CAM visible (aunque este vacio, con mensaje explicativo).
- El dashboard carga en <3 segundos con 20 sesiones.
- Responsive mobile (Gonzalo muestra en LinkedIn desde celular).

---

## ORDEN DE EJECUCION

1. [x] FASE A.1 — RPC `zykos_dashboard_granular` (ya deployada)
2. [ ] FASE A.2 — RPC `zykos_dashboard_baseline`
3. [ ] FASE C — RPC `zykos_dashboard_calibration`
4. [ ] FASE B — Extender granular para cam/mic (condicional a que exista data; si no, stub)
5. [ ] FASE D — `METRIC_DICTIONARY` JS embebido
6. [ ] FASE E.1 — Box plot RT intra-sesion (Chart.js boxplot plugin o SVG custom)
7. [ ] FASE E.2 — Small multiples Q1-Q4
8. [ ] FASE E.3 — Sesion vs baseline (dot plot con banda IQR)
9. [ ] FASE E.4 — Trayectoria motora sparkline
10. [ ] FASE E.5 — CAM timeline panel
11. [ ] FASE F — Reorganizacion visual
12. [ ] Commit + push + PR
13. [ ] Tarea follow-up: migrar lawn-mower al engine V4 (purgar escritura directa de tremor_*)
14. [ ] Follow-up: eliminar biomet.js, show-metrics.js (legacy prohibidos)

---

## CADA BLOQUE ES ATOMICO

Si se corta la sesion en medio, el proximo arranque:
- Lee este archivo
- Mira que fase esta `[x]` y cual `[ ]`
- Retoma desde la siguiente sin replan

---

## REFERENCIAS TECNICAS

- **face-api.js** — software que maneja la cam. Detecta 7 expresiones basicas (neutral, happy, sad, angry, fearful, disgusted, surprised), descriptores faciales de 128-D para match de identidad, landmarks de 68 puntos. Es el servicio externo validado al que la Constitucion V4 se refiere como unico proveedor legitimo de constructos afectivos (cam_*). Corre client-side, procesa la webcam localmente, emite eventos timestamped al stream raw.
- **face-api FACS markers** → `cam_genuine_smile_pct` (Duchenne), `cam_social_smile_pct` (no-Duchenne), `cam_brow_furrow_ms`, `cam_lip_compression_max_ms`, `cam_blink_rate_mean/cv/burst`.
- **agent-media.js** es quien consume face-api y escribe al stream.
- **agent-og-media.js** calcula BIOMETRICA_OG_MEDIA: luminancia, canal verde (proxy rPPG segun Verkruysse 2008, Poh 2010, McDuff 2014), presencia binaria, blackouts. No se usa aun.
- **Baseline individual** segun Constitucion V4 Art. X: minimo 5-10 sesiones; con 3 hay indicio pero no deteccion de cambio confiable. Implementamos umbral minimo 3 con aviso, optimo 10.
- **No usar RCI de Jacobson-Truax** con cutoffs publicados. Sí se puede usar RCI personal: `(sesion_hoy - mediana_propia) / SD_propia`. Flag si |z| > 1.96.
