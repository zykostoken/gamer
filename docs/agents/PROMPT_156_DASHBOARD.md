# PROMPT — AUDIT #156 — Dashboard 174 métricas completas

**EJECUTOR:** Claude Code (terminal CLI en tu máquina, dentro del repo `Psykostoken/gamer`).

**CÓMO LO PEGÁS:**
1. Abrí terminal en tu máquina.
2. `cd` al repo gamer (si no lo tenés cloneado, primero `git clone https://github.com/Psykostoken/gamer.git`).
3. Corré `claude` (eso abre Claude Code en ese directorio).
4. Pegá TODO lo que está debajo del separador.

---

**MODELO RECOMENDADO en Claude Code:** **Sonnet 4.5** (más cuota, ideal para sesiones largas). Si la tarea exige razonamiento arquitectural en algún punto, Claude Code permite cambiar a Opus 4.5 mid-sesión.

# CONTEXTO Y DOCTRINA — LEÉ ANTES DE TOCAR

Sos el ejecutor técnico de ZYKOS GAMER, plataforma B2B de fenotipado cognitivo del Dr. Gonzalo Pérez Cortizo. Tu trabajo se mide en código mergeado y verificado, no en explicaciones.

## Reglas no negociables

1. **Verificar antes de afirmar.** Nunca digas "está hecho" sin chequear desde DB / archivo / API. Asumir es la fuente del 80% de los bugs de este proyecto.
2. **Canon vivo = `zykos_metric_dictionary`** en Supabase project `aypljitzifwjosjkqsuu`. 175+ métricas firmadas. Constitución V4 Art VIII.
3. **NO tocar `buzblnkpfydeheingzgn`** (Supabase clínica José Ingenieros, tablas `hdd_*`). ZYKOS GAMER es **`aypljitzifwjosjkqsuu`** exclusivo, tablas `zykos_*`.
4. **Workflow**: branch desde main → audit `in_progress` en `zykos_canon_audit` → trabajo → commit + push + PR → merge squash → audit `done`.
5. **Argentino comprimido**, sin emojis, sin reverencias. Mostrá trabajo, no entusiasmo.
6. **Estado limpio al 29-abr 04:40 AR**: trigger V5 normalizer activo, JSONB con 0 contaminación legacy en 2905 filas, RLS 62/62, 7 pg_cron, 0 PRs abiertos. No hay deuda — solo este audit y el #166.

## Recursos

| Recurso | ID/URL |
|---|---|
| Supabase MCP project | `aypljitzifwjosjkqsuu` |
| Repo | `Psykostoken/gamer` (estás dentro) |
| Branch base | `main` (commit `3943d38`) |
| Domain | `zykos.ar` |
| Pacientes test | DNI 30542195 (Gonzalo), 13207846 (Arturo Coupau) |

---

# TU TAREA — AUDIT #156

**Doctrina firmada por el Dr. Pérez Cortizo (verbatim):**

> "lawn mower toma 54 metricas, porque no veo todas... todas de cada juego no una parte... chequea e incorporalas antes que..."

## Problema

El dashboard del profesional muestra **un subconjunto pequeño de métricas** por juego, no todas las que efectivamente cada juego escribe en `zykos_game_metrics`. Esto vuelve invisible al clínico una buena parte del fenotipado capturado.

Como el JSONB ahora está en canon V5 limpio (trigger normalizer activo, dict con `legacy_aliases`), el dashboard puede leer canon directo sin RPCs traductoras.

## Plan de trabajo (ejecutalo en este orden)

### FASE 1 — Auditoría real (antes de tocar código)

1. **Protocolo de arranque obligatorio:**
   ```sql
   SELECT * FROM zykos_canon_audit ORDER BY phase, id;
   SELECT metric_key, domain, schema_column, deprecated 
   FROM zykos_metric_dictionary 
   WHERE deprecated IS NOT TRUE ORDER BY domain, metric_key;
   ```
   Mostrame el output. No avances sin esto.

2. **Inventario de archivos del dashboard:**
   ```bash
   git ls-files | grep -iE 'dashboard|report|informe' | head -30
   git ls-files games/play/ | head
   ```

3. **Inventario de métricas que cada juego escribe:**
   Por cada juego en `games/play/`, hacé grep de las keys que llegan a `metric_data`:
   ```bash
   for f in games/play/*.html games/play/*/index.html; do
     echo "=== $f ==="
     grep -oE "metric_data['\"]?\s*[:=]\s*\{[^}]+\}" "$f" 2>/dev/null | head -5
     grep -oE "['\"]([a-z_]+_(ms|count|ratio|pct|px|index|score|rate|error|event))['\"]" "$f" 2>/dev/null | sort -u
   done
   ```

4. **Cruzar contra canon vivo:**
   Para cada juego, listar:
   - Métricas que el juego escribe Y están en `zykos_metric_dictionary.metric_key` → **incluir en dashboard**
   - Métricas que el juego escribe pero NO están en el dict → **reportar a Gonzalo, no inventar**
   - Métricas en el dict del dominio del juego que el juego NO escribe → **gap, reportar**

5. **Output esperado de Fase 1:** una tabla markdown con columnas:
   `juego | metric_key | domain | nature | está_en_canon | está_capturada | acción`

### FASE 2 — Diseño dashboard

1. Identificar archivo principal del dashboard (probablemente `gamer/dashboard/report.html` o similar).
2. Para cada juego, una sección con sub-secciones por dominio (`motor_coordination`, `attention_speed`, `executive_function`, `memory_learning`, `semantic_comprehension`, `affective_regulation`, `navigation_behavior`, `infrastructure`).
3. Dentro de cada dominio, mostrar TODAS las métricas que ese juego captura para ese dominio.
4. Layout: tabla simple con columnas `métrica | valor último | media histórica | trend Q1→Q4`.
5. **NO usar Chart.js todavía** (eso es audit #166). Solo tablas con números bien formateados.

### FASE 3 — Implementación

1. Crear branch: `feature/dashboard-156-metricas-completas`.
2. Audit pre-trabajo:
   ```sql
   UPDATE zykos_canon_audit 
   SET status='in_progress', notes=notes || E'\n\n=== UPDATE <fecha> ===\nClaude Code arrancando. Plan: <copiar Fase 2>'
   WHERE id=156;
   ```
3. Modificar el dashboard HTML con las nuevas secciones.
4. Si hace falta una RPC nueva para traer todas las métricas por juego/paciente, crearla con `apply_migration` (NO inline en frontend).
5. Probar localmente con DNI 30542195 (mis datos).

### FASE 4 — Verificación

1. Confirmar que cada juego muestra el conteo de métricas esperado de Fase 1.
2. Si lawn-mower captura 54 métricas, el dashboard debe mostrar 54 (no menos).
3. Output esperado: tabla con `juego | metricas_esperadas | metricas_mostradas | OK/FAIL`.

### FASE 5 — Cierre

1. Commit conventional: `feat(dashboard): mostrar todas las metricas canonicas por juego (audit #156)`.
2. Push a origin: `git push -u origin feature/dashboard-156-metricas-completas`.
3. Crear PR vía GitHub CLI (si no tenés `gh` instalado, dame la URL del branch que armo el PR yo en chat):
   ```bash
   gh pr create --title "feat(dashboard): metricas completas por juego (audit #156)" \
                --body "Implementa audit #156. Dashboard ahora muestra todas las metricas canonicas que cada juego efectivamente captura, agrupadas por dominio semiologico." \
                --base main
   ```
4. Mergear con squash y borrar branch.
5. Audit post-trabajo:
   ```sql
   UPDATE zykos_canon_audit 
   SET status='done', notes=notes || E'\n\n=== DONE <fecha> ===\nPR #<num> mergeado. <N> juegos, <total> métricas mostradas. Verificación: <resumen>'
   WHERE id=156;
   ```

## Criterios de éxito (cómo sabe el Dr. que terminaste bien)

- Audit #156 marcado `done` en `zykos_canon_audit`.
- PR mergeado a main, branch borrada.
- Lawn-mower muestra todas las métricas que captura (esperado ≥40).
- Cada otro juego muestra todas sus métricas canónicas.
- Guardian sigue OK: `curl https://aypljitzifwjosjkqsuu.supabase.co/functions/v1/zykos-guardian`.
- Reporte resumen con: juegos modificados, total de métricas agregadas al dashboard, archivos tocados.

## Si encontrás algo raro

- Si una métrica del dict no tiene cómo calcularse → comentariola en el dashboard como "pendiente captura" pero NO la inventes.
- Si el dashboard ya tenía estructura distinta a la que asumo → no lo refactorices entero, solo extendelo.
- Si hay conflict con el trigger V5 → parar y reportar, no tocar el normalizer.

**Empezá con Fase 1 y mostrame el output antes de avanzar.** No saltees fases.
