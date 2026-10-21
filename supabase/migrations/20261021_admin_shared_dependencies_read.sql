-- ROOMS M4: lectura administrativa de dependencias indirectas.
-- Permisos aplicados previamente mediante Supabase SQL Editor.
-- Sin cambios en RLS ni permisos de usuarios normales.

GRANT SELECT ON TABLE
  public.household_person_candidates,
  public.listing_private_locations
TO service_role;
