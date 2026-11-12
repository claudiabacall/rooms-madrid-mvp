-- ROOMS M8.11
-- Integridad de anuncios y privacidad de ubicaciones.
-- Validado en Supabase QA mediante M8.09 y M8.10.
--
-- Las coordenadas publicas son gestionadas por la funcion
-- SECURITY DEFINER set_listing_private_location.
--
-- Los clientes pueden crear y editar datos funcionales,
-- pero no pueden manipular campos tecnicos o coordenadas.

BEGIN;

REVOKE INSERT, UPDATE
ON TABLE public.listings
FROM authenticated;

GRANT INSERT (
  owner_id,
  kind,
  title,
  zone,
  price,
  available_from,
  duration,
  rooms,
  baths,
  area,
  furnished,
  features,
  photos,
  description,
  source_url,
  status,
  location_precision
)
ON TABLE public.listings
TO authenticated;

GRANT UPDATE (
  kind,
  title,
  zone,
  price,
  available_from,
  duration,
  rooms,
  baths,
  area,
  furnished,
  features,
  photos,
  description,
  source_url,
  status
)
ON TABLE public.listings
TO authenticated;

ALTER POLICY "Crear anuncios propios"
ON public.listings
WITH CHECK (
  owner_id = auth.uid()
  AND location_precision = 'approximate'
  AND latitude IS NULL
  AND longitude IS NULL
);

COMMIT;
