import {
  createVerificationReaders
} from './account-admin-verification-readers.mjs';

import {
  verifyAdministrativeDeletion
} from './account-admin-final-checks.mjs';

/**
 * Adaptador de verificacion posterior.
 *
 * No elimina usuarios, modifica Storage ni escribe auditorias.
 * Requiere una auditoria processing y un claimToken real
 * cuando se use en una ejecucion administrativa futura.
 */
export async function checkPostDeletion({
  url,
  key,
  targetId,
  auditId,
  claimToken,
  storage,
  fetchImpl
}) {
  const readers = createVerificationReaders({
    url,
    key,
    fetchImpl
  });

  const storageDatabaseVerified =
    await readers.getStorageDatabaseVerification({
      auditId,
      targetId,
      claimToken
    });

  if (storageDatabaseVerified !== true) {
    throw new Error('Storage DB no verificado');
  }

  return verifyAdministrativeDeletion({
    targetId,
    auditId,
    claimToken,
    storage,
    getAuthUser: readers.getAuthUser,
    getDatabaseVerification:
      readers.getDatabaseVerification
  });
}
