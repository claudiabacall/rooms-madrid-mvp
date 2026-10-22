-- STORAGE: NO instalar triggers sobre storage.objects.
-- Diseñar controles mediante RLS de Storage y API oficial.
-- El bloqueo transaccional del claim NO cubre todavía
-- operaciones Storage: concurrencia pendiente.
-- No ejecutar este borrador.

-- ROOMS M4 · BORRADOR NO EJECUTABLE SIN REVISION
-- NO APLICAR A SUPABASE.
-- Falta coordinar bloqueos transaccionales con el
-- claim administrativo y revisar funciones privilegiadas.
-- No completa auditorias ni elimina usuarios.

BEGIN;

CREATE OR REPLACE FUNCTION
  public.rooms_guard_deleting_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor uuid;
BEGIN
  -- Solo actividad iniciada con sesion autenticada.
  -- Las operaciones administrativas requieren
  -- controles independientes.
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN CASE
      WHEN TG_OP = 'DELETE' THEN OLD
      ELSE NEW
    END;
  END IF;

  v_actor := auth.uid();

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Identidad no disponible';
  END IF;

  -- Serializar escrituras del usuario con su claim.
  -- La proteccion solo sirve si todos los caminos
  -- relevantes adquieren este mismo bloqueo.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_audit a
    WHERE a.target_user_id = v_actor
      AND a.status = 'processing'
  ) THEN
    RAISE EXCEPTION
      'Cuenta en proceso de eliminacion';
  END IF;

  RETURN CASE
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_guard_deleting_account()
FROM PUBLIC, anon, authenticated;

-- Triggers de propuesta. No aplicar antes de revisar
-- concurrencia, permisos y comportamiento de Storage.

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.connections
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.conversation_preferences
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.household_candidate_votes
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.household_candidates
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.household_invitations
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.household_members
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.household_person_candidates
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.households
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.listing_private_locations
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.match_preferences
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.onboarding_preferences
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.rooms_dna
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.saved_collection_items
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.saved_collections
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.saved_items
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.user_blocks
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.user_intents
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();


-- Cobertura adicional:
-- record_terms_acceptance() escribe con SECURITY DEFINER.
-- Pendiente validar el efecto sobre trazabilidad legal.

CREATE TRIGGER rooms_guard_deletion_writes
BEFORE INSERT OR UPDATE OR DELETE
ON public.legal_acceptances
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_deleting_account();


COMMIT;
