-- ROOMS M6.32B
-- Eliminar tokens de invitacion de metadatos persistidos.
-- Basado en la prueba M6.31V de Supabase QA.
--
-- No ejecutar manualmente en produccion.
-- Requiere revision y validacion E2E antes del despliegue.
--
-- Reversion controlada:
-- DROP TRIGGER rooms_strip_invite_token_identities ON auth.identities;
-- DROP TRIGGER rooms_strip_invite_token_users ON auth.users;
-- DROP FUNCTION rooms_private.strip_invite_token_identities();
-- DROP FUNCTION rooms_private.strip_invite_token_users();

BEGIN;

DO $guard$
BEGIN
  IF to_regprocedure(
    'rooms_private.consume_beta_invite_on_signup()'
  ) IS NULL THEN
    RAISE EXCEPTION 'STOP: consumidor de invitaciones ausente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname IN (
      'rooms_strip_invite_token_users',
      'rooms_strip_invite_token_identities'
    )
      AND tgrelid IN (
        'auth.users'::regclass,
        'auth.identities'::regclass
      )
  ) THEN
    RAISE EXCEPTION 'STOP: triggers de limpieza ya existentes';
  END IF;

  IF to_regprocedure(
    'rooms_private.strip_invite_token_users()'
  ) IS NOT NULL
  OR to_regprocedure(
    'rooms_private.strip_invite_token_identities()'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: funciones de limpieza ya existentes';
  END IF;
END;
$guard$;

CREATE FUNCTION rooms_private.strip_invite_token_users()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.raw_user_meta_data :=
    COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
      - 'rooms_beta_invite_token';

  RETURN NEW;
END;
$function$;

CREATE TRIGGER rooms_strip_invite_token_users
BEFORE INSERT OR UPDATE OF raw_user_meta_data
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION rooms_private.strip_invite_token_users();

CREATE FUNCTION rooms_private.strip_invite_token_identities()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.identity_data :=
    COALESCE(NEW.identity_data, '{}'::jsonb)
      - 'rooms_beta_invite_token';

  RETURN NEW;
END;
$function$;

CREATE TRIGGER rooms_strip_invite_token_identities
BEFORE INSERT OR UPDATE OF identity_data
ON auth.identities
FOR EACH ROW
EXECUTE FUNCTION rooms_private.strip_invite_token_identities();

DO $verify$
BEGIN
  IF (
    SELECT count(*)
    FROM pg_trigger
    WHERE tgrelid IN (
      'auth.users'::regclass,
      'auth.identities'::regclass
    )
      AND tgname IN (
        'rooms_strip_invite_token_users',
        'rooms_strip_invite_token_identities'
      )
      AND tgenabled = 'O'
  ) <> 2 THEN
    RAISE EXCEPTION 'FAIL: protecciones incompletas';
  END IF;
END;
$verify$;

COMMIT;
