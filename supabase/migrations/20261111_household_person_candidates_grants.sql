-- ROOMS M7.88
-- Permisos de candidatos verificados en Supabase QA.
-- RLS limita las operaciones a miembros o propietarios
-- del hogar correspondiente.

BEGIN;

GRANT SELECT, DELETE
ON TABLE public.household_person_candidates
TO authenticated;

COMMIT;
