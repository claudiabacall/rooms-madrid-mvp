/**
 * ROOMS M4 - Inspector de dependencias de cuentas.
 *
 * Solo lectura.
 * Requiere un cliente proporcionado por backend administrativo.
 * Una inspeccion incompleta nunca autoriza una eliminacion.
 */

import { validate as isUuid } from './account-deletion-uuid.mjs';

async function countRows(db, table, field, userId) {
  const { count, error } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(field, userId);

  if (error) {
    throw new Error(
      `No se pudo consultar ${table}: ${error.message}`
    );
  }

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(
      `Recuento no verificable en ${table}`
    );
  }

  return count;
}

export async function inspectAccountSharedImpact(db, userId) {
  if (!db || typeof db.from !== 'function') {
    throw new Error('Cliente administrativo requerido');
  }

  if (!isUuid(userId)) {
    throw new Error('Identificador de usuario no valido');
  }

  const [
    ownedCommunities,
    ownedHouseholds
  ] = await Promise.all([
    countRows(db, 'communities', 'owner_id', userId),
    countRows(db, 'households', 'owner_id', userId)
  ]);

  if (ownedCommunities > 0 || ownedHouseholds > 0) {
    return {
      ownedCommunities,
      ownedHouseholds,
      communityMembersAffected: 0,
      householdMembersAffected: 0
    };
  }

  // No declarar que una baja es segura mientras no se
  // hayan verificado las demas dependencias compartidas.
  throw new Error(
    'Inspeccion incompleta: dependencias compartidas ' +
    'pendientes de verificar'
  );
}
