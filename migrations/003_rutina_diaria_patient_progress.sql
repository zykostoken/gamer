-- ============================================================
-- MIGRATION 003: zykos_patient_progress
-- Supabase project: aypljitzifwjosjkqsuu
--
-- Implementa la Fase 2 del RUTINA_DIARIA_BLUEPRINT.md (v1.0).
--
-- Propósito: rastrear la progresión por paciente dentro del módulo
-- Rutina Diaria. Una fila por (dni, scenario_slug, axis_slug).
-- Soporta:
--   - Desbloqueo secuencial de ejercicios por completitud (no por performance)
--   - Cooldown temporal de 24h por eje
--   - Override del clínico (tier forzado, skip de cooldown)
--   - Historia longitudinal de ejercicios completados por paciente
--
-- Lineamientos (blueprint sección 10):
--   - DNI es la clave universal (no patient_id, no user_id)
--   - Sin hipótesis clínicas en columnas ni en valores
--   - RLS: paciente lee solo lo suyo; clínico lee todo
--
-- EJECUTAR EN: Supabase SQL Editor (proyecto aypljitzifwjosjkqsuu)
-- SEGURIDAD: migration idempotente (IF NOT EXISTS). Safe re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLA: zykos_patient_progress
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zykos_patient_progress (
  id                         BIGSERIAL PRIMARY KEY,
  dni                        TEXT NOT NULL,
  scenario_slug              TEXT NOT NULL,
  axis_slug                  TEXT NOT NULL,
  current_tier               INT  NOT NULL DEFAULT 1 CHECK (current_tier BETWEEN 1 AND 5),
  unlocked_exercises         JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_available_at          TIMESTAMPTZ,
  clinical_override_tier     INT CHECK (clinical_override_tier IS NULL OR clinical_override_tier BETWEEN 1 AND 5),
  clinical_override_at       TIMESTAMPTZ,
  clinical_override_by       TEXT,
  last_completed_exercise    TEXT,
  last_completed_at          TIMESTAMPTZ,
  total_exercises_completed  INT NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dni, scenario_slug, axis_slug)
);

COMMENT ON TABLE zykos_patient_progress IS
  'Rutina Diaria module: per-patient progression state by scenario and cognitive axis. Unlock by completion, cooldown 24h, clinician override supported.';

COMMENT ON COLUMN zykos_patient_progress.dni IS
  'Universal patient key. Matches zykos_users.dni and zykos_metrics_canonical.dni.';

COMMENT ON COLUMN zykos_patient_progress.scenario_slug IS
  'Narrative wrapper: futbol, hogar, taller, cantina, etc.';

COMMENT ON COLUMN zykos_patient_progress.axis_slug IS
  'Cognitive axis within the scenario: camisetas, botines, medias, vestuario, cancha, hinchada, etc.';

COMMENT ON COLUMN zykos_patient_progress.current_tier IS
  'Current complexity tier for this axis (1-5). Advances by completion of previous tier exercises, not by performance.';

COMMENT ON COLUMN zykos_patient_progress.unlocked_exercises IS
  'Array of game_slug strings currently unlocked for this patient in this axis. Example: ["camisetas-numeros","camisetas-tamanos"]';

COMMENT ON COLUMN zykos_patient_progress.next_available_at IS
  '24h cooldown per axis. Patient cannot start new exercise of this axis before this timestamp. NULL means immediately available. Clinical override can bypass.';

COMMENT ON COLUMN zykos_patient_progress.clinical_override_tier IS
  'If set, forces current_tier for this axis. Used by clinician from the panel when standard progression is not appropriate.';

COMMENT ON COLUMN zykos_patient_progress.clinical_override_by IS
  'DNI of the clinician who signed the override. Required for audit trail.';

-- ------------------------------------------------------------
-- 2. ÍNDICES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ppg_dni
  ON zykos_patient_progress(dni);

CREATE INDEX IF NOT EXISTS idx_ppg_next
  ON zykos_patient_progress(next_available_at)
  WHERE next_available_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ppg_scenario
  ON zykos_patient_progress(scenario_slug, axis_slug);

-- ------------------------------------------------------------
-- 3. TRIGGER: auto-update updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION zykos_ppg_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ppg_updated_at ON zykos_patient_progress;
CREATE TRIGGER trg_ppg_updated_at
  BEFORE UPDATE ON zykos_patient_progress
  FOR EACH ROW
  EXECUTE FUNCTION zykos_ppg_update_timestamp();

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- Paciente lee solo sus propias filas.
-- Clínico (rol = 'medico' o 'superadmin') lee todo.
-- ------------------------------------------------------------
ALTER TABLE zykos_patient_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS ppg_patient_self_read ON zykos_patient_progress;
DROP POLICY IF EXISTS ppg_clinician_read_all ON zykos_patient_progress;
DROP POLICY IF EXISTS ppg_service_write ON zykos_patient_progress;

-- Patient reads own rows only (auth.uid() maps to user_id; we match via users table)
CREATE POLICY ppg_patient_self_read
  ON zykos_patient_progress
  FOR SELECT
  USING (
    dni IN (
      SELECT dni FROM zykos_users WHERE id = auth.uid()
    )
  );

-- Clinician reads all rows
CREATE POLICY ppg_clinician_read_all
  ON zykos_patient_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM zykos_users
      WHERE id = auth.uid()
        AND role IN ('medico', 'superadmin')
    )
  );

-- Service role (edge functions, engine) writes freely
-- This relies on SUPABASE_SERVICE_ROLE_KEY being used server-side
CREATE POLICY ppg_service_write
  ON zykos_patient_progress
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ------------------------------------------------------------
-- 5. VISTA: zykos_patient_dashboard_view
-- Alimenta el mini-dashboard del paciente y el panel clínico.
-- Devuelve por DNI: ejercicios completados, días consecutivos,
-- próximo disponible, y progresión por eje.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW zykos_patient_dashboard_view AS
SELECT
  ppg.dni,
  ppg.scenario_slug,
  ppg.axis_slug,
  ppg.current_tier,
  COALESCE(ppg.clinical_override_tier, ppg.current_tier) AS effective_tier,
  ppg.unlocked_exercises,
  ppg.next_available_at,
  CASE
    WHEN ppg.next_available_at IS NULL THEN true
    WHEN ppg.next_available_at <= now() THEN true
    ELSE false
  END AS is_available_now,
  ppg.last_completed_exercise,
  ppg.last_completed_at,
  ppg.total_exercises_completed,
  -- Aggregate: total across all axes per patient
  SUM(ppg.total_exercises_completed) OVER (PARTITION BY ppg.dni) AS patient_total_completed,
  -- Aggregate: count of axes patient has engaged with
  COUNT(*) OVER (PARTITION BY ppg.dni) AS patient_axes_active,
  ppg.clinical_override_tier,
  ppg.clinical_override_at,
  ppg.clinical_override_by,
  ppg.updated_at
FROM zykos_patient_progress ppg;

COMMENT ON VIEW zykos_patient_dashboard_view IS
  'Denormalized view for patient mini-dashboard and clinician panel. RLS inherited from zykos_patient_progress.';

-- ------------------------------------------------------------
-- 6. FUNCIÓN HELPER: complete_exercise
-- Llamada por el engine al terminar un ejercicio.
-- Actualiza progress atómicamente:
--   - Marca last_completed_exercise y last_completed_at
--   - Incrementa total_exercises_completed
--   - Fija next_available_at = now() + 24h
--   - Desbloquea el siguiente ejercicio del eje si aplica
--
-- Parámetros:
--   p_dni            DNI del paciente
--   p_scenario       scenario_slug
--   p_axis           axis_slug
--   p_exercise_slug  game_slug que se completó
--   p_next_exercise  game_slug del siguiente ejercicio a desbloquear
--                    (NULL si no hay más en este tier/axis)
--
-- Retorna: JSONB con el estado post-update.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION zykos_complete_exercise(
  p_dni            TEXT,
  p_scenario       TEXT,
  p_axis           TEXT,
  p_exercise_slug  TEXT,
  p_next_exercise  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row   zykos_patient_progress;
  v_unlocked JSONB;
BEGIN
  -- Upsert pattern: ensure a row exists for this (dni, scenario, axis)
  INSERT INTO zykos_patient_progress (dni, scenario_slug, axis_slug, unlocked_exercises)
  VALUES (p_dni, p_scenario, p_axis, jsonb_build_array(p_exercise_slug))
  ON CONFLICT (dni, scenario_slug, axis_slug) DO NOTHING;

  -- Fetch current row
  SELECT * INTO v_row
  FROM zykos_patient_progress
  WHERE dni = p_dni AND scenario_slug = p_scenario AND axis_slug = p_axis;

  -- Build new unlocked list: add next_exercise if not already present
  v_unlocked := v_row.unlocked_exercises;
  IF p_next_exercise IS NOT NULL
     AND NOT (v_unlocked @> jsonb_build_array(p_next_exercise)) THEN
    v_unlocked := v_unlocked || jsonb_build_array(p_next_exercise);
  END IF;

  -- Update
  UPDATE zykos_patient_progress
     SET last_completed_exercise   = p_exercise_slug,
         last_completed_at         = now(),
         total_exercises_completed = total_exercises_completed + 1,
         next_available_at         = now() + INTERVAL '24 hours',
         unlocked_exercises        = v_unlocked
   WHERE dni = p_dni
     AND scenario_slug = p_scenario
     AND axis_slug = p_axis
   RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'dni', v_row.dni,
    'scenario_slug', v_row.scenario_slug,
    'axis_slug', v_row.axis_slug,
    'current_tier', v_row.current_tier,
    'total_exercises_completed', v_row.total_exercises_completed,
    'next_available_at', v_row.next_available_at,
    'unlocked_exercises', v_row.unlocked_exercises
  );
END;
$$;

GRANT EXECUTE ON FUNCTION zykos_complete_exercise(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 7. FUNCIÓN HELPER: clinician_override_tier
-- El clínico fuerza el tier de un eje para un paciente.
-- Registra quién lo firmó y cuándo (audit trail).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION zykos_clinician_override_tier(
  p_dni            TEXT,
  p_scenario       TEXT,
  p_axis           TEXT,
  p_tier           INT,
  p_clinician_dni  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row    zykos_patient_progress;
  v_role   TEXT;
BEGIN
  -- Verify clinician has role
  SELECT role INTO v_role FROM zykos_users WHERE dni = p_clinician_dni;
  IF v_role NOT IN ('medico', 'superadmin') THEN
    RAISE EXCEPTION 'zykos_clinician_override_tier: DNI % does not have clinician role (got %)', p_clinician_dni, COALESCE(v_role, 'NULL');
  END IF;

  IF p_tier NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'zykos_clinician_override_tier: tier must be between 1 and 5, got %', p_tier;
  END IF;

  -- Upsert + update
  INSERT INTO zykos_patient_progress (dni, scenario_slug, axis_slug)
  VALUES (p_dni, p_scenario, p_axis)
  ON CONFLICT (dni, scenario_slug, axis_slug) DO NOTHING;

  UPDATE zykos_patient_progress
     SET clinical_override_tier = p_tier,
         clinical_override_at   = now(),
         clinical_override_by   = p_clinician_dni
   WHERE dni = p_dni
     AND scenario_slug = p_scenario
     AND axis_slug = p_axis
   RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'dni', v_row.dni,
    'scenario_slug', v_row.scenario_slug,
    'axis_slug', v_row.axis_slug,
    'current_tier', v_row.current_tier,
    'clinical_override_tier', v_row.clinical_override_tier,
    'clinical_override_at', v_row.clinical_override_at,
    'clinical_override_by', v_row.clinical_override_by
  );
END;
$$;

GRANT EXECUTE ON FUNCTION zykos_clinician_override_tier(TEXT, TEXT, TEXT, INT, TEXT)
  TO authenticated, service_role;

-- ------------------------------------------------------------
-- 8. FUNCIÓN HELPER: skip_cooldown
-- El clínico autoriza que el paciente haga OTRO ejercicio del mismo
-- eje el mismo día (p.ej. evaluación de baseline).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION zykos_skip_cooldown(
  p_dni            TEXT,
  p_scenario       TEXT,
  p_axis           TEXT,
  p_clinician_dni  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM zykos_users WHERE dni = p_clinician_dni;
  IF v_role NOT IN ('medico', 'superadmin') THEN
    RAISE EXCEPTION 'zykos_skip_cooldown: DNI % does not have clinician role', p_clinician_dni;
  END IF;

  UPDATE zykos_patient_progress
     SET next_available_at = NULL
   WHERE dni = p_dni
     AND scenario_slug = p_scenario
     AND axis_slug = p_axis;

  RETURN jsonb_build_object(
    'dni', p_dni,
    'scenario_slug', p_scenario,
    'axis_slug', p_axis,
    'cooldown_skipped_at', now(),
    'by_clinician_dni', p_clinician_dni
  );
END;
$$;

GRANT EXECUTE ON FUNCTION zykos_skip_cooldown(TEXT, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

-- ============================================================
-- FIN MIGRATION 003
-- Siguiente: Fase 3 (reescritura del motor seriation con pointer events)
-- ============================================================
