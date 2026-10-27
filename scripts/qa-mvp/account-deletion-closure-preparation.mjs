import {
  buildCompletedAuditPatch
} from './account-deletion-audit-state.mjs';

/**
 * Prepara evidencia para un cierre administrativo futuro.
 *
 * No ejecuta la eliminacion, no escribe auditorias y
 * no habilita la RPC completed de Supabase.
 */
export async function prepareVerifiedDeletionClosure({
  executionResult,
  audit,
  targetId,
  claimToken,
  verifyPostDeletion,
  finishedAt
}) {
  if (
    !executionResult ||
    executionResult.status !== 'AUTH_DELETION_CONFIRMED' ||
    executionResult.userId !== targetId ||
    executionResult.auth !== 'DELETED' ||
    executionResult.storage !== 'STORAGE_VERIFIED_EMPTY' ||
    executionResult.databaseVerification !== 'PENDING'
  ) {
    throw new Error('Ejecucion previa no acreditada');
  }

  if (typeof verifyPostDeletion !== 'function') {
    throw new Error('Verificacion posterior requerida');
  }

  const result = await verifyPostDeletion({
    targetId,
    auditId: audit?.id,
    claimToken
  });

  if (
    !result ||
    result.status !== 'DELETION_VERIFIED' ||
    result.userId !== targetId ||
    result.authVerified !== true ||
    result.databaseVerified !== true ||
    result.storageVerified !== true
  ) {
    throw new Error('Verificacion posterior incompleta');
  }

  const evidence = {
    storage_verified: true,
    auth_verified: true,
    database_verified: true,
    shared_impact_verified:
      audit?.shared_impact_verified === true
  };

  const auditPatch = buildCompletedAuditPatch({
    audit,
    targetId,
    claimToken,
    evidence,
    finishedAt
  });

  return {
    status: 'CLOSURE_PREPARED_NOT_APPLIED',
    userId: targetId,
    verification: result,
    auditPatch
  };
}
