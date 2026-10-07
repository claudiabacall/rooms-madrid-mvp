-- ROOMS
-- Harden SECURITY DEFINER RPC permissions.
-- These RPCs are application functions and must not be executable by PUBLIC.

revoke execute on function
  public.get_profile_visibility(uuid)
from public;

grant execute on function
  public.get_profile_visibility(uuid)
to authenticated;


revoke execute on function
  public.get_visible_profiles(uuid)
from public;

grant execute on function
  public.get_visible_profiles(uuid)
to authenticated;


revoke execute on function
  public.is_household_member(uuid)
from public;

grant execute on function
  public.is_household_member(uuid)
to authenticated;


revoke execute on function
  public.is_household_owner(uuid)
from public;

grant execute on function
  public.is_household_owner(uuid)
to authenticated;


revoke execute on function
  public.users_are_blocked(uuid, uuid)
from public;

grant execute on function
  public.users_are_blocked(uuid, uuid)
to authenticated;
