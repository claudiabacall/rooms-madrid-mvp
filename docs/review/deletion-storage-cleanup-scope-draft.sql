-- ROOMS M6.19N
-- BORRADOR LOCAL. NO INSTALAR EN SUPABASE.
--
-- Autorizaciones administrativas por objeto exacto.
-- No deshabilita triggers, RLS ni el guard existente.
-- Necesita integracion con el guard y pruebas SQL/API.
-- No autoriza por si mismo ningun borrado.

CREATE TABLE public.rooms_storage_cleanup_scope (
  bucket_id text NOT NULL,
  object_name text NOT NULL,
  target_user_id uuid NOT NULL,
  audit_id uuid NOT NULL,
  claim_token uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (bucket_id, object_name)
);

REVOKE ALL
ON public.rooms_storage_cleanup_scope
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION
public.rooms_admin_authorize_storage_cleanup(
  p_audit_id uuid,
  p_target_id uuid,
  p_claim_token uuid,
  p_bucket text,
  p_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_object record;
  v_identifiers uuid[] := ARRAY[]::uuid[];
  v_value text;
BEGIN
  IF p_audit_id IS NULL
     OR p_target_id IS NULL
     OR p_claim_token IS NULL
     OR p_bucket IS NULL
     OR p_name IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  IF p_bucket NOT IN (
    'avatars',
    'listing-images',
    'community-images',
    'community-post-media'
  ) THEN
    RAISE EXCEPTION 'Bucket no autorizado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_target_id
      AND u.raw_user_meta_data
        ->> 'rooms_deletion_test' = 'true'
      AND u.email ~
        '^rooms-delete-qa-[a-z0-9]+@example\.com$'
  ) THEN
    RAISE EXCEPTION 'Cuenta desechable no verificada';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_target_id::text, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.account_deletion_audit a
    WHERE a.id = p_audit_id
      AND a.target_user_id = p_target_id
      AND a.claim_token = p_claim_token
      AND a.status = 'processing'
      AND a.claimed_at IS NOT NULL
      AND a.finished_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Claim administrativo no vigente';
  END IF;

  SELECT o.owner::text AS owner,
         o.owner_id,
         o.name
  INTO v_object
  FROM storage.objects o
  WHERE o.bucket_id = p_bucket
    AND o.name = p_name
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Objeto Storage no encontrado';
  END IF;

  -- Todas las identidades presentes deben coincidir.
  -- Nunca se acepta un archivo de propietario mixto.
  FOREACH v_value IN ARRAY ARRAY[
    v_object.owner,
    v_object.owner_id,
    pg_catalog.split_part(v_object.name, '/', 1)
  ]
  LOOP
    IF v_value IS NULL OR v_value = '' THEN
      CONTINUE;
    END IF;

    IF v_value ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN
      v_identifiers := v_identifiers || v_value::uuid;
    ELSIF v_value = v_object.owner
       OR v_value = v_object.owner_id THEN
      RAISE EXCEPTION 'Propietario Storage no valido';
    END IF;
  END LOOP;

  IF pg_catalog.array_length(v_identifiers, 1) IS NULL
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.unnest(v_identifiers) AS x(uid)
       WHERE x.uid <> p_target_id
     ) THEN
    RAISE EXCEPTION 'Objeto ajeno o propietario ambiguo';
  END IF;

  INSERT INTO public.rooms_storage_cleanup_scope (
    bucket_id,
    object_name,
    target_user_id,
    audit_id,
    claim_token,
    expires_at
  )
  VALUES (
    p_bucket,
    p_name,
    p_target_id,
    p_audit_id,
    p_claim_token,
    pg_catalog.clock_timestamp()
      + INTERVAL '5 minutes'
  );
END;
$function$;

REVOKE ALL ON FUNCTION
public.rooms_admin_authorize_storage_cleanup(
  uuid,uuid,uuid,text,text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rooms_admin_authorize_storage_cleanup(
  uuid,uuid,uuid,text,text
)
TO service_role;
