-- ROOMS DNA V2
-- Control de concurrencia optimista mediante revision.

alter table public.rooms_dna
  add column if not exists revision bigint not null default 0;

create or replace function public.rooms_dna_increment_revision()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$function$;

drop trigger if exists
  rooms_dna_revision_before_update
on public.rooms_dna;

create trigger rooms_dna_revision_before_update
before update on public.rooms_dna
for each row
execute function public.rooms_dna_increment_revision();

revoke all on function
  public.rooms_dna_increment_revision()
from public;

revoke all on function
  public.rooms_dna_increment_revision()
from anon;

revoke all on function
  public.rooms_dna_increment_revision()
from authenticated;
