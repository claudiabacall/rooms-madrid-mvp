-- ROOMS M6.19K
-- BORRADOR LOCAL. NO EJECUTAR EN SUPABASE.
-- Bloquea escrituras de cuentas en baja mediante
-- owner, owner_id y primer segmento de la ruta.
-- La limpieza administrativa requiere un mecanismo
-- independiente, autorizado y aun no implementado.
-- Revisar compatibilidad con Supabase Storage.

CREATE OR REPLACE FUNCTION
public.rooms_storage_deletion_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_row jsonb;
  v_field text;
  v_value text;
  v_user uuid;
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
    FOREACH v_field IN ARRAY ARRAY[
      'owner', 'owner_id'
    ]
    LOOP
      v_value := v_row->>v_field;

      IF v_value IS NOT NULL AND v_value <> '' THEN
        IF v_value !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN
          RAISE EXCEPTION 'Unresolved Storage owner';
        END IF;

        v_users := v_users || v_value::uuid;
      END IF;
    END LOOP;

    v_value := pg_catalog.split_part(
      COALESCE(v_row->>'name', ''), '/', 1
    );

    IF v_value ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN
      v_users := v_users || v_value::uuid;
    END IF;
  END LOOP;

  IF pg_catalog.array_length(v_users, 1) IS NULL THEN
    RAISE EXCEPTION 'Unresolved Storage owner';
  END IF;

  FOR v_user IN
    SELECT DISTINCT x.uid
    FROM pg_catalog.unnest(v_users) AS x(uid)
    ORDER BY x.uid
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
    RAISE EXCEPTION 'Storage bloqueado por baja';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER rooms_storage_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION
public.rooms_storage_deletion_write_guard();
