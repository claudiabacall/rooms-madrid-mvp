import test from 'node:test';
import assert from 'node:assert/strict';

import {
  prepareVerifiedDeletionClosure
} from './account-deletion-closure-preparation.mjs';

const targetId = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';
const auditId = '11111111-1111-4111-8111-111111111111';
const claimToken = '22222222-2222-4222-8222-222222222222';

const audit = {
  id: auditId,
  target_user_id: targetId,
  operator_id: '33333333-3333-4333-8333-333333333333',
  status: 'processing',
  claim_token: claimToken,
  claimed_at: '2026-10-27T09:00:00Z',
  finished_at: null,
  storage_verified: false,
  auth_verified: false,
  database_verified: false,
  shared_impact_verified: true
};

const executionResult = {
  status: 'AUTH_DELETION_CONFIRMED',
  userId: targetId,
  storage: 'STORAGE_VERIFIED_EMPTY',
  auth: 'DELETED',
  databaseVerification: 'PENDING'
};

const verifiedResult = {
  status: 'DELETION_VERIFIED',
  userId: targetId,
  authVerified: true,
  databaseVerified: true,
  storageVerified: true
};

function options(overrides = {}) {
  return {
    executionResult,
    audit,
    targetId,
    claimToken,
    finishedAt: '2026-10-27T10:00:00Z',
    verifyPostDeletion: async () => verifiedResult,
    ...overrides
  };
}

test('prepara el cierre tras verificar todas las evidencias', async () => {
  let calls = 0;

  const result = await prepareVerifiedDeletionClosure(
    options({
      verifyPostDeletion: async input => {
        calls++;
        assert.deepEqual(input, {
          targetId,
          auditId,
          claimToken
        });
        return verifiedResult;
      }
    })
  );

  assert.equal(calls, 1);
  assert.equal(result.status, 'CLOSURE_PREPARED_NOT_APPLIED');
  assert.equal(result.auditPatch.status, 'completed');
  assert.equal(result.auditPatch.database_verified, true);
  assert.equal(result.auditPatch.shared_impact_verified, true);
});

test('bloquea una ejecucion que no elimino Auth', async () => {
  await assert.rejects(
    prepareVerifiedDeletionClosure(
      options({
        executionResult: {
          ...executionResult,
          auth: 'PENDING'
        }
      })
    ),
    /Ejecucion previa/
  );
});

test('bloquea ausencia de confirmacion Storage', async () => {
  await assert.rejects(
    prepareVerifiedDeletionClosure(
      options({
        executionResult: {
          ...executionResult,
          storage: 'PENDING'
        }
      })
    ),
    /Ejecucion previa/
  );
});

test('bloquea verificacion incompleta de base de datos', async () => {
  await assert.rejects(
    prepareVerifiedDeletionClosure(
      options({
        verifyPostDeletion: async () => ({
          ...verifiedResult,
          databaseVerified: false
        })
      })
    ),
    /Verificacion posterior/
  );
});

test('bloquea errores del verificador remoto', async () => {
  await assert.rejects(
    prepareVerifiedDeletionClosure(
      options({
        verifyPostDeletion: async () => {
          throw new Error('RPC unavailable');
        }
      })
    ),
    /RPC unavailable/
  );
});

test('bloquea impacto compartido no acreditado', async () => {
  await assert.rejects(
    prepareVerifiedDeletionClosure(
      options({
        audit: {
          ...audit,
          shared_impact_verified: false
        }
      })
    ),
    /impacto compartido/
  );
});

test('bloquea una reclamacion administrativa incorrecta', async () => {
  await assert.rejects(
    prepareVerifiedDeletionClosure(
      options({
        audit: {
          ...audit,
          claim_token:
            '44444444-4444-4444-8444-444444444444'
        }
      })
    ),
    /token incompatible/
  );
});

console.log('ROOMS CLOSURE PREPARATION · SOLO SIMULACION');
