import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

import {
  validate as isUuid
} from './account-deletion-uuid.mjs';

import {
  deleteDisposableAccountStorage
} from './account-storage-cleanup.mjs';

const IMPACT_FIELDS = [
  'communityMembersAffected',
  'householdMembersAffected',
  'ownedCommunities',
  'ownedHouseholds'
];

export async function executeDisposableAccountDeletion({
  user,
  targetId,
  confirmation,
  storage,
  auditId,
  claimToken,
  verifyDeletionClaim,
  inspectSharedImpact,
  deleteAuthUser
}) {
  assertDisposableAccount(user, targetId);

  if (confirmation !== `DELETE ACCOUNT ${targetId}`) {
    throw new Error('Confirmacion de baja incorrecta');
  }

  if (
    !isUuid(auditId) ||
    !isUuid(claimToken) ||
    typeof verifyDeletionClaim !== 'function'
  ) {
    throw new Error('Reclamacion administrativa requerida');
  }

  if (
    typeof inspectSharedImpact !== 'function' ||
    typeof deleteAuthUser !== 'function'
  ) {
    throw new Error('Faltan operaciones administrativas');
  }

  // Esta consulta debe realizarse en el backend administrativo.
  // No confiar en estados de auditoria enviados por el cliente.
  const claim = await verifyDeletionClaim({
    auditId,
    targetId,
    claimToken
  });

  if (
    !claim ||
    claim.id !== auditId ||
    claim.target_user_id !== targetId ||
    claim.claim_token !== claimToken ||
    claim.status !== 'processing' ||
    !claim.claimed_at ||
    claim.finished_at != null
  ) {
    throw new Error('Reclamacion administrativa no vigente');
  }

  // El inventario compartido debe consultarse en el backend
  // administrativo, no suministrarse por el usuario.
  const impact = await inspectSharedImpact(targetId);

  if (!impact || typeof impact !== 'object') {
    throw new Error('No se pudo verificar el impacto compartido');
  }

  for (const field of IMPACT_FIELDS) {
    if (
      !Number.isSafeInteger(impact[field]) ||
      impact[field] < 0
    ) {
      throw new Error(`Impacto no verificado: ${field}`);
    }
  }

  if (IMPACT_FIELDS.some(field => impact[field] > 0)) {
    throw new Error(
      'Baja detenida: existen comunidades u hogares ' +
      'con titularidad o miembros afectados'
    );
  }

  // Primera operación destructiva: limpiar Storage.
  // Si falla, nunca se procede a eliminar Auth.
  const storageResult = await deleteDisposableAccountStorage({
    storage,
    user,
    targetId,
    confirmation: `DELETE STORAGE ${targetId}`
  });

  if (
    storageResult.status !== 'STORAGE_VERIFIED_EMPTY' ||
    storageResult.remainingFiles !== 0
  ) {
    throw new Error('Storage no verificado como vacio');
  }

  // Revalidar despues de Storage y antes de eliminar Auth.
  // Esta consulta no sustituye un bloqueo transaccional
  // ni protege por si sola las escrituras concurrentes.
  const finalClaim = await verifyDeletionClaim({
    auditId,
    targetId,
    claimToken
  });

  if (
    !finalClaim ||
    finalClaim.id !== auditId ||
    finalClaim.target_user_id !== targetId ||
    finalClaim.claim_token !== claimToken ||
    finalClaim.status !== 'processing' ||
    !finalClaim.claimed_at ||
    finalClaim.finished_at != null
  ) {
    throw new Error(
      'Reclamacion administrativa revocada antes de Auth'
    );
  }

  // Segunda operación destructiva: eliminar Auth.
  const authResult = await deleteAuthUser(targetId);

  if (!authResult || authResult.deleted !== true) {
    throw new Error('Eliminacion de Auth no confirmada');
  }

  return {
    status: 'AUTH_DELETION_CONFIRMED',
    userId: targetId,
    storage: storageResult.status,
    auth: 'DELETED',
    databaseVerification: 'PENDING'
  };
}
