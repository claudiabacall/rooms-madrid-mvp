import test from 'node:test';
import assert from 'node:assert/strict';

import {
  simulateDeletionFailureHandling
} from './account-deletion-failure-simulation.mjs';

const TARGET = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';

const AUDIT = {
  id: '11111111-1111-4111-8111-111111111111',
  target_user_id: TARGET,
  operator_id: '33333333-3333-4333-8333-333333333333',
  status: 'processing',
  claim_token: '22222222-2222-4222-8222-222222222222',
  claimed_at: '2026-10-21T17:00:00.000Z',
  storage_verified: false,
  auth_verified: false,
  database_verified: false,
  shared_impact_verified: false,
  finished_at: null
};

const NAMES = [
  'preflight',
  'storage',
  'auth',
  'verifyAuth',
  'verifyDatabase',
  'verifyStorage',
  'verifySharedImpact'
];

function operations(failing = null) {
  return Object.fromEntries(
    NAMES.map(name => [
      name,
      async () => name !== failing
    ])
  );
}

async function simulate(failing = null) {
  return simulateDeletionFailureHandling({
    audit: { ...AUDIT },
    targetId: TARGET,
    operations: operations(failing),
    finishedAt: '2026-10-21T18:00:00.000Z'
  });
}

test('bloqueo previo impide llegar a Storage', async () => {
  const result = await simulate('preflight');

  assert.equal(result.auditPatch.status, 'failed');
  assert.deepEqual(result.stages, []);
  assert.equal(result.automaticRetry, false);
});

test('fallo Storage impide ejecutar Auth', async () => {
  const result = await simulate('storage');

  assert.equal(result.failedStage, 'storage');
  assert.equal(result.stages.includes('auth'), false);
  assert.equal(result.auditPatch.status, 'failed');
});

test('fallo Auth requiere conciliacion', async () => {
  const result = await simulate('auth');

  assert.equal(result.failedStage, 'auth');
  assert.equal(result.auditPatch.status, 'failed');
  assert.equal(result.automaticRetry, false);
});

test('Auth confirmado pero BD no verificada nunca completa', async () => {
  const result = await simulate('verifyDatabase');

  assert.equal(result.stages.includes('auth'), true);
  assert.equal(result.failedStage, 'verifyDatabase');
  assert.equal(result.auditPatch.status, 'failed');
  assert.equal(result.automaticRetry, false);
});

test('exito simulado exige todas las verificaciones', async () => {
  const result = await simulate();

  assert.equal(result.stages.length, 7);
  assert.equal(result.auditPatch.status, 'completed');
  assert.equal(result.auditPatch.auth_verified, true);
  assert.equal(result.auditPatch.database_verified, true);
  assert.equal(result.auditWritten, false);
});
