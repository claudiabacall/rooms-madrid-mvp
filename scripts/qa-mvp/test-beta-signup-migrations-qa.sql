
\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'rooms_beta_invite_qa' THEN
    RAISE EXCEPTION 'STOP: no es la base QA';
  END IF;
  IF to_regprocedure(
    'rooms_private.consume_beta_invite_on_signup()'
  ) IS NULL THEN
    RAISE EXCEPTION 'STOP: funcion de consumo no disponible';
  END IF;
END;
$$;

-- Sustituir temporalmente el trigger antiguo del QA.
DROP TRIGGER IF EXISTS rooms_beta_invite_qa ON auth.users;

CREATE OR REPLACE FUNCTION public.rooms_block_beta_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'ROOMS registration temporarily closed';
END;
$$;

CREATE TRIGGER rooms_beta_registration_closed
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.rooms_block_beta_registration();

-- Stub local para representar el trigger de aceptacion legal.
CREATE FUNCTION public.rooms_qa_capture_legal()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE TRIGGER rooms_capture_signup_terms
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.rooms_qa_capture_legal();

INSERT INTO rooms_private.beta_invitations (
  email_normalized, token_digest, expires_at
)
VALUES (
  'activation-qa@example.test',
  extensions.digest(repeat('E', 43), 'sha256'),
  now() + interval '1 day'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO auth.users(email, raw_user_meta_data)
    VALUES ('activation-qa@example.test', '{}'::jsonb);
    RAISE EXCEPTION 'FAIL: bloqueo inicial no funciona';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROOMS registration temporarily closed' THEN
      RAISE;
    END IF;
  END;
  RAISE NOTICE 'OK Registro inicialmente cerrado';
END;
$$;

-- ACTIVACION REAL DEL BORRADOR

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


DO $$
DECLARE
  meta jsonb := jsonb_build_object(
    'rooms_age_18_confirmed', true,
    'rooms_terms_accepted', true,
    'rooms_terms_version', 'qa-1',
    'rooms_beta_invite_token', repeat('E', 43)
  );
  stored jsonb;
BEGIN
  BEGIN
    INSERT INTO auth.users(email, raw_user_meta_data)
    VALUES ('sin-invitacion@example.test', meta);
    RAISE EXCEPTION 'FAIL: alta no autorizada';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Invitacion no valida' THEN
      RAISE;
    END IF;
  END;

  INSERT INTO auth.users(email, raw_user_meta_data)
  VALUES ('activation-qa@example.test', meta)
  RETURNING raw_user_meta_data INTO stored;

  IF stored ? 'rooms_beta_invite_token' THEN
    RAISE EXCEPTION 'FAIL: token persistido';
  END IF;

  RAISE NOTICE 'OK Alta sin invitacion rechazada';
  RAISE NOTICE 'OK Alta invitada aceptada';
  RAISE NOTICE 'OK Token no persistido';
END;
$$;

-- CIERRE REAL DEL BORRADOR

LOCK TABLE auth.users IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF to_regprocedure(
    'public.rooms_block_beta_registration()'
  ) IS NULL THEN
    RAISE EXCEPTION 'STOP: blocking function missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_registration_closed'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'STOP: guard trigger missing';
  END IF;
END;
$$;

DROP TRIGGER rooms_beta_registration_closed
ON auth.users;

CREATE TRIGGER rooms_beta_registration_closed
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.rooms_block_beta_registration();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_registration_closed'
      AND tgfoid =
        'public.rooms_block_beta_registration()'
          ::regprocedure
      AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'STOP: closure not verified';
  END IF;
END;
$$;


DO $$
BEGIN
  BEGIN
    INSERT INTO auth.users(email, raw_user_meta_data)
    VALUES ('despues-cierre@example.test', '{}'::jsonb);
    RAISE EXCEPTION 'FAIL: cierre de emergencia ineficaz';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROOMS registration temporarily closed' THEN
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'OK Cierre de emergencia restaurado';
END;
$$;

ROLLBACK;

SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email IN (
      'activation-qa@example.test',
      'sin-invitacion@example.test',
      'despues-cierre@example.test'
    )
  ) THEN 'FAIL: usuarios QA persistidos'
  WHEN EXISTS (
    SELECT 1 FROM rooms_private.beta_invitations
    WHERE email_normalized = 'activation-qa@example.test'
  ) THEN 'FAIL: invitacion QA persistida'
  WHEN NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_invite_qa'
      AND NOT tgisinternal
  ) THEN 'FAIL: trigger QA original ausente'
  ELSE 'OK Estado anterior restaurado'
END AS verification;
