-- ROOMS M6.16S
-- BORRADOR DE REVISION. NO EJECUTAR EN SUPABASE.
-- Basado en la definicion instalada, consultada en M6.16E.
-- Requiere guard y claim coordinados antes de aplicarse.
-- No protege por si solo escrituras directas ni Storage.

CREATE OR REPLACE FUNCTION
  public.accept_household_invitation(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  _invitation public.household_invitations%ROWTYPE;
  _actor uuid;
BEGIN
  _actor := auth.uid();

  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Adquirir bloqueo antes de consultar o escribir.
  PERFORM public.rooms_assert_deletion_write_allowed(
    _actor
  );

  SELECT *
  INTO _invitation
  FROM public.household_invitations
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF _invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer available';
  END IF;

  IF _invitation.expires_at <= now() THEN
    UPDATE public.household_invitations
    SET status = 'expired'
    WHERE id = _invitation.id;

    RAISE EXCEPTION 'Invitation expired';
  END IF;

  INSERT INTO public.household_members (
    household_id,
    user_id,
    role,
    status
  )
  VALUES (
    _invitation.household_id,
    _actor,
    'member',
    'accepted'
  )
  ON CONFLICT (household_id, user_id)
  DO UPDATE SET status = 'accepted';

  UPDATE public.household_invitations
  SET
    status = 'accepted',
    accepted_by = _actor,
    accepted_at = now()
  WHERE id = _invitation.id;

  RETURN _invitation.household_id;
END;
$function$;
