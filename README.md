# ZYKOS GAMER

Plataforma B2B de rehabilitación cognitiva gamificada con captura de biomarcadores digitales.

Desarrollada por Dr. Gonzalo J. Perez Cortizo — Clínica Psiquiátrica Privada José Ingenieros SRL, Necochea, Argentina.

Repo: Psykostoken/gamer (privado) | Supabase: aypljitzifwjosjkqsuu | Dominio: zykos.ar

---

## Stack

Frontend: HTML/CSS/JS vanilla sin frameworks
Deploy: Netlify auto-deploy desde GitHub main
Backend: Supabase PostgreSQL + RPC + RLS + Edge Functions
Auth: Custom bcrypt RPC — sin Supabase Auth
Dominio: zykos.ar

---

## Arquitectura del engine de métricas

Los juegos son instrumentos tontos. No saben que los miden. No escriben a Supabase directamente.

JUEGO (dumb) → ZYKOS ENGINE → Supabase zykos_game_metrics
                     ↑
         corsario + agentes (DOM observers)

Capas: RAW (stream DOM) → AGENTES (cómputo biométrico) → ENGINE (unifica, escribe) → ANÁLISIS SQL

El engine es el único escritor. Los juegos aportan via ZYKOS.endSession() las métricas que solo su lógica conoce. Los agentes capturan todo lo observable desde afuera.

El sistema mide. El clínico interpreta. No hay constructos diagnósticos en el código.

---

## Diccionario canónico — 96 métricas, 16 dominios

Un constructo = un nombre = una columna. Si no está en METRIC_DICTIONARY (zykos-engine.js) no existe.

Dominios: MOTOR(11) EJECUTIVO(13) FATIGABILIDAD(10) MEMORIA(8) CALCULO(7) SDT(6) RT_DIST(6) COMPRENSION(6) PLANIFICACION(5) ESPACIAL(5) ATENCION(5) INHIBICION(3) PRAXIS(3) MEMORIA_TRABAJO(3) META(3) HARDWARE(2)

Métricas clave: jitter_reposo_px, vel_cv, vel_oscilacion_index, precision_deposito_px, rt_mean_ms, rt_cv, decaimiento_mitades, perseveracion_count, d_prime, hit_rate, evocacion_libre_count, calculo_correcto_count, tiempo_planificacion_ms, consigna_repeticiones_count

---

## Juegos (15 en portal)

Activos: lawn-mower, pill-organizer, super-market, neuro-chef, medication-memory, fridge-logic, reflejos, daily-routine, ferretería, almacén, electrodomésticos, librería, carnicería, mercería.
En reparación: inkblot.

Modos en packs classify-and-place: clasificar, armar kit, calcular, semejanzas, ordenar (seriación), razonar (inferencia).

---

## Base de datos (Supabase: aypljitzifwjosjkqsuu)

Tablas: zykos_users (45 cols, RLS), zykos_game_metrics (hash chain SHA-256), zykos_game_sessions, zykos_calibrations, zykos_audit_log, zykos_raw_stream.

RPCs: zykos_register, zykos_login, zykos_validate_session, zykos_consume_session, zykos_get_metric_zscores, zykos_get_oscillations, zykos_get_concomitants.

Registro: 15 sesiones iniciales por usuario. Notificación mail al admin en cada registro.

---

## Seguridad

HSTS, X-Frame-Options DENY, CSP estricta, XSS-Protection en todos los headers.
Evidence hash chain SHA-256 en zykos_game_metrics (inmutabilidad).
RLS: cada usuario solo ve sus propios datos. Admin solo accesible a superadmin.
Anon key pública segura por RLS (no permite acceso directo a tablas).

---

## Variables de entorno

RESEND_API_KEY — envío de mails de registro (notify-registration)

---

## Propiedad intelectual

DNDA Argentina — obra inédita (en trámite)
INPI Argentina — PSYKooD Clase 44 (en trámite)
Copyright en /COPYRIGHT | Licencia propietaria en /LICENSE

---

## Deudas técnicas

- neuro-chef: biometrics.js propio, no migrado al engine canónico
- daily-routine, fridge-logic, super-market: sin engine canónico ni agentes activos
- inkblot: en reparación, rediseño pendiente
- d-prime: requiere corrección loglineal de Hautus para hit rate = 1.0 o FAR = 0.0
- SEM por métrica: no calculado aún — requiere estudio test-retest
- Validación clínica pendiente: test-retest ICC, validez convergente, normas poblacionales

---

## Nota epistemológica

ZYKOS GAMER no diagnostica. Las métricas son observaciones conductuales digitales.
La nomenclatura evita deliberadamente términos diagnósticos.
Los estudios requeridos antes de uso clínico estandarizado incluyen test-retest ICC por métrica,
validez convergente contra baterías estándar (MATRICS, CANTAB, NIH Toolbox),
y normas poblacionales por edad, sexo, escolaridad y lateralidad (mínimo 300 sujetos).
