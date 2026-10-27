-- ROOMS M6.16P
-- BORRADOR DE REVISION. NO EJECUTAR EN SUPABASE.
-- Requiere la funcion rooms_assert_deletion_write_allowed.
-- La funcion y el claim deben usar la misma clave.
-- No constituye una barrera completa.
-- No protege otras RPC, escrituras directas o Storage.
-- Funcion original conservada sin modificaciones.

create or replace function public.create_community(
  _name text,
  _description text default null::text,
  _visibility text default 'public'::text
)
returns public.communities
language plpgsql
security definer
set search_path = ''
as $function$
declare
  _user_id uuid;
  _community public.communities;
begin
  _user_id := auth.uid();

  if _user_id is null then
    raise exception 'Authentication required';
  end if;

  -- M6.16P: exigir bloqueo transaccional y
  -- comprobar que no hay una baja activa.
  -- Esta llamada debe permanecer dentro de la
  -- misma transaccion que las escrituras.
  perform public.rooms_assert_deletion_write_allowed(
    _user_id
  );

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
