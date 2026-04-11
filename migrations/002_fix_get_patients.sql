-- ============================================================
-- FIX: zykos_get_patients — column full_name does not exist in zykos_users
-- CAUSA: La funcion original referenciaba full_name de zykos_users,
--        pero esa columna solo existe en zykos_patients.
-- SOLUCION: Consultar zykos_patients en vez de zykos_users para la lista.
-- EJECUTAR EN: Supabase SQL Editor (proyecto aypljitzifwjosjkqsuu)
-- ============================================================

CREATE OR REPLACE FUNCTION zykos_get_patients(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_patients JSONB;
BEGIN
  -- Validar sesion
  SELECT u.id, u.dni, u.email, u.display_name, u.role
    INTO v_user
    FROM zykos_sessions s
    JOIN zykos_users u ON u.id = s.user_id
   WHERE s.session_token = p_token
     AND s.is_active = true
     AND s.expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'session_invalid');
  END IF;

  -- Obtener pacientes segun rol
  IF v_user.role IN ('superadmin', 'admin') THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'dni', p.dni,
        'display_name', COALESCE(p.full_name, p.dni::TEXT)
      ) ORDER BY p.dni
    ), '[]'::jsonb)
    INTO v_patients
    FROM zykos_patients p
    WHERE p.status IS DISTINCT FROM 'inactive';
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'dni', p.dni,
        'display_name', COALESCE(p.full_name, p.dni::TEXT)
      )
    ), '[]'::jsonb)
    INTO v_patients
    FROM zykos_patients p
    WHERE p.dni = v_user.dni;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_user.role,
    'patients', v_patients
  );
END;
$$;

-- Permisos para que anon key pueda ejecutar
GRANT EXECUTE ON FUNCTION zykos_get_patients(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION zykos_get_patients(TEXT) TO authenticated;
