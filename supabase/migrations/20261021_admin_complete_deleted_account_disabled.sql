-- ROOMS M4: cierre administrativo deliberadamente deshabilitado.
-- Aplicado y verificado previamente en Supabase.
-- No ejecuta bajas ni completa auditorias.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rooms_admin_complete_deleted_account(
    p_audit_id uuid,
    p_target_id uuid,
    p_claim_token uuid
  )
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  fk record;
  v_count bigint;
  v_checked integer := 0;
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  PERFORM 1
  FROM public.account_deletion_audit a
  WHERE a.id = p_audit_id
    AND a.target_user_id = p_target_id
    AND a.claim_token = p_claim_token
    AND a.status = 'processing'
    AND a.finished_at IS NULL
    AND a.shared_impact_verified = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auditoria no autorizada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_target_id
  ) THEN
    RAISE EXCEPTION 'Auth todavia contiene la cuenta';
  END IF;

  FOR fk IN
    SELECT
      n.nspname AS esquema,
      t.relname AS tabla,
      a.attname AS columna,
      cardinality(c.conkey) AS columnas_fk,
      a.atttypid AS tipo_columna
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND c.confrelid IN (
        'auth.users'::regclass,
        'public.profiles'::regclass
      )
  LOOP
    IF fk.columnas_fk <> 1
       OR fk.columna IS NULL
       OR fk.tipo_columna <> 'uuid'::regtype THEN
      RAISE EXCEPTION 'FK no soportada';
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      fk.esquema, fk.tabla, fk.columna
    )
    INTO v_count
    USING p_target_id;

    IF v_count <> 0 THEN
      RAISE EXCEPTION
        'Persisten registros en %.%',
        fk.tabla, fk.columna;
    END IF;

    v_checked := v_checked + 1;
  END LOOP;

  IF v_checked < 35 THEN
    RAISE EXCEPTION 'Cobertura FK insuficiente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.owner = p_target_id
       OR o.owner_id = p_target_id::text
       OR o.name LIKE p_target_id::text || '/%'
  ) THEN
    RAISE EXCEPTION 'Persisten archivos en Storage';
  END IF;

  -- Bloqueo deliberado: falta evidencia independiente
  -- de la API de Storage y proteccion de concurrencia.
  RAISE EXCEPTION
    'Cierre deshabilitado: falta evidencia API Storage';
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_complete_deleted_account(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
