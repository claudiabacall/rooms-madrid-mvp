-- ROOMS: registrar aceptacion durante la creacion de Auth.
-- No publicar versiones ni abrir el registro desde esta migracion.
-- Solo se ejecuta para usuarios creados DESPUES de instalar el trigger.

create or replace function public.capture_signup_terms_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version text;
  v_terms_published boolean;
begin
  -- Mientras no existan condiciones publicadas, no hay
  -- aceptacion registrable. Las altas administrativas QA
  -- anteriores al lanzamiento no quedan bloqueadas.
  select exists (
    select 1
    from public.legal_document_versions
    where document_type = 'terms'
      and published_at is not null
  )
  into v_terms_published;

  if not v_terms_published then
    return new;
  end if;

  -- Una vez publicadas condiciones, toda cuenta nueva
  -- debe declarar la aceptacion de una version publicada.
  if (
    new.raw_user_meta_data
      -> 'rooms_terms_accepted'
  ) is distinct from 'true'::jsonb then
    raise exception 'Terms acceptance required';
  end if;

  v_version :=
    new.raw_user_meta_data ->> 'rooms_terms_version';

  if v_version is null or not exists (
    select 1
    from public.legal_document_versions
    where document_type = 'terms'
      and version = v_version
      and published_at is not null
  ) then
    raise exception 'Terms version not published';
  end if;

  insert into public.legal_acceptances (
    user_id,
    document_type,
    version,
    accepted_at
  )
  values (
    new.id,
    'terms',
    v_version,
    now()
  );

  return new;
end;
$$;

revoke all
on function public.capture_signup_terms_acceptance()
from public, anon, authenticated;

drop trigger if exists rooms_capture_signup_terms
on auth.users;

create trigger rooms_capture_signup_terms
after insert on auth.users
for each row
execute function public.capture_signup_terms_acceptance();
