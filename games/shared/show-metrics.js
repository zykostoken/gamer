// ================================================================
// show-metrics.js — Modal de métricas post-juego con colores históricos
// ZYKOS GAMER
// ================================================================

(function(global) {
'use strict';

// ================================================================
// showMetricsModal - Modal de resultados con colores históricos
// ================================================================
global.showMetricsModal = async function(resultData) {
    resultData = resultData || {};
    
    // Obtener DNI del paciente
    var dni = null;
    try { 
        dni = new URLSearchParams(window.location.search).get('dni') || 
              localStorage.getItem('hdd_patient_dni') ||
              sessionStorage.getItem('hdd_patient_dni');
    } catch(e) {}
    
    if (!dni || dni === 'DEMO') {
        console.log('[show-metrics] No DNI - skipping color history');
        return;
    }

    // Obtener slug del juego actual
    var gameSlug = window.location.pathname.split('/').pop().replace('.html','');
    
    // Cliente Supabase
    var client = null;
    try {
        client = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : 
                 window.supabase?.createClient('https://aypljitzifwjosjkqsuu.supabase.co', 
                 typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '');
    } catch(e) {}
    
    if (!client) {
        console.warn('[show-metrics] No Supabase client');
        return;
    }

    // ================================================================
    // ANÁLISIS CLÍNICO COMPLETO: PLAN IDEAL VS PLAN EJECUTADO
    // ================================================================
    function analyzePlanExecution() {
        // Acceder al estado del juego y métricas biométricas
        var state = window.state || window.gameState || {};
        var biomet = window.biomet?.compute() || {};
        
        // Métricas básicas
        var score = state.score || resultData.score || 0;
        var errors = state.errors || resultData.errors || 0;
        var completed = state.completed || resultData.completed || false;
        var completitud = state.completitud || (completed ? 100 : 0);
        
        var analysis = {
            // === EFICACIA ===
            eficacia_objetivo: biomet.eficacia_objetivo || null,  // objetivos logrados / objetivos totales
            eficacia_plan_propio: biomet.eficacia_plan_propio || null,  // ejecutó correctamente su propio plan
            
            // === EFICIENCIA ===
            economia_cognitiva: biomet.economia_cognitiva || null,  // acciones útiles / acciones totales
            eficiencia_trayectoria: biomet.eficiencia_trayectoria || null,  // camino directo / camino real
            
            // === PATRÓN ANTE ERRORES (CRÍTICO CLÍNICO) ===
            error_pattern: {
                total_errors: errors,
                error_rate: null,
                omission_errors: biomet.errores_omision || 0,  // no hizo lo que debía
                commission_errors: biomet.errores_comision || 0,  // hizo lo que no debía
                perseveration_count: biomet.perseveracion_count || 0,  // repite mismo error (Bufestron)
                
                // Análisis de respuesta ante error
                response_pattern: null  // 'se_frena', 'persevera', 'corrige_adapta', 'abandona'
            },
            
            // === DISMETRIA ===
            dismetria: {
                mean_error_px: biomet.dismetria_mean_px || null,
                pattern: null  // 'overshooting', 'undershooting', 'erratico', 'normal'
            },
            
            // === COORDINACIÓN MOTORA ===
            motor: {
                tremor_reposo: biomet.tremor_reposo_px || null,
                tremor_inicio: biomet.tremor_inicio_px || null,
                tremor_terminal: biomet.tremor_terminal_px || null,
                rectificaciones: biomet.rectificaciones_count || 0
            },
            
            // === EJECUTIVO ===
            ejecutivo: {
                impulsividad_ratio: biomet.impulsividad_ratio || null,
                inhibicion_motor: biomet.inhibicion_motor || null,
                hesitaciones_count: biomet.hesitaciones_count || 0,
                rt_mean_ms: biomet.rt_mean_ms || null,
                rt_cv: biomet.rt_cv || null  // variabilidad = irregularidad atencional
            },
            
            // === SECUENCIA ===
            secuencia: {
                correcta_pct: biomet.secuencia_correcta_pct || null,
                pattern_type: null  // 'ordenado', 'caótico', 'parcialmente_ordenado'
            },
            
            // === ENGAGEMENT ===
            engagement: {
                level: null,  // 'alto', 'medio', 'bajo'
                completion_pattern: null,  // 'completo', 'parcial', 'abandonado'
                frustration_signal: null  // 'presente', 'ausente'
            }
        };
        
        // Calcular error rate
        var total_actions = score + errors;
        if (total_actions > 0) {
            analysis.error_pattern.error_rate = errors / total_actions;
        }
        
        // Inferir patrón de respuesta ante error
        if (analysis.error_pattern.perseveration_count > 3) {
            analysis.error_pattern.response_pattern = 'persevera';  // Bufestron
        } else if (analysis.ejecutivo.hesitaciones_count > 5 && analysis.error_pattern.error_rate > 0.2) {
            analysis.error_pattern.response_pattern = 'se_frena';  // bloqueo ante error
        } else if (completitud < 30 && errors > 3) {
            analysis.error_pattern.response_pattern = 'abandona';  // frustración
        } else if (analysis.error_pattern.error_rate < 0.2 || biomet.plan_failed_attempts?.length === 0) {
            analysis.error_pattern.response_pattern = 'corrige_adapta';  // flexibilidad
        }
        
        // Patrón de dismetria
        if (biomet.dismetria_mean_px) {
            if (biomet.dismetria_mean_px > 40) {
                analysis.dismetria.pattern = 'overshooting';
            } else if (biomet.dismetria_mean_px > 20) {
                analysis.dismetria.pattern = 'erratico';
            } else {
                analysis.dismetria.pattern = 'normal';
            }
        }
        
        // Patrón de secuencia
        if (analysis.secuencia.correcta_pct !== null) {
            if (analysis.secuencia.correcta_pct > 0.8) {
                analysis.secuencia.pattern_type = 'ordenado';
            } else if (analysis.secuencia.correcta_pct > 0.4) {
                analysis.secuencia.pattern_type = 'parcialmente_ordenado';
            } else {
                analysis.secuencia.pattern_type = 'caotico';
            }
        }
        
        // Engagement
        if (completitud >= 80) {
            analysis.engagement.level = 'alto';
        } else if (completitud >= 40) {
            analysis.engagement.level = 'medio';
        } else {
            analysis.engagement.level = 'bajo';
        }
        
        if (completed) {
            analysis.engagement.completion_pattern = 'completo';
        } else if (completitud > 20) {
            analysis.engagement.completion_pattern = 'parcial';
        } else {
            analysis.engagement.completion_pattern = 'abandonado';
        }
        
        if (analysis.error_pattern.error_rate > 0.3 && completitud < 50) {
            analysis.engagement.frustration_signal = 'presente';
        } else {
            analysis.engagement.frustration_signal = 'ausente';
        }
        
        return analysis;
    }

    // ================================================================
    // GUARDAR ANÁLISIS CLÍNICO EN SUPABASE
    // ================================================================
    async function saveClinicalAnalysis(analysis) {
        if (!client || !dni || dni === 'DEMO') return;
        
        try {
            await client.from('hdd_game_metrics').insert({
                patient_dni: dni,
                game_slug: gameSlug,
                metric_type: 'clinical_analysis',
                metric_value: analysis.eficacia_objetivo,  // métrica principal
                metric_data: {
                    // Plan ejecutado vs ideal
                    eficacia_objetivo: analysis.eficacia_objetivo,
                    eficacia_plan_propio: analysis.eficacia_plan_propio,
                    economia_cognitiva: analysis.economia_cognitiva,
                    eficiencia_trayectoria: analysis.eficiencia_trayectoria,
                    
                    // Patrón ante errores (CRÍTICO)
                    error_response_pattern: analysis.error_pattern.response_pattern,
                    perseveration_count: analysis.error_pattern.perseveration_count,
                    omission_errors: analysis.error_pattern.omission_errors,
                    commission_errors: analysis.error_pattern.commission_errors,
                    error_rate: analysis.error_pattern.error_rate,
                    
                    // Dismetria
                    dismetria_mean_px: analysis.dismetria.mean_error_px,
                    dismetria_pattern: analysis.dismetria.pattern,
                    
                    // Motor
                    tremor_reposo: analysis.motor.tremor_reposo,
                    tremor_inicio: analysis.motor.tremor_inicio,
                    tremor_terminal: analysis.motor.tremor_terminal,
                    rectificaciones: analysis.motor.rectificaciones,
                    
                    // Ejecutivo
                    impulsividad_ratio: analysis.ejecutivo.impulsividad_ratio,
                    inhibicion_motor: analysis.ejecutivo.inhibicion_motor,
                    hesitaciones_count: analysis.ejecutivo.hesitaciones_count,
                    rt_mean_ms: analysis.ejecutivo.rt_mean_ms,
                    rt_cv: analysis.ejecutivo.rt_cv,
                    
                    // Secuencia
                    secuencia_correcta_pct: analysis.secuencia.correcta_pct,
                    secuencia_pattern: analysis.secuencia.pattern_type,
                    
                    // Engagement
                    engagement_level: analysis.engagement.level,
                    completion_pattern: analysis.engagement.completion_pattern,
                    frustration_signal: analysis.engagement.frustration_signal
                },
                created_at: new Date().toISOString()
            });
            
            console.log('[show-metrics] Clinical analysis saved to DB');
        } catch(e) {
            console.warn('[show-metrics] Error saving clinical analysis:', e);
        }
    }

    // ================================================================
    // CARGAR COLORES HISTÓRICOS
    // ================================================================
    async function loadColorHistory() {
        try {
            // Últimas 10 selecciones de color para este juego
            var { data, error } = await client
                .from('hdd_mood_entries')
                .select('color_hex, color_name, created_at, context_type')
                .eq('patient_dni', dni)
                .eq('source_activity', gameSlug)
                .eq('entry_type', 'satisfaction_color')
                .not('color_hex', 'is', null)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error) {
                console.warn('[show-metrics] Error loading colors:', error);
                return [];
            }
            
            return data || [];
        } catch(e) {
            console.warn('[show-metrics] Exception loading colors:', e);
            return [];
        }
    }

    // ================================================================
    // RENDERIZAR HISTÓRICO DE COLORES
    // ================================================================
    function renderColorHistory(colors) {
        if (!colors || colors.length === 0) {
            return '<p style="color: rgba(255,255,255,0.5); font-size: 0.85rem; text-align: center; margin: 8px 0;">Sin colores registrados aún</p>';
        }
        
        var html = '<div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-top: 8px;">';
        
        colors.forEach(function(c) {
            var date = new Date(c.created_at);
            var timeAgo = getTimeAgo(date);
            
            html += '<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">';
            html += '<div style="width: 32px; height: 32px; border-radius: 50%; background: ' + c.color_hex + '; border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.3);" title="' + timeAgo + '"></div>';
            html += '<span style="font-size: 0.65rem; color: rgba(255,255,255,0.4);">' + timeAgo + '</span>';
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    }
    
    function getTimeAgo(date) {
        var now = new Date();
        var diffMs = now - date;
        var diffMins = Math.floor(diffMs / 60000);
        var diffHours = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'ahora';
        if (diffMins < 60) return diffMins + 'm';
        if (diffHours < 24) return diffHours + 'h';
        if (diffDays < 7) return diffDays + 'd';
        return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    }

    // ================================================================
    // CREAR Y MOSTRAR MODAL
    // ================================================================
    async function showModal() {
        // Cargar colores históricos
        var colorHistory = await loadColorHistory();
        
        // Análisis clínico completo del plan ejecutado
        var clinicalAnalysis = analyzePlanExecution();
        
        // Guardar análisis en DB para el profesional
        await saveClinicalAnalysis(clinicalAnalysis);
        
        // Crear overlay
        var overlay = document.createElement('div');
        overlay.id = 'metrics-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);';
        
        // Crear card
        var card = document.createElement('div');
        card.style.cssText = 'background:#1e293b;border-radius:20px;padding:24px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;font-family:system-ui,sans-serif;max-height:85vh;overflow-y:auto;';
        
        // Título
        card.innerHTML = '<h2 style="font-size:1.3rem;margin:0 0 4px;text-align:center;color:#fff;">Colores que elegiste</h2>';
        
        // Subtítulo explicativo
        card.innerHTML += '<p style="font-size:0.85rem;color:rgba(255,255,255,0.6);text-align:center;margin:0 0 16px;">Estos son los colores que seleccionaste en sesiones anteriores de este juego</p>';
        
        // Renderizar histórico
        card.innerHTML += renderColorHistory(colorHistory);
        
        // Nota clínica (solo para profesionales, NO para pacientes)
        // Esta sección está comentada porque NO debe mostrarse al paciente
        /*
        if (moodInference && colorHistory.length > 0) {
            card.innerHTML += '<div style="margin-top:16px;padding:12px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.08);">';
            card.innerHTML += '<p style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin:0;line-height:1.4;"><strong>Nota clínica (no visible para paciente):</strong></p>';
            card.innerHTML += '<p style="font-size:0.75rem;color:rgba(255,255,255,0.4);margin:4px 0 0;line-height:1.4;">';
            card.innerHTML += 'Engagement: ' + moodInference.engagement_level + ' | ';
            card.innerHTML += 'Completitud: ' + moodInference.completion_pattern + ' | ';
            card.innerHTML += 'Errores: ' + moodInference.error_pattern;
            if (moodInference.frustration_signal === 'presente') {
                card.innerHTML += ' | ⚠️ Señal de frustración';
            }
            card.innerHTML += '</p>';
            card.innerHTML += '</div>';
        }
        */
        
        // Botón continuar
        card.innerHTML += '<div style="margin-top:20px;text-align:center;">';
        card.innerHTML += '<button id="close-metrics-modal" style="padding:12px 32px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.4);">Continuar</button>';
        card.innerHTML += '</div>';
        
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        
        // Event listener para cerrar
        document.getElementById('close-metrics-modal').addEventListener('click', function() {
            overlay.style.animation = 'mfadeOut .25s ease forwards';
            setTimeout(function() { 
                overlay.remove(); 
            }, 300);
        });
        
        // CSS animations
        if (!document.getElementById('metrics-modal-css')) {
            var css = document.createElement('style');
            css.id = 'metrics-modal-css';
            css.textContent = '@keyframes mfadeIn{from{opacity:0}to{opacity:1}}@keyframes mfadeOut{from{opacity:1}to{opacity:0}}';
            document.head.appendChild(css);
        }
        
        overlay.style.animation = 'mfadeIn .3s ease';
    }
    
    // Ejecutar modal
    await showModal();
};

})(window);
