# ZYKOS GAMER — AUDITORÍA GLOBAL FINAL
## Repo: Psykostoken/gamer | Site: zykos.ar
## Fecha: 2026-04-04 | Auditoría Completa de Agentes

---

## ESTADO: PRODUCCIÓN ✓

### Contaminación: CERO
- José Ingenieros / clínica: 0
- /hdd/ paths: 0
- hdd_ tables/localStorage: 0
- telemedicina/jitsi/neon/daily/stripe/mercadopago: 0
- var pid: 0
- cji_ localStorage: 0

### Arquitectura
- 84 archivos en repo (+1: agent-og-media.js)
- 11 juegos en portal (7 standalone + 4 classify-and-place packs)
- 9 juegos con pre-game mood (color proyectivo + preguntas)
- 7 juegos con post-game color
- 9 juegos con evidence-hash (integridad criptográfica)
- 9 juegos con input-calibration (homologación hardware)
- 9 juegos con auto-save (captura en exit)
- 5 packs de contenido: 346 items, 35 misiones, 24 eventos

### Packs de Contenido
| Pack | Items | Categorías | Misiones | Eventos |
|------|-------|-----------|----------|---------|
| La Ferretería de Berugo | 90 | 9 | 7 | 6 |
| El Almacén de Don Tito | 79 | 9 | 7 | 5 |
| Electrodomésticos El Rayo | 61 | 8 | 7 | 4 |
| La Librería de la Seño Marta | 72 | 8 | 7 | 4 |
| Desafío Milanesas (supermarket) | 44 | 6 | 7 | 5 |

### Supabase (aypljitzifwjosjkqsuu)
- 10 RPCs: register, login, validate_session, consume_session, logout, compute_evidence_hash, auto_audit, mark_metrics_shown, record_metrics_view, get_pending_notifications
- Tablas zykos_*: users, game_metrics, game_sessions, calibrations, audit_log, etc.
- Bridge views: zykos_patients, zykos_platform_sessions, etc. → over hdd_* tables
- Trigger prevent_delete_evidence: activo (guarda eterna)
- evidence_hash + previous_hash: en zykos_game_metrics

### Netlify (zykos.ar)
- Auto-deploy desde Psykostoken/gamer (main)
- 7 redirects + security headers (HSTS, CSP, X-Frame-Options)
- Site ID: 332b1ca6-d613-4b8e-9894-314b3e8d1e1c

---

## AGENTES PIRATA — Sistema de Captura Conductual

### Arquitectura de Agentes
Los agentes son observadores pasivos del DOM. No saben qué juego está corriendo.
Solo detectan eventos (clicks, mouse, etc) y extraen métricas conductuales.
El engine (zykos-engine.js) coordina el ciclo: start → collect → stop.

### Inventario de Agentes (9 total)

| Agente | Archivo | Métricas | Dominio | Descripción |
|--------|---------|----------|---------|-------------|
| **presence** | agent-presence.js | 6 | PRESENCIA | Actividad física: activo/idle/ausente |
| **focus** | agent-focus.js | 5 | ATENCION | Interrupciones, tiempo fuera de ventana |
| **context** | agent-context.js | 8 | COMPRENSION | Instrucciones, clicks totales, conexión |
| **inhibition** | agent-inhibition.js | 4 | INHIBICION | Perseveración, impulsividad, drags abortados |
| **motor** | agent-motor.js | 14 | MOTOR | Jitter, velocidad, trayectoria, inactividad |
| **rt** | agent-rt.js | 7 | ATENCION | Tiempo de reacción, hesitaciones, vigilancia |
| **scroll** | agent-scroll.js | 5 | ESPACIAL | Scroll, profundidad, reversiones |
| **media** | agent-media.js | 18 | MEDIA | Expresión facial (FACS), parpadeo, sonrisa |
| **og-media** | agent-og-media.js | 14 | OG_MEDIA | Presencia cam/mic, luminancia, audio básico |

### Detalle: agent-og-media.js (NUEVO)

**Propósito**: Capa fundacional de captura de cámara y micrófono.
No hace análisis facial complejo (eso es agent-media.js).
Captura métricas simples: presencia, luminancia, canal verde (proxy PPG), audio.

**Principios**:
1. LAZY — no existe hasta consentimiento explícito via setConsent()
2. HARDWARE-ADAPTIVE — detecta capacidad y degrada: full → cam_only → mic_only → none
3. CERO DATOS AL SERVIDOR — solo métricas computadas localmente
4. PRIVACIDAD — el video/audio NUNCA sale del navegador

**Respaldo académico**:
- Verkruysse et al. (2008) — HR via webcam canal verde
- Poh et al. (2010) — HR extraction via ICA
- De Haan & Jeanne (2013) — CHROM para rPPG robusto
- Mcduff et al. (2014) — Stress via HR variability
- Cummins et al. (2015) — Speech biomarkers

**Métricas producidas**:
```
og_cam_present           — boolean: cámara activa
og_cam_presence_pct      — ratio: % tiempo con contenido visual
og_cam_blackout_count    — count: episodios sin detección
og_cam_blackout_max_ms   — ms: blackout más largo
og_cam_luminance_mean    — 0-255: luminancia media
og_cam_luminance_cv      — ratio: variabilidad de luz
og_cam_green_channel_mean— 0-255: canal verde (proxy PPG)
og_cam_green_cv          — ratio: variabilidad canal verde

og_mic_present           — boolean: micrófono activo
og_mic_db_mean           — dB: volumen ambiental medio
og_mic_db_cv             — ratio: variabilidad de volumen
og_mic_silence_pct       — ratio: % tiempo en silencio
og_mic_speech_episodes   — count: episodios de habla
og_mic_peak_db           — dB: pico máximo
```

**Uso desde juegos**:
```javascript
// En el HTML del juego, cargar el agente:
<script src="../shared/agents/agent-og-media.js"></script>

// Configurar consentimiento (desde form de permisos):
ZykosOgMediaAgent.setConsent(camConsent, micConsent);

// El engine maneja start/collect/stop automáticamente
```

### agent-media.js vs agent-og-media.js

| Aspecto | agent-media.js | agent-og-media.js |
|---------|---------------|-------------------|
| **Propósito** | Análisis facial FACS | Captura básica cam/mic |
| **Dependencia** | face-api.js (2.8MB CDN) | Ninguna (vanilla JS) |
| **Métricas** | AU, sonrisa, parpadeo, humor | Presencia, luz, audio |
| **Cómputo** | Alto (detección facial 5fps) | Bajo (sampling 200ms) |
| **Correlación** | Cruza humor × rendimiento | Solo captura base |
| **Uso** | Análisis emocional profundo | Contexto ambiental |

**Recomendación**: usar ambos si se quiere análisis completo,
o solo og-media si se quiere impacto mínimo en performance.

---

### Flujo Completo
1. Registro → 3 consentimientos (investigación, salud, términos) → DNI obligatorio
2. Portal → 11 juegos disponibles → consume sesión via RPC
3. Pre-game: calibración hardware → color proyectivo → preguntas anímicas
4. Gameplay: métricas capturadas en tiempo real por 9 agentes
5. Post-game: color satisfacción → modal métricas → evidence_hash
6. Datos: guardados eternamente, hasheados, encadenados
7. Sesiones agotadas: tiers jugador / profesional (efecto perdigón)

### Modelo de Negocio
- Free: 15 sesiones, 1 perfil
- Jugador: sesiones ilimitadas, grupo familiar
- Profesional: panel clínico, N pacientes, sin infraestructura propia
- IP cerrada: software vendible como licencia institucional
- Datos: base normativa poblacional = paridad de valor tokenizado

### Próximos Pasos
1. ~~Biometrías pasivas (cámara/mic) con constructo clínico validado~~ ✓ (agent-og-media.js)
2. Juego Rorschach (manchas algorítmicas, almacenes Necochea)
3. Auditar cautious-carnival para concordancia total
4. Plantilla de clonación institucional
5. Registrar IP en DNDA + INPI Argentina
6. Revocar GitHub PAT (seguridad)

---
*ZYKOS es la CIA del profesional. Captura, hashea, guarda para siempre. El profesional decide.*
