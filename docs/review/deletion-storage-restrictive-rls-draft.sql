-- ROOMS M6.19C
-- PROTOTIPO LOCAL. NO EJECUTAR EN SUPABASE.
-- No sustituye triggers ni proteccion de concurrencia.
-- No garantiza bloqueo de service_role ni Storage API.
-- Requiere revisar las politicas efectivas antes de aplicar.

CREATE OR REPLACE FUNCTION
public.rooms_storage_write_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.account_deletion_audit a
       WHERE a.target_user_id = auth.uid()
         AND a.status IN ('started', 'processing', 'failed')
     );
$function$;

REVOKE ALL ON FUNCTION
public.rooms_storage_write_allowed()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
public.rooms_storage_write_allowed()
TO authenticated;

-- Las politicas RESTRICTIVE se combinan mediante AND
-- con las politicas permisivas preexistentes.

CREATE POLICY rooms_deletion_storage_insert_guard
ON storage.objects
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.rooms_storage_write_allowed());

CREATE POLICY rooms_deletion_storage_update_guard
ON storage.objects
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.rooms_storage_write_allowed())
WITH CHECK (public.rooms_storage_write_allowed());

CREATE POLICY rooms_deletion_storage_delete_guard
ON storage.objects
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.rooms_storage_write_allowed());
