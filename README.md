# ZYKOS GAMER

Plataforma de fenotipado cognitivo-motor-proyectivo digital.

Repo: Psykostoken/gamer | Supabase: aypljitzifwjosjkqsuu | Dominio: zykos.ar

## DICCIONARIO CANONICO DE METRICAS (53)

Un concepto = un nombre. Si no esta aca, no existe en la plataforma.
Captura en tiempo real, constante. Analisis siempre diferido.
La velocidad es velocidad. No es tristeza. La interpretacion es del profesional.

### MOTOR — Tremor (M1)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 1 | tremor_reposo_px | px | SPY | Jitter cursor quieto >500ms |
| 2 | tremor_inicio_px | px | SPY | Jitter primeros 150ms movimiento |
| 3 | tremor_terminal_px | px | SPY | Jitter ultimos 80px antes click |

Eliminados: tremorIndex, tremor_index, tremor_avg, tremor_speed_var, tremor_event_count, tremor_avg_jitter, tremor_max_jitter

### MOTOR — Velocidad (M2)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 4 | rt_mean_ms | ms | SPY | Tiempo de reaccion medio |
| 5 | vel_peak_mean | px/ms | SPY | Velocidad pico media |
| 6 | vel_peak_sd | px/ms | SPY | SD velocidad pico |

Eliminados: mean_rt_ms, mean_reaction_time_ms, reaction_time_ms, mean_decision_time_ms, avg_hesitation_ms, first_click_latency_ms, time_to_first_action_ms, latencia_inicio_ms, avgSpeed

### MOTOR — Precision (M3)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 7 | dismetria_mean_px | px | SPY | Distancia click al centro target |
| 8 | eficiencia_trayectoria | ratio | SPY+GAME | Path recto / path real |
| 9 | rectificaciones_count | count | SPY | Cambios direccion >45 grados |

Eliminados: pathEfficiency, path_efficiency, movement_efficiency, scan_score, drop_precision, drop_offset_mean_px, abruptRedirections, motor_clumsiness_score, overshoot_count, dysmetria_ratio

### MOTOR — Extrapiramidal (M4)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 10 | vel_cv | ratio | SPY | CV velocidad |
| 11 | rigidez_index | index | SPY | 1-vel_cv |
| 12 | cogwheel_index | index | SPY | Oscilaciones ritmicas velocidad |
| 13 | clasp_knife_ratio | ratio | SPY | Caidas bruscas aceleracion |
| 14 | espasticidad_index | index | SPY | Clasp-knife normalizado |

### ATENCION — Vigilancia (A1)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 15 | rt_sd_ms | ms | SPY | SD del RT |
| 16 | rt_cv | ratio | SPY | CV RT. >0.25 irregular. ADHD g=0.76 |
| 17 | decaimiento_vigilancia | ratio | SPY | RT 2da/1ra mitad |
| 18 | iiv_consecutiva | ms | SPY | SD diferencias consecutivas RT |

### ATENCION — Fatiga (A2)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 19 | fatiga_motor | ratio | SPY | Tremor 2da/1ra mitad |
| 20 | fatiga_precision | ratio | SPY | Dismetria 2da/1ra mitad |
| 21 | fatiga_global | ratio | SPY | Media ratios fatiga |

### EJECUTIVO — Inhibicion (E1)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 22 | errores_comision | count | SPY+GAME | Respondio cuando no debia |
| 23 | errores_omision | count | GAME | No respondio cuando debia |
| 24 | impulsividad_ratio | ratio | SPY | Acciones <150ms / total |
| 25 | inhibicion_motor | ratio | SPY | Movimientos abortados / iniciados |
| 26 | falsos_clicks | count | SPY+GAME | Clicks fuera de targets |

Eliminados: commission_errors, omission_errors, false_alarms, impulsivity_ratio

### EJECUTIVO — Planificacion (E2)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 27 | eficacia_objetivo | ratio | GAME | Objetivos logrados / totales |
| 28 | eficacia_plan | ratio | GAME | Ejecucion del propio plan |
| 29 | economia_cognitiva | ratio | SPY | Acciones utiles / totales |
| 30 | secuencia_correcta_pct | pct | GAME | % acciones en orden correcto |
| 31 | hesitaciones_count | count | SPY | Pausas >200ms |
| 32 | hesitacion_mean_ms | ms | SPY | Duracion media hesitacion |

Eliminados: plan_efficiency, planificacion_ratio, escaneo_sistematico, neatness_score, completeness_pct, long_pauses_count, avg_pause_duration_ms

### EJECUTIVO — Flexibilidad (E3)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 33 | perseveracion_count | count | SPY | Repeticion estereotipada. Bufestron |
| 34 | autocorreccion_ratio | ratio | SPY+GAME | Errores corregidos / totales |
| 35 | post_error_rt_ratio | ratio | SPY+GAME | RT post-error / RT medio |

### MEMORIA — Trabajo (MEM1)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 36 | memory_span | count | GAME | Items retenidos simultaneamente |

### MEMORIA — Aprendizaje (MEM2)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 37 | curva_aprendizaje | ratio | COMPUTED | Eficiencia sesion N / N-1 |

### COMPRENSION (C1)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 38 | instruction_time_ms | ms | SPY | Tiempo leyendo instrucciones |
| 39 | instruction_reread | count | SPY | Releer instrucciones |
| 40 | first_action_latency_ms | ms | SPY | Inicio hasta primera accion |

### CALCULO (CAL1)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 41 | error_estimacion_abs | currency | GAME | Error absoluto estimacion |
| 42 | error_estimacion_pct | pct | GAME | Error porcentual estimacion |

### AFECTIVO — Frustracion (AFEC1)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 43 | engagement_decay | ratio | COMPUTED | Tiempo sesion N / N-1 |

### AFECTIVO — Proyectivo (AFEC2)

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 44 | color_hex | hex | MOOD | Color proyectivo elegido |
| 45 | color_congruencia | index | COMPUTED | Correlacion rendimiento-color |

### META

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 46 | session_duration_ms | ms | SPY | Duracion sesion |
| 47 | total_clicks | count | SPY | Total clicks |
| 48 | total_actions | count | SPY | Acciones significativas |

### HARDWARE

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 49 | hw_idle_jitter_px | px | SPY | Ruido dispositivo reposo |
| 50 | hw_latency_ms | ms | SPY | Delay input device |

### CONTEXTO

| # | Metrica | U | Fuente | Descripcion |
|---|---------|---|--------|-------------|
| 51 | tab_switches | count | SPY | Cambios pestana |
| 52 | time_hidden_ms | ms | SPY | Tiempo pestana oculta |
| 53 | orientation_changes | count | SPY | Rotaciones dispositivo |

### SDT (derivadas)

| Metrica | Descripcion |
|---------|-------------|
| d_prime | Sensibilidad: z(hit_rate) - z(fa_rate) |
| response_bias | Criterio: conservador vs liberal |

## 15 PERFILES COMPUESTOS

No diagnosticos. Contra baseline individual (RCI, min 5 sesiones).

| Perfil | Formula |
|--------|---------|
| EFICIENCIA PLENA | M2 rapido + M3 preciso + E1 bajo + E2 alto |
| ACELERAMIENTO DESINHIBIDO | M2 rapido + M3 bajo + E1 alto + E2 bajo |
| ENLENTECIMIENTO COMPENSADO | M2 lento + M3 preciso + E1 bajo |
| ENLENTECIMIENTO DETERIORANTE | M2 lento + M3 bajo + omisiones + E2 bajo |
| VARIABILIDAD ATENCIONAL | rt_cv > baseline + precision intermitente |
| DISOCIACION MOTOR-COGNITIVO | (M1 alto + M3 ok) o (M1 bajo + M3 bajo) |
| FATIGA PROGRESIVA | 2da mitad > 20% peor que 1ra |
| PERSEVERACION RIGIDA | perseveracion > baseline + autocorreccion < baseline |
| CONFUSION PERCEPTUAL | C1 bajo + irrelevantes + recorrido caotico |
| APRENDIZAJE ACTIVO | Mejora inter-sesion significativa |
| AUSENCIA DE APRENDIZAJE | No mejora inter-sesion |
| ANHEDONIA CONDUCTUAL | color constante + engagement descendente |
| DISOCIACION SUBJETIVO-OBJETIVO | color alegre + rendimiento malo |
| EXPANSION SIN ANCLAJE | agencia max + riesgo max + complejidad baja |
| RETRACCION EVITATIVA | agencia min + riesgo min + solo basico |

## DCAT — Digital Choice Attribute Taxonomy

| Dimension | Polo A | Polo B |
|-----------|--------|--------|
| AGENCIA | Activo | Pasivo |
| ORIENTACION TEMPORAL | Presente/Futuro | Pasado |
| REFERENCIA AL SELF | Autocentrado | Alocentrado |
| FUNCIONAL vs AFECTIVO | Pragmatico | Emocional |
| RIESGO vs SEGURIDAD | Exploratorio | Conservador |
| COMPLEJIDAD | Elaborado | Simple |
| CONSISTENCIA | Estable | Variable |
| CONGRUENCIA | Congruente | Disociado |

Regla de oro: nunca se codifica UNA eleccion. Se codifica el PATRON longitudinal.

## FUENTES

- SPY: spy pasivo sin cooperacion del juego
- GAME: juego reporta via ZYKOS.report()
- SPY+GAME: spy estima proxy, juego da dato exacto
- COMPUTED: longitudinal en dashboard
- MOOD: color picker proyectivo

## EFECTOS FARMACOLOGICOS

| Farmaco | Efecto | Tamano |
|---------|--------|--------|
| BZD | Deficit amplio | d=-0.74 |
| Litio | Psicomotor+verbal | ES=0.62 |
| ISRS | Neutro a positivo | Pequeno |
| AP2G | Marginal mejoria | g=0.17 |
| AP1G | Deterioro | Peor que AP2G |

## STACK

- Frontend: Vanilla JS, cero frameworks
- DB: Supabase PostgreSQL con RLS
- Deploy: Netlify auto-deploy
- Seguridad: bcrypt, SHA-256 hash chain, inmutabilidad
- Regulatorio: ANMAT SaMD Clase II, ReNaPDiS, Ley 25.326/26.529/26.657
