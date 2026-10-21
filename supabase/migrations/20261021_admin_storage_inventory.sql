-- ROOMS M4: inventario integral de Storage previo a una baja.
-- Ya instalado y comprobado en Supabase SQL Editor.
-- Exclusivamente lectura.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rooms_admin_storage_inventory(p_target_id uuid)
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
AS $$
BEGIN
  IF p_target_id IS NULL THEN
    RAISE EXCEPTION 'UUID requerido';
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
ON FUNCTION public.rooms_admin_storage_inventory(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.rooms_admin_storage_inventory(uuid)
TO service_role;

COMMIT;
