# ZYKOS GAMER — Copilot Instructions

## Project Overview
ZYKOS GAMER is a B2B cognitive gaming platform for mental health assessment.
12 therapeutic games capture 140+ biometric metrics per session.
The data is hashed (evidence_hash chain) and stored permanently.

## Critical Rules
1. NEVER reference clinicajoseingenieros.ar, cautious-carnival, or José Ingenieros
2. ZYKOS is B2B Gamer ONLY — no telemedicine, no Jitsi, no Neon, no Daily.co, no Stripe, no MercadoPago
3. All table names use zykos_ prefix (not hdd_)
4. All localStorage keys use zykos_ prefix
5. DNI is the universal patient identifier variable name
6. Metrics are the monarchy — games serve the metrics, not the other way around
7. Every game saves to zykos_game_metrics via evidence_hash chain
8. No gaming without registration — the registration form is the gateway
9. Data persists forever — prevent_delete triggers are active
10. Pre-game flow: calibration → color → questions → gameplay

## Tech Stack
- Frontend: vanilla HTML/JS/CSS, Tailwind (pill-organizer only)
- Fonts: DM Sans, Space Mono, Orbitron
- Backend: Supabase (aypljitzifwjosjkqsuu) with custom RPCs
- Hosting: Netlify (auto-deploy from main)
- Auth: zykos_register, zykos_login, zykos_validate_session RPCs
- Telemetry: shared/telemetry.js + games/shared/evidence-hash.js

## File Structure
- games/play/*.html — standalone game files
- games/shared/*.js — shared framework (biomet, mood, calibration, etc)
- engines/*/index.html — generic game engines with pack system
- packs/classify-and-place/*.json — content packs
- auth/index.html — registration/login
- games/portal/index.html — game selection portal

## When syncing to carnival (cautious-carnival repo)
- Replace zykos_ with hdd_ in all table/localStorage refs
- Replace /games/portal/ with /hdd/portal/ in back links
- Replace ZYKOS GAMER with Clínica José Ingenieros where appropriate
- Copy evidence-hash.js (it exists in both repos)
