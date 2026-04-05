// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
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
              localStorage.getItem('zykos_patient_dni') ||
              sessionStorage.getItem('zykos_patient_dni');
    } catch(e) {}
    
    if (!dni || dni === null) {
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
            ratio_completados: biomet.ratio_completados || null,  // objetivos logrados / objetivos totales
            eficacia_plan_propio: biomet.eficacia_plan_propio || null,  // ejecutó correctamente su propio plan
            
            // === EFICIENCIA ===
            ratio_acciones_util: biomet.ratio_acciones_util || null,  // acciones útiles / acciones totales
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
                mean_error_px: biomet.precision_deposito_px || null,
                pattern: null  // 'overshooting', 'undershooting', 'erratico', 'normal'
            },
            
            // === COORDINACIÓN MOTORA ===
            motor: {
                jitter_reposo_px:   biomet.jitter_reposo_px   || null,
                jitter_inicio_px:   biomet.jitter_inicio_px   || null,
                jitter_terminal_px: biomet.jitter_terminal_px || null,
                rectificaciones:    biomet.rectificaciones_count || 0
            },
            
            // === EJECUTIVO ===
            ejecutivo: {
                impulsividad_ratio: biomet.impulsividad_ratio || null,
                count_drags_abortados: biomet.count_drags_abortados || null,
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
        var _disPx = biomet.precision_deposito_px;
        if (_disPx) {
            if (_disPx > 40) {
                analysis.dismetria.pattern = 'overshooting';
            } else if (_disPx > 20) {
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
        if (!client || !dni || dni === null) return;
        
        try {
            await client.from('zykos_game_metrics').insert({
                patient_dni: dni,
                game_slug: gameSlug,
                metric_type: 'clinical_analysis',
                metric_value: analysis.ratio_completados,  // métrica principal
                metric_data: {
                    // Plan ejecutado vs ideal
                    ratio_completados: analysis.ratio_completados,
                    eficacia_plan_propio: analysis.eficacia_plan_propio,
                    ratio_acciones_util: analysis.ratio_acciones_util,
                    eficiencia_trayectoria: analysis.eficiencia_trayectoria,
                    
                    // Patrón ante errores (CRÍTICO)
                    error_response_pattern: analysis.error_pattern.response_pattern,
                    perseveration_count: analysis.error_pattern.perseveration_count,
                    omission_errors: analysis.error_pattern.omission_errors,
                    commission_errors: analysis.error_pattern.commission_errors,
                    error_rate: analysis.error_pattern.error_rate,
                    
                    // Dismetria
                    precision_deposito_px: analysis.dismetria.mean_error_px,
                    dismetria_pattern: analysis.dismetria.pattern,
                    
                    // Motor
                    tremor_reposo: analysis.motor.tremor_reposo,
                    tremor_inicio: analysis.motor.tremor_inicio,
                    tremor_terminal: analysis.motor.tremor_terminal,
                    rectificaciones: analysis.motor.rectificaciones,
                    
                    // Ejecutivo
                    impulsividad_ratio: analysis.ejecutivo.impulsividad_ratio,
                    count_drags_abortados: analysis.ejecutivo.count_drags_abortados,
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
                .from('zykos_mood_entries')
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
                card.innerHTML += ' | [!]️ Señal de frustración';
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

// ================================================================
// FEEDBACK COLLECTION — post-game rating
// Shows after metrics modal. 1-5 stars + optional comment.
// ================================================================

function showFeedbackModal(gameSlug) {
  if (document.getElementById('zykos-feedback-modal')) return;
  
  var dni = null;
  try { dni = new URLSearchParams(window.location.search).get('dni') || localStorage.getItem('zykos_patient_dni'); } catch(e) {}
  
  var overlay = document.createElement('div');
  overlay.id = 'zykos-feedback-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);';
  
  var card = document.createElement('div');
  card.style.cssText = 'background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;max-width:360px;width:90%;text-align:center;color:#e2e8f0;font-family:DM Sans,system-ui,sans-serif;';
  
  card.innerHTML = 
    '<p style="font-size:0.85rem;color:rgba(255,255,255,0.5);margin-bottom:8px;">Tu opinion nos ayuda</p>' +
    '<p style="font-size:1.1rem;font-weight:700;margin-bottom:16px;">Como fue la experiencia?</p>' +
    '<div id="fb-stars" style="display:flex;gap:8px;justify-content:center;margin-bottom:16px;font-size:2rem;cursor:pointer;">' +
      '<span data-r="1" style="opacity:0.3">&#9733;</span>' +
      '<span data-r="2" style="opacity:0.3">&#9733;</span>' +
      '<span data-r="3" style="opacity:0.3">&#9733;</span>' +
      '<span data-r="4" style="opacity:0.3">&#9733;</span>' +
      '<span data-r="5" style="opacity:0.3">&#9733;</span>' +
    '</div>' +
    '<textarea id="fb-comment" placeholder="Algo que quieras contarnos? (opcional)" style="width:100%;height:60px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px;color:#e2e8f0;font-size:0.85rem;resize:none;margin-bottom:12px;"></textarea>' +
    '<div style="display:flex;gap:8px;justify-content:center;">' +
      '<button id="fb-send" style="padding:10px 24px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;">Enviar</button>' +
      '<button id="fb-skip" style="padding:10px 24px;background:transparent;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);border-radius:10px;cursor:pointer;">Saltar</button>' +
    '</div>';
  
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  
  var selectedRating = 0;
  var stars = card.querySelectorAll('#fb-stars span');
  stars.forEach(function(s) {
    s.onclick = function() {
      selectedRating = parseInt(s.getAttribute('data-r'));
      stars.forEach(function(st) {
        st.style.opacity = parseInt(st.getAttribute('data-r')) <= selectedRating ? '1' : '0.3';
        st.style.color = parseInt(st.getAttribute('data-r')) <= selectedRating ? '#fbbf24' : '#e2e8f0';
      });
    };
  });
  
  document.getElementById('fb-send').onclick = function() {
    if (selectedRating === 0) return;
    var comment = document.getElementById('fb-comment').value.trim();
    var sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
    if (sb) {
      (async function() {
        try {
          var r = await sb.from('zykos_feedback').insert({
            patient_dni: dni,
            game_slug: gameSlug || window._zykosCurrentGame || 'unknown',
            rating: selectedRating,
            comment: comment || null,
            session_number: parseInt(localStorage.getItem('zykos_session_number') || '0')
          });
          if (r.error) console.warn('[feedback] save:', r.error.message);
        } catch(e) { console.warn('[feedback]', e); }
      })();
    }
    overlay.remove();
  };
  
  document.getElementById('fb-skip').onclick = function() { overlay.remove(); };
}

// Auto-show feedback after post-game metrics close
var _origShowMetrics = typeof showPostGameMetrics === 'function' ? showPostGameMetrics : null;
if (_origShowMetrics) {
  showPostGameMetrics = function() {
    _origShowMetrics.apply(this, arguments);
    // After metrics modal closes, show feedback
    var _checkClosed = setInterval(function() {
      if (!document.getElementById('zykos-metrics-overlay')) {
        clearInterval(_checkClosed);
        setTimeout(function() {
          showFeedbackModal(window._zykosCurrentGame);
        }, 500);
      }
    }, 300);
    setTimeout(function() { clearInterval(_checkClosed); }, 30000);
  };
}
