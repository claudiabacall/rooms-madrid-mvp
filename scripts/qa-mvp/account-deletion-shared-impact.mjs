import { validate as isUuid } from './account-deletion-uuid.mjs';

import {
  countAccountSharedImpact
} from './account-shared-impact.mjs';

async function countAffectedRows(db, table, first, second, targetId) {
  const result = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .or(`${first}.eq.${targetId},${second}.eq.${targetId}`);

  if (
    result.error ||
    !Number.isSafeInteger(result.count) ||
    result.count < 0
  ) {
    throw new Error(`Inventario administrativo incompleto: ${table}`);
  }

  return result.count;
}

/**
 * Solo para backend administrativo autorizado.
 * No utilizar con el cliente publico del navegador.
 *
 * Es un inventario puntual, no una barrera concurrente.
 * No autoriza por si mismo la eliminacion.
 */
export async function inspectSharedCommunicationImpact(db, targetId) {
  if (!isUuid(targetId) || !db || typeof db.from !== 'function') {
    throw new Error('Inventario administrativo no disponible');
  }

  const sharedMessagesAffected = await countAffectedRows(
    db, 'messages', 'sender_id', 'recipient_id', targetId
  );

  const sharedConnectionsAffected = await countAffectedRows(
    db, 'connections', 'requester_id', 'recipient_id', targetId
  );

  return {
    sharedMessagesAffected,
    sharedConnectionsAffected
  };
}


/**
 * Inventario conjunto para un backend administrativo.
 * No constituye barrera concurrente ni autoriza bajas.
 * El cliente debe tener visibilidad administrativa completa.
 */
export async function inspectSixSharedImpact(db, targetId) {
  if (!isUuid(targetId) || !db || typeof db.from !== 'function') {
    throw new Error('Inventario administrativo no disponible');
  }

  const ownership = await countAccountSharedImpact(db, targetId);
  const communication = await inspectSharedCommunicationImpact(
    db, targetId
  );

  const impact = { ...ownership, ...communication };

  const required = [
    'communityMembersAffected',
    'householdMembersAffected',
    'ownedCommunities',
    'ownedHouseholds',
    'sharedMessagesAffected',
    'sharedConnectionsAffected'
  ];

  if (
    required.some(key =>
      !Number.isSafeInteger(impact[key]) ||
      impact[key] < 0
    )
  ) {
    throw new Error('Inventario compartido incompleto');
  }

  return impact;
}
