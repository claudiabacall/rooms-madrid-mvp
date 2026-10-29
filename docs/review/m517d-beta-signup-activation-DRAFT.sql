-- ROOMS M5.17D
-- BORRADOR. NO EJECUTAR EN SUPABASE.
-- Requiere aprobacion legal, pruebas en entorno
-- Supabase aislado y autorizacion explicita.
-- Requiere esquema y funcion de invitaciones instalados.
--
-- La sustitucion del trigger es transaccional.
-- No hay fase intermedia de registro libre.

BEGIN;

LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  v_trigger_function oid;
BEGIN
  IF to_regclass('rooms_private.beta_invitations') IS NULL THEN
    RAISE EXCEPTION 'STOP: invitations not installed';
  END IF;

  IF to_regprocedure(
    'rooms_private.consume_beta_invite_on_signup()'
  ) IS NULL THEN
    RAISE EXCEPTION 'STOP: consume function missing';
  END IF;

  SELECT t.tgfoid
  INTO v_trigger_function
  FROM pg_trigger t
  WHERE t.tgrelid = 'auth.users'::regclass
    AND t.tgname = 'rooms_beta_registration_closed'
    AND NOT t.tgisinternal
    AND t.tgenabled = 'O';

  IF v_trigger_function IS DISTINCT FROM
    to_regprocedure(
      'public.rooms_block_beta_registration()'
    )::oid THEN
    RAISE EXCEPTION
      'STOP: unexpected registration guard: %',
      v_trigger_function;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_capture_signup_terms'
      AND NOT tgisinternal
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'STOP: legal capture trigger missing';
  END IF;
END;
$$;

DROP TRIGGER rooms_beta_registration_closed
ON auth.users;

CREATE TRIGGER rooms_beta_registration_closed
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION
  rooms_private.consume_beta_invite_on_signup();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_registration_closed'
      AND tgfoid =
        'rooms_private.consume_beta_invite_on_signup()'
          ::regprocedure
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'STOP: activation not verified';
  END IF;
END;
$$;

COMMIT;
