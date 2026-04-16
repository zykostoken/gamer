// ================================================================
// zykos-engine.js — CORE ENGINE
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
// ZYKOS GAMER · Metric Capture Platform
//
// ARCHITECTURE:
// This is the ONE AND ONLY script that writes to Supabase.
// Games NEVER write to the DB. Games are dumb HTML.
// Pirate agents observe DOM events and extract metrics.
// This core collects from all agents and persists.
//
// PRINCIPLES:
// 1. Metrics are the monarchy, games are servants
// 2. Each metric has ONE canonical name, ONE definition
// 3. Raw events are sacred (Capa 0) — never modified
// 4. Computed metrics (Capa 2) are always re-derivable from raw
// 5. No metric without a clinical construct
// 6. No construct without a validated measurement method
// ================================================================

(function(global) {
'use strict';

// ================================================================
// METRIC DICTIONARY — THE CANONICAL VOCABULARY
// Every metric that exists in ZYKOS is defined here.
// If it's not here, it doesn't exist.
// ================================================================
var METRIC_DICTIONARY = {

    // === IRREGULARIDAD MOTORA ===
    // Nombres de código: jitter_* (descriptivo, no diagnóstico)
    // Lo que el clínico puede inferir de valores altos está en la literatura:
    //   jitter_reposo_px alto → parkinsonismo, temblor esencial, ansiedad basal (Jankovic 2008)
    //   jitter_terminal_px alto → patología cerebelosa (Holmes 1922)
    // El sistema mide. El clínico interpreta.
    jitter_reposo_px:       { domain:'MOTOR', unit:'px', range:[0,50],
        desc:'Irregularidad del cursor en reposo >500ms. Lit: parkinsonismo, temblor esencial (Jankovic 2008).' },
    jitter_inicio_px:       { domain:'MOTOR', unit:'px', range:[0,50],
        desc:'Irregularidad al iniciar movimiento (primeros 150ms). Proxy de inicio motor.' },
    jitter_terminal_px:     { domain:'MOTOR', unit:'px', range:[0,50],
        desc:'Irregularidad al aproximar el target (últimos 80px). Lit: patología cerebelosa (Holmes 1922).' },
    precision_deposito_px:  { domain:'MOTOR', unit:'px', range:[0,200],
        desc:'Distancia media del click/touch al centro del target. Proxy de dismetría.' },

    // === VELOCIDAD MOTORA ===
    vel_peak_mean:          { domain:'MOTOR', construct:'Velocidad pico', unit:'px/ms', range:[0,5], desc:'Velocidad pico media del cursor durante movimientos.' },
    vel_peak_sd:            { domain:'MOTOR', construct:'Variabilidad velocidad pico', unit:'px/ms', range:[0,3], desc:'SD de velocidad pico.' },
    vel_cv:                 { domain:'MOTOR', construct:'CV velocidad (M4)', unit:'ratio', range:[0,2],
        desc:'Protocolo M4: Coeficiente de variación de velocidad. Alto=movimiento rígido sin modulación.' },
    vel_uniformidad_index:          { domain:'MOTOR', construct:'Índice de uniformidad', unit:'index', range:[0,1],
        desc:'Protocolo M4: 1 - vel_cv. Alto=pobreza de modulación rítmica.' },
    vel_oscilacion_index:         { domain:'MOTOR', construct:'Oscilaciones rítmicas', unit:'index', range:[0,1],
        desc:'Protocolo M4: Signo de rueda dentada digital. Ref: Jankovic 2008.' },
    vel_caida_brusca_ratio:      { domain:'MOTOR', construct:'Caída brusca de aceleración', unit:'ratio', range:[0,10],
        desc:'Protocolo M4: Caídas bruscas de aceleración; indicador de rigidez motora severa.' },
    vel_perfil_abrupto:     { domain:'MOTOR', construct:'Perfil abrupto normalizado', unit:'index', range:[0,1],
        desc:'Protocolo M4: Valor normalizado de la caída de tensión motora. 0=normal, 1=abrupto.' },

    // === TRAYECTORIA / PRAXIS ===
    eficiencia_trayectoria: { domain:'PRAXIS', construct:'Eficiencia de trayectoria', unit:'ratio', range:[0,1], desc:'Path recto / path real. 1=perfecto.' },
    rectificaciones_count:  { domain:'PRAXIS', construct:'Rectificaciones', unit:'count', range:[0,500], desc:'Cambios bruscos de dirección (>45°) durante arrastre.' },
    falsos_clicks:          { domain:'PRAXIS', construct:'Clicks erráticos', unit:'count', range:[0,200], desc:'Clicks fuera de elementos interactivos.' },

    // === ERRORES (Signal Detection) ===
    errores_omision:        { domain:'ATENCION', construct:'Errores de omisión', unit:'count', range:[0,100], desc:'No respondió cuando debía. Correlato: inatención.' },
    errores_comision:       { domain:'INHIBICION', construct:'Errores de comisión', unit:'count', range:[0,100], desc:'Respondió cuando no debía. Correlato: impulsividad.' },
    perseveracion_count:    { domain:'EJECUTIVO', construct:'Perseveración', unit:'count', range:[0,50], desc:'Repetición estereotipada. Correlato: rigidez cognitiva, frontal.' },

    // === SECUENCIA / PLANIFICACIÓN ===
    secuencia_correcta_pct: { domain:'EJECUTIVO', construct:'Secuenciación', unit:'pct', range:[0,100], desc:'% de acciones en orden correcto.' },
    ratio_completados:      { domain:'EJECUTIVO', construct:'Eficacia de objetivo', unit:'ratio', range:[0,1],
        desc:'Protocolo E2: Objetivos logrados / esperados.' },
    plan_failed_attempts:   { domain:'EJECUTIVO', construct:'Intentos fallidos', unit:'count', range:[0,50], desc:'Planes iniciados pero no completados.' },

    // === TIEMPO DE REACCIÓN / ATENCIÓN ===
    rt_mean_ms:             { domain:'ATENCION', construct:'Tiempo de reacción medio', unit:'ms', range:[100,5000], desc:'RT medio sobre todos los estímulos respondidos.' },
    rt_sd_ms:               { domain:'ATENCION', construct:'Variabilidad RT', unit:'ms', range:[0,2000], desc:'SD del RT. Alto = inconsistente.' },
    rt_cv:                  { domain:'ATENCION', construct:'Coeficiente de variación RT (A1)', unit:'ratio', range:[0,2],
        desc:'Protocolo A1. rt_cv > 0.25 sugiere irregularidad atencional. TDAH correlación g=0.76.' },
    iiv_consecutiva:        { domain:'ATENCION', construct:'Variabilidad intraindividual consecutiva (IIV)', unit:'ms', range:[0,500],
        desc:'Protocolo A1. SD de las diferencias entre RT de ensayos consecutivos. Sensible a fluctuaciones atencionales.' },
    vigor_mental_h1_h2:     { domain:'ATENCION', construct:'Vigor mental H1/H2', unit:'ratio', range:[0.3,2],
        desc:'V4 canónico (reemplaza decaimiento_vigilancia): RT 1ra mitad / RT 2da mitad. >1 = warm-up/mejora temporal. <1 = fatigabilidad. Calculado post-hoc por agente-rt / biomet.' },

    // Fatigabilidad y distribucion temporal — tercios, transversal a todos los juegos
    // A2 Fatiga — protocolo clínico v1 (calculados en análisis diferido SQL)
    fatiga_motor:         { domain:'FATIGABILIDAD', construct:'Fatiga motora', unit:'ratio', range:[0,5],
        desc:'Protocolo A2. jitter_terminal / jitter_reposo. >1.5 = fatiga motora significativa.' },
    fatiga_precision:     { domain:'FATIGABILIDAD', construct:'Fatiga de precisión', unit:'ratio', range:[0,5],
        desc:'Protocolo A2. precision_deposito_px T3 / T1. Degradación por tiempo de exposición.' },
    fatiga_global:        { domain:'FATIGABILIDAD', construct:'Fatiga global (media ponderada)', unit:'ratio', range:[0,5],
        desc:'Protocolo A2. Media ponderada de ratios fatiga_motor + fatiga_precision + RT.' },

    eficacia_tercio_1:    { domain:'FATIGABILIDAD', construct:'Eficacia tercio inicial', unit:'ratio', range:[0,1], desc:'Correctos/total en el primer tercio temporal de la sesion.' },
    eficacia_tercio_2:    { domain:'FATIGABILIDAD', construct:'Eficacia tercio medio', unit:'ratio', range:[0,1], desc:'Correctos/total en el segundo tercio temporal de la sesion.' },
    eficacia_tercio_3:    { domain:'FATIGABILIDAD', construct:'Eficacia tercio final', unit:'ratio', range:[0,1], desc:'Correctos/total en el ultimo tercio temporal de la sesion.' },
    delta_ok_t3_menos_t1: { domain:'FATIGABILIDAD', construct:'ok_t3/total_t3 menos ok_t1/total_t1', unit:'ratio', range:[-1,1], desc:'(ok_t3/total_t3) - (ok_t1/total_t1). El clinico interpreta la pendiente.' },
    rt_tercio_1:          { domain:'FATIGABILIDAD', construct:'RT medio tercio inicial', unit:'ms', range:[0,5000], desc:'RT promedio en el primer tercio. Null si < 6 respuestas.' },
    rt_tercio_2:          { domain:'FATIGABILIDAD', construct:'RT medio tercio intermedio', unit:'ms', range:[0,5000], desc:'RT promedio en el segundo tercio.' },
    rt_tercio_3:          { domain:'FATIGABILIDAD', construct:'RT medio tercio final', unit:'ms', range:[0,5000], desc:'RT promedio en el ultimo tercio.' },
    errores_tercio_1:     { domain:'FATIGABILIDAD', construct:'Errores tercio inicial', unit:'count', range:[0,100], desc:'Errores cometidos en el primer tercio temporal. Alto = no fijo la consigna.' },
    errores_tercio_2:     { domain:'FATIGABILIDAD', construct:'Errores tercio medio', unit:'count', range:[0,100], desc:'Errores en el segundo tercio. Alto = fatiga atencional media sesion.' },
    errores_tercio_3:     { domain:'FATIGABILIDAD', construct:'Errores tercio final', unit:'count', range:[0,100], desc:'Errores en el ultimo tercio. Alto = olvido de consigna o fatiga final.' },
    // Automonitoreo — deteccion y correccion de error propio
    correcciones_activas: { domain:'EJECUTIVO', construct:'Correcciones activas', unit:'count', range:[0,50], desc:'Errores seguidos de correccion del mismo item. Indica automonitoreo activo.' },
    automonitoreo_pct:    { domain:'EJECUTIVO', construct:'Tasa de automonitoreo', unit:'pct', range:[0,100], desc:'Correcciones activas / total errores * 100. Que proporcion de sus errores el sujeto corrige solo.' },
    completado_con_pct:   { domain:'EJECUTIVO', construct:'Completitud al declarar fin', unit:'pct', range:[0,100], desc:'% de objetivos completados cuando el sujeto presiona el boton de fin. <90 = automonitoreo deficiente.' },
    movimientos_post_completado: { domain:'EJECUTIVO', construct:'Movimientos post-declaracion', unit:'count', range:[0,200], desc:'Movimientos realizados despues de declarar completado. Indica perseveracion o correccion tardia.' },

    // === HESITACIÓN ===
    hesitaciones_count:     { domain:'EJECUTIVO', construct:'Hesitaciones', unit:'count', range:[0,200], desc:'Pausas >200ms durante acción motora activa.' },
    hesitacion_mean_ms:     { domain:'EJECUTIVO', construct:'Duración hesitación', unit:'ms', range:[0,5000], desc:'Duración media de cada hesitación.' },

    // === CONTROL EJECUTIVO ===
    impulsividad_ratio:     { domain:'INHIBICION', construct:'Impulsividad', unit:'ratio', range:[0,1], desc:'Ratio de acciones rápidas (<150ms) sin pausa previa.' },
    count_drags_abortados:       { domain:'INHIBICION', construct:'Inhibición motora', unit:'count', range:[0,200],
        desc:'Protocolo E1: Movimientos iniciados y abortados antes del click.' },
    ratio_acciones_util:     { domain:'EJECUTIVO', construct:'Economía cognitiva', unit:'ratio', range:[0,1],
        desc:'Protocolo E2: Acciones útiles / total. Mide eficiencia ejecutiva.' },

    // === INSTRUCCIONES / COMPRENSIÓN ===
    instruction_time_ms:    { domain:'COMPRENSION', construct:'Tiempo de lectura', unit:'ms', range:[0,60000], desc:'Tiempo total leyendo instrucciones.' },
    instruction_scrollbacks:{ domain:'COMPRENSION', construct:'Re-lecturas', unit:'count', range:[0,50], desc:'Scrollbacks en pantalla de instrucciones.' },
    first_action_latency_ms:{ domain:'EJECUTIVO', construct:'Latencia de inicio', unit:'ms', range:[0,30000], desc:'Tiempo desde que aparece el juego hasta 1ra acción.' },

    // === META / SESIÓN ===
    // AFEC — biomarcadores afectivos (protocolo v1, calculados en análisis diferido)
    engagement_decay:     { domain:'AFEC', construct:'Decaimiento de engagement inter-sesiones', unit:'ratio', range:[-2,2],
        desc:'Protocolo AFEC1. Variación de duración sesión N vs N-1. Negativo = retracción afectiva.' },
    color_hex:            { domain:'AFEC', construct:'Color elegido en pre-game (proyectivo)', unit:'hex', range:[0,0],
        desc:'Protocolo AFEC2. Tono cromático en el mood check-in pre-juego. Análisis proyectivo.' },
    color_congruencia:    { domain:'AFEC', construct:'Congruencia estado afectivo-rendimiento', unit:'ratio', range:[-1,1],
        desc:'Protocolo AFEC2. Correlación entre el color elegido y el rendimiento real de la sesión.' },

    session_duration_ms:    { domain:'META', construct:'Duración sesión', unit:'ms', range:[0,3600000], desc:'Duración total de la sesión de juego.' },
    total_clicks:           { domain:'META', construct:'Total clicks', unit:'count', range:[0,10000], desc:'Total de clicks/taps en la sesión.' },
    total_actions:          { domain:'META', construct:'Total acciones', unit:'count', range:[0,10000], desc:'Total de acciones significativas.' },

    // === HARDWARE CORRECTION ===
    hw_idle_jitter_px:      { domain:'HARDWARE', construct:'Jitter basal del dispositivo', unit:'px', range:[0,20], desc:'Ruido del input device en reposo.' },
    hw_latency_ms:          { domain:'HARDWARE', unit:'ms', range:[0,100], desc:'Delay inherente del input device.' },

    // === PRESENCIA ACTIVA ===
    presencia_activa_pct:               { domain:'PRESENCIA', construct:'Presencia activa', unit:'%', range:[0,100], desc:'Porcentaje del tiempo con actividad real (mouse/touch).' },
    presencia_idle_pct:                 { domain:'PRESENCIA', construct:'Presencia idle', unit:'%', range:[0,100], desc:'Porcentaje del tiempo presente pero sin accion.' },
    presencia_ausente_pct:              { domain:'PRESENCIA', construct:'Ausencia', unit:'%', range:[0,100], desc:'Porcentaje del tiempo fuera de la pantalla (otra app, pantalla apagada).' },
    presencia_segmentos_activos:        { domain:'PRESENCIA', construct:'Fragmentation', unit:'count', range:[0,200], desc:'Cantidad de rafagas continuas de actividad.' },
    presencia_duracion_media_activa_ms: { domain:'PRESENCIA', construct:'Duracion media de actividad', unit:'ms', range:[0,600000], desc:'Duracion media de cada rafaga activa.' },
    presencia_idle_max_ms:              { domain:'PRESENCIA', construct:'Idle maximo', unit:'ms', range:[0,600000], desc:'Periodo idle mas largo de la sesion.' },
    // ── MEMORIA ──────────────────────────────────────────────────────────────
    evocacion_libre_count:        { domain:'MEMORIA', unit:'count', range:[0,20],    desc:'Items recordados sin ayuda en fase de evocacion libre.' },
    evocacion_indiciada_count:    { domain:'MEMORIA', unit:'count', range:[0,20],    desc:'Items recordados con pista semantica o perceptual.' },
    intrusiones_count:            { domain:'MEMORIA', unit:'count', range:[0,50],    desc:'Items reportados que no estaban en el set original.' },
    orden_correcto_pct:           { domain:'MEMORIA', unit:'pct',   range:[0,100],   desc:'% de items recordados en la posicion serial correcta.' },
    tiempo_encoding_ms:           { domain:'MEMORIA', unit:'ms',    range:[0,60000], desc:'Tiempo total mirando el material antes de la fase de evocacion.' },
    reconocimiento_correcto_pct:  { domain:'MEMORIA', unit:'pct',   range:[0,100],   desc:'Hits en fase de reconocimiento multiple choice.' },
    falsos_positivos_count:       { domain:'MEMORIA', unit:'count', range:[0,50],    desc:'Items reconocidos como presentes que no estaban.' },
    curva_posicion_serial:        { domain:'MEMORIA', unit:'json',  range:null,      desc:'Array de [pos, recordado] para analisis de primacia/recencia.' },

    // ── CALCULO ───────────────────────────────────────────────────────────────
    calculo_correcto_count:       { domain:'CALCULO', unit:'count', range:[0,50],    desc:'Respuestas numericas dentro del rango aceptable.' },
    calculo_error_absoluto_medio: { domain:'CALCULO', unit:'units', range:[0,10000], desc:'Error absoluto medio entre respuesta del sujeto y valor correcto.' },
    calculo_tiempo_mean_ms:       { domain:'CALCULO', unit:'ms',    range:[0,120000],desc:'Tiempo medio por problema de calculo.' },
    presupuesto_pct_usado:        { domain:'CALCULO', unit:'pct',   range:[0,200],   desc:'% del presupuesto disponible que utilizó. >100 = excedido.' },
    presupuesto_excedido:         { domain:'CALCULO', unit:'bool',  range:[0,1],     desc:'1 si gastó más del presupuesto disponible.' },
    calculo_error_pct:            { domain:'CALCULO', unit:'pct',   range:[0,100],   desc:'Error relativo medio (abs(respuesta-correcto)/correcto * 100).' },
    envases_necesarios_correcto:  { domain:'CALCULO', unit:'bool',  range:[0,1],     desc:'Calculó correctamente la cantidad de envases para el periodo.' },

    // ── COMPRENSION ───────────────────────────────────────────────────────────
    consigna_repeticiones_count:  { domain:'COMPRENSION', unit:'count', range:[0,20],    desc:'Veces que el sujeto solicitó repetir la consigna (audio o texto).' },
    tiempo_primer_click_post_audio_ms: { domain:'COMPRENSION', unit:'ms', range:[0,30000], desc:'RT desde fin del audio de consigna hasta primera accion.' },
    relecturas_consigna_count:    { domain:'COMPRENSION', unit:'count', range:[0,20],    desc:'Scrollbacks en zona de instrucciones durante el juego.' },
    comprension_score:            { domain:'COMPRENSION', unit:'pct',   range:[0,100],   desc:'Score compuesto de precision en tareas que requieren leer/oír consigna.' },

    // ── MEMORIA DE TRABAJO ────────────────────────────────────────────────────
    span_items:                   { domain:'MEMORIA_TRABAJO', unit:'count', range:[0,15],   desc:'Cantidad maxima de items manejados simultaneamente sin error.' },
    actualizacion_correcta_pct:   { domain:'MEMORIA_TRABAJO', unit:'pct',   range:[0,100],  desc:'% de actualizaciones correctas en tareas n-back o equivalente.' },

    // ── PLANIFICACION ─────────────────────────────────────────────────────────
    tiempo_planificacion_ms:      { domain:'PLANIFICACION', unit:'ms',    range:[0,60000], desc:'Tiempo antes del primer movimiento (inspeccion del problema).' },
    pasos_en_orden_pct:           { domain:'PLANIFICACION', unit:'pct',   range:[0,100],   desc:'% de pasos ejecutados en la secuencia optima.' },
    backtrack_count:              { domain:'PLANIFICACION', unit:'count', range:[0,50],    desc:'Veces que volvio atras en la secuencia de pasos.' },
    plan_abandonado_count:        { domain:'PLANIFICACION', unit:'count', range:[0,20],    desc:'Planes iniciados y abandonados antes de completarse.' },
    estrategia_global:            { domain:'PLANIFICACION', unit:'cat',   range:null,      desc:'por_categoria | por_secuencia | mixto | sin_patron — detectable por orden de acciones.' },

    // ── SEÑAL DETECTION THEORY ────────────────────────────────────────────────
    hit_rate:                     { domain:'SDT', unit:'ratio', range:[0,1],  desc:'Respuestas correctas a target / total targets presentados.' },
    false_alarm_rate:             { domain:'SDT', unit:'ratio', range:[0,1],  desc:'Respuestas a no-target / total no-targets presentados.' },
    miss_rate:                    { domain:'SDT', unit:'ratio', range:[0,1],  desc:'No respuestas a target / total targets.' },
    d_prime:                      { domain:'SDT', unit:'sd',    range:[-3,3], desc:'Discriminabilidad (z(HR) - z(FAR)). 0=azar, >1=bueno.' },
    criterion_c:                  { domain:'SDT', unit:'sd',    range:[-3,3], desc:'Criterio de respuesta. <0=liberal (responde mucho), >0=conservador.' },
    lateralizacion_diff_ms:       { domain:'SDT', unit:'ms',    range:[-500,500], desc:'RT medio izquierda menos RT medio derecha. 0=simetrico.' },

    // ── DISTRIBUCION RT ───────────────────────────────────────────────────────
    rt_percentil_10_ms:           { domain:'RT_DIST', unit:'ms', range:[50,2000],  desc:'Percentil 10 del RT (velocidad pura sin outliers).' },
    rt_percentil_90_ms:           { domain:'RT_DIST', unit:'ms', range:[100,5000], desc:'Percentil 90 del RT (cola lenta de la distribucion).' },
    rt_outliers_count:            { domain:'RT_DIST', unit:'count', range:[0,50],  desc:'RTs > media+2SD propios del sujeto.' },
    latencia_post_error_ms:       { domain:'RT_DIST', unit:'ms', range:[0,5000],   desc:'RT medio en la accion inmediata posterior a un error.' },
    latencia_post_correcto_ms:    { domain:'RT_DIST', unit:'ms', range:[0,5000],   desc:'RT medio en la accion inmediata posterior a un acierto.' },
    intervalo_acciones_cv:        { domain:'RT_DIST', unit:'ratio', range:[0,3],   desc:'CV del intervalo entre acciones consecutivas. Alto = ritmo irregular.' },

    // ── EXPLORACION ESPACIAL ──────────────────────────────────────────────────
    dispersion_clicks_px:         { domain:'ESPACIAL', unit:'px',    range:[0,500], desc:'SD de los puntos de impacto (dispersion espacial de clicks).' },
    sesgo_lateral_px:             { domain:'ESPACIAL', unit:'px',    range:[-200,200], desc:'Error sistematico lateral: positivo=derecha, negativo=izquierda.' },
    scroll_depth_max_px:          { domain:'ESPACIAL', unit:'px',    range:[0,10000], desc:'Profundidad maxima de scroll alcanzada en la sesion.' },
    scroll_reversals_count:       { domain:'ESPACIAL', unit:'count', range:[0,100], desc:'Veces que invirtio la direccion del scroll.' },
    scroll_velocity_mean:         { domain:'ESPACIAL', unit:'px/ms', range:[0,50],  desc:'Velocidad media de scroll — proxy de agitacion motora.' },
    scroll_total_distance_px:     { domain:'ESPACIAL', unit:'px',    range:[0,50000], desc:'Distancia total recorrida con scroll en la sesion.' },
    scroll_time_at_bottom_ms:     { domain:'ESPACIAL', unit:'ms',    range:[0,300000], desc:'Tiempo en zona inferior del documento — busqueda activa.' },
    zona_ignorada:                { domain:'ESPACIAL', unit:'bool',  range:[0,1],   desc:'1 si hay una region del tablero que nunca fue visitada.' },

    // === FOCO Y ATENCION AMBIENTAL ===
    // ---------------------------------------------------------------
    // DOS FENOMENOS DISTINTOS — no confundir:
    //
    // MULTITASKING (visibilitychange): el paciente cambio de ventana/app.
    //   Sigue activo cognitivamente. Mide alternancia, regulacion atencional,
    //   carga cognitiva concurrente. El cursor puede moverse en otra ventana.
    //
    // INACTIVIDAD FISICA (ausencia de mousemove > 3s): el cuerpo no se mueve.
    //   Puede ser: se fue a atender el telefono, latencia decisional, freezing
    //   ante dificultad, o simplemente mira la pantalla sin reaccionar.
    //   El cursor esta quieto EN esta ventana. Proxy de freezing conductual.
    // ---------------------------------------------------------------

    // INACTIVIDAD FISICA — ausencia de mousemove
    inactivity_episodes_count:    { domain:'ATENCION', unit:'count', range:[0,100], desc:'Episodios de inactividad fisica (sin mousemove >3s). Proxy de freezing.' },
    inactivity_total_ms:          { domain:'ATENCION', unit:'ms',    range:[0,3600000], desc:'Tiempo total acumulado sin movimiento fisico durante la sesion.' },
    inactivity_max_ms:            { domain:'ATENCION', unit:'ms',    range:[0,3600000], desc:'El episodio de inactividad fisica mas largo.' },

    // MULTITASKING — cambio de ventana/pestaña
    // Métricas de interrupción — el multitasking es conducta atencional real.
    // Un paciente que se va 3 veces es diferente al que no se mueve.
    // Cuándo se fue, por cuánto tiempo, si volvió enseguida: todo es señal.
    focus_interruptions_count:    { domain:'ATENCION', unit:'count', range:[0,50],  desc:'Cantidad de veces que salio del juego. Cada salida es conducta real.' },
    focus_time_away_ms:           { domain:'ATENCION', unit:'ms',    range:[0,3600000], desc:'Tiempo total acumulado fuera del juego durante la sesion.' },
    focus_time_away_max_ms:       { domain:'ATENCION', unit:'ms',    range:[0,3600000], desc:'Duracion de la interrupcion mas larga — cuanto se fue en el peor caso.' },
    focus_away_pct:               { domain:'ATENCION', unit:'ratio', range:[0,1],   desc:'Fraccion del tiempo total de sesion fuera de foco.' },
    tab_switches_count:           { domain:'ATENCION', unit:'count', range:[0,50],  desc:'Cambios de pestana/ventana. Alias de focus_interruptions_count.' },

    // ---------------------------------------------------------------
    // DOMINIO IDENTIDAD — biometría legal cam+mic (opt-in explícito)
    // Identidad del paciente real frente a la cámara. Defensa legal.
    // Valor null si el usuario no consintió o el dispositivo no está disponible.
    // Doctrina V4 M16: Cam/mic = identidad legal + FACS + cruce contextual, NO cognitivo.
    // ---------------------------------------------------------------
    identity_face_present_pct:    { domain:'IDENTIDAD', unit:'ratio', range:[0,1],
        desc:'Fraccion del tiempo con cara detectada en el frame. Lit: presencia fisica del paciente.' },
    identity_face_enrolled:       { domain:'IDENTIDAD', unit:'bool',  range:[0,1],
        desc:'1 si se registró un embedding facial de enrollment al inicio de la sesion.' },
    identity_session_verified:    { domain:'IDENTIDAD', unit:'bool',  range:[0,1],
        desc:'1 si la cara detectada coincide con el enrollment a lo largo de la sesion.' },
    identity_anomaly_count:       { domain:'IDENTIDAD', unit:'count', range:[0,100],
        desc:'Episodios donde el match de identidad cayó por debajo del umbral. Alerta de suplantacion.' },
    identity_voice_episodes:      { domain:'IDENTIDAD', unit:'count', range:[0,200],
        desc:'Episodios de vocalizacion detectados por el mic. Proxy de presencia activa.' },

    // ---------------------------------------------------------------
    // DOMINIO FACS — expresion facial (face-api, opt-in explícito)
    // Action Units: descripciones musculares observables, sin etiquetas diagnósticas.
    // Lit: Ekman & Friesen (1978), Duchenne (1862), Gross (2002), Cohn & Ekman (2005).
    // El sistema mide. El clínico interpreta.
    // ---------------------------------------------------------------

    // Ceño y tensión facial superior
    facs_brow_furrow_episodes:    { domain:'FACS', unit:'count',  range:[0,500],
        desc:'AU4 corrugador superciliar activo. Lit: esfuerzo cognitivo, frustración, dolor (Ekman 1978).' },
    facs_brow_furrow_ms:          { domain:'FACS', unit:'ms',     range:[0,3600000],
        desc:'Tiempo total con ceño fruncido. Indicador de carga emocional o cognitiva acumulada.' },

    // Tensión nasal
    facs_nose_wrinkle_episodes:   { domain:'FACS', unit:'count',  range:[0,200],
        desc:'AU9 elevador ala nariz + arruga nasal. Lit: expresión aversiva (Ekman 1978).' },

    // Compresión labial
    facs_lip_compression_episodes:{ domain:'FACS', unit:'count',  range:[0,200],
        desc:'AU23+AU24 orbicular labios. Lit: supresión emocional, control inhibitorio (Gross 2002).' },
    facs_lip_compression_max_ms:  { domain:'FACS', unit:'ms',     range:[0,60000],
        desc:'Tensión labial máxima sostenida en un episodio.' },

    // Parpadeo — ampliamente validado en neuroftalmología
    facs_blink_rate_mean:         { domain:'FACS', unit:'n/min',  range:[0,60],
        desc:'Parpadeos/min. Norma: 15-20. Bajo: hiperfoco, Parkinson. Alto: fatiga, stress (lit. neuroftalmología).' },
    facs_blink_rate_cv:           { domain:'FACS', unit:'ratio',  range:[0,3],
        desc:'Variabilidad del parpadeo. Alto CV indica parpadeo irregular.' },
    facs_blink_burst_count:       { domain:'FACS', unit:'count',  range:[0,100],
        desc:'Ráfagas >3 parpadeos en <2s. Lit: tic ocular, stress agudo.' },

    // Sonrisa — Duchenne (1862) validado fisiológicamente
    facs_genuine_smile_pct:       { domain:'FACS', unit:'ratio',  range:[0,1],
        desc:'AU6+AU12 simultáneos — sonrisa de Duchenne. Lit: afecto positivo genuino, correlato parasimpático.' },
    facs_social_smile_pct:        { domain:'FACS', unit:'ratio',  range:[0,1],
        desc:'AU12 sin AU6 — sonrisa voluntaria. Lit: regulación social, diferente correlato fisiológico.' },

    // CORRELACIÓN AFECTO-RENDIMIENTO — cruce FACS × eficacia del juego (M16)
    // Requiere tanto agent-media como que los juegos reporten aciertos/errores
    // via ZykosMediaAgent.reportGameEvent('hit'|'error')
    // Lit: Russell (1980) modelo circumplejo, Cohn & Ekman (2005) AU temporal dynamics
    affect_smile_during_hits_pct:  { domain:'FACS', unit:'ratio', range:[0,1],
        desc:'Fraccion de aciertos con sonrisa genuina activa. Alto=afecto positivo reactivo al exito.' },
    affect_brow_during_errors_pct: { domain:'FACS', unit:'ratio', range:[0,1],
        desc:'Fraccion de errores con ceño fruncido activo. Alto=esfuerzo/frustración reactiva al error.' },
    affect_lip_during_errors_pct:  { domain:'FACS', unit:'ratio', range:[0,1],
        desc:'Fraccion de errores con boca apretada. Alto=supresion emocional post-error (Gross 2002).' },
    affect_reactivity:             { domain:'FACS', unit:'ratio', range:[-1,1],
        desc:'>0.3=afecto reactivo al rendimiento. ~0=afecto plano/disociado. <-0.1=patron atipico.' },

    // ---------------------------------------------------------------
    // DOMINIO OG_MEDIA — Original Graphics Media (capa fundacional cam+mic)
    // Sin face-api. Vanilla JS. Bajo CPU. Base sobre la que FACS extiende.
    // Captura: presencia, luminancia, canal verde (proxy PPG), audio.
    // Lit: Verkruysse (2008), Poh (2010), De Haan (2013), Mcduff (2014)
    // ---------------------------------------------------------------
    og_cam_present:               { domain:'OG_MEDIA', unit:'bool',   range:[0,1],      desc:'1 si la camara estuvo activa en la sesion.' },
    og_cam_presence_pct:          { domain:'OG_MEDIA', unit:'ratio',  range:[0,1],      desc:'Fraccion del tiempo con contenido visual en el frame.' },
    og_cam_blackout_count:        { domain:'OG_MEDIA', unit:'count',  range:[0,100],    desc:'Episodios sin contenido visual. Correlato de ausencia fisica.' },
    og_cam_blackout_max_ms:       { domain:'OG_MEDIA', unit:'ms',     range:[0,600000], desc:'Blackout mas largo de la sesion.' },
    og_cam_luminance_mean:        { domain:'OG_MEDIA', unit:'0-255',  range:[0,255],    desc:'Luminancia media del frame (ITU-R BT.709).' },
    og_cam_luminance_cv:          { domain:'OG_MEDIA', unit:'ratio',  range:[0,3],      desc:'Variabilidad de luminancia. Alto=cambios de luz o movimiento.' },
    og_cam_green_channel_mean:    { domain:'OG_MEDIA', unit:'0-255',  range:[0,255],    desc:'Canal verde medio. Proxy PPG para HR (Verkruysse 2008, Poh 2010).' },
    og_cam_green_cv:              { domain:'OG_MEDIA', unit:'ratio',  range:[0,3],      desc:'Variabilidad canal verde. Correlato de pulso cardiaco rPPG (De Haan 2013).' },
    og_mic_present:               { domain:'OG_MEDIA', unit:'bool',   range:[0,1],      desc:'1 si el microfono estuvo activo en la sesion.' },
    og_mic_db_mean:               { domain:'OG_MEDIA', unit:'dB',     range:[0,100],    desc:'Volumen ambiental medio. Contexto acustico de la sesion.' },
    og_mic_db_cv:                 { domain:'OG_MEDIA', unit:'ratio',  range:[0,3],      desc:'Variabilidad de volumen. Alto=entorno ruidoso o variable.' },
    og_mic_silence_pct:           { domain:'OG_MEDIA', unit:'ratio',  range:[0,1],      desc:'Fraccion del tiempo en silencio (<30dB). Entorno controlado.' },
    og_mic_speech_episodes:       { domain:'OG_MEDIA', unit:'count',  range:[0,500],    desc:'Episodios de vocalizacion (>50dB). Lit: Cummins (2015).' },
    og_mic_peak_db:               { domain:'OG_MEDIA', unit:'dB',     range:[0,100],    desc:'Pico maximo de audio. Ruido externo extremo o vocalizacion intensa.' },

    // ---------------------------------------------------------------
    // DOMINIO PLATAFORMA — conducta del paciente en el portal (M15)
    // Métricas a nivel portal, no propias al juego individual.
    // Fuente: platform_dom (corsario del portal).
    // ---------------------------------------------------------------
    portal_tiempo_seleccion_ms:       { domain:'PLATAFORMA', unit:'ms',    range:[0,3600000],
        desc:'Tiempo desde que el portal se abre hasta que el paciente selecciona un juego.' },
    portal_backtrack_count:           { domain:'PLATAFORMA', unit:'count', range:[0,50],
        desc:'Veces que el paciente volvió al portal desde un juego sin completarlo.' },
    portal_hover_count:               { domain:'PLATAFORMA', unit:'count', range:[0,200],
        desc:'Cantidad de hover sobre iconos de juego antes de seleccionar. Proxy de indecision.' },
    platform_dias_desde_ultima_sesion:{ domain:'PLATAFORMA', unit:'count', range:[0,9999],
        desc:'Días transcurridos desde la sesion anterior del paciente en la plataforma.' },
    platform_racha_consecutiva:       { domain:'PLATAFORMA', unit:'count', range:[0,365],
        desc:'Días consecutivos con al menos una sesion completada.' },
    platform_sesiones_total:          { domain:'PLATAFORMA', unit:'count', range:[0,9999],
        desc:'Total de sesiones completadas por el paciente en la plataforma.' },
    platform_variedad_juegos:         { domain:'PLATAFORMA', unit:'count', range:[0,12],
        desc:'Cantidad de juegos distintos jugados por el paciente. 12 = set completo.' },

    // ---------------------------------------------------------------
    // DOMINIO OG_MEDIA — Original Graphics Media (capa fundacional cam+mic)
    // Métricas simples sin análisis facial complejo. Captura presencia,
    // luminancia, canal verde (proxy PPG), y audio básico.
    // Procesamiento 100% en browser. Cero frames al servidor.
    // Lit: Verkruysse et al. (2008), Poh et al. (2010), Mcduff (2014)
    // ---------------------------------------------------------------

    // CÁMARA — métricas de presencia y luz
    og_cam_present:               { domain:'OG_MEDIA', unit:'bool',   range:[0,1],      desc:'1 si la cámara estuvo activa en la sesión.' },
    og_cam_presence_pct:          { domain:'OG_MEDIA', unit:'ratio',  range:[0,1],      desc:'Fracción del tiempo con contenido visual significativo en el frame.' },
    og_cam_blackout_count:        { domain:'OG_MEDIA', unit:'count',  range:[0,100],    desc:'Episodios sin contenido visual (cámara tapada, luz apagada, ausencia).' },
    og_cam_blackout_max_ms:       { domain:'OG_MEDIA', unit:'ms',     range:[0,600000], desc:'Blackout más largo. Lit: correlato de ausencia física o atencional.' },
    og_cam_luminance_mean:        { domain:'OG_MEDIA', unit:'0-255',  range:[0,255],    desc:'Luminancia media del frame. Informa sobre condiciones de iluminación.' },
    og_cam_luminance_cv:          { domain:'OG_MEDIA', unit:'ratio',  range:[0,3],      desc:'Variabilidad de luminancia. Alto=cambios de luz o movimiento frecuente.' },
    og_cam_green_channel_mean:    { domain:'OG_MEDIA', unit:'0-255',  range:[0,255],    desc:'Canal verde medio. Lit: proxy PPG para HR (Verkruysse 2008, Poh 2010).' },
    og_cam_green_cv:              { domain:'OG_MEDIA', unit:'ratio',  range:[0,3],      desc:'Variabilidad del canal verde. Correlato de pulso cardíaco (rPPG).' },

    // MICRÓFONO — métricas de audio ambiente
    og_mic_present:               { domain:'OG_MEDIA', unit:'bool',   range:[0,1],      desc:'1 si el micrófono estuvo activo en la sesión.' },
    og_mic_db_mean:               { domain:'OG_MEDIA', unit:'dB',     range:[0,100],    desc:'Volumen ambiental medio. Informa sobre contexto acústico.' },
    og_mic_db_cv:                 { domain:'OG_MEDIA', unit:'ratio',  range:[0,3],      desc:'Variabilidad de volumen. Alto=entorno ruidoso o variable.' },
    og_mic_silence_pct:           { domain:'OG_MEDIA', unit:'ratio',  range:[0,1],      desc:'Fracción del tiempo en silencio (<30dB). Alto=entorno controlado.' },
    og_mic_speech_episodes:       { domain:'OG_MEDIA', unit:'count',  range:[0,500],    desc:'Episodios de vocalización (>50dB). Lit: verbalización espontánea.' },
    og_mic_peak_db:               { domain:'OG_MEDIA', unit:'dB',     range:[0,100],    desc:'Pico máximo de audio en la sesión. Indica ruido externo extremo.' },

    // Contexto de sesión — imprescindible para interpretar cualquier métrica conductual.
    // Sesión 1 de un paciente nuevo ≠ sesión 15 de un paciente establecido.
    // La expansividad (salirse, explorar) en sesión 1 puede ser un indicador
    // de estilo conductual, no de déficit.
    session_number:               { domain:'META', unit:'count', range:[1,9999], desc:'Numero ordinal de esta sesion para este paciente en este juego. 1 = primera vez.' },
    is_first_session:             { domain:'META', unit:'bool',  range:[0,1],   desc:'1 si es la primera sesion del paciente en este juego.' },

};

// Count
var _dictCount = Object.keys(METRIC_DICTIONARY).length;

// ================================================================
// EVENT BUS — Raw event stream (Capa 0)
// ================================================================
var _eventBuffer = [];
var _sessionId = null;
var _sessionStart = null;
var _agents = {};

var ZYKOS = {

    // --- Session management ---
    startSession: function(gameSlug, patientDni, patientId) {
        _sessionId = 'zs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        _sessionStart = performance.now();
        _eventBuffer = [];
        
        ZYKOS.meta = {
            game_slug: gameSlug,
            patient_dni: patientDni,
            patient_id: patientId,
            session_id: _sessionId,
            started_at: new Date().toISOString(),
            user_agent: navigator.userAgent,
            screen: { w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 }
        };

        // Activate all registered agents
        Object.keys(_agents).forEach(function(name) {
            try { _agents[name].start(ZYKOS.meta); } catch(e) { console.warn('[zykos-engine] Agent ' + name + ' start error:', e.message); }
        });

        ZYKOS._pushRaw('session_start', { game_slug: gameSlug });
        console.log('[zykos-engine] Session started: ' + _sessionId + ' | Agents: ' + Object.keys(_agents).join(', '));
    },

    endSession: async function() {
        if (!_sessionId) return;
        var duration = performance.now() - _sessionStart;
        ZYKOS._pushRaw('session_end', { duration_ms: Math.round(duration) });

        // Collect from all agents — puede retornar Promise (Web Worker) o valor sincrono
        var agentNames = Object.keys(_agents);
        var agentResults = {};

        // Parar todos los agentes primero, luego recolectar
        var collectPromises = agentNames.map(async function(name) {
            try {
                var result = _agents[name].collect();
                // Si collect() devuelve una Promise (Web Worker), la esperamos
                if (result && typeof result.then === 'function') {
                    result = await result;
                }
                agentResults[name] = result;
            } catch(e) {
                console.warn('[zykos-engine] Agent ' + name + ' collect error:', e.message);
            } finally {
                try { _agents[name].stop(); } catch(e) {}
            }
        });

        await Promise.all(collectPromises);

        // Flush audio module si existe
        if (typeof ZykosAudio !== 'undefined' && ZykosAudio.flush) {
            try { agentResults['_audio'] = ZykosAudio.flush(); }
            catch(e) { console.warn('[zykos-engine] Audio flush error:', e.message); }
        }

        // Flush media agent si está activo (opt-in, no en _agents)
        // Sus métricas se mezclan con el resto — son biomarcadores del mismo evento
        if (typeof ZykosMediaAgent !== 'undefined' && ZykosMediaAgent.collect) {
            try {
                var mediaResult = ZykosMediaAgent.collect();
                ZykosMediaAgent.stop();
                // Mezclar directo en unified — misma jerarquía que jitter_reposo_px
                if (mediaResult) Object.assign(agentResults['_media'] = {}, mediaResult);
            } catch(e) { console.warn('[zykos-engine] Media flush error:', e.message); }
        }

        // Merge into unified metric record
        var metrics = ZYKOS._mergeAgentResults(agentResults, duration);

        // Persist to Supabase
        ZYKOS._persist(metrics);

        _sessionId = null;
        return metrics;
    },

    // --- Audio module registration ---
    registerAudioModule: function(audioModule) {
        // ZykosAudio se auto-registra via DOMContentLoaded
        console.log('[zykos-engine] Audio module registered');
    },

    registerAgent: function(name, agent) {
        if (!agent.start || !agent.collect || !agent.stop) {
            console.error('[zykos-engine] Agent "' + name + '" must implement start(), collect(), stop()');
            return;
        }
        _agents[name] = agent;
    },

    // --- Raw event push (Capa 0) ---
    _pushRaw: function(type, data) {
        _eventBuffer.push({
            t: Math.round(performance.now() - (_sessionStart || 0)),
            type: type,
            data: data
        });
    },

    // --- Merge agent results into canonical metrics ---
    _mergeAgentResults: function(agentResults, duration) {
        var unified = {
            session_id: _sessionId,
            game_slug: ZYKOS.meta.game_slug,
            patient_dni: ZYKOS.meta.patient_dni,
            patient_id: ZYKOS.meta.patient_id,
            session_duration_ms: Math.round(duration),
            agents_active: Object.keys(agentResults),
            timestamp: new Date().toISOString()
        };

        // Adjuntar perfil de hardware activo — contexto de dispositivo por sesion
        // Sin esto, jitter_reposo_px de un mouse no es comparable a uno de touchpad
        if (typeof InputCalibration !== 'undefined' && InputCalibration.getProfile) {
            var hwp = InputCalibration.getProfile();
            if (hwp) {
                unified.hw_idle_jitter_px  = hwp.idle_jitter_px  || null;
                unified.hw_latency_ms      = hwp.rt_p10_ms       || null;
                unified._hw_profile = {
                    device:           hwp.input_device,
                    profile_ts:       hwp.timestamp,
                    idle_jitter_px:   hwp.idle_jitter_px,
                    rt_p10_ms:        hwp.rt_p10_ms,
                    offset_mean_px:   hwp.offset_mean_px,
                    path_efficiency:  hwp.path_efficiency_mean,
                    approach_jitter:  hwp.approach_jitter_mean
                };
            }
        }

        // Each agent returns an object with ONLY canonical metric names
        Object.keys(agentResults).forEach(function(agentName) {
            var result = agentResults[agentName];
            if (!result) return;
            Object.keys(result).forEach(function(key) {
                if (METRIC_DICTIONARY[key]) {
                    // Validate range
                    var def = METRIC_DICTIONARY[key];
                    var val = result[key];
                    if (val !== null && val !== undefined) {
                        if (typeof val === 'number' && (val < def.range[0] * 0.5 || val > def.range[1] * 2)) {
                            // Out of expected range — flag but still record
                            unified['_flag_' + key] = 'out_of_range';
                        }
                        unified[key] = val;
                    }
                } else if (key.startsWith('_raw_')) {
                    // Raw sub-data allowed with _raw_ prefix
                    unified[key] = result[key];
                } else {
                    console.warn('[zykos-engine] Agent "' + agentName + '" returned unknown metric: ' + key);
                }
            });
        });

        return unified;
    },

    // --- Persist to Supabase (THE ONLY WRITER) ---
    _persist: async function(metrics) {
        // Post-persist: llamar zykos_detect_patterns() de forma diferida
        // No bloquea el guardado de métricas. Corre en background.
        // Detecta patrones conductuales compuestos sobre datos ya guardados.
        try {
            var sb = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
            if (!sb) { console.warn('[zykos-engine] No Supabase client'); return; }

            // Calcular número ordinal de sesión antes de persistir.
            // Es crítico para interpretar métricas conductuales:
            // un paciente nuevo que se va 3 veces ≠ un paciente establecido.
            // Sesión 1 = primera vez que juega este juego.
            var sessionNumber = 1;
            var isFirstSession = true;
            try {
                var snRes = await sb.rpc('zykos_get_session_number', {
                    p_dni: metrics.patient_dni,
                    p_game_slug: metrics.game_slug
                });
                if (snRes.data) {
                    sessionNumber = snRes.data.session_number || 1;
                    isFirstSession = snRes.data.is_first_session !== false;
                }
            } catch(e) { /* no bloquear si falla */ }

            // Evidence hash chain
            var payload = {
                patient_dni: metrics.patient_dni,
                user_id: metrics.patient_id,
                game_slug: metrics.game_slug,
                metric_type: 'session_biomet',
                metric_data: {
                    ...metrics,
                    // Contexto de sesión — fundamental para análisis longitudinal
                    session_number: sessionNumber,
                    is_first_session: isFirstSession
                },
                session_id: metrics.session_id,
                session_date: new Date().toISOString().slice(0, 10),
                session_number: sessionNumber
            };

            if (typeof ZykosEvidence !== 'undefined') {
                payload = await ZykosEvidence.prepare(payload);
            }

            var { error } = await sb.from('zykos_game_metrics').insert(payload);
            if (error) {
                console.warn('[zykos-engine] Persist error:', error.message);
            } else {
                console.log('[zykos-engine] Metrics persisted: ' + Object.keys(metrics).length + ' fields');
                // Post-persist diferido — no bloquea, no afecta la UX
                if (payload.session_id) {
                    // 1. Detección de patrones conductuales
                    sb.rpc('zykos_detect_patterns', { p_session_id: payload.session_id })
                      .then(function(r){
                          if (r.error) console.warn('[patterns]', r.error.message);
                      }).catch(function(){});

                    // 2. Fatiga A2 del protocolo clínico (cómputo diferido)
                    sb.rpc('zykos_compute_fatiga', { p_session_id: payload.session_id })
                      .then(function(r){
                          if (r.error) console.warn('[fatiga-A2]', r.error.message);
                      }).catch(function(){});

                    // 3. Timeline de humor facial (solo si agent-media estuvo activo)
                    var humTL  = metrics['_raw_humor_timeline'];
                    var humPE  = metrics['_raw_performance_events'];
                    if (humTL && humTL.length > 0) {
                        sb.rpc('zykos_insert_affect_timeline', {
                            p_session_id:  payload.session_id,
                            p_patient_dni: metrics.patient_dni,
                            p_game_slug:   metrics.game_slug,
                            p_timeline:    humTL,
                            p_perf_events: humPE || []
                        }).then(function(r){
                            if (r.error) console.warn('[affect-timeline]', r.error.message);
                            else console.log('[affect-timeline] ' + humTL.length + ' eventos guardados');
                        }).catch(function(){});
                    }
                }
            }

            // Also persist raw event buffer (Capa 0)
            if (_eventBuffer.length > 0) {
                var rawPayload = {
                    patient_dni: metrics.patient_dni,
                    user_id: metrics.patient_id,
                    game_slug: metrics.game_slug,
                    metric_type: 'raw_events',
                    metric_data: { events: _eventBuffer, count: _eventBuffer.length },
                    session_id: metrics.session_id,
                    session_date: new Date().toISOString().slice(0, 10)
                };
                if (typeof ZykosEvidence !== 'undefined') {
                    rawPayload = await ZykosEvidence.prepare(rawPayload);
                }
                await sb.from('zykos_game_metrics').insert(rawPayload);
            }
        } catch(e) {
            console.error('[zykos-engine] Critical persist error:', e.message);
        }
    },

    // --- Public API ---
    getDictionary: function() { return METRIC_DICTIONARY; },
    getMetricCount: function() { return _dictCount; },
    getSessionId: function() { return _sessionId; },
    isActive: function() { return _sessionId !== null; },
    meta: null
};

// ================================================================
// AUTO-ATTACH: Start session when game loads, end on unload
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    // Extract patient info from URL/localStorage
    var params = new URLSearchParams(window.location.search);
    var dni = params.get('dni') || localStorage.getItem('zykos_patient_dni') || null;
    var userId = null;
    try { userId = JSON.parse(localStorage.getItem('zykos_user') || '{}').user_id || null; } catch(e) {}
    
    // Detect game slug from URL
    var path = window.location.pathname;
    var slug = path.split('/').pop().replace('.html', '').replace('index', '') || 'unknown';
    if (path.includes('classify-and-place')) slug = 'classify-' + (params.get('pack') || 'unknown');
    if (path.includes('inkblot')) slug = 'inkblot';

    if (dni) {
        // Esperar agentes via evento 'zykos:agents-ready' o fallback 300ms
        // Evita race condition donde un agente lento no queda en la sesion
        var started = false;
        function tryStart() {
            if (started) return;
            started = true;
            ZYKOS.startSession(slug, dni, userId);
        }
        document.addEventListener('zykos:agents-ready', tryStart, { once: true });
        setTimeout(tryStart, 300);
    }
});

window.addEventListener('beforeunload', function() {
    if (!ZYKOS.isActive()) return;
    // CRITICO: beforeunload no puede await Promises ni esperar Web Workers.
    // El worker de agent-motor tiene datos que no se computaron todavia.
    // Estrategia: guardar el raw stream sincrono via sendBeacon.
    // El compute diferido queda como tarea pendiente en Supabase.
    // Ademas: terminar los agentes en modo sync (sin collect(), solo stop())
    // para que al menos el raw_stream quede guardado.
    try {
        // Parar agentes sin collect (no podemos await el worker)
        Object.keys(_agents).forEach(function(name) {
            try { _agents[name].stop(); } catch(e) {}
        });

        var dni = ZYKOS.meta ? ZYKOS.meta.patient_dni : null;
        var slug = ZYKOS.meta ? ZYKOS.meta.game_slug : 'unknown';
        var duration = Math.round(performance.now() - _sessionStart);

        if (dni && _rawStream && _rawStream.length > 0) {
            var payload = JSON.stringify({
                patient_dni: dni,
                game_slug: slug,
                session_id: _sessionId,
                metric_type: 'raw_stream_unload',
                metric_value: _rawStream.length,
                metric_data: {
                    raw_events: _rawStream.slice(-300),
                    duration_ms: duration,
                    unload_reason: 'beforeunload',
                    // Flag para que SQL sepa que estas metricas son incompletas
                    compute_pending: true
                }
            });
            // sendBeacon: sincrono, sobrevive al cierre del contexto JS
            var url = 'https://aypljitzifwjosjkqsuu.supabase.co/rest/v1/zykos_raw_stream';
            navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        }
    } catch(e) { /* silencioso — contexto en cierre */ }
    _sessionId = null;
});

// Mouse idle detector — distingue ausencia fisica de multitasking
// Si el mouse no se mueve en N segundos con tab visible = ausencia fisica
// Si el mouse se mueve pero la tab esta oculta = multitasking
var _lastMouseMoveTime = performance.now();
var _mouseIdleTimer = null;
var MOUSE_IDLE_THRESHOLD_MS = 90000; // 90s sin mouse = probable ausencia fisica

document.addEventListener('mousemove', function() {
    _lastMouseMoveTime = performance.now();
}, { passive: true });

document.addEventListener('touchstart', function() {
    _lastMouseMoveTime = performance.now();
}, { passive: true });

// Chequear idle cada 30s
setInterval(function() {
    if (!ZYKOS.isActive()) return;
    var idleMs = Math.round(performance.now() - _lastMouseMoveTime);
    if (idleMs > MOUSE_IDLE_THRESHOLD_MS) {
        ZYKOS._pushRaw('mouse_idle', {
            idle_ms: idleMs,
            session_ms: Math.round(performance.now() - _sessionStart),
            tab_visible: !document.hidden
        });
    }
}, 30000);

// Visibility change — pausar/reanudar agentes al cambiar de ventana
// Problema: cuando el usuario alterna ventanas, el browser congela el hilo.
// Los timestamps siguen corriendo pero no hay eventos mousemove.
// Al volver, el primer sample tiene un gap enorme que contamina vel_cv y rt_mean_ms.
// Solucion: pausar los agentes en hidden, reanudar en visible.
// El gap queda marcado en el stream para que el analisis SQL lo descarte.
var _visibilityGapStart = null;

document.addEventListener('visibilitychange', function() {
    if (!ZYKOS.isActive()) return;

    if (document.hidden) {
        // Tab ocultada — pausar todos los agentes
        _visibilityGapStart = performance.now();
        Object.keys(_agents).forEach(function(name) {
            try {
                if (_agents[name].pause) _agents[name].pause();
            } catch(e) {}
        });
        ZYKOS._pushRaw('tab_hidden', {
            t: Date.now(),
            session_ms: Math.round(performance.now() - _sessionStart)
        });
        // Tasker: iniciar medicion de actividad durante el gap
        if (window._ZykosTasker) window._ZykosTasker.enterGap(performance.now());
    } else {
        // Tab visible de nuevo — reanudar y registrar gap
        var gapMs = _visibilityGapStart ? Math.round(performance.now() - _visibilityGapStart) : 0;
        _visibilityGapStart = null;
        // El gap es dato clinico real — no se descarta, se contextualiza.
        // Cuantas veces se fue el paciente, por cuanto tiempo, en que momento
        // de la sesion: eso es parte del fenotipo, no ruido.
        ZYKOS._pushRaw('tab_visible', {
            t: Date.now(),
            gap_ms: gapMs,
            session_ms: Math.round(performance.now() - _sessionStart),
            clinical_context: 'interrupcion_real_del_paciente'
        });
        // Tasker: cerrar medicion del gap
        if (window._ZykosTasker) window._ZykosTasker.exitGap(performance.now());
        // Reanudar agentes — resetear lastSample para evitar delta enorme
        Object.keys(_agents).forEach(function(name) {
            try {
                if (_agents[name].resume) _agents[name].resume();
                else if (_agents[name].resetLastSample) _agents[name].resetLastSample();
            } catch(e) {}
        });
    }
});

// Export
global.ZYKOS = ZYKOS;
global.METRIC_DICTIONARY = METRIC_DICTIONARY;

console.log('[zykos-engine] Core loaded. Dictionary: ' + _dictCount + ' metrics defined.');

})(typeof window !== 'undefined' ? window : this);
