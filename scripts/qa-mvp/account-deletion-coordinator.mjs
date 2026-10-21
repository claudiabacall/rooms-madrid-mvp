import {
  assertDisposableAccount
} from './account-deletion-guards.mjs';

import {
  deleteDisposableAccountStorage
} from './account-storage-cleanup.mjs';

const IMPACT_FIELDS = [
  'communityMembersAffected',
  'householdMembersAffected'
];

export async function executeDisposableAccountDeletion({
  user,
  targetId,
  confirmation,
  storage,
  inspectSharedImpact,
  deleteAuthUser
}) {
  assertDisposableAccount(user, targetId);

  if (confirmation !== `DELETE ACCOUNT ${targetId}`) {
    throw new Error('Confirmacion de baja incorrecta');
  }

  if (
    typeof inspectSharedImpact !== 'function' ||
    typeof deleteAuthUser !== 'function'
  ) {
    throw new Error('Faltan operaciones administrativas');
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
      'con otros miembros afectados'
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
