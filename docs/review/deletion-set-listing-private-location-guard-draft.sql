-- ROOMS M6.16V
-- BORRADOR DE REVISION. NO EJECUTAR EN SUPABASE.
-- Definicion recuperada mediante pg_get_functiondef.
-- Cambios previstos: search_path restringido y guard
-- despues de autenticacion, antes de cualquier escritura.
-- No sustituye la proteccion de Storage ni otras rutas.

CREATE OR REPLACE FUNCTION public.set_listing_private_location(
  target_listing_id uuid,
  target_exact_address text,
  target_exact_latitude double precision,
  target_exact_longitude double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  current_user_id uuid;
  seed bigint;
  angle_radians double precision;
  radius_meters double precision;
  latitude_offset double precision;
  longitude_offset double precision;
  public_latitude double precision;
  public_longitude double precision;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- M6.16V: bloqueo coordinado con el claim.
  perform public.rooms_assert_deletion_write_allowed(
    current_user_id
  );

  if target_exact_address is null
     or length(trim(target_exact_address)) < 3 then
    raise exception 'Invalid address';
  end if;

  if target_exact_latitude not between -90 and 90 then
    raise exception 'Invalid latitude';
  end if;

  if target_exact_longitude not between -180 and 180 then
    raise exception 'Invalid longitude';
  end if;

  if not exists (
    select 1
    from public.listings
    where id = target_listing_id
      and owner_id = current_user_id
  ) then
    raise exception 'Listing not found or not owned by user';
  end if;

  /*
    Semilla estable derivada del anuncio.
    No cambia entre recargas.
  */
  seed :=
    (
      ('x' || substr(md5(target_listing_id::text), 1, 15))
      ::bit(60)::bigint
    );

  /*
    Angulo entre 0 y 360 grados.
  */
  angle_radians :=
    radians((seed % 360)::double precision);

  /*
    Radio estable entre 180 y 300 metros.
  */
  radius_meters :=
    180 + (seed % 121);

  /*
    Aproximacion geografica:
    1 grado latitud equivale aproximadamente a 111320 m.
  */
  latitude_offset :=
    (radius_meters / 111320.0) * cos(angle_radians);

  longitude_offset :=
    (
      radius_meters
      /
      (
        111320.0 *
        greatest(
          abs(cos(radians(target_exact_latitude))),
          0.01
        )
      )
    ) * sin(angle_radians);

  public_latitude :=
    target_exact_latitude + latitude_offset;

  public_longitude :=
    target_exact_longitude + longitude_offset;

  insert into public.listing_private_locations (
    listing_id,
    owner_id,
    exact_address,
    exact_latitude,
    exact_longitude,
    updated_at
  )
  values (
    target_listing_id,
    current_user_id,
    trim(target_exact_address),
    target_exact_latitude,
    target_exact_longitude,
    now()
  )
  on conflict (listing_id)
  do update set
    exact_address = excluded.exact_address,
    exact_latitude = excluded.exact_latitude,
    exact_longitude = excluded.exact_longitude,
    updated_at = now();

  update public.listings
  set
    latitude = public_latitude,
    longitude = public_longitude,
    location_precision = 'approximate',
    updated_at = now()
  where id = target_listing_id
    and owner_id = current_user_id;

  return jsonb_build_object(
    'listing_id', target_listing_id,
    'latitude', public_latitude,
    'longitude', public_longitude,
    'location_precision', 'approximate',
    'approximation_radius_meters', radius_meters
  );
end;
$function$;
