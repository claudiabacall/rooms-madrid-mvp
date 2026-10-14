-- Apply manually only after approval; no db push.
-- Safe because world_interests options have no dimensional signals in DNA V2.
-- Server owns interest categories and legacy mirror; never accepts derived DNA from client.
create or replace function public.update_profile_interests_v2(
  p_expected_revision bigint,
  p_interests jsonb,
  p_name text,
  p_age integer,
  p_bio text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_current public.rooms_dna%rowtype;
  v_dna public.rooms_dna%rowtype;
  v_profile public.profiles%rowtype;
  v_count integer;
  v_legacy text[];
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  if jsonb_typeof(p_interests) is distinct from 'array' or
     jsonb_array_length(p_interests) > 5 then
    raise exception 'Invalid interests selection' using errcode = '22023';
  end if;
  select count(*) into v_count
    from jsonb_array_elements(p_interests) as e(value)
   where jsonb_typeof(e.value) is distinct from 'string'
      or not (e.value #>> '{}' = any(array[
        'sport','music','food','travel','nightlife','cinema','gaming',
        'art','reading','nature','fashion','pets'
      ]));
  if v_count <> 0 or (
    select count(*) from (select distinct value from jsonb_array_elements(p_interests)) t
  ) <> jsonb_array_length(p_interests) then
    raise exception 'Invalid interests selection' using errcode = '22023';
  end if;

  if nullif(btrim(p_name), '') is null or char_length(p_name) > 40
     or char_length(coalesce(p_bio,'')) > 500
     or (p_age is not null and (p_age < 18 or p_age > 99)) then
    raise exception 'Invalid profile fields' using errcode = '22023';
  end if;

  -- Lock serializes same-user edits; reject stale writers before modifying either table.
  select * into v_current from public.rooms_dna
   where user_id = v_uid for update;
  if not found or v_current.model_version <> 2 or
     v_current.revision <> p_expected_revision then
    raise exception 'DNA revision conflict' using errcode = '40001';
  end if;
  if jsonb_typeof(v_current.answers) is distinct from 'object' or
     jsonb_typeof(v_current.categories) is distinct from 'object' then
    raise exception 'DNA data not compatible' using errcode = '22023';
  end if;

  -- The server derives both projections from the validated canonical selection.
  select coalesce(array_agg(
    case e.value #>> '{}'
      when 'food' then 'cooking'
      when 'nightlife' then 'going-out'
      else e.value #>> '{}'
    end order by e.ordinality
  ) filter (where e.value #>> '{}' = any(array[
    'sport','music','food','travel','nightlife','gaming','reading','pets'
  ])), array[]::text[]) into v_legacy
  from jsonb_array_elements(p_interests) with ordinality e(value, ordinality);

  update public.rooms_dna set
    answers = jsonb_set(v_current.answers, '{world_interests}', p_interests, true),
    categories = jsonb_set(v_current.categories, '{interests}', p_interests, true),
    calculated_at = clock_timestamp()
  where user_id = v_uid
  returning * into v_dna;

  update public.profiles set
    name = btrim(p_name), alias = btrim(p_name), age = p_age,
    bio = coalesce(p_bio,''), interests = v_legacy
  where id = v_uid
  returning * into v_profile;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('dna', to_jsonb(v_dna), 'profile', to_jsonb(v_profile));
end;
$function$;

revoke all on function public.update_profile_interests_v2(
  bigint, jsonb, text, integer, text
) from public, anon;
grant execute on function public.update_profile_interests_v2(
  bigint, jsonb, text, integer, text
) to authenticated;
