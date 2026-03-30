-- Auto-fill patient_dni↔patient_id on INSERT to game_metrics and mood_entries
-- Ensures BOTH identifiers are always populated regardless of which one the code sends
-- Eliminates the "null patient_dni" or "null patient_id" data quality issue permanently

CREATE OR REPLACE FUNCTION auto_fill_patient_identifiers()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.patient_id IS NOT NULL AND (NEW.patient_dni IS NULL OR NEW.patient_dni = '') THEN
    SELECT dni INTO NEW.patient_dni FROM hdd_patients WHERE id = NEW.patient_id;
  END IF;
  IF NEW.patient_dni IS NOT NULL AND NEW.patient_dni != '' AND NEW.patient_id IS NULL THEN
    SELECT id INTO NEW.patient_id FROM hdd_patients WHERE dni = NEW.patient_dni;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_fill_patient_ids_metrics ON hdd_game_metrics;
CREATE TRIGGER trg_auto_fill_patient_ids_metrics
  BEFORE INSERT ON hdd_game_metrics FOR EACH ROW
  EXECUTE FUNCTION auto_fill_patient_identifiers();

DROP TRIGGER IF EXISTS trg_auto_fill_patient_ids_mood ON hdd_mood_entries;
CREATE TRIGGER trg_auto_fill_patient_ids_mood
  BEFORE INSERT ON hdd_mood_entries FOR EACH ROW
  EXECUTE FUNCTION auto_fill_patient_identifiers();
