# MATRIZ DE SEMÁNTICAS DE INPUT POR JUEGO

**Documento doctrinal — referencia obligatoria Art 3.6 Canon V4.**

**Fecha:** 24-Abr-2026
**Autor:** Dr. Gonzalo J. Pérez Cortizo + Claude (auditoría de código)
**Base:** lectura directa de `games/play/*.html` en commit bffd05a
**Estado:** vivo — se actualiza cuando un juego cambia su mecánica

---

## 0. REGLA RECTORA (Art 3.6)

Los gestos de input del paciente se clasifican en dos categorías mutuamente excluyentes:

1. **Gesto bruto** — el juego no asigna intención declarada. El gesto es un evento DOM crudo (`click`, `touchend`, `keydown`) cuyo significado clínico es ambiguo y requiere cruce post-hoc. Ejemplo: un click en una gondola de super-market que no discrimina entre click derecho e izquierdo es bruto.

2. **Gesto semántico** — el juego asigna intención declarada por diseño de la mecánica. El juego **debe emitir** un `event_type` nombrado al stream (no un `click_event` genérico), con la intención declarada como campo de datos. Ejemplo: click izquierdo corto sobre pastilla = `pill_cycle_fraction`; click derecho sobre pastilla = `pill_pickup`.

Los gestos brutos van al stream como `click_event` / `touch_event` / `keystroke_event` con campos de resolución clínica (botón, detail, target_was_active, delta_previous_ms). Los gestos semánticos van al stream como `event_type` específico del dominio semántico.

---

## 1. MATRIZ

Leyenda de columnas:
- **Gesto**: combinación concreta de evento DOM + condiciones
- **Mecánica actual**: qué hace el juego con ese gesto hoy (leído del código)
- **Tipo**: `BRUTO` o `SEMÁNTICO`
- **event_type propuesto**: nombre canónico del evento que el juego debería emitir al stream en Fase A de V5
- **Dominios candidatos**: dominios clínicos que ese evento puede alimentar al ser cruzado post-hoc

### 1.1. PILL-ORGANIZER (`games/play/pill-organizer.html`)

| Gesto | Mecánica actual | Tipo | event_type propuesto | Dominios candidatos |
|---|---|---|---|---|
| Click derecho sobre `.pill-source` | `pickupOne(med)` — toma una pastilla al stack | SEMÁNTICO | `pill_pickup` | MEMORIA, EJECUTIVO |
| Click derecho sobre `.slot` con stack | `releaseOneOnSlot(slot)` — suelta una | SEMÁNTICO | `pill_release_right` | EJECUTIVO, PRAXIS |
| Click izq corto (<LONG_PRESS_MS) sobre `.pill-source` | `cycleFraction(med)` — cicla entera → ½ → ¼ → ⅛ | SEMÁNTICO | `pill_cycle_fraction` | CALCULO, COMPRENSION |
| Click izq long-press sobre `.pill-source` | `resetFraction(med)` — vuelve a entera | SEMÁNTICO | `pill_reset_fraction` | EJECUTIVO (autocorrección) |
| Click izq normal sobre `.slot` con stack | `releaseOneOnSlot(slot)` — suelta una | SEMÁNTICO | `pill_release_left` | EJECUTIVO, PRAXIS |
| Click sobre `.reset-fraction-btn` | `resetFraction(med)` — botón UI | SEMÁNTICO | `pill_reset_button` | EJECUTIVO (autocorrección) |
| touchstart/touchend sobre pastilla | mismos gestos mapeados a touch | SEMÁNTICO | iguales, con `input_device:'touch'` | idem |

**Campos obligatorios del evento**: `intention`, `target_med`, `current_fraction`, `prescribed_fraction`, `matches_prescription`, `rt_ms_since_prev`, `x`, `y`, `t`.

**Nota clínica**: la mecánica separa 4 intenciones distintas sobre el mismo elemento (pickup, release, cycle, reset). Si se emite un `click_event` crudo el analizador pierde toda la semántica farmacológica. Este es el caso de mayor riesgo de pérdida de información.

### 1.2. LAWN-MOWER (`games/play/lawn-mower.html`)

| Gesto | Mecánica actual | Tipo | event_type propuesto | Dominios candidatos |
|---|---|---|---|---|
| Click izq (button=0) sobre canvas | `handleCanvasClick` — movimiento paso a paso | BRUTO (x,y determinan movimiento) | `lawn_move_click` | MOTOR, PRAXIS |
| Click der/medio (button=1\|2) mousedown + mousemove | Drag para mover jugador N/S/E/W | SEMÁNTICO (drag = modo continuo) | `lawn_move_drag_start`/`lawn_move_drag_end` | MOTOR |
| contextmenu | preventDefault (bloqueado) | — | — | — |
| touchend | mismo que click | BRUTO | `lawn_move_tap` | MOTOR |
| keydown (flechas/WASD) | Mueve jugador | SEMÁNTICO (teclado vs mouse ≠ pricing clínico) | `lawn_move_key` con `direction` | MOTOR, ATENCION |

**Eventos del juego a emitir** (no son de input pero son eventos brutos del juego según Art 3.6): `cable_stuck`, `bag_full`, `pool_overflow`, `child_danger`, `reset_triggered`, `blocked_by_bag`, `blocked_by_no_path`, `compostera_trip`, `flower_hit`, `pool_hit`, `grass_cut`. Todos van al stream como `event_type='game_event'` con subtipo.

### 1.3. REFLEJOS (`games/play/reflejos.html`)

| Gesto | Mecánica actual | Tipo | event_type propuesto | Dominios candidatos |
|---|---|---|---|---|
| Click sobre target con `expectedAction='tap'` | Evaluación inmediata de tap | SEMÁNTICO | `reflex_response` con `response_type:'tap'` | SDT, RT_DIST, INHIBICION |
| Click sobre target con `expectedAction='double'` — primer click | Abre ventana de 350ms, NO evalúa | SEMÁNTICO | `reflex_first_click_of_double` | SDT, RT_DIST |
| Click sobre target con `expectedAction='double'` — segundo click en ventana | Evalúa como double OK | SEMÁNTICO | `reflex_response` con `response_type:'double'` | SDT, RT_DIST, INHIBICION |
| Timeout de 350ms sin segundo click | Evalúa como tap fallido (era double) | SEMÁNTICO | `reflex_response` con `response_type:'tap_when_double_expected'` | INHIBICION, CONTROL_MOTOR |
| Click sobre target con `expectedAction='inhibit'` | Error de comisión | SEMÁNTICO | `reflex_response` con `response_type:'commission'` | INHIBICION |
| dblclick nativo | Safety net si ventana propia falló | SEMÁNTICO (ya tratado arriba) | fallback a `reflex_response` | SDT |

**Nota clínica**: reflejos ya tiene la semántica más fina del repo. Sólo falta que el juego emita esos eventos al stream en lugar de sólo resumirlos post-partida.

### 1.4. SUPER-MARKET (`games/play/super-market.html`)

| Gesto | Mecánica actual | Tipo | event_type propuesto | Dominios candidatos |
|---|---|---|---|---|
| Click sobre `.product-item` | `toggleProduct(id)` — agrega/quita del carrito | SEMÁNTICO (toggle es acción declarada) | `cart_toggle` con `direction:'add'\|'remove'`, `product_id`, `tier`, `was_in_recipe` | CALCULO, COMPRENSION, MEMORIA_TRABAJO |
| Click en botón "cobrar" | Cerrar compra y evaluar | SEMÁNTICO | `checkout_trigger` | EJECUTIVO |

**Nota**: super-market no distingue der/izq. Toda la semántica está en la identidad del producto clickeado.

### 1.5. FRIDGE-LOGIC (`games/play/fridge-logic.html`)

| Gesto | Mecánica actual | Tipo | event_type propuesto | Dominios candidatos |
|---|---|---|---|---|
| touchstart sobre `.card` | Arranca drag | SEMÁNTICO (drag = intención mover) | `fridge_drag_start` con `card_id`, `category` | EJECUTIVO, MEMORIA_SEMANTICA |
| touchmove | Movimiento durante drag | BRUTO (muchos eventos) | `fridge_drag_sample` (muestreado) | MOTOR |
| touchend sobre zona de categoría | Evalúa clasificación | SEMÁNTICO | `fridge_drop` con `card_id`, `target_category`, `is_correct` | EJECUTIVO, MEMORIA_SEMANTICA |

### 1.6. DAILY-ROUTINE (`games/play/daily-routine.html`)

| Gesto | Mecánica actual | Tipo | event_type propuesto | Dominios candidatos |
|---|---|---|---|---|
| Click sobre escena/hotspot | Registra decisión del paciente | SEMÁNTICO | `routine_scene_choice` con `scene_id`, `choice_id`, `was_optional`, `skipped_before` | COMPRENSION, PLANIFICACION, AFEC |

### 1.7. MEDICATION-MEMORY (`games/play/medication-memory.html`)

| Gesto | Mecánica actual | Tipo | event_type propuesto | Dominios candidatos |
|---|---|---|---|---|
| Click sobre tarjeta de nivel | `startGame(lvl.id)` — selección de nivel | SEMÁNTICO | `memory_level_start` | META |
| Click sobre pill en bandeja | Selecciona/deselecciona | SEMÁNTICO | `memory_tray_toggle` con `pill_id`, `direction` | MEMORIA, MEMORIA_TRABAJO |
| Click sobre `.tray-item-remove` | Quita item de la bandeja | SEMÁNTICO | `memory_tray_remove` | EJECUTIVO (autocorrección) |

### 1.8. NEURO-CHEF (`games/play/neuro-chef/index.html`)

No tiene `addEventListener` directo en el HTML — la lógica vive en `js/game.js` y `js/biometrics.js`. Requiere auditoría separada de esos módulos JS para completar esta entrada.

**TODO**: auditar `games/play/neuro-chef/js/*.js` y completar fila en próxima iteración.

---

## 2. CONSECUENCIAS DE ESTA MATRIZ PARA V5 FASE A

1. **Pill-organizer es el piloto obligatorio.** Tiene la semántica más rica (5 intenciones distintas sobre el mismo elemento visual) y es el caso que más pierde con captura genérica. Lo arreglamos primero — paso B de la sesión.

2. **Reflejos tiene la semántica mejor codificada ya en el código** — sólo falta cablear la emisión al stream. Segundo en orden.

3. **Los "eventos de juego" (no-input)** — cable_stuck, bag_full, pool_overflow, cart_toggle, fridge_drop — son tan importantes clínicamente como los eventos de input, pero **tampoco son métricas**. Van al stream con `event_type='game_event'` y subtipo. Esto es Art 3.6 punto 1.

4. **Los gestos BRUTOS existentes (canvas clicks en lawn-mower, mousemove samples)** se mantienen como eventos DOM crudos. Pero se les agrega resolución clínica: `button`, `detail`, `target_id`, `target_was_active`, `delta_previous_ms`. Lo que hoy capturamos está sub-resolucionado.

5. **El juego emite. El corsario/engine escribe.** Ningún juego hace `supabase.insert()`. Esa es la deuda arquitectónica grande — 8 juegos hoy insertan directo. Se resuelve en Fase A paralela al paso B.

---

## 3. PENDIENTES DE AUDITORÍA

- Completar neuro-chef (requiere leer `js/*.js`)
- Auditar `engines/classify-and-place` y `engines/inkblot` y `engines/kitchen` si están activos
- Verificar si rokola.html (shell) produce eventos semánticos propios distintos a los de los juegos embebidos

---

**Fin del documento.** Próximo paso: PR B (pill-organizer piloto emitiendo los 6 `event_type` semánticos declarados al stream).
