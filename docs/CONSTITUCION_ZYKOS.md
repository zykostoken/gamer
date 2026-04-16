# CONSTITUCION DE ZYKOS GAMER
## Documento Fundacional — Arquitectura, Principios y Ley Canonica
**Version:** 4.0 — Promulgada 11 Abril 2026 (actualizada desde V3 del 8 Abril 2026)
**Autor:** Dr. Gonzalo J. Perez Cortizo
**Repo:** Psykostoken/gamer (privado) | Dominio: zykos.ar | Supabase: aypljitzifwjosjkqsuu

---

## PREAMBULO

ZYKOS GAMER es una plataforma B2B de rehabilitacion cognitiva gamificada con captura de biomarcadores digitales. No es un sistema diagnostico. No reemplaza la evaluacion clinica. Es un instrumento de fenotipado digital longitudinal que captura micro-conductas observables y las pone en manos del profesional de salud para que este — y solo este — interprete.

**La velocidad es velocidad, no es tristeza.**
El dato bruto es objetivo. La categoria clinica es responsabilidad del clinico.

---

## ARTICULO 1 — PRINCIPIOS IRRENUNCIABLES

**1.1** Las metricas son la monarquia. Los juegos son siervos.
Todo juego alimenta el mismo diccionario canonico. Ningun juego tiene metricas propias que no esten en el METRIC_DICTIONARY de zykos-engine.js.

**1.2** Los agentes piratas roban del DOM. Los juegos nunca escriben a Supabase directamente.
El unico escritor autorizado es zykos-engine.js via ZYKOS.endSession(). Los juegos exponen sus metricas propias al engine via la interfaz publica. Los agentes capturan todo lo observable desde afuera.

**1.3** Nomenclatura canonica unica.
Un constructo = un nombre = una columna. Si no esta en METRIC_DICTIONARY no existe. No se aceptan sinonimos, aliases ni variantes. Jamas.

**1.4** Cadena de integridad SHA-256.
Cada registro en zykos_game_metrics tiene evidence_hash + previous_hash. Los datos son inmutables. No se pueden borrar ni modificar. Esta es la garantia legal y forense del sistema.

**1.5** Capas progresivas (Progressive Disclosure).
Capa 0: eventos raw (stream DOM). Capa 1: metricas individuales. Capa 2: composites por dominio. Capa 3: perfil longitudinal + RCI. El clinico decide hasta que capa profundizar.

**1.6** Z-scores duales + RCI de Chelune.
Z-score intra-sujeto: variacion respecto al propio baseline. Z-score inter-sujeto: posicion en la poblacion normativa. RCI: cambio estadisticamente real vs variabilidad aleatoria (umbral p<0.05).

**1.7** El sistema NO diagnostica. Senializa para derivacion clinica.
Ningun output del sistema puede usar terminologia diagnostica nosologica (DSM/CIE). Los outputs son descriptores funcionales. La interpretacion clinica es post-hoc humana, no algoritmica hardcodeada.

---

## ARTICULO 2 — ARQUITECTURA DEL ENGINE

```
JUEGO (dumb HTML)
  ↓ expone metricas propias via ZYKOS.endSession(gameMetrics)
AGENTES PIRATAS (DOM observers externos al juego)
  ↓ capturan: RT, jitter, trayectoria, hesitaciones, contexto
ZYKOS ENGINE (zykos-engine.js — unico escritor)
  ↓ consolida agentes + gameMetrics + evidence hash
SUPABASE zykos_game_metrics (tabla universal)
  ↓ metric_type = session_biomet | session_summary | raw_events
SUBAGENTE DE ANALISIS (Edge Function post-sesion)
  ↓ calcula composites + Z-scores + llama Claude API
CLINICAL_ANALYSIS (metric_type = clinical_analysis)
  ↓ texto descriptivo medico listo antes de que el clinico abra el dashboard
DASHBOARD (games/portal/dashboard.html)
  ↓ Progressive Disclosure: panel analisis → perfil dominios → metricas individuales
```

### Agentes piratas activos
| Agente | Metricas | Metodo |
|---|---|---|
| agent-rt | rt_mean_ms, rt_cv, rt_sd_ms, fatigue_index, hesitation_count | MutationObserver + timestamps |
| agent-executive | commission_errors, omission_errors, planning_ratio, perseveration_count | action_log analysis |
| agent-tremor (motor) | jitter_reposo_px, jitter_terminal_px, precision_deposito_px, vel_cv | mousemove/touchmove streams |
| agent-memory | memory_span, essentials_got_pct, d_prime | game state observation |
| agent-context | mood_pre_game, mood_post_game, completion_rate | mood-modals + session metadata |
| agent-comprehension | comprehension_written, first_click_latency_ms | instruction read time analysis |
| agent-navigation | portal_time_to_game_start_ms, portal_backtrack_count | portal event tracking |

---

## ARTICULO 3 — DICCIONARIO CANONICO V4 (174 METRICAS)

Fuente de verdad: `engines/METRIC_DICTIONARY_V4.json`
Referencia en runtime: `games/shared/zykos-engine.js` → `METRIC_DICTIONARY`

### Doctrina V4 adicional a los principios 1.1-1.7

**3.1 Semiologia digital continua.** NO bateria neuropsicologica. Los juegos capturan flujo conductual, no ensayos discretos de evaluacion.

**3.2 Captura cruda primaria.** Toda metrica relevante se captura en `zykos_raw_stream`. El analisis es siempre post-hoc en `zykos-post-session-analyzer`. El juego no calcula — registra.

**3.3 Temporalidad Q1-Q4 + H1-H2.** Las metricas con `temporal: true` en el diccionario tienen variantes calculadas post-hoc con sufijo `_Q1`, `_Q2`, `_Q3`, `_Q4`, `_H1`, `_H2`. El juego captura el evento con timestamp. El analizador calcula la banda.

**3.4 Cam/mic = identidad legal + FACS + cruce contextual. NUNCA cognitivo.** Tres dominios separados:
- `IDENTIDAD`: verificacion de autoria de la sesion (biometria legal)
- `FACS`: fenomenos faciales observables (Action Units). Cruce con rendimiento
- `OG_MEDIA`: seniales raw de camara/microfono (luminancia, canal verde rPPG, audio)

**3.5 Baseline individual.** Minimo 5-10 sesiones antes de calcular Z-scores intra-sujeto. Cero cutoffs externos hardcodeados en el juego o el engine.

### Dominios (alineados con MATRICS MCCB — FDA gold standard)

| # | Dominio ZYKOS | Equivalente MATRICS | ICC | Metricas |
|---|---|---|---|---|
| 1 | ATENCION | Speed of Processing + Vigilance | 0.70-0.90 | 13 |
| 2 | EJECUTIVO | Reasoning & Problem Solving | 0.40-0.75 | 12 |
| 3 | MOTOR | Cogstate Finger Tapping | 0.75-0.85 | 11 |
| 4 | MEMORIA | Verbal & Visual Learning | 0.40-0.75 | 14 |
| 5 | CALCULO | NIH Toolbox Pattern Comparison | 0.50-0.70 | 11 |
| 6 | COMPRENSION | Extension ZYKOS | pendiente | 6 |
| 7 | FATIGABILIDAD | Transversal | 0.60-0.80 | 13 |
| 8 | SDT | CPT-IP (d-prime) | 0.70-0.85 | 6 |
| 9 | PLANIFICACION | Tower of London | 0.50-0.70 | 5 |
| 10 | MEMORIA_TRABAJO | Working Memory WAIS-IV | 0.50-0.70 | 3 |
| 11 | INHIBICION | Reasoning & Problem Solving | 0.55-0.75 | 3 |
| 12 | PRAXIS | Cogstate Detection | 0.65-0.80 | 3 |
| 13 | RT_DIST | Simple/Choice RT | 0.75-0.90 | 6 |
| 14 | ESPACIAL | BVMT-R / Visual Learning | 0.55-0.75 | 8 |
| 15 | AFEC | Social Cognition (MSCEIT) | variable | 7 |
| 16 | FACS | FACS (Ekman & Friesen 1978) | variable | 14 |
| 17 | IDENTIDAD | Biometria legal | N/A | 5 |
| 18 | PRESENCIA | Engagement (Kaliouby 2005) | variable | 6 |
| 19 | OG_MEDIA | rPPG (Verkruysse 2008) | variable | 14 |
| 20 | PLATAFORMA | Extension ZYKOS (conducta portal) | pendiente | 7 |
| 21 | META | Metadata normalizacion | N/A | 5 |
| 22 | HARDWARE | Hardware correction baseline | N/A | 2 |

### Metricas prohibidas (NUNCA en codigo activo, NUNCA en el diccionario)
`tremor_avg_jitter`, `tremor_reposo_px`, `rigidez_index`, `espasticidad_index`, `cogwheel_index`, `clasp_knife_ratio`, `interferencia_ratio`, `economia_cognitiva`, `eficacia_plan_propio`, `decaimiento_mitades`.

Los fenomenos que estos nombres intentaban capturar se miden con nombres descriptivos del fenomeno observable: `vel_uniformidad_index`, `vel_oscilacion_index`, `vel_caida_brusca_ratio`, `vel_perfil_abrupto`, `vigor_mental_h1_h2`, `wm_interferencia_ratio`, `ratio_acciones_util`.

### Composites clinicos V4 (calculados por zykos-post-session-analyzer, NO por el juego)
```
Composite_ATENCION  = 0.30×Z(rt_mean_ms) + 0.25×Z(rt_cv) + 0.20×Z(hesitaciones_count)
                    + 0.15×Z(iiv_consecutiva) + 0.10×Z(fatiga_global)

Composite_EJECUTIVO = 0.25×Z(errores_comision) + 0.20×Z(errores_omision)
                    + 0.15×Z(automonitoreo_pct) + 0.15×Z(ratio_acciones_util)
                    + 0.15×Z(pasos_en_orden_pct) + 0.10×Z(perseveracion_count)

Composite_MOTOR     = 0.40×Z(jitter_terminal_px) + 0.30×Z(vel_cv)
                    + 0.15×Z(eficiencia_trayectoria) + 0.15×Z(precision_deposito_px)

Composite_MEMORIA   = 0.30×Z(evocacion_libre_count) + 0.25×Z(registro_index)
                    + 0.25×Z(d_prime) + 0.20×Z(consolidacion_pct)

Composite_CALCULO   = 0.35×Z(calculo_correcto_count) + 0.25×Z(calculo_error_pct)
                    + 0.25×Z(estimacion_cercana_pct) + 0.15×Z(razonamiento_proporcional_pct)
```
Normalizacion: T = 50 + 10 × composite_z

---

## ARTICULO 4 — BANDAS CLINICAS

| Z_inter | Estado | Color |
|---|---|---|
| <= -2.0 | ALTERADO_MODERADO | rojo |
| <= -1.5 | ALTERADO_LEVE | naranja |
| <= -1.0 | LIMITE | amarillo |
| > -1.0 | NORMAL | verde |

### Combinacion con Z_intra y RCI
- Z_inter borderline + RCI significativo → FLAG de cambio
- Z_inter severo + Z_intra estable → baseline bajo individual (no es deterioro)
- Z_inter normal + Z_intra significativo → CAMBIO TEMPRANO (senial mas valiosa)

### RCI de Chelune
```
RCI = (X_actual - X_baseline - Efecto_Practica) / (SEM × sqrt(2))
SEM = SD_baseline × sqrt(1 - reliability)

Reliability por dominio: RT=0.85, Accuracy=0.65, d-prime=0.80, Motor(jitter)=0.75, Composites=0.85-0.90
Interpretacion: RCI > +1.96 = Mejora REAL | RCI < -1.96 = Empeoramiento REAL
```

---

## ARTICULO 5 — 15 PERFILES COMPUESTOS

Los perfiles son descriptores de estado funcional. No son diagnosticos nosologicos.

| Perfil | Formula tecnica | Observacion clinica |
|---|---|---|
| 1. Eficiencia Plena | M2 rapido + M3 preciso + E1 bajo + E2 alto | Funcionamiento optimo |
| 2. Aceleramiento Desinhibido | M2 rapido + M3 bajo + E1 alto + E2 bajo | Patron impulsivo |
| 3. Enlentecimiento Compensado | M2 lento + M3 preciso + E1 bajo | Estrategia conservadora |
| 4. Enlentecimiento Deteriorante | M2 lento + M3 bajo + omisiones + E2 bajo | Compromiso funcional severo |
| 5. Variabilidad Atencional | rt_cv > baseline + precision intermitente | Inestabilidad en red de vigilancia |
| 6. Disociacion Motor-Cognitivo | M1 alto + M3 ok OR M1 bajo + M3 bajo | Desacople fisico-ejecutivo |
| 7. Fatiga Progresiva | 2da mitad > 20% peor que 1ra | Agotamiento prematuro |
| 8. Perseveracion Rigida | perseveracion > baseline + autocorreccion < baseline | Rigidez cognitiva |
| 9. Confusion Perceptual | C1 bajo + irrelevantes + recorrido caotico | Fallas en decodificacion |
| 10. Aprendizaje Activo | Mejora inter-sesion significativa | Pronostico positivo |
| 11. Ausencia de Aprendizaje | Estancamiento de eficiencia inter-sesion | Posible deficit consolidacion |
| 12. Anhedonia Conductual | color constante + engagement descendente | Retraimiento afectivo |
| 13. Disociacion Subjetivo-Objetivo | color alegre + rendimiento pobre | Incongruencia afecto-funcion |
| 14. Expansion sin Anclaje | agencia max + riesgo max + complejidad baja | Conducta exploratoria desorganizada |
| 15. Retraccion Evitativa | agencia min + riesgo min + solo basico | Patron defensivo ansioso |

---

## ARTICULO 6 — EFECTOS FARMACOLOGICOS (referencia, no diagnostico)

| Farmaco | Metricas afectadas | Efecto | Reversible |
|---|---|---|---|
| Benzodiacepinas | rt_mean_ms↑, fatigue_index↑, memory_span↓, commission_errors↑ | d=-0.74 | Parcial (10+ meses) |
| Litio | rt_mean_ms↑, speed_mean↓, registration_index↓ | ES=0.62 | Si |
| ISRS | rt_mean_ms↓ leve, cognitive_flexibility↑ | Pequenio positivo | 75% MDD con deficit residual |
| AP 2da gen | rt_mean_ms↓ marginal | g=0.17 | No (reduce desorganizacion) |
| AP 1ra gen | rt_mean_ms↑, memory_span↓ | Peor que 2G | Parcial (dosis-dependiente) |

---

## ARTICULO 7 — TAXONOMIA DCAT (Digital Choice Attribute Taxonomy)

8 dimensiones bipolares del patron longitudinal de elecciones:

1. Agencia: Activo vs Pasivo
2. Orientacion Temporal: Presente/Futuro vs Pasado
3. Referencia al Self: Autocentrado vs Alocentrado
4. Funcional vs Afectivo: Pragmatico vs Emocional
5. Riesgo vs Seguridad: Exploratorio vs Conservador
6. Complejidad: Elaborado vs Simple
7. Consistencia: Estable vs Variable
8. Congruencia: Congruente vs Disociado

---

## ARTICULO 8 — REGLAS DE NEGOCIO INNEGOCIABLES

**8.1 Sin registro no hay juego.**
Todo usuario necesita cuenta verificada antes de jugar. Las 15 sesiones free son el techo para usuarios sin plan.

**8.2 Los datos son eternos.**
Ningun registro de zykos_game_metrics puede borrarse ni modificarse. Los triggers de inmutabilidad son inviolables. Esta es la garantia del valor de la evidencia.

**8.3 ZYKOS y cautious-carnival son soberanos y nunca se cruzan.**
ZYKOS = B2B Gamer puro (zykos.ar, Supabase aypljitzifwjosjkqsuu, repo Psykostoken/gamer).
cautious-carnival = institucional CJI (clinicajoseingenieros.ar, Supabase buzblnkpfydeheingzgn).
Cero referencias cruzadas en codigo, datos, dominios.

**8.4 El juego no diagnostica.**
Ningun juego puede generar clinical_flags con terminologia diagnostica. El juego registra datos crudos. El subagente post-sesion genera lenguaje descriptivo. El clinico interpreta.

**8.5 El engine es el unico escritor.**
Los juegos llaman a ZYKOS.endSession(). Nunca a supabase.from().insert() directamente.

---

## ARTICULO 9 — JUEGOS ACTIVOS Y ESTADO

| Juego | Estado | Dominio primario | Metricas clave |
|---|---|---|---|
| lawn-mower | Activo — modelo de referencia | Planificacion espacial, motor | rt_mean_ms, jitter_reposo_px, planning_ratio |
| pill-organizer | Activo | Praxis motora fina, memoria trabajo | tremor_terminal, precision_deposito_px |
| reflejos | Activo | Atencion sostenida, inhibicion | d_prime, rt_cv, commission_errors |
| super-market | Activo | Planificacion, calculo, comprension | planning_ratio, calculation_memory |
| neuro-chef | Activo | SDT, memoria semantica | d_prime, hit_rate, recipe_recall_correct |
| medication-memory | Activo | Memoria trabajo, secuenciacion | memory_span, sequence_accuracy_pct |
| fridge-logic | Activo | Categorizacion, flexibilidad | cognitive_flexibility_index |
| daily-routine | Activo | Secuenciacion temporal | sequence_accuracy_pct |
| classify-and-place (5 packs) | Activo | Clasificacion semantica, inhibicion | semantic_classification_accuracy, commission_errors |
| inkblot / manchas | En reparacion | Proyectivo | — |

---

## ARTICULO 10 — SUBAGENTE DE ANALISIS POST-SESION

**Nombre:** `zykos-analyze-session` (Supabase Edge Function)
**Trigger:** INSERT en zykos_game_metrics con metric_type IN (session_summary, session_biomet, session_complete)
**Output:** metric_type = clinical_analysis, campo metric_data.analisis_texto
**Modelo:** Claude Sonnet (claude-sonnet-4-20250514)
**Principio:** Genera lenguaje descriptivo medico, nunca diagnostico. El clinico interpreta.

El texto generado se muestra en el dashboard antes de las metricas individuales, como primer elemento visible al abrir el perfil de un paciente.

---

## ARTICULO 11 — INFRAESTRUCTURA

**Frontend:** HTML/CSS/JS vanilla — sin frameworks. DM Sans + IBM Plex Mono.
**Deploy:** Netlify auto-deploy desde GitHub main (site ID: 332b1ca6-d613-4b8e-9894-314b3e8d1e1c).
**Backend:** Supabase PostgreSQL + RPC + RLS + Edge Functions.
**Auth:** Custom bcrypt RPC — sin Supabase Auth. Login por DNI/email + password.
**Integridad:** SHA-256 evidence_hash + previous_hash en cada registro.
**Seguridad:** HSTS, X-Frame-Options DENY, CSP estricta, RLS por usuario.
**IP:** DNDA Argentina (obra inedita, en tramite) + INPI PSYKooD Clase 44.

---

## ARTICULO 12 — DEUDAS TECNICAS DECLARADAS

- Validacion clinica pendiente: test-retest ICC por metrica, validez convergente contra MATRICS/CANTAB, normas poblacionales (minimo 300 sujetos)
- SEM por metrica: requiere estudio test-retest
- d-prime: requiere correccion loglineal de Hautus para hit_rate=1.0 o FAR=0.0
- Subagente de gestion B2B: reportes periodicos automaticos a clinicas cliente
- Subagente de concomitancias: deteccion automatica de pares de metricas que covarian

---

*Este documento es la fuente de verdad arquitectonica de ZYKOS GAMER.*
*Toda decision de diseno, toda linea de codigo, todo output clinico debe ser consistente con estos articulos.*
*Promulgado: 8 de abril de 2026 — Necochea, Argentina.*
