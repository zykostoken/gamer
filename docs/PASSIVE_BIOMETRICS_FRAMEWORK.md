# ZYKOS GAMER — Framework de Biometrías Pasivas
## Captura de voz, gesto y entorno con constructo clínico validado

---

## PRINCIPIO RECTOR

Cada dato capturado tiene un constructo clínico detrás.
Si no tiene constructo, no se captura.
No es tormenta de datos. Es evidencia quirúrgica.

El psiquiatra lo hace en 10 segundos a través de la piel.
ZYKOS lo digitaliza para que quede registro medible y comparativo.
ZYKOS no diagnostica. Es la CIA del profesional.

---

## DATOS PASIVOS DE VOZ (micrófono)

### Solicitud de permiso
Al registrarse o al inicio de sesión, se solicita permiso de micrófono.
Texto: "ZYKOS puede analizar características de tu voz durante el juego
para complementar la evaluación cognitiva. Solo se registran patrones
acústicos, nunca el contenido de lo que decís."

### Métricas vocales con constructo

| Métrica | Constructo clínico | Relevancia psiquiátrica | Paper de referencia |
|---------|-------------------|------------------------|-------------------|
| Tasa de habla (palabras/min) | Presión del habla vs bradilalia | Manía / depresión / parkinsonismo | Cummins et al., 2015 |
| Duración de pausas | Latencia de respuesta verbal | Enlentecimiento psicomotor / bloqueo de pensamiento | Alpert et al., 2001 |
| Variabilidad de pitch (F0 SD) | Prosodia aplanada vs exaltada | Afecto aplanado (esquizofrenia) / exaltación (manía) | Cohen et al., 2016 |
| Rango de F0 (Hz) | Rango tonal | Monotonía / expresividad emocional | Cannizzaro et al., 2004 |
| Intensidad media (dB) | Volumen vocal | Hipotimia / excitación psicomotriz | Stassen et al., 1995 |
| Jitter/Shimmer | Estabilidad laríngea | Temblor vocal / ansiedad / efecto medicamentoso | Titze, 1994 |
| Speech-to-silence ratio | Verborragia vs mutismo | Fuga de ideas / negativismo / inhibición | Covington et al., 2005 |
| Coherencia semántica (si transcribe) | Lógica vs discordancia ideativa | Trastorno formal del pensamiento | Bedi et al., 2015 |

### Implementación técnica
- Web Audio API para captura de stream
- Análisis en tiempo real vía AudioContext + AnalyserNode
- Pitch detection: autocorrelación o YIN algorithm
- NO se guarda audio raw (privacidad)
- Se guardan solo las métricas numéricas

### Frecuencia de muestreo
- Análisis cada 500ms durante gameplay activo
- Promedio por sesión + distribución temporal
- Registro longitudinal: comparar sesión actual vs baseline

---

## DATOS PASIVOS DE CÁMARA (video)

### Solicitud de permiso
"ZYKOS puede analizar patrones de movimiento facial y postura
durante el juego para complementar la evaluación. No se graba
video ni se almacenan imágenes."

### Métricas gestuales con constructo

| Métrica | Constructo clínico | Relevancia psiquiátrica | Referencia |
|---------|-------------------|------------------------|-----------|
| Frecuencia de parpadeo | Activación dopaminérgica | Parkinsonismo medicamentoso / baseline atencional | Karson et al., 1990 |
| Asimetría facial | Parálisis facial / expresividad | Efecto secundario medicamentoso / afecto | Borod et al., 2002 |
| Head movement frequency | Inquietud motora / acatisia | Acatisia / ansiedad / hiperkinesia | Walther et al., 2012 |
| Gaze stability | Fijación atencional | Déficit atencional / distractibilidad | Anderson & MacAskill, 2013 |
| Posture stability | Estabilidad postural | Sedación / parkinsonismo / catatonía | Docx et al., 2012 |
| Facial Action Units (FACS) | Expresión emocional | Afecto restringido / incongruencia afectiva | Ekman & Friesen, 1978 |
| Latencia de sonrisa | Respuesta emocional | Anhedonia / procesamiento emocional | Tremeau et al., 2005 |

### Implementación técnica
- MediaDevices API para stream de cámara
- Face detection: MediaPipe Face Mesh (runs in browser, no server)
- Landmark tracking para head pose, blink, FACS
- NO se guarda video ni frames
- Se guardan coordenadas y métricas numéricas

### Consideraciones éticas
- SIEMPRE pedir permiso explícito
- SIEMPRE permitir rechazar sin penalización en gameplay
- NUNCA grabar contenido (solo métricas derivadas)
- Los datos son del paciente — el profesional los interpreta
- El paciente puede solicitar ver qué se capturó

---

## DATOS PASIVOS DE INTERACCIÓN CON EL PORTAL

Estas métricas NO requieren permisos especiales (ya se capturan implícitamente):

| Métrica | Constructo | Ya implementado? |
|---------|-----------|-----------------|
| Tiempo de navegación entre pantallas | Velocidad de procesamiento | Parcial |
| Patrón de clics/taps | Impulsividad / hesitación | ✅ biomet.js |
| Scroll behavior | Comprensión / búsqueda visual | ✅ biomet.js |
| Error clicks (fuera de target) | Dismetría / imprecisión | ✅ biomet.js |
| Tremor de cursor | Temblor fino | ✅ biomet.js + calibration |
| Tiempo en pantalla de instrucciones | Comprensión lectora | Parcial |
| Re-lecturas (scrollback) | Dificultad de comprensión | No |
| Patrón de abandono | Frustración / fatiga | ✅ auto-save.js |
| Hora del día de uso | Ritmo circadiano | ✅ telemetry.js |
| Frecuencia de uso semanal | Adherencia / motivación | ✅ telemetry.js |

---

## EVALUACIÓN LONGITUDINAL

Un día o un evento no hacen al diagnóstico.
Las métricas se evalúan longitudinalmente:

- Baseline: primeras 3-5 sesiones → perfil basal del paciente
- Reliable Change Index (RCI): detectar cambio significativo vs ruido
- Cluster classification: FUNCIONAL / HIPOACTIVO / HIPERACTIVO / DESORGANIZADO
- Eficacia: ¿completa la tarea?
- Eficiencia: ¿cómo la completa? ¿cuánto le cuesta?
- Post-intervención: ¿mejoró después de ajuste farmacológico?
- Alertas automáticas: cambio brusco en patrón longitudinal

---

## IMPLEMENTACIÓN POR FASES

### Fase 1 (actual): Métricas de gameplay
- biomet.js, telemetry.js, evidence-hash.js
- Tremor, RT, accuracy, perseveraciones, pausas
- 140+ métricas por sesión
- ✅ IMPLEMENTADO

### Fase 2 (próxima): Biometrías pasivas de interacción
- Mejorar captura de scroll, re-lectura, abandono
- Agregar tiempo en instrucciones
- Mapear cada métrica a constructo
- Sin permisos adicionales necesarios

### Fase 3 (futura): Voz
- Solicitar permiso de micrófono
- Web Audio API para F0, jitter, speech rate
- NO grabar audio, solo métricas
- Requiere validación clínica antes de deploy

### Fase 4 (futura): Cámara
- Solicitar permiso de cámara
- MediaPipe Face Mesh para landmarks
- NO grabar video, solo coordenadas
- Requiere consentimiento informado específico
- Requiere validación ética institucional

---

*Cada métrica debe tener: constructo, paper, implementación técnica,*
*formato de almacenamiento, y criterio de interpretación.*
*Sin eso, no se captura. No es tormenta de datos.*
