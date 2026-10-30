\set ON_ERROR_STOP on

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';

DO $guard$
BEGIN
  IF current_database() <> 'postgres'
     OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'STOP: identidad SQL inesperada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_registration_closed'
      AND tgenabled = 'O'
      AND tgfoid =
        'public.rooms_block_beta_registration()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'STOP: registro beta no bloqueado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    WHERE p.oid =
      'rooms_private.consume_beta_invite_on_signup()'::regprocedure
      AND p.prorettype = 'trigger'::regtype
      AND p.prosecdef
      AND 'search_path=""' = ANY(p.proconfig)
  ) THEN
    RAISE EXCEPTION 'STOP: consumidor de invitaciones inesperado';
  END IF;

  IF to_regclass('rooms_private.beta_invitations') IS NULL THEN
    RAISE EXCEPTION 'STOP: tabla de invitaciones ausente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
      AND tgfoid =
        'rooms_private.consume_beta_invite_on_signup()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'STOP: consumidor ya conectado';
  END IF;
END;
$guard$;

CREATE TRIGGER rooms_consume_beta_invite
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION rooms_private.consume_beta_invite_on_signup();

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_consume_beta_invite'
      AND tgfoid =
        'rooms_private.consume_beta_invite_on_signup()'::regprocedure
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'STOP: consumidor no conectado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_registration_closed'
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'STOP: registro beta desprotegido';
  END IF;

  RAISE NOTICE 'OK consumidor de invitaciones conectado';
  RAISE NOTICE 'OK registro general permanece bloqueado';
END;
$verify$;

COMMIT;

\echo OK_ROOMS_M615_INVITE_CONSUMER_CONNECTED
