-- ROOMS M4: evidencia previa de impacto compartido.
-- Aplicada previamente en Supabase SQL Editor.
-- No reclama auditorias ni elimina datos.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rooms_admin_attest_shared_impact(
    p_audit_id uuid,
    p_target_id uuid,
    p_claim_token uuid
  )
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_rel record;
  v_count integer := 0;
  v_profiles integer := 0;
  v_roles integer := 0;
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_audit a
    WHERE a.id = p_audit_id
      AND a.target_user_id = p_target_id
      AND a.claim_token = p_claim_token
      AND a.status = 'processing'
      AND a.finished_at IS NULL
      AND a.shared_impact_verified = false
  ) THEN
    RAISE EXCEPTION 'Reclamacion incompatible';
  END IF;

  FOR v_rel IN
    SELECT *
    FROM public.rooms_admin_user_fk_inventory(
      p_target_id
    )
  LOOP
    v_count := v_count + 1;

    IF v_rel.tabla = 'profiles'
       AND v_rel.columna = 'id'
       AND v_rel.referencia = 'auth.users' THEN

      IF v_rel.registros <> 1 THEN
        RAISE EXCEPTION 'Perfil inesperado';
      END IF;

      v_profiles := v_profiles + 1;

    ELSIF v_rel.tabla = 'user_roles'
       AND v_rel.columna = 'user_id'
       AND v_rel.referencia = 'auth.users' THEN

      IF v_rel.registros <> 1 THEN
        RAISE EXCEPTION 'Rol inesperado';
      END IF;

      v_roles := v_roles + 1;

    ELSIF v_rel.registros <> 0 THEN

      RAISE EXCEPTION
        'Dependencia existente en %.%',
        v_rel.tabla,
        v_rel.columna;

    END IF;
  END LOOP;

  IF v_count < 35
     OR v_profiles <> 1
     OR v_roles <> 1 THEN
    RAISE EXCEPTION
      'Inventario incompleto o estructura inesperada';
  END IF;

  UPDATE public.account_deletion_audit a
  SET shared_impact_verified = true
  WHERE a.id = p_audit_id
    AND a.target_user_id = p_target_id
    AND a.claim_token = p_claim_token
    AND a.status = 'processing'
    AND a.finished_at IS NULL
    AND a.shared_impact_verified = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo registrar la evidencia';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_attest_shared_impact(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_attest_shared_impact(uuid,uuid,uuid)
TO service_role;

COMMIT;
