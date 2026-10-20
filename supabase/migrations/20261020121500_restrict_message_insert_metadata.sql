-- ROOMS: restringir metadatos de mensajes.
-- Aplicacion manual tras revision. No db push.
--
-- Solo se permite INSERT de sender_id, recipient_id y body.
-- created_at utiliza DEFAULT now().
-- read_at utiliza DEFAULT NULL.
-- UPDATE(read_at) y las politicas RLS se conservan.

BEGIN;

-- Retirar permisos generales y especificos heredados
-- para el rol authenticated.
REVOKE INSERT ON TABLE public.messages
FROM authenticated;

REVOKE INSERT (created_at, read_at)
ON TABLE public.messages
FROM authenticated;

-- Conceder exclusivamente las columnas necesarias.
GRANT INSERT (sender_id, recipient_id, body)
ON TABLE public.messages
TO authenticated;

-- Verificar privilegios efectivos antes del COMMIT.
DO $$
BEGIN
  IF has_table_privilege(
    'authenticated', 'public.messages', 'INSERT'
  ) OR has_column_privilege(
    'authenticated', 'public.messages', 'created_at', 'INSERT'
  ) OR has_column_privilege(
    'authenticated', 'public.messages', 'read_at', 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Persisten permisos de INSERT no autorizados';
  END IF;

  IF NOT (
    has_column_privilege(
      'authenticated', 'public.messages', 'sender_id', 'INSERT'
    )
    AND has_column_privilege(
      'authenticated', 'public.messages', 'recipient_id', 'INSERT'
    )
    AND has_column_privilege(
      'authenticated', 'public.messages', 'body', 'INSERT'
    )
    AND has_column_privilege(
      'authenticated', 'public.messages', 'read_at', 'UPDATE'
    )
  ) THEN
    RAISE EXCEPTION 'Faltan permisos necesarios para mensajeria';
  END IF;
END;
$$;

COMMIT;
