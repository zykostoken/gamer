// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
/* ============================================================
   ZYKOS GAMER — UNIFIED TELEMETRY SENDER
   shared/telemetry.js
   
   Importar en cualquier juego:
   <script src="/games/shared/telemetry.js"></script>
   
   Se encarga de:
   1. Iniciar sesión de plataforma al abrir
   2. Registrar cada sesión de juego con métricas
   3. Enviar mouse telemetry comprimida
   4. Enviar action logs (kit, classify moves)
   5. Generar alertas automáticas
   6. Actualizar perfil acumulado
   
   NO depende de ningún juego específico — es agnóstico al frame.
   ============================================================ */

const TELEM = (() => {
  // Supabase config
  const SUPABASE_URL = 'https://aypljitzifwjosjkqsuu.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cGxqaXR6aWZ3am9zamtxc3V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzA4MjksImV4cCI6MjA4OTE0NjgyOX0.uIKgKI0XrarWqHNtjDTPTUUbI15fxL-ptr0-xFcLz4Q';
  
  let _sb = null;
  let _patientId = null;
  let _platformSessionId = null;
  let _gameSessionId = null;
  let _gamesPlayedCount = 0;

  // Init Supabase client
  function _getSb() {
    if (_sb) return _sb;
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    }
    return _sb;
  }

  // ---- HELPERS ----
  async function _insert(table, data) {
    const sb = _getSb();
    if (!sb) { console.warn('[TELEM] No Supabase client'); return null; }
    try {
      // Evidence hash chain for metric tables
      if (table.includes('game_metrics') || table.includes('game_sessions') || table.includes('clinical_alerts')) {
        if (typeof ZykosEvidence !== 'undefined' && ZykosEvidence.prepare) {
          data = await ZykosEvidence.prepare(data);
        }
      }
      const { data: result, error } = await sb.from(table).insert(data).select().single();
      if (error) { console.error(`[TELEM] Insert ${table}:`, error.message); return null; }
      return result;
    } catch (e) { console.error(`[TELEM] Insert ${table} exception:`, e); return null; }
  }

  async function _insertMany(table, rows) {
    const sb = _getSb();
    if (!sb || !rows.length) return;
    try {
      // Evidence hash chain for batch inserts on metric tables
      if (table.includes('game_metrics') && typeof ZykosEvidence !== 'undefined' && ZykosEvidence.prepare) {
        for (var i = 0; i < rows.length; i++) {
          rows[i] = await ZykosEvidence.prepare(rows[i]);
        }
      }
      const { error } = await sb.from(table).insert(rows);
      if (error) console.error(`[TELEM] InsertMany ${table}:`, error.message);
    } catch (e) { console.error(`[TELEM] InsertMany ${table}:`, e); }
  }

  async function _update(table, id, data) {
    const sb = _getSb();
    if (!sb) return;
    try {
      const { error } = await sb.from(table).update(data).eq('id', id);
      if (error) console.error(`[TELEM] Update ${table}:`, error.message);
    } catch (e) { console.error(`[TELEM] Update ${table}:`, e); }
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Inicializar con el ID del paciente. Llamar al cargar la página.
   * Crea la sesión de plataforma.
   */
  async function init(patientId) {
    _patientId = patientId || 'anonymous';
    const now = new Date();
    const result = await _insert('zykos_platform_sessions', {
      patient_id: _patientId,
      login_hour: now.getHours(),
      login_day_of_week: now.getDay(),
      user_agent: navigator.userAgent,
    });
    if (result) _platformSessionId = result.id;
    console.log('[TELEM] Platform session:', _platformSessionId);
    
    // Check for night login alert
    const hour = now.getHours();
    if (hour >= 2 && hour <= 5) {
      await _createAlert('night_login', 'medium', 
        `Conexión nocturna a las ${hour}:${String(now.getMinutes()).padStart(2,'0')} — evaluar insomnio o inversión de ritmo circadiano`,
        { hour, day: now.toISOString() }
      );
    }
    return _platformSessionId;
  }

  /**
   * Iniciar una sesión de juego. Llamar al arrancar cada partida.
   * Retorna el game_session_id.
   */
  async function startGameSession({ frame, packId, mode, level }) {
    _gamesPlayedCount++;
    const result = await _insert('zykos_game_sessions', {
      platform_session_id: _platformSessionId,
      patient_id: _patientId,
      frame: frame || 'classify-and-place',
      pack_id: packId,
      mode: mode,
      level: level || 1,
    });
    if (result) _gameSessionId = result.id;
    console.log(`[TELEM] Game session: ${_gameSessionId} (${packId}/${mode}/L${level})`);
    return _gameSessionId;
  }

  /**
   * Finalizar sesión de juego con resultados.
   * Llamar cuando el paciente termina o abandona.
   */
  async function endGameSession(results) {
    if (!_gameSessionId) return;
    
    const data = {
      ended_at: new Date().toISOString(),
      duration_ms: results.durationMs || 0,
      score: results.score || 0,
      correct: results.correct || 0,
      errors: results.errors || 0,
      total_items: results.totalItems || 0,
      accuracy_pct: results.accuracyPct || 0,
      completed: results.completed !== false,
      abandonment_point_pct: results.abandonmentPct || null,
      // Classify
      perseverations: results.perseverations || null,
      avg_reaction_time_ms: results.avgReactionTimeMs || null,
      // Kit
      kit_scenario: results.kitScenario || null,
      kit_budget: results.kitBudget || null,
      kit_spent: results.kitSpent || null,
      kit_budget_exceeded: results.kitBudgetExceeded || false,
      kit_budget_exceeded_at_ms: results.kitBudgetExceededAtMs || null,
      kit_items_added: results.kitItemsAdded || null,
      kit_items_removed: results.kitItemsRemoved || null,
      kit_first_action_ms: results.kitFirstActionMs || null,
      kit_avg_deliberation_ms: results.kitAvgDeliberationMs || null,
      kit_deliberation_pauses: results.kitDeliberationPauses || null,
      kit_categories_covered: results.kitCategoriesCovered || null,
      // Calc
      calc_problems_attempted: results.calcAttempted || null,
      calc_problems_correct: results.calcCorrect || null,
      // Sim
      sim_pairs_viewed: results.simPairsViewed || null,
    };

    await _update('zykos_game_sessions', _gameSessionId, data);

    // Check for alerts
    if (results.accuracyPct !== undefined && results.accuracyPct < 30) {
      await _createAlert('low_accuracy', 'medium',
        `Precisión muy baja (${results.accuracyPct}%) en ${results.packId || 'juego'} modo ${results.mode || '?'}`,
        { accuracy: results.accuracyPct, pack: results.packId, mode: results.mode }
      );
    }

    return _gameSessionId;
  }

  /**
   * Enviar telemetría de mouse comprimida.
   * Llamar al final de cada sesión de juego.
   */
  async function sendMouseTelemetry(metrics) {
    if (!_gameSessionId) return;

    // Classify psychomotor speed
    let speedClass = 'normal';
    if (metrics.vel < 100) speedClass = 'very_slow';
    else if (metrics.vel < 200) speedClass = 'slow';
    else if (metrics.vel > 600) speedClass = 'very_fast';
    else if (metrics.vel > 400) speedClass = 'fast';

    // Classify motor consistency
    let consistClass = 'normal';
    if (metrics.velVar < 50) consistClass = 'uniform';
    else if (metrics.velVar > 300) consistClass = 'erratic';
    else if (metrics.velVar > 150) consistClass = 'variable';

    // Classify fatigue
    let fatigueClass = 'none';
    if (metrics.pauses > 8 || metrics.idleRatio > 40) fatigueClass = 'severe';
    else if (metrics.pauses > 4 || metrics.idleRatio > 25) fatigueClass = 'moderate';
    else if (metrics.pauses > 2 || metrics.idleRatio > 15) fatigueClass = 'mild';

    await _insert('zykos_mouse_telemetry', {
      game_session_id: _gameSessionId,
      patient_id: _patientId,
      total_points: metrics.pts || 0,
      total_distance_px: metrics.totalDist || 0,
      avg_velocity_px_s: metrics.vel || 0,
      velocity_variance: metrics.velVar || 0,
      pauses_gt_2s: metrics.pauses || 0,
      direction_changes: metrics.dirChanges || 0,
      path_efficiency_pct: metrics.pathEff || 0,
      idle_ratio_pct: metrics.idleRatio || 0,
      scroll_events: metrics.scrollCount || 0,
      max_scroll_depth_px: metrics.maxScroll || 0,
      psychomotor_speed_class: speedClass,
      motor_consistency_class: consistClass,
      fatigue_indicator: fatigueClass,
    });
  }

  /**
   * Enviar log de acciones del Kit (batch).
   */
  async function sendKitLog(actions) {
    if (!_gameSessionId || !actions.length) return;
    const rows = actions.map((a, i) => ({
      game_session_id: _gameSessionId,
      patient_id: _patientId,
      action: a.action,
      item_id: a.itemId,
      item_name: a.name || null,
      item_category: a.category || null,
      item_price: a.price || 0,
      cumulative_spent: a.spent || 0,
      elapsed_ms: Math.round(a.time || 0),
      since_last_action_ms: Math.round(a.sinceLastMs || 0),
      action_order: i + 1,
    }));
    await _insertMany('zykos_kit_action_log', rows);
  }

  /**
   * Enviar movimientos de Classify (batch).
   */
  async function sendClassifyMoves(moves, items) {
    if (!_gameSessionId || !moves.length) return;
    const rows = moves.map((m, i) => {
      const item = items?.find(it => it.id === m.itemId);
      return {
        game_session_id: _gameSessionId,
        patient_id: _patientId,
        item_id: m.itemId,
        item_name: item?.name || m.itemId,
        target_category: m.targetCat,
        correct_category: item?.category || m.targetCat,
        is_correct: m.correct,
        reaction_time_ms: Math.round(m.rt || 0),
        elapsed_ms: Math.round(m.time || 0),
        move_order: i + 1,
        had_similarity_note: !!item?.similarity_note,
      };
    });
    await _insertMany('zykos_classify_moves', rows);
  }

  /**
   * Cerrar sesión de plataforma. Llamar al salir de la página.
   */
  async function endPlatformSession() {
    if (!_platformSessionId) return;
    await _update('zykos_platform_sessions', _platformSessionId, {
      ended_at: new Date().toISOString(),
      duration_ms: Math.round(performance.now()),
      games_played: _gamesPlayedCount,
    });
  }

  // ---- ALERTS ----
  async function _createAlert(type, severity, message, data) {
    await _insert('zykos_clinical_alerts', {
      patient_id: _patientId,
      alert_type: type,
      severity: severity,
      message: message,
      data: data || {},
      game_session_id: _gameSessionId,
    });
    console.log(`[TELEM] Alert: ${severity} — ${message}`);
  }

  // ---- BEFOREUNLOAD ----
  // Detectar cierre abrupto vs. salida controlada
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      // Intento best-effort de cerrar la sesión
      if (_platformSessionId && navigator.sendBeacon) {
        const sb = _getSb();
        if (sb) {
          const body = JSON.stringify({
            ended_at: new Date().toISOString(),
            duration_ms: Math.round(performance.now()),
            games_played: _gamesPlayedCount,
          });
          // sendBeacon no permite PATCH, así que logueamos el cierre como evento
          navigator.sendBeacon(
            `${SUPABASE_URL}/rest/v1/zykos_platform_sessions?id=eq.${_platformSessionId}`,
            body
          );
        }
      }
    });
  }

  // ---- PUBLIC ----
  return {
    init,
    startGameSession,
    endGameSession,
    sendMouseTelemetry,
    sendKitLog,
    sendClassifyMoves,
    endPlatformSession,
    // Getters
    get patientId() { return _patientId; },
    get platformSessionId() { return _platformSessionId; },
    get gameSessionId() { return _gameSessionId; },
  };
})();

// Export para módulos si se usa con import
if (typeof module !== 'undefined') module.exports = TELEM;
