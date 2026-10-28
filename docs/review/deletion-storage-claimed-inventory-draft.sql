-- ROOMS M6.19G
-- BORRADOR LOCAL. NO EJECUTAR EN SUPABASE.
-- Inventario previo a Auth vinculado a claim activo.
-- No sustituye una barrera de concurrencia.

CREATE OR REPLACE FUNCTION
public.rooms_admin_storage_inventory_claimed(
  p_audit_id uuid,
  p_target_id uuid,
  p_claim_token uuid
)
RETURNS TABLE (
  archivos_encontrados bigint,
  por_owner bigint,
  por_owner_id bigint,
  por_ruta bigint,
  fuera_de_buckets_previstos bigint,
  buckets_afectados bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
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
      AND a.claimed_at IS NOT NULL
      AND a.finished_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'Reclamacion administrativa no vigente';
  END IF;

  -- La funcion existente vuelve a verificar que
  -- la cuenta es desechable y sigue en Auth.
  RETURN QUERY
  SELECT *
  FROM public.rooms_admin_storage_inventory(p_target_id);
END;
$function$;

REVOKE ALL ON FUNCTION
public.rooms_admin_storage_inventory_claimed(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rooms_admin_storage_inventory_claimed(uuid,uuid,uuid)
TO service_role;
