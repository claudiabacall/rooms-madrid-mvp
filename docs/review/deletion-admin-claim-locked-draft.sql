-- ROOMS M6.17R
-- BORRADOR PARA PRUEBAS. NO EJECUTAR EN SUPABASE.
-- Basado en el claim administrativo original.
-- Unico cambio funcional: advisory lock previo al UPDATE.
-- NO habilita Auth, Storage ni limpieza destructiva.
-- NO constituye una barrera integral.

CREATE OR REPLACE FUNCTION
  public.rooms_admin_claim_disposable_deletion(
    p_audit_id uuid,
    p_target_id uuid
  )
RETURNS TABLE (
  audit_id uuid,
  execution_token uuid,
  claimed_timestamp timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_audit_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_target_id
      AND u.raw_user_meta_data
        ->> 'rooms_deletion_test' = 'true'
      AND u.email ~
        '^rooms-delete-qa-[a-z0-9]+@example\.com$'
  ) THEN
    RAISE EXCEPTION 'Cuenta desechable no verificada';
  END IF;

  -- Coordinar con los triggers de escrituras.
  -- El bloqueo permanece hasta el fin de la transaccion.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_target_id::text, 0)
  );

  RETURN QUERY
  UPDATE public.account_deletion_audit a
  SET
    status = 'processing',
    claim_token = gen_random_uuid(),
    claimed_at = clock_timestamp()
  WHERE a.id = p_audit_id
    AND a.target_user_id = p_target_id
    AND a.status = 'started'
    AND a.finished_at IS NULL
    AND a.claim_token IS NULL
    AND a.storage_verified = false
    AND a.auth_verified = false
    AND a.database_verified = false
    AND a.shared_impact_verified = false
  RETURNING
    a.id,
    a.claim_token,
    a.claimed_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Auditoria ya reclamada o estado incompatible';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_claim_disposable_deletion(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_claim_disposable_deletion(uuid, uuid)
TO service_role;
