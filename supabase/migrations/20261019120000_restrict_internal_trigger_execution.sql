-- ROOMS: restringir ejecucion directa de funciones internas.
-- Estos triggers se ejecutan por PostgreSQL, no mediante llamadas RPC.
-- Cambio aplicado y verificado previamente en Supabase.

revoke execute on function public.add_community_owner()
from public, anon, authenticated;

revoke execute on function public.create_default_user_role()
from public, anon, authenticated;

revoke execute on function public.handle_new_user()
from public, anon, authenticated;

revoke execute on function public.validate_household_candidate_vote()
from public, anon, authenticated;
