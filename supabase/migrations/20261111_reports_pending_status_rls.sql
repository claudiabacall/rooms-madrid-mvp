-- ROOMS M7.98
-- Validado en Supabase QA mediante prueba negativa real.
-- Un usuario solo puede crear reportes propios con estado pending.
-- Los estados de moderacion permanecen fuera del flujo de usuario.

BEGIN;

ALTER POLICY "Users can create reports"
ON public.reports
WITH CHECK (
  reporter_id = auth.uid()
  AND status = 'pending'
);

COMMIT;
