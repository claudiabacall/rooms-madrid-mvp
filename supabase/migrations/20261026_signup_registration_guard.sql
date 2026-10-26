-- ROOMS M6.2D
-- Propuesta de proteccion del registro.
-- NO APLICAR sin revisar el estado real de Supabase.
--
-- Requisitos para toda nueva cuenta:
-- 1. Declaracion expresa de mayoria de edad.
-- 2. Aceptacion expresa de las condiciones.
-- 3. Version de condiciones vigente y publicada.
--
-- Esta version elimina la excepcion historica que
-- permitia altas sin documentos vigentes.

CREATE OR REPLACE FUNCTION
  public.capture_signup_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_version text;
  v_accepted_version text;
BEGIN
  SELECT version
    INTO v_current_version
  FROM public.legal_document_versions
  WHERE document_type = 'terms'
    AND is_current = true
    AND published_at IS NOT NULL;

  IF v_current_version IS NULL THEN
    RAISE EXCEPTION
      'Registration unavailable: no current terms';
  END IF;

  IF (
    NEW.raw_user_meta_data -> 'rooms_age_18_confirmed'
  ) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Adult declaration required';
  END IF;

  IF (
    NEW.raw_user_meta_data -> 'rooms_terms_accepted'
  ) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Terms acceptance required';
  END IF;

  v_accepted_version :=
    NEW.raw_user_meta_data ->> 'rooms_terms_version';

  IF v_accepted_version IS DISTINCT FROM v_current_version THEN
    RAISE EXCEPTION 'Terms version not current';
  END IF;

  INSERT INTO public.legal_acceptances (
    user_id,
    document_type,
    version,
    accepted_at
  )
  VALUES (
    NEW.id,
    'terms',
    v_accepted_version,
    now()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  public.capture_signup_terms_acceptance()
FROM PUBLIC, anon, authenticated;

-- No se modifica el trigger existente.
-- Se debe verificar que rooms_capture_signup_terms
-- sigue asociado a auth.users antes de aplicar.
