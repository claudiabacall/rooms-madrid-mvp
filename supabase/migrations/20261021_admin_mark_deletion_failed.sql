-- ROOMS M4: cierre controlado de auditorias fallidas.
-- Aplicado y verificado previamente en Supabase.
-- No elimina cuentas ni ejecuta la funcion.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rooms_admin_mark_deletion_failed(
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
  v_updated integer;
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  UPDATE public.account_deletion_audit a
  SET
    status = 'failed',
    finished_at = clock_timestamp()
  WHERE a.id = p_audit_id
    AND a.target_user_id = p_target_id
    AND a.claim_token = p_claim_token
    AND a.status = 'processing'
    AND a.finished_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 1 THEN
    RAISE EXCEPTION
      'Auditoria no reclamada por esta ejecucion';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_mark_deletion_failed(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_mark_deletion_failed(uuid,uuid,uuid)
TO service_role;

REVOKE UPDATE
ON TABLE public.account_deletion_audit
FROM service_role;

COMMIT;
