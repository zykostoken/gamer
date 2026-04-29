# PROMPT — AUDIT #185 — Neuro-Chef bug visual de carrito

**EJECUTOR:** GitHub Copilot Sonnet 4.5 en modo Agent (en `github.com/Psykostoken/gamer`).

**TIEMPO ESTIMADO:** 15-30 min (según decisión emoji vs assets locales).

---

# CONTEXTO Y DOCTRINA — leé antes de tocar

Sos el ejecutor técnico de ZYKOS GAMER (zykos.ar), plataforma B2B de fenotipado cognitivo del Dr. Gonzalo Pérez Cortizo. Repo `Psykostoken/gamer`, branch base `main`.

## Reglas no negociables

1. **Verificar antes de afirmar.** Chequeá DB / archivo / URL real antes de dar un cambio por hecho.
2. **NO tocar `buzblnkpfydeheingzgn`** (otro proyecto). ZYKOS GAMER es Supabase `aypljitzifwjosjkqsuu`.
3. **Argentino comprimido**, sin emojis en chat (los emojis Unicode SÍ van en el código, son la solución del bug).
4. **Workflow:** branch desde main → audit `in_progress` en `zykos_canon_audit` → trabajo → commit + push + PR → merge squash → audit `done`.

## Recursos

| Recurso | ID/URL |
|---|---|
| Supabase MCP project | `aypljitzifwjosjkqsuu` |
| Repo | `Psykostoken/gamer` |
| Branch base | `main` |
| Audit ID | **#185** |
| DNI test | 30542195 (Gonzalo) |

---

# CAUSA RAÍZ YA INVESTIGADA (no la re-investigues)

Verificación hecha antes de este prompt:

**Archivo afectado:** `games/play/neuro-chef/js/config.js` — define `const ALIMENTOS = { ... }` con ~30+ ingredientes. Cada uno tiene un campo `imagen` apuntando a **URLs externas de Unsplash**:

```js
lechuga: {
    id: 'lechuga',
    nombre: 'Lechuga',
    imagen: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=300',
    ...
}
```

**Por qué falla en producción:**
- URLs de Unsplash caducan, cambian de hash, o son bloqueadas por CSP/CORS del browser.
- `games/play/neuro-chef/js/game.js:315` tiene `onerror="this.style.display='none'"` que esconde la img si falla → resultado visual: cuadrado azul con label apenas legible.

**Síntoma reportado por el Dr. Pérez Cortizo (verbatim):** "elegí arroz xq no se veían los demás". Resultado falso de 14/100, "Te faltaron: Lechuga, Tomate, Cebolla, Huevos, Aceite". El paciente NO PUEDE EJECUTAR la tarea correctamente, contaminando el dataset clínico (audit #185 documenta 13/25 sesiones con score <30 potencialmente sesgadas por este bug).

**NO hay assets locales** en `/games/play/neuro-chef/` (verificado con `find` — no existe carpeta de imágenes).

---

# TU TAREA

Reemplazar todas las URLs de Unsplash por **emojis Unicode** representando cada ingrediente. Solución elegida porque:
- Cero dependencia externa (no falla por CDN, CORS, ni red).
- Render instantáneo, sin loading.
- Estéticamente coherente con un juego de cocina (los emojis culinarios son universales).
- Bajo riesgo, alta reversibilidad.
- No requiere agregar assets al repo ni gestionar imágenes propias.

## Plan de trabajo

### FASE 1 — Branch y audit pre-trabajo (1 min)

```bash
git checkout main && git pull origin main
git checkout -b fix/neuro-chef-185-emojis-ingredientes
```

Audit en Supabase project `aypljitzifwjosjkqsuu`:
```sql
UPDATE zykos_canon_audit 
SET status='in_progress', 
    notes = notes || E'\n\n=== UPDATE <fecha> ===\nCopilot Sonnet arrancando. Plan: reemplazar URLs Unsplash por emojis Unicode en games/play/neuro-chef/js/config.js. Branch fix/neuro-chef-185-emojis-ingredientes.'
WHERE id=185;
```

### FASE 2 — Reemplazo en `config.js` (10 min)

Editar `games/play/neuro-chef/js/config.js`. Para cada entrada de `ALIMENTOS`:
1. Reemplazar el campo `imagen: 'https://...'` por `emoji: '<unicode>'`.
2. Mapeo sugerido (completar con sentido común si falta alguno):

```
lechuga      → 🥬     tomate       → 🍅     cebolla      → 🧅
papa         → 🥔     zanahoria    → 🥕     huevos       → 🥚
aceite       → 🫒     sal          → 🧂     pan          → 🍞
arroz        → 🍚     queso        → 🧀     leche        → 🥛
manteca      → 🧈     harina       → 🌾     azucar       → 🍬
canela       → 🌿     limon        → 🍋     naranja      → 🍊
manzana      → 🍎     banana       → 🍌     frutilla     → 🍓
pollo        → 🍗     carne_picada → 🥩     pescado      → 🐟
pasta        → 🍝     pimienta     → 🌶️    ajo          → 🧄
jugo_naranja → 🧃     pan_rallado  → 🥖     ciruelas     → 🍑
crema        → 🍶     vinagre      → 🧴     helado       → 🍨
```

Si hay un ingrediente que no encaja en ningún emoji evidente, usá un fallback genérico (`🍴` para "comida indefinida" o `❓`).

### FASE 3 — Actualizar el render en `game.js` (5 min)

Editar `games/play/neuro-chef/js/game.js`. Tres ubicaciones encontradas con `<img src="${food.imagen}">` (líneas aprox **315, 363, 512**):

```js
// ANTES:
<img src="${food.imagen}" alt="${food.nombre}" loading="lazy" onerror="this.style.display='none';...">

// DESPUÉS:
<span class="food-emoji" role="img" aria-label="${food.nombre}">${food.emoji || '🍴'}</span>
```

Buscar TODAS las ocurrencias con grep:
```bash
grep -n 'food\.imagen\|f\.imagen\|item\.imagen\|\.imagen' games/play/neuro-chef/js/game.js
```

Reemplazar cada una por el `<span>` equivalente. **No dejar referencias a `.imagen`** en el código.

### FASE 4 — Estilos en `css/styles.css` (3 min)

Agregar al final de `games/play/neuro-chef/css/styles.css`:

```css
.food-emoji {
  font-size: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 60px;
  user-select: none;
  -webkit-user-select: none;
}

.food-item .food-emoji {
  font-size: 3.5rem;
}

.cart-slot .food-emoji {
  font-size: 2.5rem;
}
```

Ajustar tamaños si hay reglas previas que sobreescriban.

### FASE 5 — Verificación (5 min)

1. **Verificar JS sin referencias a `.imagen`:**
   ```bash
   grep -rn '\.imagen' games/play/neuro-chef/
   ```
   Debe retornar 0 resultados (o solo el comentario doctrinal si lo dejaste).

2. **Verificar config.js:**
   ```bash
   grep -c 'emoji:' games/play/neuro-chef/js/config.js
   grep -c 'imagen:' games/play/neuro-chef/js/config.js
   ```
   El primero debe dar el conteo de ingredientes (~30+), el segundo debe dar 0.

3. **No probás en browser** (no tenés UI). Confiás en que el HTML/CSS/JS lint-clean.

### FASE 6 — Cierre (5 min)

```bash
git add games/play/neuro-chef/
git commit -m "fix(neuro-chef): reemplazar URLs Unsplash por emojis Unicode (audit #185)

URLs externas de Unsplash fallaban en producción (CDN/CORS/CSP), 
causando cuadrados azules sin imagen ni label legible en el carrito.
Paciente no podía ejecutar tarea correctamente, contaminando dataset 
clínico (13/25 sesiones con score <30).

Reemplazo: emojis Unicode renderizados via <span class='food-emoji'>.
Cero dependencia externa, render instantáneo, estéticamente coherente.

Archivos modificados:
- games/play/neuro-chef/js/config.js (campo imagen → emoji)
- games/play/neuro-chef/js/game.js (img → span)
- games/play/neuro-chef/css/styles.css (clase .food-emoji)
"
git push -u origin fix/neuro-chef-185-emojis-ingredientes
```

Crear PR vía `gh` CLI:
```bash
gh pr create --title "fix(neuro-chef): emojis en lugar de URLs Unsplash (audit #185)" \
             --body "Resuelve audit #185. Las URLs de Unsplash en games/play/neuro-chef/js/config.js fallaban en producción, causando que las imágenes del carrito no se renderizaran y el paciente no pudiera ejecutar la tarea. Reemplazo por emojis Unicode: cero dependencia externa, render instantáneo. Mitiga contaminación del dataset clínico de neuro-chef." \
             --base main
```

Mergear con squash y borrar branch:
```bash
gh pr merge --squash --delete-branch
```

Si `gh` CLI no está disponible, dame la URL del branch y armo el PR desde la web.

Audit done en Supabase:
```sql
UPDATE zykos_canon_audit 
SET status='done', 
    notes = notes || E'\n\n=== DONE <fecha> ===\nPR #<num> mergeado. Reemplazadas <N> URLs Unsplash por emojis. Archivos: config.js, game.js, css/styles.css. Verificación: grep .imagen retorna 0 resultados.'
WHERE id=185;
```

---

## Criterios de éxito

- PR mergeado a `main`, branch borrada.
- Audit #185 marcado `done` en `zykos_canon_audit`.
- `grep -rn '\.imagen' games/play/neuro-chef/` retorna 0 resultados (o solo comentarios).
- `games/play/neuro-chef/js/config.js` tiene `emoji:` en cada entrada de `ALIMENTOS`, ninguna `imagen:`.
- Reporte resumen final: número de PR, count de ingredientes mapeados, link del merge.

## Si encontrás algo raro

- Si hay ingredientes con nombre raro que no tenés emoji evidente → usá `🍴` como fallback y reportá la lista para que el Dr. la revise después.
- Si encontrás que **algún juego más** usa `food.imagen` o estructura similar de Unsplash (ej. `super-market.html`) → **NO lo arregles en este PR**. Reportalo como audit nuevo separado.
- Si encontrás que `game.js` ya tiene fallback de emoji por algún lado → respetalo, no dupliques lógica.
- Si Supabase MCP no está conectado → hacé el commit/push igual y dame los SQL al final para que los ejecuto yo.

**Empezá por Fase 1 (branch) y reportame al cerrar el PR. NO sigas con otros bugs después de #185.**
