-- ROOMS M5.18G - BORRADOR SIN DESPLIEGUE
-- NO EJECUTAR EN SUPABASE.
-- Cobertura limitada a messages y connections.
-- El claim administrativo actual todavia NO usa
-- el mismo advisory lock.
-- NO habilita eliminaciones ni limpieza privilegiada.

CREATE OR REPLACE FUNCTION
  public.rooms_guard_shared_relation_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_ids uuid[];
  affected_id uuid;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public'
     OR TG_TABLE_NAME NOT IN ('messages', 'connections') THEN
    RAISE EXCEPTION 'Unsupported deletion guard target';
  END IF;

  IF TG_TABLE_NAME = 'messages' THEN
    IF TG_OP = 'INSERT' THEN
      affected_ids := ARRAY[NEW.sender_id, NEW.recipient_id];
    ELSIF TG_OP = 'DELETE' THEN
      affected_ids := ARRAY[OLD.sender_id, OLD.recipient_id];
    ELSE
      affected_ids := ARRAY[
        OLD.sender_id, OLD.recipient_id,
        NEW.sender_id, NEW.recipient_id
      ];
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      affected_ids := ARRAY[NEW.requester_id, NEW.recipient_id];
    ELSIF TG_OP = 'DELETE' THEN
      affected_ids := ARRAY[OLD.requester_id, OLD.recipient_id];
    ELSE
      affected_ids := ARRAY[
        OLD.requester_id, OLD.recipient_id,
        NEW.requester_id, NEW.recipient_id
      ];
    END IF;
  END IF;

  IF array_position(affected_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Missing affected identity';
  END IF;

  -- Orden estable para reducir interbloqueos
  -- entre escrituras que afectan a dos personas.
  FOR affected_id IN
    SELECT DISTINCT x
    FROM unnest(affected_ids) AS ids(x)
    ORDER BY x
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(affected_id::text, 0)
    );
  END LOOP;

  -- El resultado debe incluir las relaciones de
  -- ambas personas. No se confia solo en RLS.
  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_audit AS a
    WHERE a.target_user_id = ANY(affected_ids)
      AND a.status IN ('started', 'processing')
  ) THEN
    RAISE EXCEPTION 'Account deletion write blocked';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  public.rooms_guard_shared_relation_write()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER rooms_messages_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_shared_relation_write();

CREATE TRIGGER rooms_connections_deletion_write_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.connections
FOR EACH ROW
EXECUTE FUNCTION public.rooms_guard_shared_relation_write();
