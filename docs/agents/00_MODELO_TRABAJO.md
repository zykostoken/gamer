# MODELO DE TRABAJO ZYKOS — quién hace qué

## Roles

| Rol | Quién | Qué hace | Cuándo lo usás |
|---|---|---|---|
| **Arquitecto / Dialéctica** | Claude.ai (este chat) | Doctrina, decisiones, escribe prompts, revisa resultados | Cuando hay que decidir, planificar o evaluar |
| **Ejecutor pesado** | Claude Code (terminal/CLI en tu máquina) | Trabajos largos en el repo local: dashboards, refactors grandes, debugging multi-archivo | Tareas que requieren modificar muchos archivos en una sesión larga |
| **Ejecutor en repo** | GitHub Copilot Opus 4.5 (en github.com) | Tareas concretas con PR: bug fix, archivo nuevo, cambios chicos pero específicos | Tareas que se pueden encapsular en un PR |
| **Ejecutor browser** | Claude para Chrome | Auditorías de paneles, configs, tareas repetitivas en UIs (Supabase, Netlify, GitHub) | Cuando hay que navegar y verificar, no codear |

## Flujo estándar

1. Vos me decís en chat: "necesito X" o "quiero avanzar con audit #Y".
2. Yo te entrego **un archivo prompt** listo para pegar (este mismo formato).
3. Vos lo pegás en el agente que corresponde.
4. El agente ejecuta y reporta resultado.
5. Vos volvés a este chat con: "terminó así, hizo esto, dio este error".
6. Yo evalúo y armo el siguiente prompt o corrijo.

## Tareas pendientes priorizadas (29-abr-2026)

| # | Audit | Tarea | Ejecutor sugerido | Archivo prompt |
|---|---|---|---|---|
| 1 | #156 | Dashboard 174 métricas completas | **Claude Code** (sesión larga, multi-archivo) | `PROMPT_156_DASHBOARD.md` |
| 2 | #166 | Juegos gráficos + rokola resume + informe SDK | **Copilot Opus 4.5** (3 PRs chicos paralelos) | `PROMPT_166_TRES_BUGS.md` |
| 3 | #144 | Rokola B2B whitelabel | BLOCKED — esperando decisión comercial | — |

## Reglas para vos al usar los prompts

1. **Pegá el prompt completo, no edites**. Si querés cambiar algo, pedímelo a mí.
2. **Esperá que el ejecutor termine** antes de mandarle algo más. No interrumpas.
3. **Si pide aprobación** ("¿procedo?"), respondé "sí" y dejá que ejecute.
4. **Cuando termine, copiame de vuelta el resumen** que te dé. Yo evalúo y te digo qué sigue.
5. **Si el ejecutor te pregunta cosas que el prompt ya contestó** = mal prompt, decímelo y lo reescribo.

## Agentes que NO son ejecutores válidos para ZYKOS

- **Cowork** — no aplica a stack técnico
- **Claude para Excel/PowerPoint** — no usás esos formatos en producción del proyecto
- Cualquier IA que no tenga acceso a Supabase MCP o al repo

## Si se corta una sesión de ejecutor

- **Claude Code se cortó**: abrir nueva sesión, pegar de nuevo el mismo prompt + agregar al final "leé `zykos_canon_audit` para ver qué quedó hecho y continuá desde ahí".
- **Copilot Opus 4.5 se cortó**: el branch + commits parciales quedan en GitHub. Abrir nueva conversación, pegar prompt + "el branch X ya tiene Y commits, continuá desde ahí".
- **Yo (Claude.ai) me corté**: pegame el último prompt que te di + el output del ejecutor, y retomo.
