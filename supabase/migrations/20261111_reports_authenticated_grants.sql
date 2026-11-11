-- ROOMS M7.93
-- Permisos de reportes verificados en Supabase QA.
-- RLS permite crear y consultar solo reportes propios.
-- Sin UPDATE, DELETE ni acceso anonimo.

BEGIN;

GRANT SELECT, INSERT
ON TABLE public.reports
TO authenticated;

COMMIT;
