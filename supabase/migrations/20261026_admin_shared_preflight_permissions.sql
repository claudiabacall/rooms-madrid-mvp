-- ROOMS M6.7B
-- Lectura exclusiva del preflight administrativo de bajas.
-- Reproduce los permisos SELECT confirmados en Supabase.
-- No modifica RLS, datos ni permisos de anon/authenticated.

GRANT SELECT ON TABLE
  public.conversation_preferences,
  public.household_candidate_votes,
  public.household_candidates,
  public.household_invitations,
  public.post_comments,
  public.post_likes,
  public.user_blocks
TO service_role;
