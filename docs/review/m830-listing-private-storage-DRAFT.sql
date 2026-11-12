-- ROOMS M8.30
-- BORRADOR DE REVISION. NO EJECUTAR EN PRODUCCION.
--
-- No aplicar hasta que:
-- 1. El frontend utilice URLs firmadas.
-- 2. Las referencias antiguas se hayan migrado.
-- 3. Las pruebas de autorizacion A/B/C pasen en QA.
-- 4. Se verifique que la migracion de datos es completa.
--
-- Una URL firmada continua accesible hasta su expiracion.
-- RLS controla su emision, no revoca instantaneamente
-- los enlaces ya emitidos.
--
-- Este SQL NO debe ejecutarse automaticamente desde
-- una migracion hasta completar esas condiciones.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'listing-images'
      AND public = true
  ) THEN
    RAISE EXCEPTION
      'ROOMS: estado del bucket inesperado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Ver imágenes de anuncios'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION
      'ROOMS: politica publica original ausente';
  END IF;
END
$$;

-- La privacidad del bucket y la RLS deben activarse
-- conjuntamente, no en dos despliegues independientes.

UPDATE storage.buckets
SET public = false
WHERE id = 'listing-images';

DROP POLICY "Ver imágenes de anuncios"
ON storage.objects;

CREATE POLICY "Ver imágenes privadas de anuncios"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'listing-images'

  AND cardinality(storage.foldername(name)) = 3

  AND EXISTS (
    SELECT 1
    FROM public.listings AS l
    WHERE l.id::text =
      (storage.foldername(storage.objects.name))[2]

      AND l.owner_id::text =
        (storage.foldername(storage.objects.name))[1]

      AND (
        l.owner_id = (SELECT auth.uid())

        OR (
          l.status = 'published'

          AND NOT public.users_are_blocked(
            (SELECT auth.uid()),
            l.owner_id
          )

          AND EXISTS (
            SELECT 1
            FROM unnest(
              COALESCE(l.photos, ARRAY[]::text[])
            ) AS photo(reference)
            WHERE
              photo.reference = storage.objects.name

              OR split_part(
                split_part(photo.reference, '?', 1),
                '/storage/v1/object/public/listing-images/',
                2
              ) = storage.objects.name
          )
        )
      )
  )
);

COMMIT;
