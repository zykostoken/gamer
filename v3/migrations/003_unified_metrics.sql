CREATE TABLE IF NOT EXISTS zykos_metrics (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  patient_dni TEXT NOT NULL,
  source VARCHAR(20) NOT NULL,
  context TEXT,
  metric_name VARCHAR(80) NOT NULL,
  metric_value NUMERIC,
  metric_data JSONB,
  t_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_zm_patient ON zykos_metrics(patient_dni);
CREATE INDEX IF NOT EXISTS idx_zm_session ON zykos_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_zm_name ON zykos_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_zm_source ON zykos_metrics(source);
CREATE INDEX IF NOT EXISTS idx_zm_ptm ON zykos_metrics(patient_dni, metric_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zm_ssn ON zykos_metrics(session_id, source, metric_name);
ALTER TABLE zykos_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zm_anon_insert" ON zykos_metrics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "zm_anon_select" ON zykos_metrics FOR SELECT TO anon USING (true);
GRANT INSERT, SELECT ON zykos_metrics TO anon;
GRANT USAGE, SELECT ON SEQUENCE zykos_metrics_id_seq TO anon;
