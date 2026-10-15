-- ROOMS DNA V2: convivencia privada por defecto.
-- Conserva las preferencias explicitas del usuario.

BEGIN;

DO $$
DECLARE
  definition text;
  living_section text;
  living_start integer;
  search_start integer;
BEGIN
  definition := pg_get_functiondef(
    'public.get_profile_visibility(uuid)'::regprocedure
  );

  living_start := strpos(definition, '  living_scope :=');
  search_start := strpos(definition, '  search_scope :=');

  IF living_start = 0 OR search_start <= living_start THEN
    RAISE EXCEPTION 'Estructura inesperada. Sin cambios.';
  END IF;

  living_section := substring(
    definition FROM living_start
    FOR search_start - living_start
  );

  IF living_section NOT LIKE '%else ''public''%' THEN
    IF living_section LIKE '%else ''private''%' THEN
      RAISE NOTICE 'Privacidad por defecto ya corregida.';
      RETURN;
    END IF;

    RAISE EXCEPTION 'Valor inesperado. Sin cambios.';
  END IF;

  definition :=
    left(definition, living_start - 1)
    || replace(
      living_section,
      'else ''public''',
      'else ''private'''
    )
    || substring(definition FROM search_start);

  EXECUTE definition;
END;
$$;

COMMIT;
