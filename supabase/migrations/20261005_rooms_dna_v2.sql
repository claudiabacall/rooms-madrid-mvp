create table if not exists public.rooms_dna (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  model_version integer not null,

  answers jsonb not null
    default '{}'::jsonb,

  dimensions jsonb not null
    default '{}'::jsonb,

  categories jsonb not null
    default '{}'::jsonb,

  classification jsonb not null
    default '{}'::jsonb,

  evidence jsonb not null
    default '[]'::jsonb,

  calculated_at timestamptz not null
    default now(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint rooms_dna_model_version_positive
    check (model_version > 0),

  constraint rooms_dna_answers_object
    check (jsonb_typeof(answers) = 'object'),

  constraint rooms_dna_dimensions_object
    check (jsonb_typeof(dimensions) = 'object'),

  constraint rooms_dna_categories_object
    check (jsonb_typeof(categories) = 'object'),

  constraint rooms_dna_classification_object
    check (jsonb_typeof(classification) = 'object'),

  constraint rooms_dna_evidence_array
    check (jsonb_typeof(evidence) = 'array')
);

alter table public.rooms_dna
  enable row level security;

drop policy if exists
  "rooms_dna_select_own"
  on public.rooms_dna;

create policy
  "rooms_dna_select_own"
  on public.rooms_dna
  for select
  to authenticated
  using (
    auth.uid() = user_id
  );

drop policy if exists
  "rooms_dna_insert_own"
  on public.rooms_dna;

create policy
  "rooms_dna_insert_own"
  on public.rooms_dna
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
  );

drop policy if exists
  "rooms_dna_update_own"
  on public.rooms_dna;

create policy
  "rooms_dna_update_own"
  on public.rooms_dna
  for update
  to authenticated
  using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
  );

drop policy if exists
  "rooms_dna_delete_own"
  on public.rooms_dna;

create policy
  "rooms_dna_delete_own"
  on public.rooms_dna
  for delete
  to authenticated
  using (
    auth.uid() = user_id
  );
