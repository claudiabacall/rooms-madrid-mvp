import { validate as isUuid } from './account-deletion-uuid.mjs';
import { inventoryUserStorage } from './account-storage-inventory.mjs';
import { verifyAccountDeletion } from './account-deletion-final-verification.mjs';

export async function verifyAdministrativeDeletion({
  targetId,
  auditId,
  claimToken,
  getAuthUser,
  getDatabaseVerification,
  storage
}) {
  if (
    ![targetId, auditId, claimToken].every(isUuid) ||
    typeof getAuthUser !== 'function' ||
    typeof getDatabaseVerification !== 'function' ||
    !storage
  ) {
    throw new Error('Dependencias administrativas invalidas');
  }

  return verifyAccountDeletion({
    targetId,

    async verifyAuthAbsent(id) {
      const result = await getAuthUser(id);

      // El adaptador Auth debe acreditar una respuesta
      // explicita de usuario inexistente.
      return result?.absent === true;
    },

    async verifyDatabaseAbsent(id) {
      const result = await getDatabaseVerification({
        auditId,
        targetId: id,
        claimToken
      });

      return (
        result?.auth_absent === true &&
        Number.isSafeInteger(result.fk_relations_checked) &&
        result.fk_relations_checked >= 35 &&
        result.remaining_fk_rows === 0
      );
    },

    async verifyStorageEmpty(id) {
      const inventory = await inventoryUserStorage(storage, id);

      return Object.values(inventory).every(
        paths => Array.isArray(paths) && paths.length === 0
      );
    }
  });
}
