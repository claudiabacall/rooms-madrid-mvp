-- Compatibility security patch for existing frontend.
-- Keeps get_visible_profiles(uuid) signature and original 13 output columns.
-- Restricts legacy traits by living privacy (defaults private).
-- Supersedes legacy behavior without revoking EXECUTE for existing clients.
-- Install manually after review; do not run db push on out-of-sync history.
create or replace function public.get_visible_profiles(
  _target_user_id uuid default null::uuid
)
returns table(
  id uuid,
  name text,
  alias text,
  avatar_url text,
  bio text,
  age integer,
  seeking text[],
  zones text[],
  budget_min integer,
  budget_max integer,
  move_in_date date,
  traits text[],
  viewer_scope text
)
language sql
security definer
set search_path = public, pg_temp
as $function$

  select
    p.id,
    p.name,
    p.alias,
    p.avatar_url,
    p.bio,
    p.age,

    case
      when visibility.search_visible
        then p.seeking
      else null
    end as seeking,

    case
      when visibility.search_visible
        then p.zones
      else null
    end as zones,

    case
      when visibility.budget_visible
        then p.budget_min
      else null
    end as budget_min,

    case
      when visibility.budget_visible
        then p.budget_max
      else null
    end as budget_max,

    case
      when visibility.search_visible
        then p.move_in_date
      else null
    end as move_in_date,

    -- Legacy traits are not equivalent to DNA V2 living answers.
    -- Never expose V2 living signals through the legacy field.
    case when visibility.living_visible and (dna.model_version is distinct from 2)
      then p.traits else null end as traits,

    visibility.viewer_scope

  from public.profiles p

  left join public.onboarding_preferences pref
    on pref.user_id = p.id

  left join public.rooms_dna dna
    on dna.user_id = p.id

  cross join lateral (
    select

      case
        when exists (
          select 1
          from public.connections c
          where c.status = 'accepted'
            and (
              (
                c.requester_id = auth.uid()
                and c.recipient_id = p.id
              )
              or
              (
                c.requester_id = p.id
                and c.recipient_id = auth.uid()
              )
            )
        )
        then 'connection'
        else 'public'
      end as viewer_scope,

      (
        coalesce(
          pref.answers
            -> 'privacy'
            -> 'controls'
            ->> 'search',
          'public'
        ) = 'public'

        or (

          coalesce(
            pref.answers
              -> 'privacy'
              -> 'controls'
              ->> 'search',
            'public'
          ) = 'connections'

          and exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (
                  c.requester_id = auth.uid()
                  and c.recipient_id = p.id
                )
                or
                (
                  c.requester_id = p.id
                  and c.recipient_id = auth.uid()
                )
              )
          )
        )
      ) as search_visible,

      (
        coalesce(pref.answers -> 'privacy' -> 'controls' ->> 'living', 'private') = 'public'
        or (
          coalesce(pref.answers -> 'privacy' -> 'controls' ->> 'living', 'private') = 'connections'
          and exists (
            select 1 from public.connections c
            where c.status = 'accepted'
              and ((c.requester_id = auth.uid() and c.recipient_id = p.id)
                or (c.requester_id = p.id and c.recipient_id = auth.uid()))
          )
        )
      ) as living_visible,

      (
        coalesce(
          pref.answers
            -> 'privacy'
            -> 'controls'
            ->> 'budget',
          'public'
        ) = 'public'

        or (

          coalesce(
            pref.answers
              -> 'privacy'
              -> 'controls'
              ->> 'budget',
            'public'
          ) = 'connections'

          and exists (
            select 1
            from public.connections c
            where c.status = 'accepted'
              and (
                (
                  c.requester_id = auth.uid()
                  and c.recipient_id = p.id
                )
                or
                (
                  c.requester_id = p.id
                  and c.recipient_id = auth.uid()
                )
              )
          )
        )
      ) as budget_visible

  ) visibility

  where
    p.onboarding_completed = true

    and p.id <> auth.uid()

    and not public.users_are_blocked(
      auth.uid(),
      p.id
    )

    and (
      _target_user_id is null
      or p.id = _target_user_id
    );

$function$;

revoke all on function public.get_visible_profiles(uuid) from public, anon;
grant execute on function public.get_visible_profiles(uuid) to authenticated;
