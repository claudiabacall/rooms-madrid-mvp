-- ROOMS M4
-- Permisos de lectura para inspeccion administrativa.
-- Aplicado previamente en Supabase SQL Editor.
-- No concede acceso a anon ni authenticated.

GRANT SELECT ON TABLE
  public.households,
  public.household_members
TO service_role;
