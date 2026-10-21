-- ROOMS: registro versionado de aceptaciones legales.
-- No activa el registro de usuarios ni publica documentos.

create table if not exists public.legal_document_versions (
  document_type text not null
    check (document_type in ('terms', 'privacy')),
  version text not null
    check (length(version) between 1 and 60),
  published_at timestamptz,
  primary key (document_type, version)
);

create table if not exists public.legal_acceptances (
  user_id uuid not null
    references auth.users(id) on delete cascade,
  document_type text not null
    check (document_type = 'terms'),
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, document_type, version),
  foreign key (document_type, version)
    references public.legal_document_versions
      (document_type, version)
);

alter table public.legal_document_versions
  enable row level security;

alter table public.legal_acceptances
  enable row level security;

revoke all on public.legal_document_versions
  from public, anon, authenticated;

revoke all on public.legal_acceptances
  from public, anon, authenticated;

grant select on public.legal_document_versions
  to anon, authenticated;

grant select on public.legal_acceptances
  to authenticated;

create policy "Published legal versions are readable"
on public.legal_document_versions
for select
to anon, authenticated
using (published_at is not null);

create policy "Users read own legal acceptances"
on public.legal_acceptances
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.record_terms_acceptance(
  p_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.legal_document_versions
    where document_type = 'terms'
      and version = p_version
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
    v_user_id,
    'terms',
    p_version,
    now()
  )
  on conflict (user_id, document_type, version)
    do nothing;
end;
$$;

revoke all on function public.record_terms_acceptance(text)
  from public, anon;

grant execute on function
  public.record_terms_acceptance(text)
  to authenticated;
