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

  living_scope text := 'public';
  search_scope text := 'public';
  budget_scope text := 'public';
  activity_scope text := 'public';

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
      else 'public'
    end;

  search_scope :=
    case
      when controls ? 'search'
        then controls ->> 'search'
      when controls ? 'searching'
        and (controls ->> 'searching')::boolean = false
        then 'private'
      else 'public'
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
      else 'public'
    end;

  activity_scope :=
    case
      when controls ? 'activity'
        then controls ->> 'activity'
      when controls ? 'posts'
        and (controls ->> 'posts')::boolean = false
        then 'private'
      else 'public'
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


/*
 * Normalización del esquema antiguo de privacidad.
 *
 * Legacy:
 *   habits / searching / posts / communities -> boolean
 *
 * Actual:
 *   living / search / budget / activity
 *   public / connections / private
 */
update public.onboarding_preferences
set answers = jsonb_set(
  jsonb_set(
    answers,
    '{privacy,controls}',
    jsonb_build_object(
      'living',
        case
          when coalesce(
            (answers -> 'privacy' -> 'controls' ->> 'habits')::boolean,
            true
          )
            then 'public'
          else 'private'
        end,

      'search',
        case
          when coalesce(
            (answers -> 'privacy' -> 'controls' ->> 'searching')::boolean,
            true
          )
            then 'public'
          else 'private'
        end,

      'budget',
        case
          when coalesce(
            (answers -> 'privacy' -> 'controls' ->> 'searching')::boolean,
            true
          ) = false
            then 'private'
          when answers -> 'privacy' ->> 'level' = 'private'
            then 'private'
          when answers -> 'privacy' ->> 'level' = 'balanced'
            then 'connections'
          else 'public'
        end,

      'activity',
        case
          when coalesce(
            (answers -> 'privacy' -> 'controls' ->> 'posts')::boolean,
            true
          )
            then 'public'
          else 'private'
        end
    ),
    true
  ),
  '{privacy,level}',
  to_jsonb(
    case
      when answers -> 'privacy' ->> 'level' = 'public'
        then 'open'
      when answers -> 'privacy' ->> 'level'
        in ('open', 'balanced', 'private')
        then answers -> 'privacy' ->> 'level'
      else 'balanced'
    end
  ),
  true
)
where
  answers -> 'privacy' -> 'controls' ? 'habits'
  or answers -> 'privacy' -> 'controls' ? 'searching'
  or answers -> 'privacy' -> 'controls' ? 'posts'
  or answers -> 'privacy' -> 'controls' ? 'communities';


/*
 * El nivel es un preset.
 * Si los controles modernos no coinciden exactamente con un preset,
 * la configuración es personalizada.
 */
update public.onboarding_preferences
set answers = jsonb_set(
  answers,
  '{privacy,level}',
  to_jsonb(
    case
      when answers -> 'privacy' -> 'controls' = jsonb_build_object(
        'living', 'public',
        'search', 'public',
        'budget', 'public',
        'activity', 'public'
      )
        then 'open'

      when answers -> 'privacy' -> 'controls' = jsonb_build_object(
        'living', 'public',
        'search', 'public',
        'budget', 'connections',
        'activity', 'public'
      )
        then 'balanced'

      when answers -> 'privacy' -> 'controls' = jsonb_build_object(
        'living', 'private',
        'search', 'private',
        'budget', 'private',
        'activity', 'private'
      )
        then 'private'

      else 'custom'
    end
  ),
  true
)
where
  answers -> 'privacy' -> 'controls' ? 'living'
  and answers -> 'privacy' -> 'controls' ? 'search'
  and answers -> 'privacy' -> 'controls' ? 'budget'
  and answers -> 'privacy' -> 'controls' ? 'activity';
