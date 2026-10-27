-- ROOMS M6.18F
-- BORRADOR LOCAL. NO EJECUTAR EN SUPABASE.
-- Una baja failed mantiene bloqueadas las escrituras.
-- No define aun el procedimiento de recuperacion.

-- ROOMS M6.17H
-- PROTOTIPO LOCAL. NO EJECUTAR EN SUPABASE.
-- No cubre cascadas, Storage ni limpieza administrativa.
-- Requiere coordinar el claim con la misma advisory lock.
-- No sustituye un inventario completo de tablas y relaciones.
-- No conceder EXECUTE a roles de cliente.

CREATE OR REPLACE FUNCTION public.rooms_deletion_row_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_column text;
  v_user uuid;
  v_users uuid[] := ARRAY[]::uuid[];
  v_row jsonb;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_row := to_jsonb(OLD);

    FOREACH v_column IN ARRAY TG_ARGV LOOP
      IF NOT (v_row ? v_column) THEN
        RAISE EXCEPTION 'Unknown guard column: %', v_column;
      END IF;

      v_user := NULLIF(v_row ->> v_column, '')::uuid;
      IF v_user IS NOT NULL THEN
        v_users := pg_catalog.array_append(v_users, v_user);
      END IF;
    END LOOP;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_row := to_jsonb(NEW);

    FOREACH v_column IN ARRAY TG_ARGV LOOP
      IF NOT (v_row ? v_column) THEN
        RAISE EXCEPTION 'Unknown guard column: %', v_column;
      END IF;

      v_user := NULLIF(v_row ->> v_column, '')::uuid;
      IF v_user IS NOT NULL THEN
        v_users := pg_catalog.array_append(v_users, v_user);
      END IF;
    END LOOP;
  END IF;

  -- Primero adquirir TODOS los locks en orden estable.
  -- No consultar estados entre adquisiciones.
  FOR v_user IN
    SELECT DISTINCT u
    FROM pg_catalog.unnest(v_users) AS ids(u)
    ORDER BY u
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_user::text, 0)
    );
  END LOOP;

  -- Comprobar estados despues de adquirir los locks.
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
