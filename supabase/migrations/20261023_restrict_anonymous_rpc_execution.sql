-- ROOMS M2.4: restringir RPC al minimo privilegio.
-- Reproduce los permisos verificados en Supabase.
-- No modifica datos ni elimina funciones.

REVOKE EXECUTE ON FUNCTION
  public.accept_household_invitation(uuid)
FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION
  public.get_blocked_profiles()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.accept_household_invitation(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.get_blocked_profiles()
TO authenticated;

-- get_household_invitation(uuid) permanece sin cambios.
