# PROMPT — TAXISTA NECOCHEA · F1 ESQUELETO + ESTÍMULOS COGNITIVOS

**EJECUTOR:** Claude Code (terminal CLI en tu máquina, dentro del repo `Psykostoken/gamer`).

**MODELO RECOMENDADO:** Sonnet 4.5 (sesión larga, multi-archivo). Si en algún punto necesitás razonamiento arquitectural, podés cambiar a Opus 4.5 con `/model`.

**ALCANCE:** F1 con estímulos cognitivos. Sin NPCs, sin semáforos, sin combustible. Eso queda para F2/F3.

**CÓMO LO PEGÁS:**
1. Abrí terminal en tu máquina, vas al repo: `cd ~/gamer && git pull origin main`.
2. Corré `claude` en esa carpeta.
3. (Opcional) `/model` → seleccioná Sonnet 4.5.
4. Pegá TODO lo que está debajo del separador.

---

# CONTEXTO Y DOCTRINA — leé antes de tocar

Sos el ejecutor técnico de **ZYKOS GAMER** (zykos.ar), plataforma B2B de fenotipado cognitivo del Dr. Gonzalo Pérez Cortizo. Trabajás sobre el repo `Psykostoken/gamer`, branch `main`. Audit #191 te tracquea.

## Reglas no negociables

1. **Verificar antes de afirmar.** Chequeá DB / archivo / API real antes de dar cambio por hecho. Las suposiciones rompieron este proyecto antes.
2. **Canon vivo = `zykos_metric_dictionary`** en Supabase project `aypljitzifwjosjkqsuu`. **PROHIBIDO inventar métricas nuevas.** Si una mecánica no mapea a métrica canon existente, no se mide — no se inventa.
3. **NO tocar `buzblnkpfydeheingzgn`** (otro proyecto). ZYKOS GAMER es `aypljitzifwjosjkqsuu` exclusivo.
4. **Doctrina #1 estética: SIN EMOJIS, NUNCA.** Todo dibujado con Canvas 2D primitivas (`fillRect`, `arc`, `lineTo`, `fillText`). Forma + color + texto plano. Estética **app casual moderna sin elementos gamer/retro**.
5. **Argentino comprimido**, sin reverencias. Mostrá trabajo, no entusiasmo.
6. **Si algo no está claro, parar y reportar — NO inventar solución.** Mejor un PR a medio terminar que un PR que mete deuda silenciosa.

## Recursos

| Recurso | ID/Path |
|---|---|
| Supabase MCP project | `aypljitzifwjosjkqsuu` (zykos_*) |
| Repo (estás dentro) | `Psykostoken/gamer` |
| Branch base | `main` |
| Audit ID | **#191** |
| DNI test | 30542195 (Gonzalo) |
| Patrón de referencia | `games/play/lawn-mower.html` (6210 líneas) |

---

# OBJETIVO CLÍNICO

Juego de manejo top-down: el paciente conduce un taxi por un mapa simplificado de Necochea, recibe consignas verbales (texto en pantalla) sobre dónde llevar al pasajero, y completa 5 viajes consecutivos. Mide:

- **Memoria de consignas** (¿recordó el destino?)
- **Comprensión** (tiempo de lectura, releyó/pidió repetir)
- **RT y atención sostenida** (5 viajes seguidos, fatiga por tercios)
- **Inhibición y estímulos go/no-go** (bocinas auditivas mid-viaje → tocar barra espaciadora si la oís)
- **Flexibilidad cognitiva** (cambio de destino mid-viaje en 1-2 viajes)
- **Motor** (jitter, velocidad, eficiencia trayectoria — capturado automático por agent-motor)

---

# ARQUITECTURA — 3 archivos a crear/modificar

| Archivo | Acción | Tamaño aprox |
|---|---|---|
| `packs/taxista/pack.json` | CREAR | ~400 líneas (datos mapa + 5 misiones + 5 destinos) |
| `games/play/taxista.html` | CREAR | ~1800 líneas (HTML + CSS + JS inline, single-file pattern) |
| `games/portal/index.html` | MODIFICAR | +5 líneas (agregar entrada en array `GAMES`) |

**NO crear nuevos archivos en `games/shared/`. NO tocar `zykos-engine.js`, agentes, ni nada de la infra.** El juego se enchufa al engine via los scripts de ZYKOS al final del body.

---

# PLAN DE TRABAJO — 6 FASES OBLIGATORIAS EN ORDEN

## FASE 0 — Protocolo de arranque (no skipear)

```bash
cd ~/gamer && git checkout main && git pull origin main
git checkout -b feature/taxista-necochea-f1
```

Audit pre-trabajo en Supabase MCP:
```sql
UPDATE zykos_canon_audit 
SET status='in_progress', 
    notes = notes || E'\n\n=== UPDATE <fecha> ===\nClaude Code (Sonnet 4.5) arrancando F1 taxista. Branch feature/taxista-necochea-f1. Plan: 3 archivos (pack.json + taxista.html + portal/index.html update). Sin métricas inventadas. Estética app casual moderna sin emojis.'
WHERE id=191;
```

Verificar canon vivo (queries obligatorias):
```sql
-- Las métricas que SÍ podés usar (no inventar otras)
SELECT metric_key, domain FROM zykos_metric_dictionary
WHERE deprecated IS NOT TRUE
  AND domain IN ('attention_speed','memory_learning','executive_function',
                 'semantic_comprehension','motor_coordination','navigation_behavior')
ORDER BY domain, metric_key;
```

Verificar patrón de scripts ZYKOS exacto (no inventar):
```bash
sed -n '6100,6210p' games/play/lawn-mower.html
```
Copiar **textualmente** ese bloque al final de `taxista.html` reemplazando el slug `'lawn-mower'` por `'taxista'`.

## FASE 1 — `packs/taxista/pack.json`

### Mapa de Necochea simplificado (grilla 24x16 tiles)

Tile types soportados:
```
'road_h'     calle horizontal
'road_v'     calle vertical
'inter'      intersección (taxi puede doblar)
'block'      manzana (no transitable)
'park'       parque (no transitable, decorativo)
'beach'      playa (no transitable, decorativo)
'water'      mar (no transitable, decorativo)
'lm'         landmark (destino, ver `landmarks[]`)
```

**Layout sugerido (orientación: izquierda=oeste/centro, derecha=este/Quequén, abajo=mar):**

- 6 calles horizontales (Av 2, Av 10, Av 50, Av 59, Av 79, Costanera)
- 6 calles verticales (Calle 4, 22, 56, 73, 87, 502)
- Manzanas como `block` entre calles
- Franja inferior 2 tiles: `beach` y `water` (Necochea costa atlántica)
- Parque Miguel Lillo: zona de 4x3 tiles `park` en sector centro-oeste

### 5 landmarks reales (con posición x,y en grilla):

```json
{
  "id": "plaza_dardo_rocha",
  "name": "Plaza Dardo Rocha",
  "type": "plaza",
  "color": "#a7f3d0",
  "x": 11, "y": 6,
  "label_es": "Plaza Dardo Rocha"
}
```

Los 5: Plaza Dardo Rocha (centro), Hospital Emilio Ferreyra (norte), Terminal de Ómnibus (oeste), Playa Costanera (sur), Faro Quequén (este). Ubicalos lógicamente en la grilla.

### 5 misiones (1 pasajero por viaje, 5 viajes consecutivos):

```json
{
  "mission_id": 1,
  "passenger_name": "Sra. Marta",
  "pickup_lm": "plaza_dardo_rocha",
  "destination_lm": "hospital_emilio_ferreyra",
  "consigna_text": "Por favor, llevame al Hospital Emilio Ferreyra. Tengo turno con el médico.",
  "estimulo_auditivo": false,
  "cambio_destino_mid": null
}
```

**De las 5 misiones:**
- Misión 1: simple (pickup + destino, consigna corta)
- Misión 2: simple
- Misión 3: con `estimulo_auditivo: true` (bocina random durante el viaje, paciente debe tocar Espacio si la oye)
- Misión 4: simple
- Misión 5: con `cambio_destino_mid: "terminal_omnibus"` (a mitad del viaje el pasajero "cambió de idea", actualiza destino → mide flexibilidad cognitiva)

### Formato `pack.json` final:

```json
{
  "meta": {
    "id": "taxista-necochea",
    "version": "1.0.0",
    "name": "Taxista Necochea",
    "subtitle": "5 viajes por la ciudad",
    "audit_id": 191
  },
  "map": {
    "width": 24,
    "height": 16,
    "tile_size_default": 36,
    "tiles": [ ["block","road_h",...], ... ]
  },
  "landmarks": [ ... 5 objetos ... ],
  "missions": [ ... 5 objetos ... ],
  "audio_stimulus": {
    "type": "horn_beep",
    "frequency_hz": 440,
    "duration_ms": 200,
    "trigger_response_key": "Space",
    "max_response_window_ms": 2500
  }
}
```

## FASE 2 — `games/play/taxista.html` — Estructura HTML + CSS

### Diseño visual (estricto, NO improvisar):

- **Paleta:**
  - Fondo body `#faf5e8` (arena cálida)
  - Calles `#d1d5db` (gris claro)
  - Veredas `#e8e0d0`
  - Manzanas `#fef3c7` (amarillo muy suave) con borde `#fcd34d`
  - Parque `#a7f3d0` (verde menta)
  - Mar `#7dd3fc` (celeste)
  - Playa `#fde68a` (arena más cálida)
  - Taxi `#fbbf24` (amarillo cálido) con cartel "TAXI" arriba (texto Canvas)
  - Landmarks: rectángulo color por tipo + texto blanco encima con nombre
  - Pasajero pickup: círculo `#ec4899` con texto pequeño "👤" → **REEMPLAZAR por "P" simple en círculo**, sin emoji
  - Destino: círculo `#10b981` con texto "✓" → **REEMPLAZAR por "D" simple en círculo**

- **Tipografía:** `font-family: 'DM Sans', system-ui, sans-serif`. Mínimos: 18px en juego, 24px en consignas, 32px en HUD.

- **Bordes redondeados:** `border-radius: 12px` en cards/modales/botones.

- **HUD superior fijo:**
  - Izquierda: "Viaje 1 de 5" (texto grande)
  - Centro: consigna actual del pasajero (texto en card cálida)
  - Derecha: ganancia acumulada `$ 1.250` (no "score", no "puntos")
  - Botón "Repetir consigna" abajo de la consigna (penaliza `re_instruction_request`)

- **Mini-mapa esquina inferior derecha:** vista reducida del mapa con punto verde = destino, punto amarillo = vos.

- **Controles mobile:** D-pad virtual estilo `lawn-mower.html` líneas 174-209 (copiá ese patrón). 4 botones (↑↓←→) tamaño 80x80px, semi-transparentes. Botón "ENTREGAR" grande cuando estás cerca del destino.

- **Pantallas:**
  1. Inicio: logo "ZYKOS · Taxista Necochea" + texto "Recorré la ciudad con tu taxi. Llevá pasajeros, escuchá las consignas, hacé tu día." + botón grande "Empezar viaje".
  2. Juego: HUD + canvas + mini-mapa + dpad mobile.
  3. Resultado por viaje: card cálida "¡Buen trabajo! Llegaste a Hospital Emilio Ferreyra." + breakdown métricas en lista simple.
  4. Resultado final 5 viajes: gráficos línea con Chart.js (RT por viaje, hesitation_count por viaje, eficiencia_trayectoria por viaje).

### Render del taxi (Canvas, sin emojis):
```js
function drawTaxi(ctx, x, y, dir) {
  // dir: 0=N, 1=E, 2=S, 3=O
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir * Math.PI / 2);
  // cuerpo
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-14, -8, 28, 16);
  // ruedas
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-12, -10, 4, 3);
  ctx.fillRect(8, -10, 4, 3);
  ctx.fillRect(-12, 7, 4, 3);
  ctx.fillRect(8, 7, 4, 3);
  // cartel TAXI
  ctx.fillStyle = '#000';
  ctx.font = 'bold 7px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('TAXI', 0, 2);
  ctx.restore();
}
```

### Render de landmark (Canvas, sin emojis):
```js
function drawLandmark(ctx, lm, tx, ty, size) {
  ctx.fillStyle = lm.color;
  ctx.fillRect(tx, ty, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.font = `bold ${Math.floor(size * 0.16)}px DM Sans, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(lm.label_es, tx + size/2, ty + size/2 + 4);
}
```

## FASE 3 — Lógica de juego

### Game loop (`requestAnimationFrame`):

```js
function loop(t) {
  update(t);
  render();
  requestAnimationFrame(loop);
}

function update(t) {
  // mover taxi según teclas/dpad presionado
  // detectar overlap con pickup_lm → trigger consigna
  // detectar overlap con destination_lm + tecla "ENTREGAR" → completar viaje
  // si misión tiene estimulo_auditivo → cada N segundos disparar beep
  // si misión tiene cambio_destino_mid → al 50% del path estimado, modal "el pasajero cambió de idea"
}
```

### Eventos custom a registrar via `ZYKOS._pushRaw()`:

```js
// En cada evento clave del juego:
window.ZYKOS && ZYKOS._pushRaw('taxista', 'mission_started', {
  mission_id: 1,
  pickup_lm: 'plaza_dardo_rocha',
  destination_lm: 'hospital_emilio_ferreyra'
});

ZYKOS._pushRaw('taxista', 'consigna_shown_at', { ts: Date.now() });
ZYKOS._pushRaw('taxista', 'consigna_dismissed_at', { ts: Date.now() }); 
// Diferencia → instruction_read_ms (canon)

ZYKOS._pushRaw('taxista', 'consigna_repeat_requested', { 
  mission_id: 1, count: 1 
}); // → re_instruction_request (canon)

ZYKOS._pushRaw('taxista', 'auditory_stim_emitted', { 
  ts: Date.now(), stim_id: 'horn_1' 
});
ZYKOS._pushRaw('taxista', 'auditory_stim_response', { 
  ts: Date.now(), stim_id: 'horn_1', latency_ms: 1240 
}); // → auditory_stimulus_latency_ms (canon)

ZYKOS._pushRaw('taxista', 'destination_changed_mid', { 
  mission_id: 5, old: 'playa_costanera', new: 'terminal_omnibus' 
}); // → captura task_switch_cost_ms (canon)

ZYKOS._pushRaw('taxista', 'mission_completed', {
  mission_id: 1,
  destination_correct: true,  // → objective_efficacy / commission_error
  duration_ms: 45230,
  path_length_tiles: 18,
  optimal_path_tiles: 14    // → ratio = eficiencia_trayectoria estimada
});
```

### Métricas canon usadas (TODAS deben existir en `zykos_metric_dictionary` — NO inventar):

| Mecánica | Métrica canon (verificada en dict) | Cómo se captura |
|---|---|---|
| Tiempo leyendo consigna | `instruction_read_ms` | `consigna_dismissed_at - consigna_shown_at` |
| Pidió repetir consigna | `re_instruction_request` | contador del botón "Repetir consigna" |
| Releyó (abrió modal de nuevo) | `relecturas_consigna_count` | contador de re-aperturas |
| Tiempo desde consigna a primer movimiento | `time_to_first_action_ms` | timestamp diff |
| Llegó al destino correcto | `objective_efficacy` (1.0 si correcto, 0 si no) | flag al completar |
| Llegó a destino incorrecto | `commission_error`, `intrusion_error` | si confundió con otro landmark |
| RT al estímulo auditivo | `auditory_stimulus_latency_ms` | response - stim emit |
| Detección estímulo auditivo | `auditory_stimulus_detected_count` | flag |
| Cambio de destino mid-viaje | `task_switch_cost_ms` | RT post-cambio - RT pre-cambio |
| Tiempo total del viaje | `session_duration_ms` | end - start |
| Tiles recorridos | `navigation_path_length` | conteo |
| Volvió a tile ya visitado | `navigation_revisit_ratio` | revisits/total |
| Pausa larga (>2s sin moverse) | `long_pause_event`, `pause_event_ms`, `hesitation_count` | timer |
| Score final 5 viajes | `secuencia_correcta_pct` | correctas/5 × 100 |
| Recall final ¿qué destinos te tocaron? | `cliente_pedido_recall_pct` | pregunta al final, paciente lista los 5 destinos |

**Motor (jitter, vel, trayectoria) lo captura `agent-motor.js` automático.** No tocás nada de eso.

## FASE 4 — Sistema de consignas + estímulos auditivos

### Modal de consigna:
- Aparece cuando taxi llega al `pickup_lm` (overlap por bounding box)
- Card cálida con texto grande (24px), nombre del pasajero arriba, consigna abajo
- Timer interno mide `instruction_read_ms` desde aparición hasta cierre
- Botón "Empezar viaje" grande
- Botón secundario "Repetir consigna" (incrementa contador)

### Estímulo auditivo (misión 3):
- Web Audio API (sin dependencias):
```js
function playHorn() {
  var ctx = new (window.AudioContext || window.webkitAudioContext)();
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.frequency.value = 440;
  osc.connect(gain); gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.start(); osc.stop(ctx.currentTime + 0.2);
}
```
- Disparo aleatorio cada 8-15 segundos durante el viaje 3
- Listener `keydown` para Space, calcula latencia
- Si no responde en `max_response_window_ms` (2500ms) → `auditory_stimulus_missed`

### Cambio de destino (misión 5):
- Cuando el taxi recorrió ~50% de la distancia óptima, modal urgente: "El pasajero acaba de pedir cambio: en realidad necesita ir a [Terminal de Ómnibus]. Adaptá tu ruta."
- Mide RT pre-cambio vs RT post-cambio → `task_switch_cost_ms`
- Mini-mapa actualiza el destino marcado

## FASE 5 — Integración ZYKOS (copiar bloque exacto de lawn-mower)

Copiar **textualmente** el bloque `<!-- ZYKOS ENGINE + AGENTES -->` de `lawn-mower.html` líneas 6160-6210 al final del body de `taxista.html`. Reemplazar **únicamente** el slug `'lawn-mower'` por `'taxista'` en los 2-3 lugares donde aparezca (auto-save, comentarios).

Auto-arranque de sesión:
```js
window.addEventListener('DOMContentLoaded', function() {
  var dni = window.ZYKOS_DNI || new URLSearchParams(location.search).get('dni') 
            || localStorage.getItem('zykos_patient_dni');
  if (dni && window.ZYKOS && typeof ZYKOS.startSession === 'function') {
    ZYKOS.startSession('taxista', dni, null);
    console.log('[taxista] ZYKOS session started for DNI', dni);
  }
});
```

Cierre al terminar los 5 viajes:
```js
function endGame() {
  // ... mostrar pantalla final con charts
  if (window.ZYKOS && typeof ZYKOS.endSession === 'function') {
    ZYKOS.endSession();
  }
}
```

## FASE 6 — Registrar en portal

Editar `games/portal/index.html`. Buscar el array `var GAMES = [...]` (alrededor de línea 99). Agregar entrada **antes** del `daily-routine` o donde encaje:

```js
{ slug:'taxista', name:'Taxista Necochea', icon:'[T]', color:'#fbbf24',
  desc:'5 viajes por la ciudad. Memoria de consignas, atencion sostenida, estimulos auditivos, flexibilidad cognitiva.',
  domains:['MEM1 Trabajo','C1 Comprension','A1 Atencion','E2 Planificacion'],
  url:'/games/play/taxista.html' },
```

---

# FASE 7 — Verificación + cierre

### Checklist obligatorio:

```bash
# 1. Archivos creados/modificados
git status --short
# Debe mostrar:
#   A  packs/taxista/pack.json
#   A  games/play/taxista.html
#   M  games/portal/index.html

# 2. No hay emojis en taxista.html
grep -E '[\xF0-\xF7]' games/play/taxista.html | head
# Debe retornar 0 líneas (cero emojis Unicode)

# 3. No hay métricas inventadas
grep -E "navegacion_destino_correcto_pct|ruta_eficiencia_ratio|consigna_memoria_score|infracciones_transito|backtrack_count|tiempo_planificacion_ms|zona_ignorada|dispersion_ruta_px" games/play/taxista.html packs/taxista/pack.json
# Debe retornar 0 líneas

# 4. Bloque ZYKOS engine presente y bien
grep -n "zykos-engine.js\|agent-motor.js\|agent-rt.js\|require-auth" games/play/taxista.html
# Debe mostrar las 4+ líneas de scripts ZYKOS

# 5. Pack válido
node -e "const p = require('./packs/taxista/pack.json'); console.log('Mapa:', p.map.width, 'x', p.map.height, '· Misiones:', p.missions.length, '· Landmarks:', p.landmarks.length)"
# Debe imprimir: Mapa: 24 x 16 · Misiones: 5 · Landmarks: 5
```

Si cualquier paso falla → **parar y reportarme**, no parchear.

### Commit + push + PR:

```bash
git add packs/taxista/pack.json games/play/taxista.html games/portal/index.html
git commit -m "feat(taxista): F1 esqueleto + estimulos cognitivos (audit #191)

Nuevo juego de fenotipado: paciente conduce taxi por mapa simplificado
de Necochea, completa 5 viajes con consignas, estimulos auditivos go/no-go,
y cambio de destino mid-viaje en mision 5.

Mide (todo canon vivo, cero metricas inventadas):
- instruction_read_ms, re_instruction_request, relecturas_consigna_count
- time_to_first_action_ms, objective_efficacy, commission_error
- auditory_stimulus_latency_ms, auditory_stimulus_detected_count
- task_switch_cost_ms, navigation_path_length, navigation_revisit_ratio
- long_pause_event, hesitation_count, cliente_pedido_recall_pct
- Motor (jitter, vel, trayectoria) via agent-motor automatico

Estetica: app casual moderna sin emojis, paleta calida, target adultos
mayores y pensamiento concreto. Doctrina #1 estetica respetada.

Archivos:
- packs/taxista/pack.json (mapa 24x16 + 5 landmarks + 5 misiones)
- games/play/taxista.html (single-file, patron lawn-mower)
- games/portal/index.html (entrada en GAMES array)

F1 sin NPCs, sin semaforos, sin combustible. F2/F3 quedan como
audits separados.
"

git push -u origin feature/taxista-necochea-f1

gh pr create --title "feat(taxista): F1 esqueleto + estimulos cognitivos (audit #191)" \
             --body "Implementa audit #191 fase 1. Juego nuevo de fenotipado cognitivo conducción urbana.

Mecánicas F1:
- 5 viajes consecutivos por mapa simplificado de Necochea (24x16 tiles)
- Consigna textual del pasajero, tiempo lectura medido
- Botón repetir consigna penalizado (medición)
- Misión 3: estímulo auditivo aleatorio (bocina) → respuesta con barra espaciadora
- Misión 5: cambio de destino mid-viaje → flexibilidad cognitiva

Métricas (TODAS canon vivo, cero invenciones):
13+ métricas mapeadas a zykos_metric_dictionary verificadas pre-implementación.

Estética app casual moderna sin emojis (doctrina #1).
Sin NPCs, sin semáforos, sin combustible — F2/F3 quedan separadas.
" \
             --base main

gh pr merge --squash --delete-branch
```

Si `gh` CLI no instalada, hacé el push y dame URL del branch — armo el PR desde la web.

### Audit final:

```sql
UPDATE zykos_canon_audit 
SET status='done', 
    notes = notes || E'\n\n=== DONE <fecha> ===\nPR #<num> mergeado. 3 archivos creados/modificados. Verificación grep emojis: 0. Verificación métricas inventadas: 0. Pack JSON válido: 5 misiones, 5 landmarks, mapa 24x16. F1 completa, F2/F3 quedan como audits separados.'
WHERE id=191;

-- Crear audits hijos para F2 y F3
INSERT INTO zykos_canon_audit (phase, task, status, notes) VALUES
('F9', 'taxista_F2_NPCs_semaforos_peatones', 'pending', 
 'F2 del taxista. Agregar NPCs con pathfinding simple, semáforos rojo/verde, peatones cruzando. Métrica nueva candidata: infracciones_transito_count (requiere firma del Dr antes de incorporar al dict).'),
('F9', 'taxista_F3_misiones_combustible_eventos', 'pending',
 'F3 del taxista. Combustible + estaciones de servicio, eventos dinámicos (lluvia, corte de calle), 7 niveles escalables. Métricas nuevas candidatas requieren firma del Dr.');
```

Reporte final que tenés que mostrarle al Dr cuando termines:

- Número de PR
- Total líneas agregadas/modificadas
- Lista de las 13+ métricas canon usadas
- Conteo de archivos: `pack.json`, `taxista.html`, `portal/index.html`
- Verificación grep emojis = 0
- Audits #191 done, F2/F3 creados como pending

---

# CRITERIOS DE ÉXITO

| Criterio | Cómo se verifica |
|---|---|
| PR mergeado a main | `gh pr list --state merged --base main` |
| 0 emojis en código del juego | `grep -PE '[\x{1F300}-\x{1FFFF}]' games/play/taxista.html` retorna 0 líneas |
| 0 métricas inventadas | grep contra lista negra retorna 0 |
| `taxista.html` carga sin error en console | (no podés probar en browser, confiás en lint) |
| Pack válido | `node -e "require('./packs/taxista/pack.json')"` no error |
| Audit #191 done en `zykos_canon_audit` | query devuelve status='done' |
| Audits F2 y F3 creados pending | query devuelve 2 nuevas filas |

---

# SI ENCONTRÁS ALGO RARO

- Si una métrica que pensás usar no está en `zykos_metric_dictionary` → **no la inventes**, omitila del juego y reportala al final como "métrica candidata para incorporar".
- Si el patrón de scripts ZYKOS de lawn-mower difiere de lo que armaste → respetá lawn-mower como verdad.
- Si te quedás sin contexto a mitad → committeá lo que tengas, push, y reportá al Dr para que retome con otra sesión.
- Si Supabase MCP no está disponible → hacé los SQL como bloques de texto al final del reporte para que se ejecuten manualmente.
- **NO crear nuevos archivos en `games/shared/`. NO tocar `zykos-engine.js`. NO tocar agentes.** Si pensás que necesitás eso, parar y reportar.

---

**Empezá por FASE 0 y reportame al cerrar el PR. Una sola pasada. Sin atajos. Doctrina respetada.**
