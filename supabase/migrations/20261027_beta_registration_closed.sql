-- ROOMS M6.13E
-- Reproduce el bloqueo temporal instalado en Supabase.
-- No elimina usuarios existentes.
-- ADVERTENCIA: bloquea toda insercion nueva en auth.users,
-- incluidas cuentas QA y altas administrativas.
-- No ejecutar nuevamente en produccion sin plan de cambios.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rooms_block_beta_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION
    'ROOMS registration temporarily closed'
    USING ERRCODE = 'P0001';

  RETURN NULL;
END;
$$;

REVOKE ALL
ON FUNCTION public.rooms_block_beta_registration()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS
  rooms_beta_registration_closed
ON auth.users;

CREATE TRIGGER rooms_beta_registration_closed
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.rooms_block_beta_registration();

COMMIT;
