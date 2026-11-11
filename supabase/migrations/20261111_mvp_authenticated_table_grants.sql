-- ROOMS M7.35
-- Permisos detectados mediante pruebas E2E en Supabase QA.
-- Mantener activas las politicas RLS existentes.
-- No concede acceso de escritura al rol anon.

BEGIN;

-- Carga de miembros de hogares.
-- RLS restringe la visibilidad segun sus politicas.
GRANT SELECT
ON TABLE public.household_members
TO authenticated;

-- Edicion de anuncios propios.
-- RLS exige owner_id = auth.uid().
GRANT UPDATE
ON TABLE public.listings
TO authenticated;

-- Eliminacion de elementos guardados propios.
-- RLS exige user_id = auth.uid().
GRANT DELETE
ON TABLE public.saved_items
TO authenticated;

COMMIT;
