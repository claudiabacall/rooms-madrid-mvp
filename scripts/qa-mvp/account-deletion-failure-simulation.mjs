import {
  buildCompletedAuditPatch,
  buildFailedAuditPatch
} from './account-deletion-audit-state.mjs';

/**
 * SIMULACION EXCLUSIVAMENTE.
 * No importa clientes Supabase ni realiza solicitudes HTTP.
 * Las operaciones se inyectan desde las pruebas.
 */
export async function simulateDeletionFailureHandling({
  audit,
  targetId,
  operations,
  finishedAt
}) {
  const stages = [];
  let current = 'preflight';

  try {
    for (const name of [
      'preflight',
      'storage',
      'auth',
      'verifyAuth',
      'verifyDatabase',
      'verifyStorage',
      'verifySharedImpact'
    ]) {
      current = name;

      if (typeof operations?.[name] !== 'function') {
        throw new Error(`Operacion ausente: ${name}`);
      }

      const result = await operations[name]();

      if (result !== true) {
        throw new Error(`Comprobacion no confirmada: ${name}`);
      }

      stages.push(name);
    }

    return {
      mode: 'SIMULATION',
      outcome: 'VERIFIED_IN_SIMULATION',
      stages,
      auditPatch: buildCompletedAuditPatch({
        audit,
        targetId,
        evidence: {
          storage_verified: true,
          auth_verified: true,
          database_verified: true,
          shared_impact_verified: true
        },
        finishedAt
      }),
      auditWritten: false
    };
  } catch (error) {
    // Nunca reintentar una eliminacion de Auth automaticamente.
    // Un fallo posterior puede dejar una baja parcial.
    return {
      mode: 'SIMULATION',
      outcome: 'FAILED_REQUIRES_RECONCILIATION',
      failedStage: current,
      stages,
      reason: error.message,
      auditPatch: buildFailedAuditPatch({
        audit,
        targetId,
        finishedAt
      }),
      auditWritten: false,
      automaticRetry: false
    };
  }
}
