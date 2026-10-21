-- ROOMS M4: inventario dinamico de FK de usuarios.
-- Funcion aplicada y comprobada en Supabase SQL Editor.
-- No elimina ni modifica registros.

BEGIN;

CREATE OR REPLACE FUNCTION public.rooms_admin_user_fk_inventory(
  target_user_id uuid
)
RETURNS TABLE (
  tabla text,
  columna text,
  referencia text,
  registros bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  fk record;
  total bigint;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'UUID requerido';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = target_user_id
      AND u.raw_user_meta_data
        ->> 'rooms_deletion_test' = 'true'
      AND u.email ~
        '^rooms-delete-qa-[a-z0-9]+@example\.com$'
  ) THEN
    RAISE EXCEPTION 'Cuenta desechable no verificada';
  END IF;

  FOR fk IN
    SELECT
      n.nspname AS esquema,
      t.relname AS nombre_tabla,
      a.attname AS nombre_columna,
      c.confrelid::regclass::text AS destino,
      cardinality(c.conkey) AS numero_columnas,
      a.atttypid AS tipo_columna
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
    ORDER BY n.nspname, t.relname, a.attname
  LOOP
    IF fk.numero_columnas <> 1
       OR fk.nombre_columna IS NULL
       OR fk.tipo_columna <> 'uuid'::regtype THEN
      RAISE EXCEPTION
        'Relacion no soportada: %.%',
        fk.nombre_tabla,
        fk.nombre_columna;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE %I = $1',
      fk.esquema,
      fk.nombre_tabla,
      fk.nombre_columna
    )
    INTO total
    USING target_user_id;

    tabla := fk.nombre_tabla;
    columna := fk.nombre_columna;
    referencia := fk.destino;
    registros := total;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_admin_user_fk_inventory(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.rooms_admin_user_fk_inventory(uuid)
TO service_role;

COMMIT;
