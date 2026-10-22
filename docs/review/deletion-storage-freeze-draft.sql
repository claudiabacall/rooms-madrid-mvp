-- ROOMS M5 · BORRADOR DE REVISION
-- NO EJECUTAR EN SUPABASE.
--
-- Requiere pruebas de permisos, concurrencia y
-- compatibilidad con la API oficial de Storage.
-- No protege solicitudes ya iniciadas ni escrituras
-- efectuadas por service_role u otros roles privilegiados.
--
-- Solo protege operaciones autenticadas sometidas a RLS.
-- No reemplaza la coordinacion con el claim administrativo.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rooms_storage_write_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
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

-- Bucket: avatars

CREATE POLICY rooms_deletion_freeze_avatars_insert
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id <> 'avatars'
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_freeze_avatars_update
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  bucket_id <> 'avatars'
  OR public.rooms_storage_write_allowed()
)
WITH CHECK (
  bucket_id <> 'avatars'
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_freeze_avatars_delete
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  bucket_id <> 'avatars'
  OR public.rooms_storage_write_allowed()
);

-- Bucket: listing-images

CREATE POLICY rooms_deletion_freeze_listing_images_insert
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id <> 'listing-images'
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_freeze_listing_images_update
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  bucket_id <> 'listing-images'
  OR public.rooms_storage_write_allowed()
)
WITH CHECK (
  bucket_id <> 'listing-images'
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_freeze_listing_images_delete
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  bucket_id <> 'listing-images'
  OR public.rooms_storage_write_allowed()
);

-- Bucket: community-images

CREATE POLICY rooms_deletion_freeze_community_images_insert
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id <> 'community-images'
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_freeze_community_images_update
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  bucket_id <> 'community-images'
  OR public.rooms_storage_write_allowed()
)
WITH CHECK (
  bucket_id <> 'community-images'
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_freeze_community_images_delete
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  bucket_id <> 'community-images'
  OR public.rooms_storage_write_allowed()
);

-- Bucket: community-post-media

CREATE POLICY rooms_deletion_freeze_community_post_media_insert
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id <> 'community-post-media'
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_freeze_community_post_media_update
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  bucket_id <> 'community-post-media'
  OR public.rooms_storage_write_allowed()
)
WITH CHECK (
  bucket_id <> 'community-post-media'
  OR public.rooms_storage_write_allowed()
);

CREATE POLICY rooms_deletion_freeze_community_post_media_delete
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  bucket_id <> 'community-post-media'
  OR public.rooms_storage_write_allowed()
);

COMMIT;

-- PENDIENTE ANTES DE APLICAR:
-- 1. Confirmar permisos y politicas vigentes de Storage.
-- 2. Comprobar cargas normales con cuentas QA.
-- 3. Probar rechazo de escritura durante processing.
-- 4. Probar solicitudes Storage ya iniciadas.
-- 5. Coordinar bloqueo con claim administrativo.
-- 6. Revisar rutas privilegiadas y recuperacion.
-- 7. Verificar que la limpieza administrativa sigue operativa.
-- 8. Revisar el efecto de bloquear desde started.
