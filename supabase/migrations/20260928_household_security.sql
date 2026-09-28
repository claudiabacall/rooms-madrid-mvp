-- Seguridad y consistencia de Hogares / grupos de búsqueda.


-- Miembros reales de un Hogar.
-- Solo un miembro aceptado puede consultar la lista.
create or replace function public.get_household_members(
  _household_id uuid
)
returns table(
  household_id uuid,
  user_id uuid,
  role text,
  status text,
  joined_at timestamptz,
  name text,
  alias text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    hm.household_id,
    hm.user_id,
    hm.role,
    hm.status,
    hm.joined_at,
    p.name,
    p.alias,
    p.avatar_url
  from public.household_members hm
  join public.profiles p
    on p.id = hm.user_id
  where hm.household_id = _household_id
    and hm.status = 'accepted'
    and public.is_household_member(_household_id)
  order by hm.joined_at asc;
$$;

revoke all
on function public.get_household_members(uuid)
from public;

grant execute
on function public.get_household_members(uuid)
to authenticated;


-- Un usuario solo puede actualizar su voto
-- mientras siga perteneciendo al Hogar.
drop policy if exists "Miembros actualizan sus votos"
on public.household_candidate_votes;

create policy "Miembros actualizan sus votos"
on public.household_candidate_votes
for update
to authenticated
using (
  user_id = auth.uid()
  and (
    public.is_household_member(household_id)
    or public.is_household_owner(household_id)
  )
)
with check (
  user_id = auth.uid()
  and (
    public.is_household_member(household_id)
    or public.is_household_owner(household_id)
  )
);


-- Un voto solo puede apuntar a un candidato
-- que exista realmente dentro del mismo Hogar.
create or replace function public.validate_household_candidate_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.candidate_type = 'listing' then

    if not exists (
      select 1
      from public.household_candidates hc
      where hc.household_id = new.household_id
        and hc.listing_id = new.candidate_id
    ) then
      raise exception
        'Listing candidate does not exist in this household';
    end if;

  elsif new.candidate_type = 'person' then

    if not exists (
      select 1
      from public.household_person_candidates hpc
      where hpc.household_id = new.household_id
        and hpc.user_id = new.candidate_id
    ) then
      raise exception
        'Person candidate does not exist in this household';
    end if;

  else
    raise exception 'Invalid candidate type';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_household_candidate_vote_trigger
on public.household_candidate_votes;

create trigger validate_household_candidate_vote_trigger
before insert or update
on public.household_candidate_votes
for each row
execute function public.validate_household_candidate_vote();
