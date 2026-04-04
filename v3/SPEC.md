# ZYKOS V3 — PORTAL SPA + SPY CONTINUO
# Especificacion tecnica definitiva
# 2 Abril 2026 — Branch: v3-spa
# NO MERGEAR hasta prueba completa en zykos.ar

# ================================================================
# DECISIONES DE STACK
# ================================================================
#
# Vanilla JS + ES modules. No React, no framework.
# Razones:
# - Los juegos ya estan escritos en vanilla JS
# - No agregar dependencia de build (no webpack, no vite)
# - Netlify sirve estatico, sin build step = deploy instantaneo
# - El spy necesita control total del DOM sin abstraccion
# - Menor superficie de ataque para auditoria ANMAT
#
# Supabase JS v2 via CDN (ya en uso)
# DOMPurify v3 via CDN (ya en uso)
# Chart.js via CDN (para dashboard)
# Cero dependencias npm para el frontend

# ================================================================
# ARQUITECTURA DE ARCHIVOS
# ================================================================
#
# /index.html          — Landing publica (login/registro)
# /auth/index.html     — Auth flow
# /portal.html         — EL PORTAL SPA (todo corre aca adentro)
# /js/spy.js           — Observador continuo (se carga en portal.html)
# /js/router.js        — SPA router (hash-based, sin server config)
# /js/supabase.js      — Supabase client singleton
# /js/auth-guard.js    — Verifica sesion, redirige si no hay
# /js/sanitize.js      — DOMPurify helper
# /js/evidence.js      — SHA-256 hash chain
# /js/mood.js          — Color picker proyectivo (sin emojis)
# /js/metrics-ui.js    — Show metrics modal post-sesion
#
# /games/              — Modulos de juego (NO son paginas)
# /games/lawn-mower.js
# /games/pill-organizer.js
# /games/super-market.js
# /games/fridge-logic.js
# /games/medication-memory.js
# /games/neuro-chef.js
# /games/reflejos.js
# /games/daily-routine.js
# /games/classify-and-place.js
# /games/inkblot.js
#
# /dashboard/          — Dashboard profesional (pagina separada)
# /dashboard/index.html
# /dashboard/report.html
#
# /admin/              — Admin (pagina separada)

# ================================================================
# PORTAL SPA — portal.html
# ================================================================
#
# Un solo HTML. Nunca se recarga. Estructura:
#
# <html>
# <head>
#   <script src="/js/supabase.js"></script>
#   <script src="/js/spy.js"></script>       <!-- SE CARGA PRIMERO -->
#   <script src="/js/auth-guard.js"></script>
#   <script src="/js/sanitize.js"></script>
#   <script src="/js/evidence.js"></script>
#   <script src="/js/mood.js"></script>
#   <script src="/js/metrics-ui.js"></script>
#   <script src="/js/router.js"></script>
# </head>
# <body>
#   <nav id="zykos-nav">...</nav>
#   <main id="zykos-app"></main>  <!-- Aca se renderiza todo -->
# </body>
# </html>
#
# El router escucha hash changes:
#   #/            — Menu de juegos (cards)
#   #/play/lawn-mower    — Juego activo
#   #/play/pill-organizer
#   #/history     — Historial de sesiones
#   #/profile     — Perfil del paciente
#
# Cuando el paciente elige un juego:
# 1. Router carga el modulo JS del juego (dynamic import o script inject)
# 2. El modulo recibe el <main> container y lo llena con su UI
# 3. El modulo expone: init(), destroy(), getState()
# 4. El spy SIGUE CORRIENDO. Nunca se interrumpio.
# 5. El spy detecta el cambio de contexto automaticamente (hash change)
#    y tagea el stream: {context: 'play/lawn-mower', t: ...}
#
# Cuando el paciente vuelve al menu:
# 1. Router llama destroy() del juego activo
# 2. El juego limpia su UI del <main>
# 3. Router renderiza el menu de vuelta
# 4. El spy sigue grabando. Ahora tagea contexto 'menu'.

# ================================================================
# SPY.JS — Observador continuo
# ================================================================
#
# PRINCIPIO: Se carga una vez. Graba hasta que se cierra la pestana.
# No se reinicia entre juegos. No se pausa. No se apaga.
#
# STREAM CRUDO:
# Array de eventos: {t, k, x, y, ctx, m}
#   t   = ms desde carga de pagina (performance.now relativo)
#   k   = tipo: 'm'(move), 'c'(click), 'h'(hide/show), 's'(scroll),
#          'r'(route change), 'e'(error), 'd'(drag), 'i'(idle)
#   x,y = coordenadas (si aplica)
#   ctx = contexto actual (menu, play/lawn-mower, instructions, etc)
#   m   = metadata variable segun tipo
#
# PERSISTENCIA:
# El stream se persiste a Supabase en intervalos de 30 segundos
# Y al cerrar la pagina (beforeunload + visibilitychange).
# Cada chunk es un INSERT a zykos_raw_stream con:
#   session_id, patient_dni, chunk_index, events[], timestamp
#
# POST-SESION COMPUTE:
# Cuando el paciente cierra o cuando pasan 5 min de inactividad,
# el spy computa las 53 metricas del diccionario desde el stream
# y las persiste como un registro en zykos_computed_metrics.
# Las metricas que necesitan datos del juego se llenan si el juego
# las reporto via ZYKOS.report(). Si no, quedan null.
#
# CONTEXTO AUTOMATICO:
# El spy escucha hashchange y actualiza el campo ctx de cada evento.
# Asi el analisis puede filtrar: "dame las metricas motoras solo
# durante pill-organizer" vs "dame las metricas durante navegacion".
#
# CALIBRACION AUTOMATICA:
# En los primeros 3 segundos de cada carga (mientras el paciente
# lee la pantalla sin interactuar), el spy mide hw_idle_jitter_px
# y hw_latency_ms. Estos valores se restan de todo el stream.

# ================================================================
# GAME MODULES — Interface comun
# ================================================================
#
# Cada juego es un modulo JS que exporta:
#
# {
#   id: 'lawn-mower',
#   name: 'Cortadora de Cesped',
#   category: 'ejecutivo',
#   init: function(container, patientDni, config) {
#     // Renderiza el juego dentro de container
#     // container es el <main id="zykos-app">
#     // El juego NO toca nada fuera de container
#     // El juego NO carga scripts externos
#     // El juego NO escribe a Supabase directo
#   },
#   destroy: function() {
#     // Limpia todo: event listeners, intervals, timeouts
#     // Devuelve container vacio
#   },
#   getState: function() {
#     // Devuelve estado actual del juego para auto-save
#   }
# }
#
# El juego puede llamar a ZYKOS.report() para pasar datos
# que el spy no puede inferir solo:
#   ZYKOS.report({
#     errores_omision: 3,
#     errores_comision: 1,
#     eficacia_objetivo: 0.85,
#     secuencia_correcta_pct: 72,
#     _game_grass_cut: 45,
#     _game_flowers_hit: 2
#   })
#
# Las keys con prefijo _game_ son datos del juego (score, etc).
# Las keys sin prefijo son metricas del diccionario canonico.
# El spy valida que cada key sin _game_ existe en el diccionario.

# ================================================================
# PROTECCION DE IP
# ================================================================
#
# Los juegos ya no son archivos HTML publicos accesibles por URL.
# Son modulos JS cargados dinamicamente por el router.
# Se pueden servir:
#
# Opcion A: Archivos JS en /games/ con Netlify redirect rules
#   que requieren header de auth (edge function valida token)
#   Pro: simple. Con: el JS sigue siendo descargable si tienen token.
#
# Opcion B: Edge functions que sirven el JS solo si sesion valida
#   Pro: el JS nunca esta en disco publico.
#   Con: mas complejo, latencia en carga.
#
# Opcion C: Ofuscacion en build + archivos JS publicos
#   Pro: simple deploy. Con: ofuscacion es reversible.
#
# Recomendacion: Opcion A para MVP. Los juegos estan en /games/*.js
# pero Netlify edge function valida token antes de servir.
# Para produccion: Opcion B (edge function genera JS on-the-fly).

# ================================================================
# SUPABASE SCHEMA (nuevas tablas para V3)
# ================================================================
#
# zykos_raw_stream
#   id SERIAL PRIMARY KEY
#   session_id TEXT NOT NULL
#   patient_dni TEXT NOT NULL
#   chunk_index INTEGER NOT NULL
#   context TEXT           -- 'menu', 'play/lawn-mower', etc
#   events JSONB NOT NULL  -- array de eventos crudos
#   event_count INTEGER
#   created_at TIMESTAMPTZ DEFAULT now()
#   evidence_hash TEXT     -- SHA-256 hash chain
#
# zykos_sessions
#   id SERIAL PRIMARY KEY
#   session_id TEXT UNIQUE NOT NULL
#   patient_dni TEXT NOT NULL
#   started_at TIMESTAMPTZ
#   ended_at TIMESTAMPTZ
#   duration_ms INTEGER
#   games_played TEXT[]    -- array de slugs jugados en esta sesion
#   device_info JSONB      -- screen, ua, dpr
#   created_at TIMESTAMPTZ DEFAULT now()
#
# zykos_computed_metrics (ya existe, se reutiliza)
#   Cada fila = metricas de UN contexto dentro de UNA sesion
#   session_id + context = unique
#   metric_data JSONB con las 53 metricas canonicas
#
# Las tablas existentes (zykos_game_metrics, zykos_mood_entries)
# se mantienen para compatibilidad. La nueva tabla zykos_raw_stream
# es la fuente de verdad. Las metricas computadas se derivan de ahi.

# ================================================================
# MOOD (sin emojis)
# ================================================================
#
# El portal muestra el color picker:
# 1. Al inicio de sesion (pre-game)
# 2. Al finalizar cada juego (post-game)
# 3. Al cerrar sesion (post-sesion)
#
# 12 circulos de color sin etiquetas. Sin texto. Sin emojis.
# El color se guarda en zykos_mood_entries y tambien como evento
# en el stream: {k:'color', ctx:'pre_game', m:{hex:'#FF0000'}}
#
# El boton de skip es un guion casi invisible (—).
# No hay "Como te sentis?" ni "Elegi un color".
# Solo los 12 circulos. El paciente entiende.

# ================================================================
# DASHBOARD PROFESIONAL
# ================================================================
#
# Pagina separada (/dashboard/). No es SPA. Es para el profesional.
# Lee de zykos_computed_metrics y zykos_raw_stream.
#
# 3 capas (AACN 2020 progressive disclosure):
#
# Capa 1: Radar chart 7 dominios + semaforo + tendencia
# Capa 2: Composites por dominio expandibles, lineas temporales
# Capa 3: Metricas individuales, stream crudo, graficos detalle
#
# Perfil compuesto: los 15 perfiles del documento fundacional
# se computan en el browser del profesional (no en servidor)
# desde los datos ya guardados.
#
# RCI de Chelune: se computa con baseline de 5+ sesiones.
# Z dual: intra + inter sujeto.
# Bandas AACN: Normal, Limite, Alterado leve/moderado/severo.

# ================================================================
# PLAN DE IMPLEMENTACION
# ================================================================
#
# FASE 1: Esqueleto SPA (hoy)
#   [ ] portal.html con router hash-based
#   [ ] spy.js cargando y grabando stream
#   [ ] Un juego (pill-organizer) convertido a modulo
#   [ ] Persistencia stream a Supabase
#   [ ] Computo post-sesion de metricas
#   [ ] Color picker sin emojis integrado
#
# FASE 2: Migrar juegos restantes
#   [ ] lawn-mower como modulo
#   [ ] super-market como modulo
#   [ ] fridge-logic como modulo
#   [ ] medication-memory como modulo
#   [ ] neuro-chef como modulo
#   [ ] reflejos como modulo
#   [ ] classify-and-place como modulo
#   [ ] inkblot como modulo
#
# FASE 3: Dashboard
#   [ ] Dashboard profesional con 3 capas
#   [ ] Computo de perfiles compuestos
#   [ ] RCI y Z-scores
#   [ ] Graficos longitudinales
#
# FASE 4: Seguridad
#   [ ] Edge function para proteger game modules
#   [ ] Ofuscacion en deploy
#   [ ] Audit trail completo
#
# FASE 5: Merge a main + deploy zykos.ar
