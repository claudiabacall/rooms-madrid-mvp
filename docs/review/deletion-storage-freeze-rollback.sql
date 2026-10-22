-- ROOMS M5 · REVERSION CONTROLADA
-- NO EJECUTAR SALVO REVERSION AUTORIZADA.

BEGIN;

DROP POLICY IF EXISTS
  rooms_deletion_storage_insert
ON storage.objects;

DROP POLICY IF EXISTS
  rooms_deletion_storage_update
ON storage.objects;

DROP POLICY IF EXISTS
  rooms_deletion_storage_delete
ON storage.objects;

DROP FUNCTION IF EXISTS
  public.rooms_storage_write_allowed();

COMMIT;
