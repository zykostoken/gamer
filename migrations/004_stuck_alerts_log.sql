-- ============================================================
-- ZYKOS GAMER: zykos_stuck_alerts_log
-- Tabla para registrar alertas enviadas por Edge Function zykos-stuck-alert
-- Articulo XIII de la Constitucion ZYKOS V4
-- ============================================================

CREATE TABLE IF NOT EXISTS zykos_stuck_alerts_log (
  id SERIAL PRIMARY KEY,
  patient_dni TEXT NOT NULL,
  game_slug TEXT NOT NULL,
  level INTEGER NOT NULL,
  consecutive_fails INTEGER NOT NULL,
  error_rates NUMERIC[] NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  smtp_result TEXT NOT NULL,
  email_message_id TEXT
);

-- Indices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_stuck_alerts_patient ON zykos_stuck_alerts_log(patient_dni);
CREATE INDEX IF NOT EXISTS idx_stuck_alerts_game ON zykos_stuck_alerts_log(game_slug);
CREATE INDEX IF NOT EXISTS idx_stuck_alerts_sent_at ON zykos_stuck_alerts_log(sent_at DESC);

-- Comentarios
COMMENT ON TABLE zykos_stuck_alerts_log IS 'Log de alertas de bloqueo enviadas por zykos-stuck-alert (Art XIII)';
COMMENT ON COLUMN zykos_stuck_alerts_log.patient_dni IS 'DNI del paciente que disparo la alerta';
COMMENT ON COLUMN zykos_stuck_alerts_log.game_slug IS 'Identificador del juego (reflejos, lawn-mower, etc)';
COMMENT ON COLUMN zykos_stuck_alerts_log.level IS 'Nivel en el que el paciente quedo bloqueado';
COMMENT ON COLUMN zykos_stuck_alerts_log.consecutive_fails IS 'Numero de intentos fallidos consecutivos';
COMMENT ON COLUMN zykos_stuck_alerts_log.error_rates IS 'Array de error rates de los intentos fallidos';
COMMENT ON COLUMN zykos_stuck_alerts_log.smtp_result IS 'Resultado del envio SMTP (success o error: mensaje)';
COMMENT ON COLUMN zykos_stuck_alerts_log.email_message_id IS 'Message-ID del email enviado (null si fallo)';

-- RLS: solo lectura para profesionales
ALTER TABLE zykos_stuck_alerts_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "professionals_read_stuck_alerts" 
  ON zykos_stuck_alerts_log 
  FOR SELECT 
  USING (true);

-- La Edge Function usa service_role key, no necesita policy de INSERT
