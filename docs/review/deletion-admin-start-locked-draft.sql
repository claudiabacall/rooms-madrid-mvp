-- ROOMS M6.18B
-- BORRADOR QA. NO EJECUTAR EN SUPABASE.
-- No elimina usuarios, archivos ni datos.
-- Solo admite cuentas desechables verificadas.
-- Pendiente: identidad del operador y revocacion de
-- escrituras directas privilegiadas sobre auditoria.

CREATE OR REPLACE FUNCTION
public.rooms_admin_start_disposable_deletion(
  p_target_id uuid,
  p_operator_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_audit_id uuid;
BEGIN
  IF p_target_id IS NULL OR p_operator_id IS NULL THEN
    RAISE EXCEPTION 'Identificadores requeridos';
  END IF;

  -- Mismo bloqueo utilizado por el guard y el claim.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_target_id::text, 0)
  );

  -- Mantener el alcance limitado a QA.
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_target_id
      AND u.raw_user_meta_data
        ->> 'rooms_deletion_test' = 'true'
      AND u.email ~
        '^rooms-delete-qa-[a-z0-9]+@example\.com$'
  ) THEN
    RAISE EXCEPTION 'Cuenta desechable no verificada';
  END IF;

  -- Validar y bloquear la solicitud original.
  PERFORM 1
  FROM public.account_deletion_requests r
  WHERE r.user_id = p_target_id
    AND r.status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud pendiente no encontrada';
  END IF;

  -- Evitar auditorias activas duplicadas.
  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_audit a
    WHERE a.target_user_id = p_target_id
      AND a.status IN ('started', 'processing')
  ) THEN
    RAISE EXCEPTION 'Ya existe una baja activa';
  END IF;

  INSERT INTO public.account_deletion_audit (
    target_user_id,
    operator_id,
    status
  )
  VALUES (
    p_target_id,
    p_operator_id,
    'started'
  )
  RETURNING id INTO v_audit_id;

  UPDATE public.account_deletion_requests
  SET status = 'processing'
  WHERE user_id = p_target_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud modificada concurrentemente';
  END IF;

  RETURN v_audit_id;
END;
$function$;

REVOKE ALL ON FUNCTION
public.rooms_admin_start_disposable_deletion(uuid,uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.rooms_admin_start_disposable_deletion(uuid,uuid)
TO service_role;
