-- ROOMS M6.17L
-- BORRADOR DE REVISION. NO EJECUTAR EN SUPABASE.
-- DEPENDENCIA: public.rooms_deletion_row_guard().
-- NO AUTORIZADO PARA DESPLIEGUE.
-- Requiere revisar permisos, cascadas, concurrencia
-- multi-fila, limpieza administrativa y Storage.
-- Las columnas se verifican en produccion antes de
-- permitir cualquier instalacion futura.

DO $check$
BEGIN
  IF to_regprocedure(
    'public.rooms_deletion_row_guard()'
  ) IS NULL THEN
    RAISE EXCEPTION 'Missing deletion row guard';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.communities'::regclass
      AND attname = 'owner_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.communities.owner_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.communities'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.communities';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.connections'::regclass
      AND attname = 'requester_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.connections.requester_id';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.connections'::regclass
      AND attname = 'recipient_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.connections.recipient_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.connections'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.connections';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.conversation_preferences'::regclass
      AND attname = 'user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.conversation_preferences.user_id';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.conversation_preferences'::regclass
      AND attname = 'other_user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.conversation_preferences.other_user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.conversation_preferences'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.conversation_preferences';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.households'::regclass
      AND attname = 'owner_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.households.owner_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.households'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.households';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.legal_acceptances'::regclass
      AND attname = 'user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.legal_acceptances.user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.legal_acceptances'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.legal_acceptances';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.listings'::regclass
      AND attname = 'owner_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.listings.owner_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.listings'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.listings';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.match_preferences'::regclass
      AND attname = 'user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.match_preferences.user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.match_preferences'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.match_preferences';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.messages'::regclass
      AND attname = 'sender_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.messages.sender_id';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.messages'::regclass
      AND attname = 'recipient_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.messages.recipient_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.messages'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.messages';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.onboarding_preferences'::regclass
      AND attname = 'user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.onboarding_preferences.user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.onboarding_preferences'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.onboarding_preferences';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.profiles.id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.profiles';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.reports'::regclass
      AND attname = 'reporter_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.reports.reporter_id';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.reports'::regclass
      AND attname = 'reported_user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.reports.reported_user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.reports'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.reports';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.rooms_dna'::regclass
      AND attname = 'user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.rooms_dna.user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.rooms_dna'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.rooms_dna';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.saved_collections'::regclass
      AND attname = 'user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.saved_collections.user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.saved_collections'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.saved_collections';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.saved_items'::regclass
      AND attname = 'user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.saved_items.user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.saved_items'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.saved_items';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.user_blocks'::regclass
      AND attname = 'blocker_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.user_blocks.blocker_id';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.user_blocks'::regclass
      AND attname = 'blocked_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.user_blocks.blocked_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.user_blocks'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.user_blocks';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.user_intents'::regclass
      AND attname = 'user_id'
      AND atttypid = 'pg_catalog.uuid'::regtype
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION
      'Invalid UUID column: public.user_intents.user_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.user_intents'::regclass
      AND tgname = 'rooms_deletion_write_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Guard trigger already exists: public.user_intents';
  END IF;
END;
$check$;

-- Tabla: public.communities
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'owner_id'
);

-- Tabla: public.connections
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.connections
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'requester_id', 'recipient_id'
);

-- Tabla: public.conversation_preferences
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.conversation_preferences
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'user_id', 'other_user_id'
);

-- Tabla: public.households
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.households
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'owner_id'
);

-- Tabla: public.legal_acceptances
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.legal_acceptances
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'user_id'
);

-- Tabla: public.listings
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'owner_id'
);

-- Tabla: public.match_preferences
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.match_preferences
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'user_id'
);

-- Tabla: public.messages
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'sender_id', 'recipient_id'
);

-- Tabla: public.onboarding_preferences
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.onboarding_preferences
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'user_id'
);

-- Tabla: public.profiles
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'id'
);

-- Tabla: public.reports
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'reporter_id', 'reported_user_id'
);

-- Tabla: public.rooms_dna
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.rooms_dna
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'user_id'
);

-- Tabla: public.saved_collections
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.saved_collections
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'user_id'
);

-- Tabla: public.saved_items
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.saved_items
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'user_id'
);

-- Tabla: public.user_blocks
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.user_blocks
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'blocker_id', 'blocked_id'
);

-- Tabla: public.user_intents
CREATE TRIGGER rooms_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE
ON public.user_intents
FOR EACH ROW
EXECUTE FUNCTION public.rooms_deletion_row_guard(
  'user_id'
);
