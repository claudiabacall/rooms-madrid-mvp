\set ON_ERROR_STOP on
BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'postgres'
     OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'STOP: identidad SQL inesperada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.listings'::regclass
      AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.profiles'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'STOP: RLS no activo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listings'
      AND policyname = 'Ver anuncios publicados'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Cada usuario ve su propio perfil'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'STOP: politicas esperadas ausentes';
  END IF;

  IF has_table_privilege('anon', 'public.listings', 'SELECT')
     OR has_table_privilege('anon', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'STOP: permisos anon inesperados';
  END IF;
END;
$guard$;

GRANT SELECT ON TABLE public.listings TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

DO $verify$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.listings', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT')
     OR has_table_privilege('anon', 'public.listings', 'SELECT')
     OR has_table_privilege('anon', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'STOP: permisos finales incorrectos';
  END IF;

  RAISE NOTICE 'OK authenticated puede consultar ambas tablas';
  RAISE NOTICE 'OK anon sigue sin acceso';
  RAISE NOTICE 'OK RLS permanece activo';
END;
$verify$;

COMMIT;
\echo OK_ROOMS_M610_GRANTS_APPLIED
