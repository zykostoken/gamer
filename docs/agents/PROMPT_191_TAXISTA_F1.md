# PROMPT — TAXISTA NECOCHEA F1 (Opción B con estímulos cognitivos)

**EJECUTOR:** Claude Code en terminal local (modelo Sonnet 4.5).

**CÓMO LO PEGÁS:**
1. Abrí terminal en tu máquina, repo gamer.
2. `git pull origin main`
3. Ejecutá `claude` (o continuá tu sesión existente).
4. Pegá TODO lo que está debajo del separador.

---

# CONTEXTO Y DOCTRINA — leé antes de tocar

Sos el ejecutor técnico de **ZYKOS GAMER** (zykos.ar), plataforma B2B de fenotipado cognitivo del Dr. Gonzalo Pérez Cortizo. Repo `Psykostoken/gamer`.

## Reglas no negociables

1. **Verificar antes de afirmar.** Chequeá DB / archivo real antes de afirmar nada.
2. **Canon vivo en `zykos_metric_dictionary`** (Supabase project `aypljitzifwjosjkqsuu`). **NO inventar métricas nuevas.** Solo usar las 175+ ya firmadas.
3. **NO tocar `buzblnkpfydeheingzgn`** (otro proyecto, clínica J.I.).
4. **Estética: app casual moderna, lo más moderno posible.** Cero retro pixel. Cero emojis (regla #1 firmada del proyecto). Bordes redondeados, paleta cálida, tipografía DM Sans / system-ui, todo dibujado con Canvas 2D primitivas.
5. **Argentino comprimido**, sin emojis en chat, sin reverencias. Mostrame trabajo, no entusiasmo.
6. **Si no encontrás algo del canon, parás y preguntás. No inventás.**

## Recursos

| Recurso | ID/URL |
|---|---|
| Supabase MCP project | `aypljitzifwjosjkqsuu` |
| Repo | `Psykostoken/gamer` |
| Branch base | `main` |
| Audit ID | **#191** |
| DNI test | 30542195 (Gonzalo) |
| Patrón de referencia | `games/play/lawn-mower.html` (6210 líneas, GTA-style top-down con tiles, WASD, d-pad mobile, integración ZYKOS completa) |

---

# OBJETIVO — TAXISTA NECOCHEA F1

Juego de navegación urbana donde el paciente maneja un taxi sobre un mapa de Necochea, recibe consignas verbales de pasajeros (recogerlos y llevarlos a destinos correctos), y debe responder a estímulos cognitivos durante el viaje. Mide localización espacial, memoria de consigna, RT, comprensión, atención sostenida, control motor, e inhibición.

**Target real:** adultos mayores 70+ y personas con discapacidad intelectual. **NO gamers.** Tiene que verse como una app moderna de celular, no como un videojuego.

## Métricas canon que se capturan (cero invenciones — todas existen ya en `zykos_metric_dictionary`)

| Mecánica del juego | Métrica canon | Dominio |
|---|---|---|
| Tiempo leyendo consigna del pasajero | `instruction_read_ms` | semantic_comprehension |
| Pidió "repetir consigna" | `re_instruction_request` | semantic_comprehension |
| Releyó la consigna mid-viaje | `relecturas_consigna_count` | semantic_comprehension |
| Saltea consigna sin leer | `instruction_skip` | semantic_comprehension |
| Recuerda destino al final | `pregame_consigna_recall_pct`, `cliente_pedido_recall_pct` | comprehension + memory |
| Llegó al destino correcto | `objective_efficacy`, `secuencia_correcta_pct` | executive |
| Llegó a destino incorrecto | `commission_error`, `intrusion_error` | executive + memory |
| Tiempo de "consigna" a "arranco" | `time_to_first_action_ms` | executive |
| Distancia recorrida | `navigation_path_length` | navigation |
| Re-visitó zona (perdido) | `navigation_revisit_ratio`, `hilo_perdido_count` | navigation |
| Insiste en ruta que no llega | `perseveration_event` | executive |
| Cambio correctivo | `self_correction_event`, `flexibility_index` | executive |
| Pausa larga sin moverse | `long_pause_event`, `pause_event_ms`, `hesitation_count` | attention |
| Fatiga últimos viajes | `vigor_mental_h1_h2`, `eficacia_por_tercios`, `rt_q1/q2/q3/q4_ms` | attention + executive |
| Estabilidad de manejo | `eficiencia_trayectoria`, `vel_cv`, `vel_uniformidad_index` | motor |
| Temblor en cursor | `jitter_reposo_px` | motor (capturado por agent-motor) |
| Frenadas/acelerones bruscos | `vel_caida_brusca_ratio`, `abrupt_redirections` | motor |
| RT al ver pasajero/landmark | `rt_mean_ms`, `rt_trial_ms` | attention |
| Detecciones correctas | `hit_count`, `miss_count`, `d_prime` | attention (SDT) |
| Sesión completa | `session_duration_ms` | navigation |

## Estímulos cognitivos extra (Opción B firmada)

Tres mecánicas adicionales que se capturan con métricas canon ya existentes:

**E1. Bocina aleatoria → respuesta espacio:**
- Cada 30-60s, suena bocina. El paciente debe tocar barra ESPACIO en <2s.
- Captura: `auditory_stimulus_detected_count`, `auditory_stimulus_latency_ms`, `auditory_compliance_pct`, `miss_count` (no respondió).

**E2. Distractor musical de fondo:**
- Música ambiente continua con tempo variable (60bpm en zonas calmas, 110bpm en zonas centro).
- Captura: `bg_music_tempo_entrainment_ratio`, `bg_music_reaction_events`, `bg_audio_distraction_count`.
- Toggle ON/OFF disponible para configuraciones sin sonido.

**E3. Cambio de destino mid-viaje:**
- En 1 de cada 3 viajes, el pasajero "cambia de idea" y dice nuevo destino mid-trayecto.
- Captura: `task_switch_cost_ms`, `flexibility_index`, `post_error_strategy`.
- El sistema mide cuánto tarda el paciente en redirigir vs. seguir hacia destino original.

---

# ARQUITECTURA TÉCNICA

## Archivos a crear

| Archivo | Propósito | Tamaño aprox |
|---|---|---|
| `games/play/taxista.html` | Juego completo single-file | ~2000 líneas |
| `packs/taxista/pack.json` | Mapa Necochea + landmarks + pasajeros + consignas | ~600 líneas JSON |

## Archivo a modificar

| Archivo | Cambio |
|---|---|
| `games/portal/index.html` | Agregar entrada `{ slug:'taxista', name:'Taxista Necochea', icon:'[T]', color:'#fbbf24', url:'/games/play/taxista.html' }` |

---

# DISEÑO VISUAL — APP CASUAL MODERNA

## Paleta cálida (NO retro, NO oscura)

```css
--bg-arena:       #faf5e8   /* fondo general */
--street:         #d1d5db   /* calles */
--sidewalk:       #e8e0d0   /* veredas */
--park:           #a7f3d0   /* parques verde menta */
--beach-sand:     #fde68a   /* arena de la playa */
--sea:            #7dd3fc   /* mar celeste */
--taxi-yellow:    #fbbf24   /* taxi amarillo cálido */
--landmark-bg:    #fff      /* fondo blanco para landmarks */
--landmark-text:  #1e293b   /* texto landmarks */
--accent:         #f59e0b   /* acentos cálidos */
--text-primary:   #1e293b
--text-secondary: #64748b
--success:        #10b981
--warning:        #f59e0b
--error-soft:     #fca5a5   /* rojos suaves, no agresivos */
```

## Tipografía

```css
font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
```

Tamaños:
- Consignas (modal): **24px**, line-height 1.5, padding generoso
- HUD: 18px
- Texto de landmarks (sobre canvas): 14-16px Bold
- Botones acción: 18px Medium

## Bordes y sombras

```css
border-radius: 16px (cards/modals);
border-radius: 12px (botones);
box-shadow: 0 4px 14px rgba(0,0,0,0.08);
```

NADA de bordes angulares. NADA de pixelado. Todo redondeado y suave.

## Render del taxi y elementos (Canvas 2D, sin sprites pixel)

```js
// Taxi: rectángulo redondeado amarillo + 4 ruedas + cartel "TAXI"
ctx.fillStyle = '#fbbf24';
roundRect(ctx, x, y, 32, 18, 6); // helper de rect redondeado
ctx.fill();
ctx.fillStyle = '#1e293b';
ctx.fillRect(x+3, y-3, 6, 4); // rueda delantera izq
ctx.fillRect(x+23, y-3, 6, 4); // rueda delantera der
ctx.fillRect(x+3, y+17, 6, 4); // rueda trasera izq
ctx.fillRect(x+23, y+17, 6, 4); // rueda trasera der
ctx.fillStyle = '#1e293b';
ctx.font = 'bold 8px DM Sans';
ctx.fillText('TAXI', x+8, y+11);

// Landmark: rectángulo blanco con sombra + texto
ctx.shadowColor = 'rgba(0,0,0,0.1)';
ctx.shadowBlur = 8;
ctx.fillStyle = '#fff';
roundRect(ctx, lx, ly, 80, 60, 12);
ctx.fill();
ctx.shadowBlur = 0;
ctx.fillStyle = '#1e293b';
ctx.font = 'bold 14px DM Sans';
ctx.textAlign = 'center';
ctx.fillText('Hospital', lx+40, ly+25);
ctx.font = '11px DM Sans';
ctx.fillStyle = '#64748b';
ctx.fillText('emergencias', lx+40, ly+42);
```

## Sin emojis, sin pictogramas

- Landmarks identificados por **rectángulo blanco con sombra + texto en bold + subtexto**.
- Pasajeros: círculo color suave (rosado #fca5a5 / celeste #93c5fd) con inicial textual ("M" para María, "J" para Juan).
- Mar y playa: franjas continuas de color con líneas curvas suaves animadas (olas con `Math.sin(time/500)`).
- Árboles: círculo verde menta sobre rectángulo marrón pequeño.

---

# MAPA DE NECOCHEA F1 (simplificado)

## Grilla 16x12 tiles, tile size 48px

Distribución espacial:
- **Norte (filas 0-3):** zona residencial + Plaza Dardo Rocha (centro: tile [8,2])
- **Centro (filas 4-7):** centro comercial, calles transitadas, Hospital ([4,5]), Terminal ([12,5])
- **Sur (filas 8-9):** Av. 59 horizontal, salida hacia rambla
- **Costa (filas 10-11):** Playa (franja continua), Faro al este ([14,11])

## 6 landmarks F1 (todos con nombres reales de Necochea)

1. **Plaza Dardo Rocha** — centro tile [8,2]
2. **Hospital Municipal** — tile [4,5]
3. **Terminal de Ómnibus** — tile [12,5]
4. **Playa Central** — tile [8,11] (franja)
5. **Faro Necochea** — tile [14,11]
6. **Parque Miguel Lillo** — tile [2,8]

## 5 viajes F1 (cada uno con consigna textual)

```json
[
  {
    "trip": 1,
    "passenger_name": "María",
    "pickup": [8,2],
    "destination": [4,5],
    "consigna": "Buenas tardes. Necesito que me lleves al Hospital Municipal, por favor.",
    "destination_label": "Hospital Municipal",
    "switch_destination": null
  },
  {
    "trip": 2,
    "passenger_name": "Juan",
    "pickup": [12,5],
    "destination": [14,11],
    "consigna": "Llevame al Faro, voy a sacar fotos del atardecer.",
    "destination_label": "Faro Necochea",
    "switch_destination": null
  },
  {
    "trip": 3,
    "passenger_name": "Carmen",
    "pickup": [4,5],
    "destination": [8,2],
    "consigna": "A la Plaza Dardo Rocha, por favor. Tengo una reunión.",
    "destination_label": "Plaza Dardo Rocha",
    "switch_destination": null
  },
  {
    "trip": 4,
    "passenger_name": "Roberto",
    "pickup": [8,2],
    "destination": [2,8],
    "consigna": "Al Parque Miguel Lillo. Voy a caminar un rato.",
    "destination_label": "Parque Miguel Lillo",
    "switch_destination": {
      "trigger_after_tiles": 5,
      "new_destination": [8,11],
      "new_destination_label": "Playa Central",
      "switch_text": "Disculpá, cambié de idea, mejor llevame a la Playa Central."
    }
  },
  {
    "trip": 5,
    "passenger_name": "Lucía",
    "pickup": [2,8],
    "destination": [12,5],
    "consigna": "A la Terminal, tengo el micro de las seis.",
    "destination_label": "Terminal de Ómnibus",
    "switch_destination": null
  }
]
```

---

# IMPLEMENTACIÓN — PASO A PASO

## FASE 1 — Preparación (5 min)

```bash
git checkout main && git pull origin main
git checkout -b feat/taxista-necochea-f1
mkdir -p packs/taxista
```

Audit pre-trabajo en Supabase:

```sql
UPDATE zykos_canon_audit 
SET status='in_progress', 
    notes = notes || E'\n\n=== UPDATE <fecha> ===\nClaude Code arrancando F1 Opción B + estética casual moderna firmada. Branch: feat/taxista-necochea-f1.'
WHERE id=191;
```

## FASE 2 — Pack de datos `packs/taxista/pack.json` (15 min)

Crear archivo con:
1. **`meta`**: id, name, version, cognitive_targets (de los dominios canon)
2. **`map`**: grilla 16x12 con tile types: `ROAD_H`, `ROAD_V`, `INTERSECTION`, `BLOCK`, `PARK`, `BEACH`, `SEA`, `LANDMARK`, `SIDEWALK`
3. **`landmarks`**: array de 6 (nombre, posición tile, color de fondo, subtítulo)
4. **`trips`**: array de 5 (estructura de arriba)
5. **`stimuli_config`**: configuración de bocina aleatoria (frecuencia, ventana RT) y música de fondo (bpm zonas)

## FASE 3 — Esqueleto HTML `games/play/taxista.html` (60 min)

Patrón de `games/play/lawn-mower.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Taxista Necochea · ZYKOS GAMER</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    /* CSS inline con la paleta cálida + bordes redondeados */
    /* HUD top, canvas center, d-pad bottom (mobile) */
    /* Modales redondeados con sombra suave */
  </style>
</head>
<body>
  <div id="app">
    <header id="hud">
      <div class="stat" id="stat-trip">Viaje 1 / 5</div>
      <div class="stat" id="stat-time">00:00</div>
      <div class="stat" id="stat-earnings">$0</div>
      <button id="btn-repeat-consigna">Repetir consigna</button>
    </header>
    
    <canvas id="game" width="768" height="576"></canvas>
    
    <div id="dpad" class="mobile-only">
      <button data-dir="up">↑</button>
      <button data-dir="left">←</button>
      <button data-dir="right">→</button>
      <button data-dir="down">↓</button>
      <button id="btn-action">Recoger / Dejar</button>
      <button id="btn-honk-response" class="hidden">¡Bocina!</button>
    </div>
    
    <!-- Modal consigna -->
    <div id="consigna-modal" class="modal hidden">
      <div class="modal-content">
        <div class="passenger-avatar"></div>
        <p class="consigna-text"></p>
        <div class="consigna-timer"></div>
        <button id="btn-empezar-viaje">Empezar viaje</button>
      </div>
    </div>
    
    <!-- Modal resultado -->
    <div id="result-modal" class="modal hidden">
      <div class="modal-content">
        <h2>¡Buen trabajo!</h2>
        <p>Mirá cómo te fue:</p>
        <div id="result-stats"></div>
        <button id="btn-otro-viaje">Hacer otro viaje</button>
      </div>
    </div>
  </div>

  <!-- ZYKOS engine + 9 agentes pirata (mismo patrón que lawn-mower) -->
  <script src="/games/shared/zykos-engine.js"></script>
  <script src="/games/shared/agents/agent-motor.js"></script>
  <script src="/games/shared/agents/agent-rt.js"></script>
  <script src="/games/shared/agents/agent-presence.js"></script>
  <script src="/games/shared/agents/agent-inhibition.js"></script>
  <script src="/games/shared/agents/agent-context.js"></script>
  <script src="/games/shared/agents/agent-scroll.js"></script>
  <script src="/games/shared/agents/agent-focus.js"></script>
  <script src="/games/shared/agents/agent-og-media.js"></script>
  <script src="/games/shared/agents/agent-media.js"></script>
  <script src="/games/shared/media-init.js"></script>
  
  <!-- JS del juego (al final, después de ZYKOS) -->
  <script>
    // Auto-session via ZYKOS al cargar (mismo patrón lawn-mower)
    // Game state, loop, render, eventos
  </script>
</body>
</html>
```

## FASE 4 — Game loop y mecánicas (90 min)

1. **Cargar pack** via `fetch('/packs/taxista/pack.json')`.
2. **Tile engine**: parsear grilla, dibujar con `roundRect` y colores cálidos.
3. **Taxi**:
   - Posición continua (no por tile) — movimiento fluido tipo GPS.
   - Velocidad limitada, aceleración suave (0.3s para máxima velocidad).
   - Solo se mueve sobre tiles `ROAD_*` / `INTERSECTION`.
   - WASD/flechas en desktop, d-pad en mobile.
4. **Pasajero**: círculo con inicial pulsante en tile pickup. Modal de consigna al llegar (medir `instruction_read_ms`).
5. **Mini-mapa**: esquina superior derecha, 120x90px. Punto del taxi + flecha al destino.
6. **Estímulos auditivos** (E1): timer aleatorio 30-60s. Sonido de bocina via Web Audio API (oscilador). Captura RT del espacio.
7. **Música de fondo** (E2): toggle ON/OFF. Tempo variable según zona del mapa.
8. **Switch destination** (E3): en trip 4, después de 5 tiles recorridos → modal "Disculpá, cambié de idea..." → captura `task_switch_cost_ms`.
9. **Detección de llegada**: bounding box del taxi vs tile destino. Botón "Dejar pasajero" activa la detección.
10. **Resultado por viaje**: modal con métricas relevantes en lenguaje accesible (NO mostrar números crudos al paciente — eso es para el clínico en el dashboard).

## FASE 5 — Integración ZYKOS (20 min)

```js
// Auto-session al cargar
ZYKOS.startSession('taxista', dni, userId);

// Eventos custom durante el juego
ZYKOS._pushRaw('passenger_pickup', { trip_id, pickup_tile, ts });
ZYKOS._pushRaw('consigna_read_complete', { trip_id, instruction_read_ms });
ZYKOS._pushRaw('passenger_dropoff', { trip_id, correct_destination, dropoff_tile });
ZYKOS._pushRaw('honk_stimulus', { ts });
ZYKOS._pushRaw('honk_response', { latency_ms, hit: true/false });
ZYKOS._pushRaw('destination_switch', { trip_id, new_dest, switch_cost_ms });
ZYKOS._pushRaw('repeat_consigna_request', { trip_id, count });

// Al final
ZYKOS.endSession({ completed: true, score, trips_correct, trips_incorrect });
```

Los 9 agentes capturan automáticamente: motor (jitter cursor → captura temblor de manejo), RT, presencia, inhibición, context, focus, og-media (FACS si cámara), media.

## FASE 6 — Registro en portal (5 min)

Editar `games/portal/index.html` línea ~135 (después de `libreria`), agregar:

```js
{ slug:'taxista', name:'Taxista Necochea', icon:'[T]', color:'#fbbf24',
  description:'Manejá un taxi por las calles de Necochea',
  url:'/games/play/taxista.html' },
```

## FASE 7 — Verificación (15 min)

```bash
# 1. Estructura
ls -la games/play/taxista.html packs/taxista/pack.json
wc -l games/play/taxista.html

# 2. Validar JSON
python3 -m json.tool packs/taxista/pack.json > /dev/null && echo "JSON OK"

# 3. Verificar imports correctos
grep -c "zykos-engine.js\|agent-" games/play/taxista.html
# debería dar al menos 10

# 4. Grep de cero emojis (regla #1)
grep -P '[\x{1F000}-\x{1FFFF}]|[\x{2600}-\x{27BF}]' games/play/taxista.html packs/taxista/pack.json
# debería dar 0 resultados

# 5. Grep de uso de métricas inventadas (regla #2: solo canon)
grep -E "navegacion_destino_correcto_pct|ruta_eficiencia_ratio|consigna_memoria_score|infracciones_transito_count|backtrack_count|tiempo_planificacion_ms|zona_ignorada|dispersion_ruta_px" games/play/taxista.html packs/taxista/pack.json
# debería dar 0 resultados
```

Si alguna verificación falla → corregir antes de commit.

## FASE 8 — Cierre (10 min)

```bash
git add games/play/taxista.html packs/taxista/ games/portal/index.html
git commit -m "feat(taxista): F1 esqueleto Necochea + estímulos cognitivos (audit #191)

Nuevo juego de navegación urbana sobre mapa simplificado de Necochea.
F1 incluye:
- Mapa 16x12 con 6 landmarks reales (Plaza Dardo Rocha, Hospital, 
  Terminal, Playa, Faro, Parque Miguel Lillo)
- 5 viajes con pasajeros y consignas textuales
- Bocina aleatoria como estímulo auditivo (auditory_stimulus_*)
- Música de fondo con tempo variable (bg_music_*)
- Switch destination en viaje 4 (task_switch_cost_ms)
- Integración completa con 9 agentes ZYKOS pirata

Estética: app casual moderna, paleta cálida, DM Sans, sin emojis,
todo Canvas 2D primitivas redondeadas. Target: adultos mayores 70+
y discapacidad intelectual.

Métricas: cero invenciones. Solo canon vivo (zykos_metric_dictionary).
Mapeo a 30+ métricas de attention_speed, memory_learning, 
executive_function, semantic_comprehension, motor_coordination, 
navigation_behavior."

git push -u origin feat/taxista-necochea-f1
```

PR vía `gh` CLI:
```bash
gh pr create --title "feat(taxista): F1 esqueleto Necochea + estímulos cognitivos (audit #191)" \
             --body "Implementa audit #191 fase F1. Nuevo juego de navegación urbana." \
             --base main
gh pr merge --squash --delete-branch
```

Audit done:
```sql
UPDATE zykos_canon_audit 
SET status='done', 
    notes = notes || E'\n\n=== F1 DONE <fecha> ===\nPR #<num> mergeado. Archivos: games/play/taxista.html (~<N> lines), packs/taxista/pack.json, games/portal/index.html. Métricas usadas (todas canon): <lista>. Estímulos E1 (bocina) + E2 (música tempo) + E3 (switch destination) implementados. F2 NPCs/semáforos queda para próximo sprint.'
WHERE id=191;
```

---

# CRITERIOS DE ÉXITO

- PR mergeado a `main`, branch borrada.
- Audit #191 marcado `done` con número de PR.
- Archivos creados: `games/play/taxista.html` (~2000 líneas) + `packs/taxista/pack.json` + portal modificado.
- `grep -P '[\x{1F000}-\x{1FFFF}]'` retorna **0 emojis** en archivos del juego.
- Grep de las 8 métricas inventadas retorna **0 resultados** (solo canon vivo).
- 10+ agentes ZYKOS importados al final del HTML (mismo patrón que lawn-mower).
- Visualmente: cuando lo abrís en browser local, se ve como una app moderna (paleta cálida, bordes redondeados, DM Sans, NO retro pixel).

---

# SI ENCONTRÁS ALGO RARO

- Si una métrica que mencioné NO está en `zykos_metric_dictionary` cuando la chequeás → **parar, reportar, no inventar**.
- Si `zykos-engine.js` o algún agente tiene API distinta a la que asumo → leé `games/play/lawn-mower.html` últimas 100 líneas para ver el patrón exacto y replicalo.
- Si el mapa 16x12 queda muy chico visualmente → ajustá tile size a 56px o 64px (no agrandes la grilla).
- Si Web Audio API no funciona en Safari iOS → fallback: el estímulo bocina puede ser visual (flash de borde naranja del canvas) en vez de sonoro. Reportá la decisión.

**Empezá con FASE 1 (branch + audit) y reportame al cerrar el PR. Pegate al plan, no improvises scope (NO agregues NPCs ni semáforos — eso es F2).**
