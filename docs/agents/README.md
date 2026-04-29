# `/docs/agents` — Catálogo de agentes y prompts ejecutables

Fuente única de verdad para coordinar entre los distintos agentes IA que trabajan sobre **ZYKOS GAMER** (zykos.ar).

## Por qué existe

ZYKOS opera con varios agentes IA en paralelo. Cada uno tiene scope distinto:
- **Claude.ai (chat web)** — arquitectura, doctrina, escribe prompts, revisa resultados.
- **Claude Code** (terminal local) — ejecutor pesado, sesiones largas en el repo.
- **GitHub Copilot Sonnet 4.5 (preferido por cuota) o Opus 4.5** — ejecutor con PRs, tareas concretas en `github.com`.
- **Claude para Chrome** — ejecutor browser, tareas en UIs (Supabase, Netlify, GitHub).

Los prompts viven acá para que **cualquier instancia futura de cualquier agente** pueda leerlos y ejecutar sin necesitar contexto de chat anterior.

## Archivos

| Archivo | Propósito | Audiencia |
|---|---|---|
| `00_MODELO_TRABAJO.md` | Define quién hace qué, cómo se coordina, qué pasa si se corta una sesión | Lectura obligatoria primera |
| `PROMPT_156_DASHBOARD.md` | Tarea grande de dashboard 174 métricas | Claude Code |
| `PROMPT_166_TRES_BUGS.md` | Tres bugs separados (informe SDK, charts, rokola resume) | Copilot Sonnet 4.5 (preferido por cuota) o Opus 4.5 |

## Reglas de la carpeta

1. **Cada prompt es auto-contenido.** No asume contexto previo. Cualquier agente debe poder ejecutarlo abriendo el archivo.
2. **Cada prompt incluye:** doctrina + reglas no negociables + recursos (IDs, URLs) + tarea + criterios de éxito + qué hacer si encuentra algo raro.
3. **Cuando un audit se cierra**, el prompt correspondiente se marca obsoleto en este README pero NO se borra (queda como histórico).
4. **Versionado**: los prompts se editan en `main` directo (no requieren PR — son documentación). El código que ejecutan sí va por PR.

## Audits actuales tracked

| Audit ID | Tarea | Prompt | Estado |
|---|---|---|---|
| #156 | Dashboard 174 métricas completas | `PROMPT_156_DASHBOARD.md` | pending (próxima sesión) |
| #166 | Informe SDK + charts + rokola resume | `PROMPT_166_TRES_BUGS.md` | pending (próxima sesión) |
| #144 | Rokola B2B whitelabel | — | BLOCKED (esperando decisión comercial) |

Estado real siempre verificable con:
```sql
SELECT * FROM zykos_canon_audit WHERE phase='F8' ORDER BY id;
```
en Supabase project `aypljitzifwjosjkqsuu`.

## Cómo agregar un prompt nuevo

1. Discutir con Claude.ai en chat la tarea.
2. Claude.ai escribe `PROMPT_<id>_<scope>.md` siguiendo el mismo formato que los existentes.
3. Commit directo a `main`: `docs(agents): add prompt for audit #<id>`.
4. El prompt queda disponible para cualquier ejecutor.

## Cómo se cierra un prompt

Cuando el audit asociado termina:
1. El ejecutor mergea su PR de código.
2. Marca audit `done` en `zykos_canon_audit`.
3. Acá en este README se mueve el audit de "pending" a "completed" (sección a agregar cuando haya el primer cierre).

---

**Doctrina:** legacy es obsoleto, evolucionamos. Constitución V4 Art VIII (`zykos_metric_dictionary` como única fuente de verdad).
