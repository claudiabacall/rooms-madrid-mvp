-- ROOMS M7.59
-- Permisos comprobados en Supabase QA mediante E2E.
-- Las politicas RLS existentes limitan las operaciones.
-- No concede permisos de escritura a anon.

BEGIN;

GRANT INSERT, UPDATE, DELETE
ON TABLE public.connections
TO authenticated;

COMMIT;
