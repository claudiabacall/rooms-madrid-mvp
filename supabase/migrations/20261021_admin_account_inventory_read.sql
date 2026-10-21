-- ROOMS M4: permisos de lectura administrativa
-- aplicados previamente en Supabase SQL Editor.
-- Sin cambios en RLS ni permisos de usuarios normales.

GRANT SELECT ON TABLE
  public.account_deletion_requests,
  public.connections,
  public.legal_acceptances,
  public.match_preferences,
  public.messages,
  public.reports,
  public.rooms_dna,
  public.saved_collections,
  public.saved_items,
  public.user_intents
TO service_role;
