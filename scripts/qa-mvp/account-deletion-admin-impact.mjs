import {
  inspectSixSharedImpact
} from './account-deletion-shared-impact.mjs';

const REQUIRED = [
  'communityMembersAffected',
  'householdMembersAffected',
  'ownedCommunities',
  'ownedHouseholds',
  'sharedMessagesAffected',
  'sharedConnectionsAffected'
];

/**
 * Solo lectura. Backend administrativo autorizado.
 *
 * El inventario de seis indicadores NO sustituye
 * el preflight amplio de relaciones.
 *
 * No autoriza ni ejecuta eliminaciones.
 */
export async function inspectAdministrativeDeletionImpact({
  db,
  targetId,
  verifyFullSharedPreflight
}) {
  if (typeof verifyFullSharedPreflight !== 'function') {
    throw new Error('Preflight completo obligatorio');
  }

  const impact = await inspectSixSharedImpact(db, targetId);

  if (REQUIRED.some(key =>
    !Number.isSafeInteger(impact[key]) ||
    impact[key] < 0
  )) {
    throw new Error('Impacto administrativo incompleto');
  }

  const full = await verifyFullSharedPreflight(targetId);

  if (
    !full ||
    full.verified !== true ||
    full.coverageComplete !== true ||
    !Number.isSafeInteger(full.relationsChecked) ||
    full.relationsChecked < 26 ||
    !Number.isSafeInteger(full.affectedRows) ||
    full.affectedRows < 0
  ) {
    throw new Error('Preflight administrativo no acreditado');
  }

  if (Object.values(impact).some(value => value > 0) ||
      full.affectedRows > 0) {
    throw new Error('Existen relaciones compartidas');
  }

  return {
    status: 'SHARED_PREFLIGHT_ONLY',
    impact,
    relationsChecked: full.relationsChecked,
    verified: true,
    deletionAuthorized: false
  };
}
