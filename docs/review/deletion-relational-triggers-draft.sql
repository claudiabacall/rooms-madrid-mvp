-- ROOMS M6.18L
-- PROTOTIPO LOCAL. NO EJECUTAR EN SUPABASE.
-- Valida propietarios directos e indirectos de OLD y NEW.
-- No desplegable: falta concurrencia sobre padres,
-- cascadas, privilegios efectivos y limpieza administrativa.

CREATE OR REPLACE FUNCTION
public.rooms_deletion_relational_row_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_spec jsonb;
  v_row jsonb;
  v_column text;
  v_relation jsonb;
  v_ref uuid;
  v_rows bigint;
  v_user uuid;
  v_users uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_NARGS <> 1 THEN
    RAISE EXCEPTION 'Invalid guard configuration';
  END IF;

  v_spec := TG_ARGV[0]::jsonb;

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
    FOR v_column IN
      SELECT pg_catalog.jsonb_array_elements_text(
        v_spec->'direct'
      )
    LOOP
      IF v_row->>v_column IS NOT NULL THEN
        v_users := v_users ||
          (v_row->>v_column)::uuid;
      END IF;
    END LOOP;

    FOR v_relation IN
      SELECT value
      FROM pg_catalog.jsonb_array_elements(
        v_spec->'relations'
      )
    LOOP
      v_column := v_relation->>0;

      IF v_row->>v_column IS NULL THEN
        CONTINUE;
      END IF;

      v_ref := (v_row->>v_column)::uuid;

      -- Identificadores procedentes de configuraciones
      -- estaticas, validadas antes de generar triggers.
      EXECUTE pg_catalog.format(
        'SELECT %I FROM public.%I WHERE id = $1 FOR SHARE',
        v_relation->>2,
        v_relation->>1
      )
      INTO v_user
      USING v_ref;

      -- EXECUTE no actualiza FOUND en PL/pgSQL.
      GET DIAGNOSTICS v_rows = ROW_COUNT;

      IF v_rows <> 1 OR v_user IS NULL THEN
        RAISE EXCEPTION
          'Unresolved protected relationship';
      END IF;

      v_users := v_users || v_user;
    END LOOP;
  END LOOP;

  IF pg_catalog.array_length(v_users, 1) IS NULL THEN
    RAISE EXCEPTION
      'Unresolved protected relationship';
  END IF;

  FOR v_user IN
    SELECT DISTINCT u
    FROM pg_catalog.unnest(v_users) AS u
    ORDER BY u
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_user::text, 0)
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

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":["user_id"],"relations":[["community_id","communities","owner_id"]]}'
);

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.household_candidates
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":["added_by"],"relations":[["household_id","households","owner_id"],["listing_id","listings","owner_id"]]}'
);

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.household_invitations
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":["invited_by","accepted_by"],"relations":[["household_id","households","owner_id"]]}'
);

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.household_members
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":["user_id"],"relations":[["household_id","households","owner_id"]]}'
);

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.household_person_candidates
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":["user_id","added_by"],"relations":[["household_id","households","owner_id"]]}'
);

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.listing_private_locations
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":["owner_id"],"relations":[["listing_id","listings","owner_id"]]}'
);

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":["author_id"],"relations":[["post_id","posts","author_id"]]}'
);

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":["user_id"],"relations":[["post_id","posts","author_id"]]}'
);

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.posts
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":["author_id"],"relations":[["community_id","communities","owner_id"],["listing_id","listings","owner_id"]]}'
);

CREATE TRIGGER rooms_deletion_relational_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.saved_collection_items
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_deletion_relational_row_guard(
  '{"direct":[],"relations":[["collection_id","saved_collections","user_id"],["saved_item_id","saved_items","user_id"]]}'
);
