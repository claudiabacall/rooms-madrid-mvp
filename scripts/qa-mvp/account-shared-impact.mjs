/**
 * ROOMS M4 - Inspector conservador de dependencias.
 * Solo lectura. Cliente proporcionado por backend autorizado.
 * No autoriza eliminaciones mientras falten comprobaciones.
 */

import { validate as isUuid } from './account-deletion-uuid.mjs';

const CHECKS = [
  ['ownedCommunities', 'communities', 'owner_id'],
  ['ownedHouseholds', 'households', 'owner_id'],
  ['communityMembersAffected', 'community_members', 'user_id'],
  ['householdMembersAffected', 'household_members', 'user_id']
];

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

  const counts = await Promise.all(
    CHECKS.map(async ([key, table, field]) => [
      key,
      await countRows(db, table, field, userId)
    ])
  );

  const impact = Object.fromEntries(counts);

  if (Object.values(impact).some(value => value > 0)) {
    // El coordinador bloquea si alguno es positivo.
    return impact;
  }

  // Otras referencias, contenidos y efectos indirectos
  // aun deben verificarse antes de autorizar una baja.
  throw new Error(
    'Inspeccion incompleta: otras dependencias ' +
    'pendientes de verificar'
  );
}
