import { validate as isUuid } from './account-deletion-uuid.mjs';

const FLAGS = Object.freeze([
  'storage_verified',
  'auth_verified',
  'database_verified',
  'shared_impact_verified'
]);

function assertClaimedAudit(audit, targetId, claimToken) {
  if (
    !audit ||
    typeof audit !== 'object' ||
    !isUuid(audit.id) ||
    !isUuid(audit.target_user_id) ||
    !isUuid(audit.operator_id) ||
    !isUuid(claimToken) ||
    audit.target_user_id !== targetId ||
    audit.status !== 'processing' ||
    audit.claim_token !== claimToken ||
    typeof audit.claimed_at !== 'string' ||
    !Number.isFinite(Date.parse(audit.claimed_at)) ||
    audit.finished_at !== null ||
    FLAGS.some(field => typeof audit[field] !== 'boolean') ||
    ['storage_verified', 'auth_verified', 'database_verified']
      .some(field => audit[field] !== false)
  ) {
    throw new Error('Auditoria reclamada o token incompatible');
  }
}

function assertFinishedAt(finishedAt) {
  if (
    typeof finishedAt !== 'string' ||
    !Number.isFinite(Date.parse(finishedAt))
  ) {
    throw new Error('Fecha de finalizacion invalida');
  }
}

export function buildCompletedAuditPatch({
  audit,
  targetId,
  claimToken,
  evidence,
  finishedAt
}) {
  assertClaimedAudit(audit, targetId, claimToken);
  assertFinishedAt(finishedAt);

  if (audit.shared_impact_verified !== true) {
    throw new Error(
      'Falta evidencia previa de impacto compartido'
    );
  }

  if (
    !evidence ||
    typeof evidence !== 'object' ||
    FLAGS.some(field => evidence[field] !== true)
  ) {
    throw new Error(
      'No se puede cerrar sin cuatro verificaciones reales'
    );
  }

  return {
    status: 'completed',
    storage_verified: true,
    auth_verified: true,
    database_verified: true,
    shared_impact_verified: true,
    finished_at: finishedAt
  };
}

export function buildFailedAuditPatch({
  audit,
  targetId,
  claimToken,
  finishedAt
}) {
  assertClaimedAudit(audit, targetId, claimToken);
  assertFinishedAt(finishedAt);

  return {
    status: 'failed',
    finished_at: finishedAt
  };
}
