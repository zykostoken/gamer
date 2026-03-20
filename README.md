# GAMER — HDD Therapeutic Gaming Engine

**B2B Mental Health Gaming Platform**

Production-ready therapeutic gaming engine with 140+ biometric metrics, clinical dashboards, and regulatory compliance packages.

## Architecture

```
engines/          <- Frame engines (write once, reuse everywhere)
packs/            <- Content packs per frame (JSON + assets, infinitely extensible)
shared/           <- Shared libraries (telemetry, Supabase config)
dashboard/        <- Clinical dashboard (demo instance)
original-code/    <- Original game source (reference implementation)
migrations/       <- Database schema (Supabase PostgreSQL)
```

## The 6 Frames

| Frame | Mechanic | Cognitive Domain |
|-------|----------|-----------------|
| `classify-and-place` | Receive items -> categorize -> place | Categorization, semantic memory |
| `sequence-builder` | Order actions -> detect dependencies | Planning, sequencing |
| `step-follower` | Read instruction -> execute steps -> timing | Executive function, sustained attention |
| `evaluate-decide` | Observe -> evaluate state -> decide | Judgment, decision making |
| `spatial-navigator` | Navigate space -> cover area -> avoid obstacles | Spatial orientation, planning |
| `memory-association` | Remember associations -> execute on time | Prospective memory, adherence |

## Stack

- Frontend: Vanilla JS + Tailwind CSS (CDN)
- Backend: Supabase PostgreSQL (each deployment gets its own instance)
- Biometrics: `shared/telemetry.js` (unified cognitive telemetry)
- Deploy: Netlify

## Self-Provisioning

Each customer gets:
1. Their own Supabase project (isolated data)
2. Same schema via `migrations/001_unified_telemetry.sql`
3. Same engine code, different config (`shared/supabase-config.js`)
4. Zero dependency on any other instance

## Design Principle

> **Same engine, different data.**
> Adding a new game = creating a JSON + graphic assets.
> No new code required.

---

*ZYKOS GAMER — Mental Health Gaming Engine for Institutional Deployment*
