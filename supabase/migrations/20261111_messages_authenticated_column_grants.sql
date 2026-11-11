-- ROOMS M7.62
-- Permisos de mensajeria verificados en Supabase QA.
-- La autorizacion entre usuarios depende tambien de RLS.
-- No habilitar UPDATE general sobre messages.

BEGIN;

GRANT INSERT
ON TABLE public.messages
TO authenticated;

GRANT UPDATE (read_at)
ON TABLE public.messages
TO authenticated;

COMMIT;
