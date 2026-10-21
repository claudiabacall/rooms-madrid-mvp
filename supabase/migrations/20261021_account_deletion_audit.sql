-- ROOMS M4: evidencia administrativa de bajas.
-- NO ejecuta eliminaciones.
-- NO modifica auth.users ni las tablas de usuarios.
-- Pendiente de definir politica de conservacion antes de uso real.

CREATE TABLE IF NOT EXISTS public.account_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  target_user_id uuid NOT NULL,
  operator_id uuid NOT NULL,

  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'completed', 'failed')),

  storage_verified boolean NOT NULL DEFAULT false,
  auth_verified boolean NOT NULL DEFAULT false,
  database_verified boolean NOT NULL DEFAULT false,
  shared_impact_verified boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,

  CONSTRAINT account_deletion_completed_verified
    CHECK (
      status <> 'completed'
      OR (
        storage_verified
        AND auth_verified
        AND database_verified
        AND shared_impact_verified
        AND finished_at IS NOT NULL
      )
    )
);

-- No FK a auth.users: el registro debe sobrevivir a la baja.

ALTER TABLE public.account_deletion_audit
  ENABLE ROW LEVEL SECURITY;

-- Solo backend administrativo autorizado.
-- No crear politicas para anon ni authenticated.

REVOKE ALL ON public.account_deletion_audit
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.account_deletion_audit IS
  'Evidencia administrativa restringida de bajas de ROOMS. '
  'Retencion pendiente de validacion legal.';
