-- ROOMS M4: verificacion posterior de Storage.
-- Instalada previamente mediante Supabase SQL Editor.
-- No borra archivos, usuarios ni actualiza auditorias.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rooms_admin_verify_deleted_storage(
    p_audit_id uuid,
    p_target_id uuid,
    p_claim_token uuid
  )
RETURNS TABLE (
  archivos_restantes bigint,
  por_owner bigint,
  por_owner_id bigint,
  por_ruta bigint,
  fuera_de_buckets_previstos bigint,
  buckets_afectados bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
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
      AND a.shared_impact_verified = true
  ) THEN
    RAISE EXCEPTION 'Ejecucion administrativa no autorizada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_target_id
  ) THEN
    RAISE EXCEPTION 'La cuenta sigue existiendo en Auth';
  END IF;

  RETURN QUERY
  SELECT
    count(*)::bigint,

    count(*) FILTER (
      WHERE o.owner = p_target_id
    )::bigint,

    count(*) FILTER (
      WHERE o.owner_id = p_target_id::text
    )::bigint,

    count(*) FILTER (
      WHERE o.name LIKE p_target_id::text || '/%'
    )::bigint,

    count(*) FILTER (
      WHERE o.bucket_id NOT IN (
        'avatars',
        'listing-images',
        'community-images',
        'community-post-media'
      )
    )::bigint,

    count(DISTINCT o.bucket_id)::bigint

  FROM storage.objects o
  WHERE
    o.owner = p_target_id
    OR o.owner_id = p_target_id::text
    OR o.name LIKE p_target_id::text || '/%';
END;
$$;

REVOKE ALL
ON FUNCTION
  public.rooms_admin_verify_deleted_storage(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION
  public.rooms_admin_verify_deleted_storage(uuid,uuid,uuid)
TO service_role;

COMMIT;
