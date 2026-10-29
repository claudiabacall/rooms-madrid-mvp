\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'rooms_beta_invite_qa' THEN
    RAISE EXCEPTION 'STOP: base no autorizada';
  END IF;

  IF to_regclass('rooms_private.beta_invitations') IS NULL THEN
    RAISE EXCEPTION 'STOP: esquema QA incompleto';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'rooms_beta_registration_closed'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'STOP: trigger QA preexistente';
  END IF;
END;
$$;

-- El test M5.17B dejo instalado un trigger QA.
-- Retirarlo solo dentro de esta transaccion evita
-- consumir dos veces una misma invitacion.
-- ROLLBACK restaura el estado original.
DROP TRIGGER IF EXISTS rooms_beta_invite_qa
ON auth.users;

CREATE FUNCTION public.rooms_block_beta_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'ROOMS registration temporarily closed';
END;
$$;

CREATE TRIGGER rooms_beta_registration_closed
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.rooms_block_beta_registration();

INSERT INTO rooms_private.beta_invitations (
  email_normalized,
  token_digest,
  expires_at
)
VALUES (
  'transition@example.test',
  extensions.digest(repeat('D', 43), 'sha256'),
  now() + interval '1 day'
);

DO $$
DECLARE
  meta jsonb := jsonb_build_object(
    'rooms_age_18_confirmed', true,
    'rooms_terms_accepted', true,
    'rooms_terms_version', 'qa-1',
    'rooms_beta_invite_token', repeat('D', 43)
  );
BEGIN
  BEGIN
    INSERT INTO auth.users(email, raw_user_meta_data)
    VALUES ('transition@example.test', meta);

    RAISE EXCEPTION 'FAIL: closed gate allowed signup';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROOMS registration temporarily closed' THEN
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'OK Closed gate rejects valid invitation';
END;
$$;

DROP TRIGGER rooms_beta_registration_closed ON auth.users;

CREATE TRIGGER rooms_beta_registration_closed
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION rooms_private.consume_beta_invite_on_signup();

DO $$
DECLARE
  meta jsonb := jsonb_build_object(
    'rooms_age_18_confirmed', true,
    'rooms_terms_accepted', true,
    'rooms_terms_version', 'qa-1',
    'rooms_beta_invite_token', repeat('D', 43)
  );
  persisted jsonb;
BEGIN
  BEGIN
    INSERT INTO auth.users(email, raw_user_meta_data)
    VALUES ('uninvited@example.test', meta);

    RAISE EXCEPTION 'FAIL: uninvited signup allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Invitacion no valida' THEN
      RAISE;
    END IF;
  END;

  INSERT INTO auth.users(email, raw_user_meta_data)
  VALUES ('transition@example.test', meta)
  RETURNING raw_user_meta_data INTO persisted;

  IF persisted ? 'rooms_beta_invite_token' THEN
    RAISE EXCEPTION 'FAIL: token persisted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rooms_private.beta_invitations
    WHERE email_normalized = 'transition@example.test'
      AND used_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: token not consumed';
  END IF;

  RAISE NOTICE 'OK Uninvited signup rejected';
  RAISE NOTICE 'OK Invited signup accepted';
  RAISE NOTICE 'OK Token consumed and removed';
END;
$$;

DROP TRIGGER rooms_beta_registration_closed ON auth.users;

CREATE TRIGGER rooms_beta_registration_closed
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.rooms_block_beta_registration();

DO $$
BEGIN
  BEGIN
    INSERT INTO auth.users(email, raw_user_meta_data)
    VALUES ('another@example.test', '{}'::jsonb);

    RAISE EXCEPTION 'FAIL: restored gate allowed signup';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROOMS registration temporarily closed' THEN
      RAISE;
    END IF;
  END;

  RAISE NOTICE 'OK Emergency closure restored';
END;
$$;

ROLLBACK;

SELECT
  CASE
    WHEN count(*) = 0
    THEN 'OK QA transition rolled back'
    ELSE 'FAIL unexpected persisted QA users'
  END AS result
FROM auth.users
WHERE email IN (
  'transition@example.test',
  'uninvited@example.test',
  'another@example.test'
);
