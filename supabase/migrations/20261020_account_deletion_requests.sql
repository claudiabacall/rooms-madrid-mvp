-- ROOMS M4
-- Solicitudes autenticadas de eliminación de cuenta.
-- No elimina cuentas ni archivos automáticamente.

create table if not exists public.account_deletion_requests (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'rejected'))
);

alter table public.account_deletion_requests
  enable row level security;

drop policy if exists
  "account_deletion_requests_select_own"
  on public.account_deletion_requests;

create policy "account_deletion_requests_select_own"
on public.account_deletion_requests
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists
  "account_deletion_requests_insert_own"
  on public.account_deletion_requests;

create policy "account_deletion_requests_insert_own"
on public.account_deletion_requests
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
);

revoke all on public.account_deletion_requests
  from public, anon, authenticated;

grant select (user_id, requested_at, status)
on public.account_deletion_requests
to authenticated;

grant insert (user_id)
on public.account_deletion_requests
to authenticated;

comment on table public.account_deletion_requests is
  'Solicitudes de supresion de cuentas ROOMS. La ejecucion requiere gestion autorizada.';
