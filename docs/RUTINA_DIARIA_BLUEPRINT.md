# Rutina Diaria — Blueprint de Rediseño

**Documento maestro del rediseño del módulo Rutina Diaria de ZYKOS GAMER**

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 13 de abril de 2026 |
| Autor clínico-arquitectónico | Dr. Gonzalo Perez Cortizo (DNI 30542195) |
| Co-autoría técnica | Claude (sesión REPO GAMER) |
| Estado | Pre-implementación. Aprobación pendiente del autor clínico antes de codear. |
| Repo destino | github.com/Psykostoken/gamer — rama `main` post-PR |
| Documento sucesor de | METRIC_DICTIONARY_V4.json, CONSTITUCION_ZYKOS.md |

---

## 1. Por qué este documento existe

El desarrollo previo del módulo Rutina Diaria avanzó por iteración rápida sin un blueprint declarado. Resultado: el motor `engines/classify-and-place` tiene seis modos declarados (`classify`, `kit`, `calc`, `sim`, `seriation`, `grouping`, `reasoning`), pero solo `classify` y `kit` están cubiertos con métricas canónicas alineadas al Diccionario V4. Los modos `seriation`, `grouping` y `reasoning` ejecutan pero escriben métricas pobres (porcentaje correcto y tiempo, nada más) porque su mecánica drag-and-drop nativa HTML5 no está hookeada a los agentes pirata del DOM.

Este documento detiene la iteración rápida y declara la arquitectura completa del módulo antes de tocar código nuevo. Cualquier cambio futuro al módulo Rutina Diaria debe ser trazable a una sección de este blueprint.

---

## 2. Identidad del módulo

### 2.1 Qué es Rutina Diaria

**Rutina Diaria es una batería longitudinal de ejercicios cognitivos breves, ambientados en escenarios narrativos cotidianos, con consigna abierta y mecánica drag-and-drop universal.**

El paciente accede una vez por día a un único ejercicio. El ejercicio nunca dura más de cinco minutos. La sesión deja huella canónica en `zykos_metrics_canonical`. Al completarlo, queda desbloqueado el siguiente ejercicio del eje, disponible al día siguiente como mínimo.

### 2.2 Qué NO es

- **No es gamificación competitiva.** No hay ranking, no hay sistema de puntos visible al paciente, no hay estrellas, no hay "ganaste / perdiste".
- **No es un test de evaluación neuropsicológica formal.** No produce diagnóstico. No clasifica al paciente en categorías clínicas. No genera reportes interpretativos automatizados.
- **No es una secuencia de niveles tipo arcade.** El paciente no "avanza" por mérito. La progresión es temporal y por completitud, no por performance.
- **No es contenido cerrado.** Cada escenario es un wrapper narrativo replicable. La arquitectura admite escenarios futuros (hogar, taller mecánico, cantina, kiosco, etc.) sin reescribir el motor.

### 2.3 Marco terapéutico de referencia

El módulo Rutina Diaria está alineado con el modelo Maxwell Jones de comunidad terapéutica que define la operación de la Clínica Psiquiátrica Privada José Ingenieros SRL. La progresión sostenida en el tiempo, sin presión competitiva ni recompensa extrínseca, es coherente con la lógica de internación prolongada y rehabilitación cognitiva ecológica. La elección de escenarios cotidianos (no escenarios de laboratorio) busca minimizar el efecto-test y maximizar la transferencia a la vida diaria del paciente post-alta.

---

## 3. Arquitectura conceptual

### 3.1 Jerarquía de cuatro niveles

```
RUTINA DIARIA (módulo)
└── ESCENARIO (wrapper narrativo: fútbol, hogar, taller, cantina, ...)
    └── EJE COGNITIVO (camisetas, botines, medias, vestuario, cancha, hinchada, ...)
        └── EJERCICIO (game_slug atómico que escribe a zykos_metrics_canonical)
            └── TIER (1 a 5: complejidad creciente declarada)
```

### 3.2 Definiciones operativas

| Concepto | Definición técnica | Definición clínica |
|---|---|---|
| Escenario | Conjunto de packs JSON que comparten meta narrativa, paleta visual, vocabulario y assets compartidos | Universo cultural reconocible por el paciente. Reduce efecto-laboratorio. |
| Eje cognitivo | Subdominio temático dentro de un escenario | Familia de tareas que comparten un sustrato cognitivo dominante (p.ej. seriación numérica vs. seriación de magnitud) |
| Ejercicio | Pack JSON único con un `game_slug` único que escribe filas a `zykos_metrics_canonical` | Tarea atómica de 3-5 minutos completable en una sesión |
| Tier | Entero 1 a 5 declarado en el pack, indica complejidad relativa dentro del eje | Posición en la zona de desarrollo próximo del paciente. El clínico puede override el tier asignado. |

### 3.3 Independencia de ejes

Los ejes son **independientes entre sí**. Un paciente puede estar en tier 3 del eje camisetas y tier 1 del eje botines simultáneamente. La progresión no es global, es por eje. Esto permite que una falla en un eje (p.ej. lectura de números) no bloquee el avance en otros ejes (p.ej. discriminación perceptual de tonalidad).

---

## 4. Mecánica universal

Toda interacción del paciente con cualquier ejercicio del módulo Rutina Diaria respeta los siguientes seis principios. No hay excepciones.

### 4.1 Drag-and-drop como única mecánica de respuesta

El paciente responde **agarrando y soltando**. No clicks, no taps, no menús, no teclado. Esta restricción es deliberada y tiene tres razones:

1. **Activa los agentes motores del DOM.** Los agentes pirata `agent-motor.js`, `agent-rt.js`, `agent-inhibition.js` capturan jitter, velocidad, hesitaciones, eficiencia de trayectoria y precisión de depósito únicamente sobre eventos de mouse/touch sostenidos. Sin drag, esos agentes quedan mudos.
2. **Es ecológicamente equivalente** a manipular objetos en el espacio físico. Un click es un acto simbólico abstracto; un drag es un acto motor que reproduce el agarre real.
3. **Es accesible transversalmente** a edad, alfabetización y experiencia digital. Un paciente analfabeto puede arrastrar; muchos no pueden navegar menús.

### 4.2 Consigna abierta, no instructiva

El ejercicio nunca le dice al paciente **cómo** ordenar, agrupar o secuenciar. Le pide la acción usando un copy de rol naturalista: "El utilero te pide que le acomodes las camisetas en el perchero." Punto.

El paciente decide la dimensión que privilegia (número, tamaño, tonalidad, similitud, proximidad). Esa decisión **es el dato clínico**. Capturar la dimensión emergente es más valioso que capturar el orden ejecutado contra una clave.

### 4.3 Sin "ganar" ni "perder" visible

El paciente nunca ve un puntaje en tiempo real, una marca de "correcto" o "incorrecto", una estrella, un emoji de aprobación, ni un mensaje de éxito o fracaso. La pantalla de cierre del ejercicio es neutra: "Listo. Buen trabajo. Mañana hay otro." El paciente vio que terminó. Punto.

Las métricas se siguen escribiendo a `zykos_metrics_canonical` con la misma riqueza, pero el feedback visible al paciente no las espeja. Esta separación entre **registro silencioso para el clínico** y **experiencia neutra para el paciente** es una decisión arquitectónica clave del módulo.

### 4.4 Mini-dashboard del paciente: solo información, no juicio

El paciente puede acceder a una vista propia donde ve:

- Cantidad de ejercicios completados
- Días consecutivos de uso
- Ejes en los que avanzó
- Próximo ejercicio disponible y cuándo

No ve: puntajes, rankings, comparaciones, interpretaciones, gráficos de "performance".

Esta vista cumple función motivacional sin contaminar el dato clínico ni meter ansiedad de tarea.

### 4.5 Un ejercicio por día, cooldown temporal de 24 horas

Al completar un ejercicio, el sistema marca `next_available_at = now + 24h` para ese eje. El paciente puede entrar a la plataforma cuando quiera, pero solo podrá iniciar un nuevo ejercicio del mismo eje al día siguiente. Otros ejes siguen disponibles si tienen ejercicios desbloqueados.

Razón clínica: prevenir agotamiento del recurso motivacional, mantener novedad sostenida durante meses de internación, reducir efecto-aprendizaje sobre la mecánica.

El clínico tiene override desde el panel para autorizar excepciones puntuales (p.ej. evaluación de baseline el primer día).

### 4.6 Desbloqueo secuencial por completitud, no por performance

Al completar un ejercicio del tier N de un eje, queda desbloqueado el ejercicio del tier N+1 del mismo eje. La condición de desbloqueo es **completar**, no **completar bien**. Un paciente que ordena al azar las camisetas y termina el ejercicio desbloquea el siguiente igual.

Razón: la performance es dato para el clínico, no premio para el paciente. Si la performance fuera condición de desbloqueo, el paciente con deterioro real se atascaría en tier 1 indefinidamente, lo cual es contrario al objetivo terapéutico de exposición continua a estímulo cognitivo.

El clínico puede fijar manualmente el tier de un paciente desde el panel si determina que cierto eje no es apropiado para escalar.

---

## 5. Sistema de medición canónica

### 5.1 Estado actual del Diccionario V4

El METRIC_DICTIONARY_V4 declara 23 dominios con 104 métricas totales. El dominio `SERIACION_PLANIFICACION` existe con 6 métricas, pero solo aparece referenciado 3 veces en todo el JSON, lo que indica que está declarado pero subutilizado. No existen los dominios `AGRUPACION` ni `SECUENCIACION`.

### 5.2 Métricas canónicas existentes que el módulo reusa

Estas se capturan automáticamente vía agentes pirata cuando el drag-and-drop esté correctamente hookeado al motor canónico:

**Dominio MOTOR (6 métricas):**
- `jitter_reposo_px`, `jitter_inicio_px`, `jitter_terminal_px`
- `precision_deposito_px`
- `eficiencia_trayectoria`
- `decisiones_correccion` (suelta-y-reagarra)

**Dominio VELOCIDAD (5 métricas):**
- `vel_peak_mean`, `vel_peak_sd`, `vel_cv`
- `vel_uniformidad_index`, `vel_oscilacion_index`

**Dominio ATENCION (7 métricas):**
- `rt_mean_ms`, `rt_cv`
- `decaimiento_mitades`
- `hesitaciones_count`, `hesitaciones_total_ms`
- `dwell_time_pre_pickup_ms`
- `inactivity_episodes_count`

**Dominio EJECUTIVO (8 métricas):**
- `errores_comision`, `errores_omision`
- `impulsividad_ratio`, `inhibicion_motor`
- `perseveracion_count`, `economia_cognitiva`
- `strategy_switches`, `decision_revisions`

**Dominio MEMORIA (4 métricas):**
- Aplicables solo en ejercicios con componente de retención (Corsi, secuencia auditiva)

**Dominios biométricos pasivos (cam, voz, OG-media):**
- Capa canónica obligatoria, capturada por agentes en background

### 5.3 Métricas a sumar al Diccionario V4

El módulo Rutina Diaria requiere extender el Diccionario V4 con tres dominios nuevos. Estos dominios se agregan al JSON sin modificar los existentes y sin tocar `prohibited_metrics`.

#### 5.3.1 Dominio nuevo: `SERIACION` (renombre o sub-dominio de SERIACION_PLANIFICACION)

| Métrica canónica | Tipo | Descripción |
|---|---|---|
| `seriation_strategy_detected` | enum | Estrategia inferida post-hoc: ascending_numeric, descending_numeric, ascending_size, descending_size, ascending_tonality, descending_tonality, categorical_binary, categorical_ternary, spatial_clustering, no_pattern, incomplete |
| `seriation_dimension_used` | enum | Dimensión privilegiada: numeric, size, tonality, color, position, none |
| `seriation_completeness_pct` | float 0-100 | Porcentaje de la secuencia que respeta el patrón detectado |
| `seriation_inversion_count` | int | Pares adyacentes invertidos respecto al orden detectado |
| `seriation_dimension_switches` | int | Cuántas veces cambió de criterio mid-task |
| `seriation_first_pickup_dimension` | enum | Sobre qué dimensión miró primero (basado en dwell pre-pickup) |
| `seriation_completion_time_ms` | int | Tiempo total desde primer pickup hasta drop final |

#### 5.3.2 Dominio nuevo: `AGRUPACION`

| Métrica canónica | Tipo | Descripción |
|---|---|---|
| `grouping_clusters_formed` | int | Cantidad de grupos espaciales detectados al final |
| `grouping_intra_cluster_coherence` | float 0-1 | Coherencia categorial dentro de cada cluster |
| `grouping_inter_cluster_separation_px` | float | Distancia promedio entre centroides de cluster |
| `grouping_outliers_count` | int | Items que no quedaron asignados a ningún cluster |
| `grouping_strategy_detected` | enum | by_category, by_color, by_size, by_position, mixed, none |
| `grouping_revision_count` | int | Items movidos entre clusters después del primer drop |

#### 5.3.3 Dominio nuevo: `SECUENCIACION`

| Métrica canónica | Tipo | Descripción |
|---|---|---|
| `sequence_steps_correct_count` | int | Pasos en posición correcta vs orden objetivo |
| `sequence_steps_total` | int | Cantidad total de pasos en la secuencia |
| `sequence_first_error_position` | int | Posición del primer error en la secuencia |
| `sequence_revision_count` | int | Pasos movidos después del primer drop |
| `sequence_completion_time_ms` | int | Tiempo total |
| `sequence_pattern_detected` | enum | strict_order, partial_order, reverse_order, clustered, random |

### 5.4 Restauración del hook agentes-motor para drag-and-drop

El motor `engines/classify-and-place/index.html` actualmente usa eventos HTML5 nativos (`dragstart`, `dragover`, `dragend`) directos al DOM del juego. Estos eventos no propagan al nivel donde escuchan los agentes pirata (`mousemove`, `pointerdown/up`).

**Solución arquitectónica:** reescribir la mecánica drag de seriation/grouping usando el patrón `pointer events` (`pointerdown`, `pointermove`, `pointerup`) en lugar de drag HTML5 nativo. Este patrón es el que ya usa `pill-organizer.html` (que sí captura métricas canónicas completas). Beneficio adicional: pointer events funcionan idéntico en mouse, touch y stylus, lo cual mejora la accesibilidad mobile.

Esta reescritura es **prerrequisito** de cualquier pack nuevo. Sin esta reescritura, los packs nuevos escribirán métricas pobres y replicarán el problema actual.

---

## 6. Frontera médico / agente IA / motor

Esta sección consolida un principio que ya está en CONSTITUCION_ZYKOS pero que se reafirma como inviolable para este módulo.

### 6.1 Lo que hace el motor

El motor mide. Captura datos canónicos del Diccionario V4. Los escribe a `zykos_metrics_canonical` con hash de evidencia. Punto.

El motor **no** interpreta clínicamente. **No** declara perfiles. **No** sugiere diagnósticos. **No** alerta sobre patrones sospechosos. **No** clasifica al paciente.

### 6.2 Lo que hace el agente IA en Supabase

El agente IA `zykos-analyze-session` (Edge Function) lee las métricas canónicas post-hoc y puede sugerir:

- Patrones detectados ("alta variabilidad de velocidad en ejercicios con componente numérico")
- Comparaciones longitudinales del propio paciente ("disminución del 30% en eficiencia_trayectoria respecto a sesiones del mes anterior")
- Outliers respecto a la propia trayectoria del paciente
- Triggers de revisión clínica (basados en umbrales que el médico configura)

El agente IA **no** firma diagnósticos. **No** prescribe. **No** comunica nada al paciente directamente.

### 6.3 Lo que hace el médico

El médico lee el dashboard. Lee las sugerencias del agente IA si las hay. Cruza con la observación clínica directa, la historia, el examen mental, la medicación, el contexto familiar, el estadio del proceso terapéutico. Y firma la interpretación clínica en el HCE del paciente.

La interpretación clínica vive en el HCE del médico, **nunca** en código del juego, nunca en el pack JSON, nunca en mensajes al paciente, nunca en logs, nunca en cadenas de texto del frontend.

### 6.4 Implicación práctica para el código

Ningún campo `cognitive_targets` de ningún pack puede contener etiquetas como "frontal", "deterioro", "afasia", "déficit", "perfil X", "compatible con Y". Solo descriptores funcionales neutros: "seriación numérica", "control visuomotor", "discriminación perceptual de tonalidad".

Ningún mensaje al paciente puede sugerir interpretación de su performance. "Buen trabajo, mañana hay otro" es aceptable. "Mejoraste tu atención" no lo es.

---

## 7. Inventario de ejercicios — Escenario Fútbol

El escenario Fútbol es el primero en implementación. Sirve como plantilla para los escenarios siguientes (Hogar, Taller mecánico, Cantina, etc.).

### 7.1 Wrapper narrativo

**Club ficticio:** "Atlético Necochea Unidos" (nombre inventado, sin riesgo de IP). Cancha de barrio. El paciente colabora con el utilero, el DT y el kinesiólogo en tareas del día a día del club.

### 7.2 Inventario completo: 23 ejercicios distribuidos en 6 ejes

#### Eje 1: Camisetas (5 ejercicios)

| Tier | game_slug | Mecánica | Dimensión saliente declarada |
|---|---|---|---|
| 1 | camisetas-numeros | Drag desde montón a perchero. 11 camisetas idénticas, único discriminador es el dorsal 1-11. | seriación numérica |
| 2 | camisetas-tamanos | 11 camisetas con número Y tres tamaños cruzados. Compiten dos dimensiones. | seriación + atención + flexibilidad |
| 3 | camisetas-tonalidad | 11 camisetas mismo número, distinta tonalidad de blanco-de-uso. | discriminación perceptual de tonalidad |
| 4 | camisetas-equipos | Mezcla de 3 equipos visualmente distintos. Agrupar por equipo. | agrupación categorial |
| 5 | camisetas-orden-juego | 11 camisetas para ubicar en posiciones de cancha 4-3-3 o 4-4-2. | conocimiento táctico cristalizado + mapeo espacial |

#### Eje 2: Botines (4 ejercicios)

| Tier | game_slug | Mecánica | Dimensión saliente declarada |
|---|---|---|---|
| 1 | botines-tamano | 5 pares idénticos en color y forma, varía solo el tamaño físico. Ordenar de menor a mayor. | seriación de magnitud perceptual |
| 2 | botines-duenos | 5 pares + 5 jugadores con altura. Trampa: arquero alto con pie chico, jugador bajo con pie grande. Asignar cada par a su dueño. | inhibición de heurística + razonamiento |
| 3 | botines-uso | 5 pares mismo tamaño, distinto desgaste (suela, taco, costuras). Ordenar por nivel de uso. | discriminación perceptual de deterioro |
| 4 | botines-tipo | Botines de tapón, futsal, papi, fútbol 5, calle. Agrupar por tipo de uso funcional. | agrupación funcional |

#### Eje 3: Medias (3 ejercicios)

| Tier | game_slug | Mecánica | Dimensión saliente declarada |
|---|---|---|---|
| 1 | medias-mugre | 8 medias mismo modelo, distinta tonalidad por uso acumulado. Ordenar de más limpia a más sucia. | discriminación perceptual de tonalidad continua |
| 2 | medias-mugre-trampa | 8 medias + 1-2 con mancha localizada de barro rojo. Ordenar por uso real, no por mancha puntual. | discriminación global vs local + inferencia causal |
| 3 | medias-pares | 12 medias sueltas, armar 6 pares. | agrupación por matching |

#### Eje 4: Vestuario y objetos (4 ejercicios)

| Tier | game_slug | Mecánica | Dimensión saliente declarada |
|---|---|---|---|
| 1 | mate-DT | 6 pasos para cebar mate. Drag de elementos en orden de uso. | secuenciación AVD cultural |
| 2 | bolso-jugador | Armar bolso para viaje en orden correcto: ropa interior abajo, botines arriba. | secuenciación espacial planificada |
| 3 | vestuario-hora-partido | 8 prendas, ordenar en orden de vestido del jugador antes de salir. | secuenciación apraxia del vestir |
| 4 | botiquin-pre-partido | 8 elementos del botiquín, ordenar por urgencia ante una lesión. | razonamiento procedural médico |

#### Eje 5: Cancha y partido (5 ejercicios)

| Tier | game_slug | Mecánica | Dimensión saliente declarada |
|---|---|---|---|
| 1 | trail-pelotas-A | 25 pelotas numeradas 1-25 esparcidas. Tocar en orden tirando línea de drag. | velocidad de procesamiento + atención sostenida |
| 2 | trail-pelotas-B | 13 pelotas numéricas + 12 jugadores con letras. Alternar 1-A-2-B-3-C... | flexibilidad cognitiva, set-shifting |
| 3 | secuencia-jugada | 5-6 jugadores en orden de paso para reconstruir una jugada vista previamente. | memoria episódica visual + secuenciación |
| 4 | alineacion-tactica | 11 jugadores, ubicar en cancha en formación 4-4-2 o 4-3-3. | mapeo espacial táctico |
| 5 | cabalas-numericas | "El 9 mete goles según un patrón. 2, 4, 8, 16, ¿próximo?" 10 series de complejidad creciente. | razonamiento inductivo numérico |

#### Eje 6: Hinchada y memoria (2 ejercicios)

| Tier | game_slug | Mecánica | Dimensión saliente declarada |
|---|---|---|---|
| 1 | hinchada-coreografia | 9 sectores de tribuna se iluminan en secuencia (longitud creciente 3-5-7-9). Repetir tocando. Variante de Corsi. | memoria de trabajo visuo-espacial |
| 2 | canticos-orden | Secuencia auditiva de 4-7 cánticos cortos del club. Repetir orden tocando. | memoria auditiva secuencial |

### 7.3 Total escenario Fútbol

**23 ejercicios** distribuidos en 6 ejes y 5 tiers. Si el paciente accede 5 días por semana, hace un ejercicio por día: ~5 semanas por eje, ~6 meses para agotar el escenario completo sin repetición. Suficiente para una internación típica de la clínica.

---

## 8. Esquema de datos en Supabase

### 8.1 Tablas existentes que se reusan

- `zykos_metrics_canonical` — destino de las métricas de cada sesión (sin cambios)
- `zykos_game_metrics` — vista legacy, se mantiene mientras dure la transición
- `zykos_users` (con `dni` como clave) — sin cambios
- `zykos_games` — agregar entradas para los 23 game_slug nuevos

### 8.2 Tabla nueva: `zykos_patient_progress`

Necesaria para implementar la mecánica de desbloqueo y cooldown.

```sql
CREATE TABLE zykos_patient_progress (
  id BIGSERIAL PRIMARY KEY,
  dni TEXT NOT NULL,
  scenario_slug TEXT NOT NULL,        -- 'futbol', 'hogar', 'taller', 'cantina'
  axis_slug TEXT NOT NULL,            -- 'camisetas', 'botines', 'medias', etc.
  current_tier INT NOT NULL DEFAULT 1,
  unlocked_exercises JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ['camisetas-numeros', 'botines-tamano', ...]
  next_available_at TIMESTAMPTZ,      -- cooldown 24h por eje
  clinical_override_tier INT,          -- override del médico, NULL si no hay
  clinical_override_at TIMESTAMPTZ,
  clinical_override_by TEXT,           -- DNI del médico que firmó el override
  last_completed_exercise TEXT,
  last_completed_at TIMESTAMPTZ,
  total_exercises_completed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dni, scenario_slug, axis_slug)
);

CREATE INDEX idx_progress_dni ON zykos_patient_progress(dni);
CREATE INDEX idx_progress_next ON zykos_patient_progress(next_available_at);
```

RLS: el paciente solo lee sus propias filas. El médico lee todas las filas de pacientes asignados a su clínica.

### 8.3 Vista derivada: `zykos_patient_dashboard_view`

Materializada o lógica, según volumen. Devuelve por DNI:

- Cantidad de ejercicios completados por eje
- Días consecutivos de uso
- Próximo ejercicio disponible y cuándo
- Trayectoria de las métricas canónicas principales (motor, velocidad, atención, ejecutivo) en formato sparkline

Esta es la vista que alimenta el mini-dashboard del paciente y, en versión expandida, el dashboard clínico del médico.

---

## 9. Plan de implementación por fases

Cada fase es un PR autocontenido con commits convencionales. Ninguna fase comienza hasta que la anterior está mergeada y verificada en producción.

### Fase 0 — Aprobación de este documento

**Entregable:** este blueprint commiteado en `docs/RUTINA_DIARIA_BLUEPRINT.md`, validado por el autor clínico, sin cambios pendientes.

**Tiempo estimado:** 1 sesión de revisión.

### Fase 1 — Extensión del Diccionario V4

**Entregable:** nuevo `engines/METRIC_DICTIONARY_V4.json` con los tres dominios nuevos (`SERIACION`, `AGRUPACION`, `SECUENCIACION`) y las 19 métricas detalladas en sección 5.3. Sin modificar dominios existentes ni `prohibited_metrics`.

**Tiempo estimado:** 1 PR, ~2 horas de trabajo.

### Fase 2 — Migración Supabase

**Entregable:** migration SQL nueva en `migrations/` que crea `zykos_patient_progress` y `zykos_patient_dashboard_view`. RLS configurado. Aplicada en el proyecto Supabase `aypljitzifwjosjkqsuu`.

**Tiempo estimado:** 1 PR + 1 ejecución manual de migration en Supabase.

### Fase 3 — Reescritura del motor seriation/grouping con pointer events

**Entregable:** `engines/classify-and-place/index.html` modificado. Las funciones `startSeriation()`, `startGrouping()` y nuevas `startSequencing()` reescritas con pointer events. Hookeo verificado a `agent-motor.js`, `agent-rt.js`, `agent-inhibition.js`. Nuevas funciones de detección de estrategia post-hoc (`detectSeriationStrategy()`, `detectGroupingStrategy()`).

**Tiempo estimado:** 1 PR grande, ~6 horas. **Crítico:** sin esta fase, las fases siguientes generan deuda técnica.

### Fase 4 — 3 ejercicios piloto del escenario Fútbol

**Entregable:** packs JSON para `camisetas-numeros`, `botines-tamano`, `medias-mugre`. Wrapper narrativo "Atlético Necochea Unidos" estabilizado. Verificación end-to-end: paciente entra desde portal → ejecuta uno → métricas aparecen en `zykos_metrics_canonical` con todos los dominios poblados.

**Tiempo estimado:** 1 PR, ~3 horas.

### Fase 5 — Portal con vista "ejercicio del día"

**Entregable:** modificación de `games/portal/index.html` para mostrar al paciente solo el o los ejercicios disponibles hoy según su `zykos_patient_progress`. Mini-dashboard del paciente accesible desde el portal (ver sección 4.4).

**Tiempo estimado:** 1 PR, ~4 horas.

### Fase 6 — Panel clínico de override y monitoreo

**Entregable:** sección nueva en el dashboard del médico para:
- Ver progresión por paciente y por eje
- Forzar tier de un eje específico
- Habilitar excepción al cooldown 24h
- Ver trayectoria longitudinal de métricas canónicas

**Tiempo estimado:** 1 PR, ~6 horas.

### Fase 7 — Completar los 20 ejercicios restantes del escenario Fútbol

**Entregable:** packs JSON para los 20 ejercicios listados en sección 7.2 que no están en el piloto.

**Tiempo estimado:** 2-3 PRs incrementales, ~10 horas totales.

### Fase 8 — Replicación a escenarios futuros

**Entregable:** plantilla genérica para crear un nuevo escenario (Hogar, Taller, Cantina) reusando el motor sin modificación. Documentación de la plantilla.

**Tiempo estimado:** plantilla en 1 PR, cada escenario nuevo después es ~10-15 horas según riqueza temática.

---

## 10. Reglas inviolables del módulo

Estas reglas se chequean antes de mergear cualquier PR del módulo Rutina Diaria. Si un PR las viola, se rechaza sin discusión.

1. **Cero `tremor_*`** ni cualquier métrica listada en `prohibited_metrics` del Diccionario V4.
2. **Cero etiquetas clínicas hardcoded** en código, packs JSON, mensajes al paciente o nombres de variables. La interpretación vive en el médico.
3. **DNI como clave universal.** Nunca `patient_id`, nunca `user_id`. El campo se llama `dni`.
4. **Hash de evidencia obligatorio** en cada escritura a `zykos_metrics_canonical`. Cadena SHA-256 enlazada.
5. **Cero emojis en interfaz del paciente.** Permitidos solo en assets visuales (íconos de objetos del juego: pelota, camiseta, etc.).
6. **Sin gamificación competitiva.** No ranking, no estrellas, no puntos visibles, no comparación entre pacientes.
7. **Drag-and-drop con pointer events**, no HTML5 drag nativo, no clicks.
8. **Consigna abierta**, nunca instructiva. El paciente decide la dimensión.
9. **Un ejercicio por día por eje**, salvo override clínico explícito.
10. **Desbloqueo por completitud, no por performance.**
11. **Sin Service Worker que cachee HTML del juego.** Permitido cachear assets estáticos.
12. **Sin tracking de terceros**, sin Google Analytics, sin Hotjar, sin Sentry-con-PII.
13. **Cualquier nuevo dominio cognitivo** se declara primero en el Diccionario V4 antes de capturarse en código. El JSON es el contrato.

---

## 11. Anexo: plantilla replicable para escenarios futuros

Cada escenario nuevo (Hogar, Taller mecánico, Cantina, Kiosco) replica la estructura del escenario Fútbol con:

- 6 ejes cognitivos temáticamente coherentes con el escenario
- ~3-5 ejercicios por eje, distribuidos en 5 tiers
- Wrapper narrativo con vocabulario, paleta y assets propios
- Reusan el motor y las métricas canónicas sin modificación
- Reusan el sistema de progreso `zykos_patient_progress` con `scenario_slug` distinto

Ejemplos de plantillas tentativas (no implementadas, requieren diseño dedicado posterior):

| Escenario | Ejes posibles |
|---|---|
| Hogar | cocina, lavadero, biblioteca, baño, taller, jardín |
| Taller mecánico | herramientas, repuestos, motor, carrocería, neumáticos, factura |
| Cantina | bebidas, platos, caja, mesas, depósito, menú |
| Kiosco | golosinas, cigarrillos, revistas, vuelto, cara conocida, vencimientos |

Cada escenario debe ser diseñado con un blueprint propio que herede las reglas inviolables de este documento.

---

## 12. Pendientes paralelos no cubiertos por este blueprint

Estos ítems están en el radar del proyecto pero no son parte del módulo Rutina Diaria. Se listan para que no se pierdan:

- Bug semántico de escritura en `pill-organizer`, `medication-memory`, `neuro-chef` (parsean OK pero no escriben — auditoría RLS/DNI/schema pendiente)
- Migración del dashboard general de `zykos_game_metrics` (legacy) a `zykos_metrics_canonical` (V4)
- Uso prohibido de `tremorIndex` en `pill-organizer.html:992` (renombrar a `jitter_reposo_px`)
- Dependabot moderate alert abierta en el repo
- Revocación del PAT GitHub usado en sesiones recientes (expuesto en chat)
- Implementación del agente IA `zykos-analyze-session` con prompts de detección de patrón sin etiquetado clínico

---

## 13. Cierre

Este documento es el contrato técnico-clínico del módulo Rutina Diaria. Cualquier divergencia futura entre el código y este blueprint debe resolverse modificando el documento primero, no el código de tapadita. La trazabilidad entre intención clínica y ejecución técnica es la condición que hace que este sistema sea defendible ante una auditoría regulatoria, una disputa de IP, o una decisión clínica controvertida.

El sistema mide. El clínico interpreta. El paciente vive su rutina diaria.

---

**Fin del documento. Versión 1.0. 13 de abril de 2026.**
