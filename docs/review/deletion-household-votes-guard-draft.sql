-- ROOMS M6.18K
-- PROTOTIPO LOCAL. NO EJECUTAR EN SUPABASE.
-- Protege OLD y NEW, propietarios directos e indirectos.
-- Pendiente: concurrencia con cambios en tablas padre.

CREATE OR REPLACE FUNCTION public.rooms_deletion_vote_row_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_row jsonb;
  v_uid uuid;
  v_household uuid;
  v_candidate uuid;
  v_type text;
  v_owner uuid;
  v_added uuid;
  v_candidate_owner uuid;
  v_users uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR v_row IN
    SELECT row_data
    FROM (
      SELECT pg_catalog.to_jsonb(OLD) AS row_data
      WHERE TG_OP IN ('UPDATE', 'DELETE')
      UNION ALL
      SELECT pg_catalog.to_jsonb(NEW)
      WHERE TG_OP IN ('INSERT', 'UPDATE')
    ) versions
  LOOP
    v_uid := (v_row->>'user_id')::uuid;
    v_household := (v_row->>'household_id')::uuid;
    v_candidate := (v_row->>'candidate_id')::uuid;
    v_type := v_row->>'candidate_type';

    IF v_uid IS NULL OR v_household IS NULL
       OR v_candidate IS NULL THEN
      RAISE EXCEPTION 'Unresolved protected relationship';
    END IF;

    SELECT h.owner_id INTO v_owner
    FROM public.households h
    WHERE h.id = v_household;

    IF NOT FOUND OR v_owner IS NULL THEN
      RAISE EXCEPTION 'Unresolved protected relationship';
    END IF;

    v_users := v_users || v_uid || v_owner;

    IF v_type = 'listing' THEN
      SELECT hc.added_by, l.owner_id
      INTO v_added, v_candidate_owner
      FROM public.household_candidates hc
      JOIN public.listings l ON l.id = hc.listing_id
      WHERE hc.household_id = v_household
        AND hc.listing_id = v_candidate;

    ELSIF v_type = 'person' THEN
      SELECT hpc.added_by, hpc.user_id
      INTO v_added, v_candidate_owner
      FROM public.household_person_candidates hpc
      WHERE hpc.household_id = v_household
        AND hpc.user_id = v_candidate;

    ELSE
      RAISE EXCEPTION 'Invalid candidate type';
    END IF;

    IF NOT FOUND OR v_added IS NULL
       OR v_candidate_owner IS NULL THEN
      RAISE EXCEPTION 'Unresolved protected relationship';
    END IF;

    v_users := v_users || v_added || v_candidate_owner;
  END LOOP;

  FOR v_uid IN
    SELECT DISTINCT u
    FROM pg_catalog.unnest(v_users) AS u
    ORDER BY u
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_uid::text, 0)
    );
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_audit a
    WHERE a.target_user_id = ANY(v_users)
      AND a.status IN ('started', 'processing', 'failed')
  ) THEN
    RAISE EXCEPTION 'Account deletion in progress';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;
