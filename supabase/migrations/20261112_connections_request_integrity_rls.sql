-- ROOMS M8.02
-- Restricciones verificadas mediante pruebas reales en Supabase QA.
-- Las solicitudes empiezan pendientes y solo el destinatario
-- puede responder. Los participantes no son editables.

BEGIN;

ALTER POLICY "Un usuario envía una conexión"
ON public.connections
WITH CHECK (
  requester_id = auth.uid()
  AND requester_id <> recipient_id
  AND status = 'pending'
  AND NOT public.users_are_blocked(
    requester_id, recipient_id
  )
);

REVOKE UPDATE
ON TABLE public.connections
FROM authenticated;

GRANT UPDATE (status)
ON TABLE public.connections
TO authenticated;

ALTER POLICY "El destinatario responde la conexión"
ON public.connections
USING (
  recipient_id = auth.uid()
  AND status = 'pending'
  AND NOT public.users_are_blocked(
    requester_id, recipient_id
  )
)
WITH CHECK (
  recipient_id = auth.uid()
  AND status IN ('accepted', 'declined')
  AND NOT public.users_are_blocked(
    requester_id, recipient_id
  )
);

COMMIT;
