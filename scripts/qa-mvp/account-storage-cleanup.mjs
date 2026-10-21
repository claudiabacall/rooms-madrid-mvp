import { assertDisposableAccount } from './account-deletion-guards.mjs';
import { buildAccountDeletionPlan } from './account-deletion-plan.mjs';
import { inventoryUserStorage } from './account-storage-inventory.mjs';

const BATCH_SIZE = 100;

export async function deleteDisposableAccountStorage({
  storage,
  user,
  targetId,
  confirmation
}) {
  // Validar antes de consultar o modificar Storage.
  assertDisposableAccount(user, targetId);

  if (confirmation !== `DELETE STORAGE ${targetId}`) {
    throw new Error('Confirmacion explicita incorrecta');
  }

  const plan = await buildAccountDeletionPlan({
    storage,
    user,
    targetId
  });

  for (const item of plan.buckets) {
    for (const path of item.paths) {
      if (
        typeof path !== 'string' ||
        !path.startsWith(`${targetId}/`)
      ) {
        throw new Error('Ruta de eliminacion no segura');
      }
    }
  }

  let deletedCount = 0;

  for (const item of plan.buckets) {
    for (let i = 0; i < item.paths.length; i += BATCH_SIZE) {
      const batch = item.paths.slice(i, i + BATCH_SIZE);

      const { error } = await storage
        .from(item.bucket)
        .remove(batch);

      if (error) {
        throw new Error(
          `Error eliminando archivos de ${item.bucket}: ${error.message}`
        );
      }

      deletedCount += batch.length;
    }
  }

  const remaining = await inventoryUserStorage(storage, targetId);

  const remainingCount = Object.values(remaining)
    .reduce((sum, files) => sum + files.length, 0);

  if (remainingCount !== 0) {
    throw new Error(
      `Limpieza incompleta: quedan ${remainingCount} archivos`
    );
  }

  return {
    status: 'STORAGE_VERIFIED_EMPTY',
    userId: targetId,
    plannedFiles: plan.totalFiles,
    removedRequests: deletedCount,
    remainingFiles: remainingCount,
    authDeletion: 'NOT_EXECUTED'
  };
}
