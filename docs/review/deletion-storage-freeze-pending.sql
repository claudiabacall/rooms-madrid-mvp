-- ROOMS M5 · BARRERA RLS DE STORAGE
-- PREPARADA PARA REVISION. NO APLICAR TODAVIA.
-- No resuelve escrituras en curso ni service_role.
-- Solo afecta a operaciones autenticadas bajo RLS.

BEGIN;

CREATE FUNCTION public.rooms_storage_write_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.account_deletion_audit a
      WHERE a.target_user_id = auth.uid()
        AND a.status IN ('started', 'processing')
    );
$$;

REVOKE ALL ON FUNCTION
  public.rooms_storage_write_allowed()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_storage_write_allowed()
TO authenticated;

CREATE POLICY rooms_deletion_storage_insert
ON storage.objects
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id NOT IN (
    'avatars',
    'listing-images',
    'community-images',
    'community-post-media'
  )
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_storage_update
ON storage.objects
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  bucket_id NOT IN (
    'avatars',
    'listing-images',
    'community-images',
    'community-post-media'
  )
  OR public.rooms_storage_write_allowed()
)
WITH CHECK (
  bucket_id NOT IN (
    'avatars',
    'listing-images',
    'community-images',
    'community-post-media'
  )
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_storage_delete
ON storage.objects
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (
  bucket_id NOT IN (
    'avatars',
    'listing-images',
    'community-images',
    'community-post-media'
  )
  OR public.rooms_storage_write_allowed()
);

COMMIT;
