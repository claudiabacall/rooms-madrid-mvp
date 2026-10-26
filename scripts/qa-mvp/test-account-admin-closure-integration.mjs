import test from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyAdministrativeDeletion
} from './account-admin-final-checks.mjs';

import {
  buildCompletedAuditPatch
} from './account-deletion-audit-state.mjs';

const targetId = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';
const auditId = '11111111-1111-4111-8111-111111111111';
const claimToken = '22222222-2222-4222-8222-222222222222';
const finishedAt = '2026-10-26T16:00:00.000Z';

function audit(shared = true) {
  return {
    id: auditId,
    target_user_id: targetId,
    operator_id: '33333333-3333-4333-8333-333333333333',
    status: 'processing',
    claim_token: claimToken,
    claimed_at: '2026-10-26T15:00:00.000Z',
    finished_at: null,
    storage_verified: false,
    auth_verified: false,
    database_verified: false,
    shared_impact_verified: shared
  };
}

function dependencies({
  authAbsent = true,
  remainingRows = 0,
  fkChecked = 35,
  files = []
} = {}) {
  return {
    targetId,
    auditId,
    claimToken,
    getAuthUser: async () => ({ absent: authAbsent }),
    getDatabaseVerification: async () => ({
      auth_absent: authAbsent,
      fk_relations_checked: fkChecked,
      remaining_fk_rows: remainingRows
    }),
    storage: {
      from() {
        return {
          async list() {
            return {
              data: files.map(name => ({
                name,
                id: name,
                metadata: { size: 1 }
              })),
              error: null
            };
          }
        };
      }
    }
  };
}

async function prepareClosure(options = {}, shared = true) {
  const result = await verifyAdministrativeDeletion(
    dependencies(options)
  );

  assert.equal(result.status, 'DELETION_VERIFIED');

  const evidence = {
    storage_verified: result.storageVerified,
    auth_verified: result.authVerified,
    database_verified: result.databaseVerified,
    shared_impact_verified: shared
  };

  return buildCompletedAuditPatch({
    audit: audit(shared),
    targetId,
    claimToken,
    evidence,
    finishedAt
  });
}

test('verificacion completa permite preparar cierre simulado', async () => {
  const patch = await prepareClosure();

  assert.equal(patch.status, 'completed');
  assert.equal(patch.auth_verified, true);
  assert.equal(patch.database_verified, true);
  assert.equal(patch.storage_verified, true);
  assert.equal(patch.shared_impact_verified, true);
  assert.equal(patch.finished_at, finishedAt);
});

test('Auth existente bloquea el cierre', async () => {
  await assert.rejects(
    prepareClosure({ authAbsent: false }),
    /Auth|eliminad/i
  );
});

test('filas pendientes en BD bloquean el cierre', async () => {
  await assert.rejects(
    prepareClosure({ remainingRows: 1 }),
    /BD|eliminad/i
  );
});

test('cobertura FK insuficiente bloquea el cierre', async () => {
  await assert.rejects(
    prepareClosure({ fkChecked: 34 }),
    /BD|eliminad/i
  );
});

test('Storage con archivos bloquea el cierre', async () => {
  await assert.rejects(
    prepareClosure({ files: ['avatar.png'] }),
    /Storage|vaci/i
  );
});

test('impacto compartido sin acreditar bloquea el cierre', async () => {
  await assert.rejects(
    prepareClosure({}, false),
    /impacto compartido/i
  );
});

console.log('ROOMS ADMIN CLOSURE INTEGRATION TEST');
console.log('SOLO SIMULACION: sin escrituras ni eliminaciones');
