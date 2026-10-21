-- ROOMS: exigir declaracion 18+ y condiciones vigentes
-- durante el alta de usuarios.
--
-- No publica condiciones ni activa el registro.
-- Mientras no exista una version vigente de condiciones,
-- las cuentas QA administrativas pueden seguir creandose.
--
-- IMPORTANTE: la declaracion de edad es autodeclarada,
-- no una comprobacion documental independiente.

CREATE OR REPLACE FUNCTION public.capture_signup_terms_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_version text;
  v_current_version text;
BEGIN
  SELECT version
  INTO v_current_version
  FROM public.legal_document_versions
  WHERE document_type = 'terms'
    AND is_current = true
    AND published_at IS NOT NULL;

  -- El lanzamiento no se activa desde esta migracion.
  IF v_current_version IS NULL THEN
    RETURN NEW;
  END IF;

  -- Comprobacion de la declaracion 18+.
  IF (
    NEW.raw_user_meta_data -> 'rooms_age_18_confirmed'
  ) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Adult declaration required';
  END IF;

  -- Aceptacion expresa de condiciones.
  IF (
    NEW.raw_user_meta_data -> 'rooms_terms_accepted'
  ) IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Terms acceptance required';
  END IF;

  v_version :=
    NEW.raw_user_meta_data ->> 'rooms_terms_version';

  IF v_version IS DISTINCT FROM v_current_version THEN
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
    v_version,
    now()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  public.capture_signup_terms_acceptance()
FROM PUBLIC, anon, authenticated;
