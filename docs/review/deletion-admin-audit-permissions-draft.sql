-- ROOMS M6.18F
-- PROPUESTA. NO EJECUTAR EN SUPABASE.
--
-- Requiere verificar previamente propietarios de funciones,
-- herencia de roles, grants efectivos, RLS y otras rutas
-- administrativas. service_role puede tener privilegios
-- adicionales que no se eliminan con estos REVOKE.
--
-- Las funciones SECURITY DEFINER deberan seguir siendo
-- propiedad de un rol administrativo controlado.
--
-- No habilita bajas reales.

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.account_deletion_audit
FROM service_role;

GRANT SELECT
ON TABLE public.account_deletion_audit
TO service_role;

-- Pendiente: restringir también escrituras directas sobre
-- account_deletion_requests y verificar que las funciones
-- administrativas no permiten transiciones arbitrarias.
--
-- Pendiente: identidad verificable del operador.
-- Pendiente: recuperacion segura de una baja fallida.
