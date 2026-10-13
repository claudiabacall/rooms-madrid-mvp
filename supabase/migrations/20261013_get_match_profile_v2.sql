-- ROOMS: Matching DNA V2
-- Datos minimos, autorizacion por usuario y privacidad.
-- No expone respuestas ni evidencias individuales.

create or replace function public.get_match_profile(
  target_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  viewer_id uuid := auth.uid();
  result jsonb;
begin
  if viewer_id is null
     or target_user_id is null
     or viewer_id = target_user_id then
    return null;
  end if;

  -- Comprobar bloqueo antes de devolver cualquier dato.
  if public.users_are_blocked(
    viewer_id, target_user_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,

    'viewer_scope',
      visibility.permissions ->> 'viewer_scope',

    'search_visible',
      coalesce(
        (visibility.permissions ->> 'search')::boolean,
        false
      ),

    'budget_visible',
      coalesce(
        (visibility.permissions ->> 'budget')::boolean,
        false
      ),

    'seeking',
      case when
        (visibility.permissions ->> 'search')::boolean
      then to_jsonb(p.seeking)
      else null end,

    'zones',
      case when
        (visibility.permissions ->> 'search')::boolean
      then to_jsonb(p.zones)
      else null end,

    'move_in_date',
      case when
        (visibility.permissions ->> 'search')::boolean
      then to_jsonb(p.move_in_date)
      else null end,

    'duration',
      case when
        (visibility.permissions ->> 'search')::boolean
      then to_jsonb(p.duration)
      else null end,

    'budget_min',
      case when
        (visibility.permissions ->> 'budget')::boolean
      then to_jsonb(p.budget_min)
      else null end,

    'budget_max',
      case when
        (visibility.permissions ->> 'budget')::boolean
      then to_jsonb(p.budget_max)
      else null end,

    'living_visible',
      coalesce(
        (visibility.permissions ->> 'living')::boolean,
        false
      ),

    -- Compatibilidad temporal con la version publicada.
    'living',
      case
        when coalesce(
          (visibility.permissions ->> 'living')::boolean,
          false
        )
        then coalesce(
          pref.answers -> 'living',
          '{}'::jsonb
        )
        else null
      end,

    'move_flexible',
      case
        when coalesce(
          (visibility.permissions ->> 'search')::boolean,
          false
        )
        then coalesce(
          pref.answers #> '{move,flexible}',
          'false'::jsonb
        )
        else null
      end,

    'dna_dimensions',
      case
        when
          coalesce(
            (visibility.permissions ->> 'living')::boolean,
            false
          )
          and d.model_version = 2
        then (
          select coalesce(
            jsonb_object_agg(
              dimension.key,
              jsonb_build_object(
                'self', jsonb_build_object(
                  'score',
                    dimension.value #> '{self,score}',
                  'confidence',
                    dimension.value #> '{self,confidence}'
                ),
                'preferred', jsonb_build_object(
                  'score',
                    dimension.value #> '{preferred,score}',
                  'confidence',
                    dimension.value #> '{preferred,confidence}'
                ),
                'importance', jsonb_build_object(
                  'score',
                    dimension.value #> '{importance,score}',
                  'confidence',
                    dimension.value #> '{importance,confidence}'
                )
              )
            ),
            '{}'::jsonb
          )
          from jsonb_each(
            coalesce(d.dimensions, '{}'::jsonb)
          ) as dimension(key, value)
          where dimension.key in (
            'privacy',
            'cleanliness',
            'visitor_tolerance',
            'sharing_style'
          )
        )
        else null
      end
  )
  into result

  from public.profiles p

  cross join lateral (
    select public.get_profile_visibility(
      p.id
    ) as permissions
  ) visibility

  left join public.rooms_dna d
    on d.user_id = p.id

  left join public.onboarding_preferences pref
    on pref.user_id = p.id

  where p.id = target_user_id
    and p.onboarding_completed = true
    and p.id <> viewer_id;

  return result;
end;
$function$;

revoke all on function
  public.get_match_profile(uuid)
from public;

revoke all on function
  public.get_match_profile(uuid)
from anon;

grant execute on function
  public.get_match_profile(uuid)
to authenticated;
