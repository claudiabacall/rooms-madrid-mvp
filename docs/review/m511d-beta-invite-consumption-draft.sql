-- ROOMS M5.11D
-- BORRADOR TECNICO. NO EJECUTAR EN SUPABASE.
-- NO crea triggers ni abre el registro.
-- Requiere revision de propietario, privilegios,
-- concurrencia, email confirmado y flujo Auth.
--
-- Contrato previsto del token:
-- 32 bytes aleatorios, representados en base64url
-- sin relleno (43 caracteres).
--
-- La emision segura de tokens NO esta implementada.

CREATE OR REPLACE FUNCTION
  rooms_private.consume_beta_invite_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
  v_terms_version text;
  v_invitation_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Operacion no permitida';
  END IF;

  -- Exigir documentos legales vigentes.
  IF NOT EXISTS (
    SELECT 1
    FROM public.legal_document_versions
    WHERE document_type = 'privacy'
      AND is_current = true
      AND published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Registro no autorizado';
  END IF;

  SELECT version INTO v_terms_version
  FROM public.legal_document_versions
  WHERE document_type = 'terms'
    AND is_current = true
    AND published_at IS NOT NULL;

  IF v_terms_version IS NULL
     OR NEW.raw_user_meta_data
       -> 'rooms_age_18_confirmed'
       IS DISTINCT FROM 'true'::jsonb
     OR NEW.raw_user_meta_data
       -> 'rooms_terms_accepted'
       IS DISTINCT FROM 'true'::jsonb
     OR NEW.raw_user_meta_data
       ->> 'rooms_terms_version'
       IS DISTINCT FROM v_terms_version THEN
    RAISE EXCEPTION 'Registro no autorizado';
  END IF;

  v_token :=
    NEW.raw_user_meta_data
      ->> 'rooms_beta_invite_token';

  IF NEW.email IS NULL
     OR v_token IS NULL
     OR v_token !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION 'Invitacion no valida';
  END IF;

  -- UPDATE condicional: bloquea la fila y
  -- permite que solo una transaccion la consuma.
  UPDATE rooms_private.beta_invitations
  SET used_at = transaction_timestamp()
  WHERE token_digest =
    extensions.digest(v_token, 'sha256')
    AND email_normalized =
      pg_catalog.lower(pg_catalog.btrim(NEW.email))
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > statement_timestamp()
  RETURNING id INTO v_invitation_id;

  IF v_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Invitacion no valida';
  END IF;

  -- Evitar almacenar el token en los metadatos
  -- persistidos del nuevo usuario.
  NEW.raw_user_meta_data :=
    NEW.raw_user_meta_data
      - 'rooms_beta_invite_token';

  RETURN NEW;
END;
$$;

-- NO CREAR EL TRIGGER EN ESTA FASE.
-- NO RETIRAR rooms_beta_registration_closed.
-- NO CONCEDER PERMISOS DE EJECUCION PUBLICOS.
--
-- Pendientes antes de aplicar:
-- 1. Revisar propiedad y permisos SECURITY DEFINER.
-- 2. Verificar compatibilidad con Supabase Auth.
-- 3. Revisar confirmacion efectiva del email.
-- 4. Implementar emision y revocacion seguras.
-- 5. Probar concurrencia con PostgreSQL aislado.
-- 6. Probar rollback ante fallo posterior de Auth.
-- 7. Verificar aceptacion legal AFTER INSERT.
-- 8. Preparar activacion y rollback controlados.
