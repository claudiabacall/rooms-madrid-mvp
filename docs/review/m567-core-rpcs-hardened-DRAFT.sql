-- ROOMS M5.40
-- BORRADOR: NO APLICAR DIRECTAMENTE EN PRODUCCION.
-- Cuatro RPC que faltan en una instalacion nueva.
-- Revisar y probar en QA antes de convertir en migracion.

-- 1. Consultar invitacion por token.
CREATE OR REPLACE FUNCTION public.get_household_invitation(
  _token uuid
)
RETURNS TABLE (
  household_id uuid,
  household_name text,
  invitation_status text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    i.household_id,
    h.name,
    i.status,
    i.expires_at
  FROM public.household_invitations i
  JOIN public.households h
    ON h.id = i.household_id
  WHERE i.token = _token
    AND auth.uid() IS NOT NULL
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION
  public.get_household_invitation(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.get_household_invitation(uuid)
TO authenticated;


-- 2. Aceptar invitacion y crear membresia.
CREATE OR REPLACE FUNCTION public.accept_household_invitation(
  _token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_inv public.household_invitations%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_inv
  FROM public.household_invitations
  WHERE token = _token
  FOR UPDATE;

  IF NOT FOUND
     OR v_inv.status <> 'pending'
     OR v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.households
    WHERE id = v_inv.household_id
      AND owner_id = v_user
  ) THEN
    RAISE EXCEPTION 'Already household owner';
  END IF;

  INSERT INTO public.household_members (
    household_id, user_id, role, status
  )
  VALUES (
    v_inv.household_id, v_user, 'member', 'accepted'
  )
  ON CONFLICT (household_id, user_id)
  DO UPDATE SET
    status = 'accepted'
  WHERE public.household_members.role = 'member';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership could not be accepted';
  END IF;

  UPDATE public.household_invitations
  SET
    status = 'accepted',
    accepted_by = v_user,
    accepted_at = now()
  WHERE id = v_inv.id;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.accept_household_invitation(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.accept_household_invitation(uuid)
TO authenticated;


-- 3. Obtener exclusivamente los usuarios bloqueados.
CREATE OR REPLACE FUNCTION public.get_blocked_profiles()
RETURNS TABLE (
  id uuid,
  alias text,
  name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    p.id,
    p.alias,
    p.name,
    p.avatar_url
  FROM public.user_blocks b
  JOIN public.profiles p
    ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
    AND auth.uid() IS NOT NULL
  ORDER BY b.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION
  public.get_blocked_profiles()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.get_blocked_profiles()
TO authenticated;


-- 4. Guardar la ubicacion exacta de un anuncio propio.
CREATE OR REPLACE FUNCTION public.set_listing_private_location(
  target_listing_id uuid,
  target_exact_address text,
  target_exact_latitude double precision,
  target_exact_longitude double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.listings
    WHERE id = target_listing_id
      AND owner_id = v_user
  ) THEN
    RAISE EXCEPTION 'Listing not owned by user';
  END IF;

  IF target_exact_address IS NULL
     OR length(btrim(target_exact_address)) = 0
     OR target_exact_latitude IS NULL
     OR target_exact_longitude IS NULL
     OR target_exact_latitude::text IN ('NaN', 'Infinity', '-Infinity')
     OR target_exact_longitude::text IN ('NaN', 'Infinity', '-Infinity')
     OR target_exact_latitude NOT BETWEEN -90 AND 90
     OR target_exact_longitude NOT BETWEEN -180 AND 180
  THEN
    RAISE EXCEPTION 'Invalid private location';
  END IF;

  INSERT INTO public.listing_private_locations (
    listing_id,
    owner_id,
    exact_address,
    exact_latitude,
    exact_longitude
  )
  VALUES (
    target_listing_id,
    v_user,
    target_exact_address,
    target_exact_latitude,
    target_exact_longitude
  )
  ON CONFLICT (listing_id)
  DO UPDATE SET
    exact_address = EXCLUDED.exact_address,
    exact_latitude = EXCLUDED.exact_latitude,
    exact_longitude = EXCLUDED.exact_longitude,
    updated_at = now()
  WHERE public.listing_private_locations.owner_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Private location could not be saved';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION
  public.set_listing_private_location(
    uuid, text, double precision, double precision
  )
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.set_listing_private_location(
    uuid, text, double precision, double precision
  )
TO authenticated;
