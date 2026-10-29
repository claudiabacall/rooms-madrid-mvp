-- ROOMS M5.17D
-- BORRADOR DE CIERRE DE EMERGENCIA.
-- NO EJECUTAR SIN AUTORIZACION.
-- Requiere funcion de bloqueo existente y verificada.

BEGIN;

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

COMMIT;
