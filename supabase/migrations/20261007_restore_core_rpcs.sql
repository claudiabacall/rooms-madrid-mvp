-- ROOMS
-- RPCs recuperadas del proyecto Supabase remoto.
-- Fuente: definiciones reales auditadas el 2026-10-07.
--
-- Importante:
-- Estas funciones dependen de tablas históricas que todavía deben
-- incorporarse al historial completo de migraciones del repositorio.

create or replace function public.create_community(
  _name text,
  _description text default null::text,
  _visibility text default 'public'::text
)
returns public.communities
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _user_id uuid;
  _community public.communities;
begin
  _user_id := auth.uid();

  if _user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(_name), '') is null then
    raise exception 'Community name is required';
  end if;

  if _visibility not in ('public', 'private') then
    raise exception 'Invalid visibility';
  end if;

  insert into public.communities (
    id,
    owner_id,
    name,
    description,
    visibility,
    status
  )
  values (
    gen_random_uuid(),
    _user_id,
    trim(_name),
    nullif(trim(_description), ''),
    _visibility,
    'active'
  )
  returning *
  into _community;

  insert into public.community_members (
    community_id,
    user_id,
    role,
    status
  )
  values (
    _community.id,
    _user_id,
    'owner',
    'active'
  )
  on conflict (community_id, user_id)
  do update set
    role = 'owner',
    status = 'active';

  return _community;
end;
$function$;


create or replace function public.users_are_blocked(
  user_a uuid,
  user_b uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.user_blocks
    where
      (
        blocker_id = user_a
        and blocked_id = user_b
      )
      or
      (
        blocker_id = user_b
        and blocked_id = user_a
      )
  );
$function$;


create or replace function public.is_household_member(
  _household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.household_members
    where household_id = _household_id
      and user_id = auth.uid()
      and status = 'accepted'
  );
$function$;


create or replace function public.is_household_owner(
  _household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.households
    where id = _household_id
      and owner_id = auth.uid()
  );
$function$;


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
set search_path to 'public'
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

    p.traits,

    visibility.viewer_scope

  from public.profiles p

  left join public.onboarding_preferences pref
    on pref.user_id = p.id

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


revoke execute on function
  public.create_community(text, text, text)
from public;

grant execute on function
  public.create_community(text, text, text)
to authenticated;


revoke execute on function
  public.get_visible_profiles(uuid)
from public;

grant execute on function
  public.get_visible_profiles(uuid)
to authenticated;


revoke execute on function
  public.users_are_blocked(uuid, uuid)
from public;

grant execute on function
  public.users_are_blocked(uuid, uuid)
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
