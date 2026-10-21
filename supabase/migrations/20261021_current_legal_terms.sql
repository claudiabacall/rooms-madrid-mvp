-- ROOMS: una sola version vigente de condiciones.
-- No publica documentos ni abre el registro.

ALTER TABLE public.legal_document_versions
ADD COLUMN IF NOT EXISTS is_current boolean
NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS
  legal_document_versions_one_current
ON public.legal_document_versions(document_type)
WHERE is_current = true;

ALTER TABLE public.legal_document_versions
DROP CONSTRAINT IF EXISTS
  legal_document_versions_current_requires_publication;

ALTER TABLE public.legal_document_versions
ADD CONSTRAINT
  legal_document_versions_current_requires_publication
CHECK (
  is_current = false
  OR published_at IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.record_terms_acceptance(
  p_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.legal_document_versions
    WHERE document_type = 'terms'
      AND version = p_version
      AND published_at IS NOT NULL
      AND is_current = true
  ) THEN
    RAISE EXCEPTION 'Terms version not current';
  END IF;

  INSERT INTO public.legal_acceptances (
    user_id,
    document_type,
    version,
    accepted_at
  )
  VALUES (
    v_user_id,
    'terms',
    p_version,
    now()
  )
  ON CONFLICT (user_id, document_type, version)
    DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION
  public.record_terms_acceptance(text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.record_terms_acceptance(text)
TO authenticated;

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

  -- Ninguna version vigente: beta aun sin activar.
  IF v_current_version IS NULL THEN
    RETURN NEW;
  END IF;

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
