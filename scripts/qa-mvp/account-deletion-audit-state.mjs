const FLAGS = Object.freeze([
  'storage_verified',
  'auth_verified',
  'database_verified',
  'shared_impact_verified'
]);

function assertStarted(audit) {
  if (
    !audit ||
    typeof audit !== 'object' ||
    typeof audit.id !== 'string' ||
    !audit.id ||
    typeof audit.target_user_id !== 'string' ||
    !audit.target_user_id ||
    typeof audit.operator_id !== 'string' ||
    !audit.operator_id ||
    audit.status !== 'started' ||
    audit.finished_at !== null ||
    FLAGS.some(field => audit[field] !== false)
  ) {
    throw new Error(
      'Auditoria inicial incompatible con la ejecucion'
    );
  }
}

function assertFinishedAt(value) {
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error('Fecha de finalizacion invalida');
  }
}

export function buildCompletedAuditPatch({
  audit,
  targetId,
  evidence,
  finishedAt
}) {
  assertStarted(audit);
  assertFinishedAt(finishedAt);

  if (audit.target_user_id !== targetId) {
    throw new Error('La auditoria corresponde a otra cuenta');
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
  finishedAt
}) {
  assertStarted(audit);
  assertFinishedAt(finishedAt);

  if (audit.target_user_id !== targetId) {
    throw new Error('La auditoria corresponde a otra cuenta');
  }

  return {
    status: 'failed',
    finished_at: finishedAt
  };
}
