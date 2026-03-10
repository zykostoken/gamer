# 🎮 GAMER — HDD Therapeutic Gaming Engine

**Hospital de Día Digital · Clínica Psiquiátrica José Ingenieros**

Motor de juegos terapéuticos con arquitectura frame + content pack para rehabilitación psiquiátrica.

## Arquitectura

```
engines/          ← 6 frame engines (mecánica pura, se escribe UNA vez)
packs/            ← Content packs por frame (JSON + assets, infinitamente extensible)
shared/           ← Librerías compartidas (biomet, Supabase, UI components)
original-code/    ← Código fuente original de cautious-carnival (referencia)
docs/             ← Documentación clínica y técnica
```

## Los 6 Frames

| Frame | Base Original | Mecánica Core | Dominio Cognitivo |
|-------|--------------|---------------|-------------------|
| `classify-and-place` | super-market | Recibir items → categorizar → ubicar | Categorización, memoria semántica |
| `sequence-builder` | daily-routine | Ordenar acciones → detectar dependencias | Planificación, secuenciación |
| `step-follower` | neuro-chef | Leer instrucción → ejecutar pasos → timing | Función ejecutiva, atención sostenida |
| `evaluate-decide` | fridge-logic | Observar → evaluar estado → decidir | Juicio, toma de decisiones |
| `spatial-navigator` | lawn-mower | Recorrer espacio → cubrir área → evitar obstáculos | Orientación espacial, planificación |
| `memory-association` | medication-memory | Recordar asociaciones → ejecutar a tiempo | Memoria prospectiva, adherencia |

## Content Packs por Frame

### classify-and-place
- `supermarket` — Supermercado (original)
- `ferreteria` — Ferretería Don Carlos
- `farmacia` — Farmacia (psicoeducación farmacológica)
- `biblioteca` — Biblioteca (categorización abstracta)
- `roperia` — Vestidor/Ropería

### sequence-builder
- `daily-routine` — Rutina diaria (original)
- `work-day` — Día laboral (rehabilitación vocacional)
- `hospital-routine` — Rutina hospitalaria

### step-follower
- `neuro-chef` — Cocina (original)
- `reparaciones` — Taller de reparaciones del hogar
- `armado-muebles` — Armado de muebles

### evaluate-decide
- `fridge-logic` — Heladera (original)
- `botiquin` — Botiquín de medicamentos
- `billetera` — Finanzas personales

### spatial-navigator
- `lawn-mower` — Cortadora de césped (original)
- `delivery` — Delivery/cadete por el barrio
- `limpieza` — Limpieza de habitación

### memory-association
- `medication-memory` — Medicación (original)
- `agenda-citas` — Agenda de citas médicas
- `cuidador-mascotas` — Cuidado de mascota

## Stack

- Frontend: Vanilla JS + Tailwind CSS (CDN)
- Backend: Supabase (proyecto `buzblnkpfydeheingzgn`)
- Biometrics: `shared/biomet/` (telemetría cognitiva)
- Deploy: Netlify (futuro subdomain de clinicajoseingenieros.ar)

## Principio de diseño

> **Mismo engine, diferente data.**
> Agregar un juego nuevo = crear un JSON + assets gráficos.
> No programar un juego nuevo.

---

*Clínica Psiquiátrica Privada José Ingenieros SRL — Necochea, Buenos Aires*
*Del Meme a la Medicina · PSYKooD*
