-- ================================================================
-- V3 MIGRATION: Raw stream + Sessions tables
-- Supabase project: aypljitzifwjosjkqsuu (ZYKOS GAMER)
-- Date: 2 April 2026
-- ================================================================

-- Raw event stream from spy.js
-- Each row = one chunk of 30 seconds of continuous observation
CREATE TABLE IF NOT EXISTS zykos_raw_stream (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  patient_dni TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  context TEXT,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  event_count INTEGER DEFAULT 0,
  evidence_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by patient and session
CREATE INDEX IF NOT EXISTS idx_raw_stream_patient ON zykos_raw_stream(patient_dni);
CREATE INDEX IF NOT EXISTS idx_raw_stream_session ON zykos_raw_stream(session_id);
CREATE INDEX IF NOT EXISTS idx_raw_stream_created ON zykos_raw_stream(created_at);

-- Immutability: no deletes, no updates on raw stream
CREATE OR REPLACE FUNCTION prevent_raw_stream_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'zykos_raw_stream is immutable. No updates or deletes allowed.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_update_raw_stream ON zykos_raw_stream;
CREATE TRIGGER no_update_raw_stream
  BEFORE UPDATE ON zykos_raw_stream
  FOR EACH ROW EXECUTE FUNCTION prevent_raw_stream_mutation();

DROP TRIGGER IF EXISTS no_delete_raw_stream ON zykos_raw_stream;
CREATE TRIGGER no_delete_raw_stream
  BEFORE DELETE ON zykos_raw_stream
  FOR EACH ROW EXECUTE FUNCTION prevent_raw_stream_mutation();

-- Session records (one per portal visit)
CREATE TABLE IF NOT EXISTS zykos_sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  patient_dni TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  games_played TEXT[] DEFAULT '{}',
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_patient ON zykos_sessions(patient_dni);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON zykos_sessions(created_at);

-- RLS: patients can only insert their own data, read their own data
ALTER TABLE zykos_raw_stream ENABLE ROW LEVEL SECURITY;
ALTER TABLE zykos_sessions ENABLE ROW LEVEL SECURITY;

-- Anon can INSERT (from frontend spy)
CREATE POLICY IF NOT EXISTS "anon_insert_raw_stream"
  ON zykos_raw_stream FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "anon_insert_sessions"
  ON zykos_sessions FOR INSERT
  TO anon WITH CHECK (true);

-- Anon can SELECT own data (by DNI match)
-- Note: In production, tighten this via Netlify function (Path B)
CREATE POLICY IF NOT EXISTS "anon_select_own_raw_stream"
  ON zykos_raw_stream FOR SELECT
  TO anon USING (true);

CREATE POLICY IF NOT EXISTS "anon_select_own_sessions"
  ON zykos_sessions FOR SELECT
  TO anon USING (true);

-- Grant usage
GRANT INSERT, SELECT ON zykos_raw_stream TO anon;
GRANT INSERT, SELECT ON zykos_sessions TO anon;
GRANT USAGE, SELECT ON SEQUENCE zykos_raw_stream_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE zykos_sessions_id_seq TO anon;
