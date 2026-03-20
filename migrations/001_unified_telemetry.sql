-- ============================================================
-- HDD GAMING: UNIFIED TELEMETRY SCHEMA
-- Supabase project: buzblnkpfydeheingzgn
-- Todas las métricas de todos los juegos convergen acá
-- ============================================================

-- 1. SESIONES DE PLATAFORMA
-- Una fila cada vez que el paciente abre la plataforma de gaming
CREATE TABLE IF NOT EXISTS hdd_platform_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL,              -- ID del paciente HDD
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,                   -- duración total
  games_played INTEGER DEFAULT 0,        -- cantidad de juegos jugados en esta sesión
  login_hour SMALLINT,                   -- hora de conexión (0-23) para ritmo circadiano
  login_day_of_week SMALLINT,            -- 0=dom, 1=lun... para patrón semanal
  user_agent TEXT,                       -- browser/device
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SESIONES DE JUEGO INDIVIDUALES
-- Una fila por cada partida (1 pack + 1 modo + 1 nivel = 1 sesión)
CREATE TABLE IF NOT EXISTS hdd_game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_session_id UUID REFERENCES hdd_platform_sessions(id),
  patient_id TEXT NOT NULL,
  -- Qué jugó
  frame TEXT NOT NULL,                   -- 'classify-and-place', 'sequence-builder', etc.
  pack_id TEXT NOT NULL,                 -- 'ferreteria', 'almacen-general', etc.
  mode TEXT NOT NULL,                    -- 'classify', 'kit', 'calc', 'sim'
  level INTEGER DEFAULT 1,
  -- Resultados
  score INTEGER DEFAULT 0,
  correct INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  accuracy_pct REAL,                     -- correct / (correct+errors) * 100
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  completed BOOLEAN DEFAULT false,       -- terminó o abandonó
  abandonment_point_pct REAL,            -- si abandonó, en qué % estaba
  -- Classify-specific
  perseverations INTEGER,                -- errores perseverativos (mismo estante equivocado 2+ veces)
  avg_reaction_time_ms INTEGER,          -- RT promedio por colocación
  -- Kit-specific
  kit_scenario TEXT,                     -- 'asado', 'mudanza', etc.
  kit_budget INTEGER,
  kit_spent INTEGER,
  kit_budget_exceeded BOOLEAN DEFAULT false,
  kit_budget_exceeded_at_ms INTEGER,     -- cuándo se pasó del presupuesto
  kit_items_added INTEGER DEFAULT 0,
  kit_items_removed INTEGER DEFAULT 0,   -- autocorrecciones
  kit_first_action_ms INTEGER,           -- latencia hasta primer item
  kit_avg_deliberation_ms INTEGER,       -- promedio entre acciones
  kit_deliberation_pauses INTEGER,       -- pausas >5s
  kit_categories_covered INTEGER,
  -- Calc-specific
  calc_problems_attempted INTEGER,
  calc_problems_correct INTEGER,
  -- Similarity-specific
  sim_pairs_viewed INTEGER,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TELEMETRÍA DE MOUSE — UNA FILA POR SESIÓN DE JUEGO
-- Resumen comprimido, no los puntos crudos
CREATE TABLE IF NOT EXISTS hdd_mouse_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id UUID NOT NULL REFERENCES hdd_game_sessions(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  -- Métricas core
  total_points INTEGER,                  -- muestras capturadas
  total_distance_px REAL,                -- distancia total recorrida
  avg_velocity_px_s REAL,                -- velocidad promedio (px/s)
  velocity_variance REAL,                -- varianza de velocidad
  pauses_gt_2s INTEGER,                  -- pausas >2 segundos
  direction_changes INTEGER,             -- cambios bruscos >90°
  path_efficiency_pct REAL,              -- ratio recta/real (%)
  idle_ratio_pct REAL,                   -- % tiempo inactivo
  -- Scroll
  scroll_events INTEGER,
  max_scroll_depth_px INTEGER,
  -- Derivadas clínicas
  psychomotor_speed_class TEXT,          -- 'very_slow', 'slow', 'normal', 'fast', 'very_fast'
  motor_consistency_class TEXT,          -- 'uniform', 'normal', 'variable', 'erratic'
  fatigue_indicator TEXT,                -- 'none', 'mild', 'moderate', 'severe'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. LOG DE ACCIONES EN KIT ABIERTO
-- Cada add/remove timestampeado — la data cruda del kit
CREATE TABLE IF NOT EXISTS hdd_kit_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id UUID NOT NULL REFERENCES hdd_game_sessions(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  action TEXT NOT NULL,                  -- 'add' | 'remove'
  item_id TEXT NOT NULL,
  item_name TEXT,
  item_category TEXT,
  item_price INTEGER,
  cumulative_spent INTEGER,              -- total gastado al momento de esta acción
  elapsed_ms INTEGER,                    -- ms desde inicio de la sesión
  since_last_action_ms INTEGER,          -- ms desde la acción anterior
  action_order INTEGER,                  -- número de acción secuencial
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. MOVIMIENTOS EN CLASSIFY (errores y aciertos)
-- Cada drag-and-drop registrado
CREATE TABLE IF NOT EXISTS hdd_classify_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id UUID NOT NULL REFERENCES hdd_game_sessions(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT,
  target_category TEXT NOT NULL,         -- donde lo puso
  correct_category TEXT NOT NULL,        -- donde debía ir
  is_correct BOOLEAN NOT NULL,
  reaction_time_ms INTEGER,              -- ms desde la última colocación
  elapsed_ms INTEGER,                    -- ms desde inicio
  move_order INTEGER,                    -- número de movimiento secuencial
  had_similarity_note BOOLEAN DEFAULT false, -- era un item confusable
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. PERFIL ACUMULADO DEL PACIENTE
-- Se recalcula periódicamente con los datos de todas las sesiones
CREATE TABLE IF NOT EXISTS hdd_patient_gaming_profile (
  patient_id TEXT PRIMARY KEY,
  -- Engagement
  total_sessions INTEGER DEFAULT 0,
  total_play_time_ms BIGINT DEFAULT 0,
  avg_session_duration_ms INTEGER,
  consecutive_days_current INTEGER DEFAULT 0,
  consecutive_days_max INTEGER DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  most_played_pack TEXT,
  most_avoided_pack TEXT,                -- pack con menos sesiones relativas
  -- Rendimiento global
  overall_accuracy_pct REAL,
  classify_accuracy_pct REAL,
  kit_budget_compliance_pct REAL,        -- promedio de (spent/budget) en kits
  calc_accuracy_pct REAL,
  -- Mouse fenotipo
  avg_mouse_velocity REAL,
  avg_velocity_variance REAL,
  avg_pause_count REAL,
  avg_path_efficiency REAL,
  avg_idle_ratio REAL,
  -- Trayectoria (tendencias)
  accuracy_trend TEXT,                   -- 'improving', 'stable', 'declining'
  speed_trend TEXT,                      -- 'faster', 'stable', 'slower'
  engagement_trend TEXT,                 -- 'increasing', 'stable', 'decreasing'
  -- Kit fenotipo
  avg_kit_first_action_ms INTEGER,
  avg_kit_deliberation_ms INTEGER,
  avg_kit_removals REAL,
  -- Nivel actual por juego
  current_levels JSONB DEFAULT '{}',     -- {"ferreteria": 3, "almacen": 2, ...}
  -- Alertas activas
  active_alerts JSONB DEFAULT '[]',
  -- Timestamps
  profile_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ALERTAS CLÍNICAS AUTOMÁTICAS
CREATE TABLE IF NOT EXISTS hdd_clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,              -- 'night_login', 'accuracy_drop', 'level_regression', 'absence', 'budget_pattern', 'motor_change'
  severity TEXT NOT NULL,                -- 'info', 'low', 'medium', 'high'
  message TEXT NOT NULL,
  data JSONB,                            -- datos contextuales de la alerta
  game_session_id UUID REFERENCES hdd_game_sessions(id),
  acknowledged BOOLEAN DEFAULT false,    -- el profesional la vio
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_platform_sessions_patient ON hdd_platform_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_time ON hdd_platform_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_patient ON hdd_game_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_time ON hdd_game_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_pack ON hdd_game_sessions(pack_id);
CREATE INDEX IF NOT EXISTS idx_mouse_session ON hdd_mouse_telemetry(game_session_id);
CREATE INDEX IF NOT EXISTS idx_mouse_patient ON hdd_mouse_telemetry(patient_id);
CREATE INDEX IF NOT EXISTS idx_kit_log_session ON hdd_kit_action_log(game_session_id);
CREATE INDEX IF NOT EXISTS idx_classify_moves_session ON hdd_classify_moves(game_session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON hdd_clinical_alerts(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unacked ON hdd_clinical_alerts(acknowledged, severity) WHERE NOT acknowledged;

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE hdd_platform_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hdd_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hdd_mouse_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE hdd_kit_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hdd_classify_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE hdd_patient_gaming_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE hdd_clinical_alerts ENABLE ROW LEVEL SECURITY;

-- Pacientes pueden insertar sus propios datos
CREATE POLICY IF NOT EXISTS "patients_insert_own" ON hdd_game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "patients_insert_own" ON hdd_mouse_telemetry FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "patients_insert_own" ON hdd_kit_action_log FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "patients_insert_own" ON hdd_classify_moves FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "patients_insert_own" ON hdd_platform_sessions FOR INSERT WITH CHECK (true);

-- Profesionales pueden leer todo
CREATE POLICY IF NOT EXISTS "professionals_read_all" ON hdd_game_sessions FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "professionals_read_all" ON hdd_mouse_telemetry FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "professionals_read_all" ON hdd_kit_action_log FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "professionals_read_all" ON hdd_classify_moves FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "professionals_read_all" ON hdd_platform_sessions FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "professionals_read_all" ON hdd_patient_gaming_profile FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "professionals_read_all" ON hdd_clinical_alerts FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "professionals_update_alerts" ON hdd_clinical_alerts FOR UPDATE USING (true);
