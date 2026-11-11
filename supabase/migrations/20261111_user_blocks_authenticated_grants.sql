-- ROOMS M7.73
-- Privilegios comprobados en Supabase QA.
-- Las politicas RLS limitan el acceso al usuario que bloquea.
-- No conceder UPDATE ni escritura a anon.

BEGIN;

GRANT INSERT, DELETE
ON TABLE public.user_blocks
TO authenticated;

COMMIT;
