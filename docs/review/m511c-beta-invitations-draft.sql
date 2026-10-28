-- ROOMS M5.11C
-- BORRADOR. NO EJECUTAR EN SUPABASE.
-- No autoriza altas ni cambia triggers de Auth.
--
-- Pendiente: mecanismo seguro de emision,
-- consumo atomico ligado al alta, Auth Hook,
-- permisos administrativos y pruebas concurrentes.

BEGIN;

CREATE SCHEMA IF NOT EXISTS rooms_private;

REVOKE ALL ON SCHEMA rooms_private
FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS
  rooms_private.beta_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    email_normalized text NOT NULL
      CHECK (
        email_normalized = lower(trim(email_normalized))
        AND length(email_normalized) BETWEEN 3 AND 254
        AND position('@' IN email_normalized) > 1
      ),

    token_digest bytea NOT NULL UNIQUE
      CHECK (octet_length(token_digest) = 32),

    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,

    used_at timestamptz,
    revoked_at timestamptz,

    CHECK (expires_at > created_at),
    CHECK (used_at IS NULL OR revoked_at IS NULL)
  );

ALTER TABLE rooms_private.beta_invitations
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON rooms_private.beta_invitations
FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS
  rooms_beta_invitations_email_idx
ON rooms_private.beta_invitations
  (email_normalized);

COMMIT;

-- NO INCLUIDO EN ESTE BORRADOR:
-- 1. Funciones de emision o validacion de tokens.
-- 2. Permisos de uso para servicios administrativos.
-- 3. Consumo de invitaciones.
-- 4. Modificacion de auth.users.
-- 5. Activacion del registro.
--
-- Futuro consumo: una operacion UPDATE ... RETURNING
-- condicionada a correo, hash, caducidad y estado.
-- Su vinculacion transaccional con el alta debe
-- demostrarse antes de aprobar la implementacion.
