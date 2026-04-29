# PROMPT — AUDIT #166 — Tres bugs (informe SDK + juegos gráficos + rokola resume)

**EJECUTOR:** GitHub Copilot Sonnet 4.5 (preferido por cuota) o Opus 4.5 en modo Agent (en `github.com/Psykostoken/gamer`).

**CÓMO LO PEGÁS:**
1. Andá a `https://github.com/Psykostoken/gamer`.
2. Abrí Copilot Chat (panel lateral o tecla atajo).
3. Cambiá el modelo a **Claude Sonnet 4.5** (más cuota) o Opus 4.5 (más razonamiento).
4. Activá modo **Agent** (no Ask, no Edit).
5. Pegá TODO lo que está debajo del separador.

**ALTERNATIVA:** Si preferís ejecutarlo desde Claude Code (terminal local), también funciona — solo ignorá las instrucciones específicas de Copilot.

---

**MODELO RECOMENDADO:** **Sonnet 4.5** (más cuota, suficiente para esta tarea). Solo cambiar a Opus 4.5 si Sonnet falla repetidamente en el mismo paso.

# CONTEXTO Y DOCTRINA

Sos el ejecutor técnico de ZYKOS GAMER (zykos.ar), plataforma B2B de fenotipado cognitivo del Dr. Gonzalo Pérez Cortizo. Trabajás sobre el repo `Psykostoken/gamer`, branch `main` actual `3943d38`.

## Reglas no negociables

1. **Verificar antes de afirmar.** Chequeá DB / archivo / API real antes de dar un cambio por hecho.
2. **Canon vivo en `zykos_metric_dictionary`** (Supabase project `aypljitzifwjosjkqsuu`).
3. **NO tocar `buzblnkpfydeheingzgn`** (es de la clínica J.I., otro proyecto).
4. **Tres bugs separados = TRES PRs separados.** No mezclar en uno solo.
5. **Argentino comprimido**, sin emojis, sin reverencias.

## Estado al 29-abr 04:40 AR

- Trigger V5 normalizer activo en `zykos_game_metrics`. JSONB con 0 contaminación legacy.
- 7 pg_cron meta-subagentes corriendo. Guardian healthy.
- 0 PRs abiertos. Inbox limpio.
- Audit #156 (dashboard) lo está haciendo Claude Code en paralelo. NO toques `dashboard/` o archivos relacionados — coordiná solo con `informe/`, `games/`, `rokola/`.

---

# TU TAREA — AUDIT #166

Tres bugs consolidados. Cada uno = un PR.

---

## BUG 1 — Informe clínico falla con "Sin Supabase client"

**Síntoma:** al abrir `/informe/index.html` aparece error "Sin Supabase client".

**Causa:** el HTML carga `/js/supabase-config.js` pero NO carga el SDK de Supabase antes. `supabase-config.js` usa `window.supabase` que no existe.

**Fix:**

1. Crear branch: `fix/informe-166-supabase-sdk`.
2. Editar `informe/index.html` (o el archivo del informe; verificá con `git ls-files | grep informe`).
3. Antes de la línea que carga `/js/supabase-config.js`, agregar:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ```
4. Probar localmente abriendo el archivo en browser (DNI test 30542195).
5. Audit pre-trabajo:
   ```sql
   INSERT INTO zykos_canon_audit (phase, task, status, notes) VALUES
   ('F8', 'informe_166_supabase_sdk_missing', 'in_progress', 
    '29-abr. Bug: /informe/index.html no carga SDK supabase-js antes de supabase-config.js. Fix: agregar script tag CDN.');
   ```
6. Commit: `fix(informe): cargar supabase-js SDK antes de supabase-config (audit #166)`.
7. Push + PR: `fix(informe): supabase SDK missing (audit #166 parte 1/3)`.
8. Merge squash + delete branch.
9. Audit done: `UPDATE zykos_canon_audit SET status='done', notes=notes || ...` con número de PR.

---

## BUG 2 — Juegos en gráficos, no texto

**Síntoma:** el dashboard (cuando esté completo, audit #156 paralelo) muestra valores numéricos en tablas. Para uso clínico longitudinal, muchos dominios necesitan visualización temporal Q1→Q4 / H1→H2.

**Scope para este audit:** **solo agregar la INFRAESTRUCTURA de charts, no la integración completa con dashboard** (eso queda para sesión post #156).

**Fix:**

1. Esperá que audit #156 esté merged a main (Claude Code lo está haciendo). Si no está, comentá en chat y pasá al BUG 3.
2. Una vez merged #156, crear branch: `feat/charts-166-chartjs-infra`.
3. Agregar Chart.js al repo (CDN, no npm — el proyecto usa CDNs):
   ```html
   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
   ```
4. Crear archivo `games/shared/zykos-chart-helpers.js` con funciones helper:
   - `renderTemporalQuartersChart(canvasId, data)` — para Q1-Q4
   - `renderHalvesChart(canvasId, data)` — para H1-H2
   - `renderLongitudinalLineChart(canvasId, sessions)` — sesiones a lo largo del tiempo
   - Estilo: minimalista, gris, sin colores chillones, fuentes monospace.
5. Documentar en `docs/CHART_HELPERS.md` con ejemplo de uso por dominio.
6. NO integrar al dashboard todavía — esto es solo infra.
7. Commit: `feat(charts): infraestructura Chart.js para visualizaciones temporales (audit #166 parte 2/3)`.
8. PR: `feat(charts): chart helpers infra (audit #166 parte 2/3)`.
9. Merge + delete + audit done.

---

## BUG 3 — Rokola resume + bug `rokola_start_session`

**Síntoma:** 
- El rokola (random selector de juegos) no permite reanudar sesión interrumpida.
- Bug existente: `rokola_start_session` insert directo en frontend en lugar de usar la RPC existente. Audit #120 lo registra.

**Fix:**

1. Crear branch: `fix/rokola-166-resume-rpc`.
2. Buscar el archivo del rokola: `git ls-files | grep -i rokola`.
3. Identificar el lugar donde hace insert directo a `zykos_sessions` o similar (grep por `from('zykos_sessions').insert`).
4. Reemplazar por llamada a la RPC existente (verificar nombre con `SELECT proname FROM pg_proc WHERE proname LIKE 'rokola%'` en Supabase).
5. **Resume**: agregar lógica que, al cargar el rokola, chequee si hay sesión `rokola_session_id` reciente (<2h) sin cerrar para el `patient_dni` actual. Si la hay, mostrar modal "¿reanudar sesión anterior o empezar nueva?".
6. Probar con DNI 30542195: empezar rokola, cerrar tab, abrir de nuevo, debería ofrecer resume.
7. Commit: `fix(rokola): usar RPC existente + resume de sesión interrumpida (audit #166 parte 3/3 #120)`.
8. PR + merge + delete + audit done. **Cerrá también audit #120** (era el mismo bug).

---

## Criterios de éxito globales (cómo sabe el Dr. que terminaste bien)

- 3 PRs mergeados a main, 3 branches borradas.
- Audit #166 marcado `done` con referencia a los 3 PRs.
- Audit #120 marcado `done` (absorbido por BUG 3).
- `/informe/index.html` abre sin error "Sin Supabase client".
- `games/shared/zykos-chart-helpers.js` existe con 3 funciones documentadas.
- Rokola permite resume de sesión <2h interrumpida.
- Guardian sigue OK.
- Reporte resumen final con números de PR.

## Si encontrás algo raro

- Si el archivo del informe no es `informe/index.html` → buscalo y reportá la ruta real ANTES de tocar.
- Si la RPC del rokola no existe → parar y reportar (NO crear una nueva sin firma del Dr.).
- Si BUG 2 depende de cosas que #156 no terminó → saltealo y avisame.

**Empezá con BUG 1 (más rápido) y reportá antes de pasar a BUG 2 o 3.** No los hagas en paralelo en el mismo branch.
