import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompletedAuditPatch,
  buildFailedAuditPatch
} from './account-deletion-audit-state.mjs';

const TARGET = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';
const AUDIT_ID = '11111111-1111-4111-8111-111111111111';
const OPERATOR = '33333333-3333-4333-8333-333333333333';
const TOKEN = '22222222-2222-4222-8222-222222222222';
const WHEN = '2026-10-21T18:00:00.000Z';

function audit() {
  return {
    id: AUDIT_ID,
    target_user_id: TARGET,
    operator_id: OPERATOR,
    status: 'processing',
    claim_token: TOKEN,
    claimed_at: WHEN,
    finished_at: null,
    storage_verified: false,
    auth_verified: false,
    database_verified: false,
    shared_impact_verified: false
  };
}

function evidence() {
  return {
    storage_verified: true,
    auth_verified: true,
    database_verified: true,
    shared_impact_verified: true
  };
}

function args(overrides = {}) {
  return {
    audit: audit(),
    targetId: TARGET,
    claimToken: TOKEN,
    finishedAt: WHEN,
    evidence: evidence(),
    ...overrides
  };
}

test('completed exige processing, token y cuatro evidencias', () => {
  const result = buildCompletedAuditPatch(args());
  assert.equal(result.status, 'completed');
  assert.equal(result.database_verified, true);
});

test('una verificacion negativa impide completar', () => {
  assert.throws(
    () => buildCompletedAuditPatch(args({
      evidence: { ...evidence(), database_verified: false }
    })),
    /cuatro verificaciones/
  );
});

test('no permite cerrar una auditoria started', () => {
  assert.throws(
    () => buildCompletedAuditPatch(args({
      audit: { ...audit(), status: 'started' }
    })),
    /incompatible/
  );
});

test('token incorrecto impide completar', () => {
  assert.throws(
    () => buildCompletedAuditPatch(args({
      claimToken: '44444444-4444-4444-8444-444444444444'
    })),
    /incompatible/
  );
});

test('no admite otra cuenta', () => {
  assert.throws(
    () => buildCompletedAuditPatch(args({
      targetId: '55555555-5555-4555-8555-555555555555'
    })),
    /incompatible/
  );
});

test('failed conserva las verificaciones sin inventarlas', () => {
  const result = buildFailedAuditPatch(args());
  assert.deepEqual(result, {
    status: 'failed',
    finished_at: WHEN
  });
});

test('token incorrecto impide registrar failed', () => {
  assert.throws(
    () => buildFailedAuditPatch(args({
      claimToken: '44444444-4444-4444-8444-444444444444'
    })),
    /incompatible/
  );
});

test('auditoria finalizada no puede reutilizarse', () => {
  assert.throws(
    () => buildCompletedAuditPatch(args({
      audit: { ...audit(), status: 'completed', finished_at: WHEN }
    })),
    /incompatible/
  );
});
