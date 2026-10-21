-- ROOMS M4 - Permisos administrativos de auditoria
-- Aplicados previamente en Supabase SQL Editor.
-- No modifica usuarios ni ejecuta eliminaciones.

REVOKE ALL ON TABLE public.account_deletion_audit
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.account_deletion_audit
TO service_role;

REVOKE DELETE
ON TABLE public.account_deletion_audit
FROM service_role;
