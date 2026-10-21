/**
 * ROOMS M4 - Verificacion final de baja.
 *
 * No borra datos.
 * Las comprobaciones deben proceder de un backend
 * administrativo autorizado, no del navegador.
 */

export async function verifyAccountDeletion({
  targetId,
  verifyAuthAbsent,
  verifyDatabaseAbsent,
  verifyStorageEmpty
}) {
  if (
    typeof verifyAuthAbsent !== 'function' ||
    typeof verifyDatabaseAbsent !== 'function' ||
    typeof verifyStorageEmpty !== 'function'
  ) {
    throw new Error(
      'Faltan comprobaciones administrativas obligatorias'
    );
  }

  if (typeof targetId !== 'string' || !targetId) {
    throw new Error('Identificador de cuenta requerido');
  }

  // Ejecutar todas las comprobaciones y rechazar cualquier
  // error o resultado que no confirme ausencia real.
  const [auth, database, storage] = await Promise.all([
    verifyAuthAbsent(targetId),
    verifyDatabaseAbsent(targetId),
    verifyStorageEmpty(targetId)
  ]);

  if (auth !== true) {
    throw new Error('Cuenta Auth no verificada como eliminada');
  }

  if (database !== true) {
    throw new Error('Datos de BD no verificados como eliminados');
  }

  if (storage !== true) {
    throw new Error('Storage no verificado como vacio');
  }

  return {
    status: 'DELETION_VERIFIED',
    userId: targetId,
    authVerified: true,
    databaseVerified: true,
    storageVerified: true
  };
}
