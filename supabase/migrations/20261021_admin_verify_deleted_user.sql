-- ROOMS M4: verificacion administrativa posterior a una baja.
-- Ya instalada mediante Supabase SQL Editor.
-- No elimina cuentas ni modifica auditorias.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rooms_admin_verify_deleted_user(
    p_audit_id uuid,
    p_target_id uuid,
    p_claim_token uuid
  )
RETURNS TABLE (
  auth_absent boolean,
  fk_relations_checked integer,
  remaining_fk_rows bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  fk record;
  v_count bigint;
  v_checked integer := 0;
  v_remaining bigint := 0;
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_audit a
    WHERE a.id = p_audit_id
      AND a.target_user_id = p_target_id
      AND a.claim_token = p_claim_token
      AND a.status = 'processing'
      AND a.finished_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Ejecucion administrativa no autorizada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_target_id
  ) THEN
    RAISE EXCEPTION 'La cuenta sigue existiendo en Auth';
  END IF;

  FOR fk IN
    SELECT
      n.nspname AS schema_name,
      t.relname AS table_name,
      a.attname AS column_name,
      cardinality(c.conkey) AS column_count,
      a.atttypid AS column_type
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t
      ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n
      ON n.oid = t.relnamespace
    LEFT JOIN pg_catalog.pg_attribute a
      ON a.attrelid = c.conrelid
      AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND c.confrelid IN (
        'auth.users'::regclass,
        'public.profiles'::regclass
      )
  LOOP
    IF fk.column_count <> 1
       OR fk.column_name IS NULL
       OR fk.column_type <> 'uuid'::regtype THEN
      RAISE EXCEPTION
        'Relacion FK no soportada: %.%',
        fk.table_name,
        fk.column_name;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      fk.schema_name,
      fk.table_name,
      fk.column_name
    )
    INTO v_count
    USING p_target_id;

    v_checked := v_checked + 1;
    v_remaining := v_remaining + v_count;
  END LOOP;

  IF v_checked < 35 THEN
    RAISE EXCEPTION 'Cobertura FK inferior a la validada';
  END IF;

  auth_absent := true;
  fk_relations_checked := v_checked;
  remaining_fk_rows := v_remaining;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_verify_deleted_user(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_verify_deleted_user(uuid, uuid, uuid)
TO service_role;

COMMIT;
