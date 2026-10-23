-- ROOMS M2.1: privacidad conservadora por defecto.
-- Respeta controles explicitos y permisos del propietario.
-- No modifica datos de usuarios.

CREATE OR REPLACE FUNCTION public.get_profile_visibility(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  viewer_id uuid := auth.uid();
  privacy_data jsonb := '{}'::jsonb;
  controls jsonb := '{}'::jsonb;

  viewer_scope text := 'public';

  living_scope text := 'private';
  search_scope text := 'private';
  budget_scope text := 'private';
  activity_scope text := 'private';

  is_connection boolean := false;
begin
  if viewer_id is not null and viewer_id = target_user_id then
    return jsonb_build_object(
      'viewer_scope', 'owner',
      'living', true,
      'search', true,
      'budget', true,
      'activity', true
    );
  end if;

  select
    coalesce(answers -> 'privacy', '{}'::jsonb)
  into privacy_data
  from public.onboarding_preferences
  where user_id = target_user_id
  limit 1;

  controls :=
    coalesce(
      privacy_data -> 'controls',
      '{}'::jsonb
    );

  if viewer_id is not null then
    select exists (
      select 1
      from public.connections
      where status = 'accepted'
        and (
          (
            requester_id = viewer_id
            and recipient_id = target_user_id
          )
          or
          (
            requester_id = target_user_id
            and recipient_id = viewer_id
          )
        )
    )
    into is_connection;
  end if;

  if is_connection then
    viewer_scope := 'connections';
  end if;

  living_scope :=
    case
      when controls ? 'living'
        then controls ->> 'living'
      when controls ? 'habits'
        and (controls ->> 'habits')::boolean = false
        then 'private'
      else 'private'
    end;

  search_scope :=
    case
      when controls ? 'search'
        then controls ->> 'search'
      when controls ? 'searching'
        and (controls ->> 'searching')::boolean = false
        then 'private'
      else 'private'
    end;

  budget_scope :=
    case
      when controls ? 'budget'
        then controls ->> 'budget'
      when controls ? 'searching'
        and (controls ->> 'searching')::boolean = false
        then 'private'
      when privacy_data ->> 'level' = 'private'
        then 'private'
      when privacy_data ->> 'level' = 'balanced'
        then 'connections'
      else 'private'
    end;

  activity_scope :=
    case
      when controls ? 'activity'
        then controls ->> 'activity'
      when controls ? 'posts'
        and (controls ->> 'posts')::boolean = false
        then 'private'
      else 'private'
    end;

  return jsonb_build_object(
    'viewer_scope',
      viewer_scope,

    'living',
      living_scope = 'public'
      or (
        living_scope = 'connections'
        and is_connection
      ),

    'search',
      search_scope = 'public'
      or (
        search_scope = 'connections'
        and is_connection
      ),

    'budget',
      budget_scope = 'public'
      or (
        budget_scope = 'connections'
        and is_connection
      ),

    'activity',
      activity_scope = 'public'
      or (
        activity_scope = 'connections'
        and is_connection
      )
  );
end;
$function$;

revoke all on function public.get_profile_visibility(uuid) from public, anon;
grant execute on function public.get_profile_visibility(uuid) to authenticated;
