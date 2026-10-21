import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCompletedAuditPatch,
  buildFailedAuditPatch
} from './account-deletion-audit-state.mjs';

const ID = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';
const FINISHED = '2026-10-21T18:00:00.000Z';

function startedAudit() {
  return {
    id: 'audit-test',
    target_user_id: ID,
    operator_id: 'operator-test',
    status: 'started',
    storage_verified: false,
    auth_verified: false,
    database_verified: false,
    shared_impact_verified: false,
    finished_at: null
  };
}

function verifiedEvidence() {
  return {
    storage_verified: true,
    auth_verified: true,
    database_verified: true,
    shared_impact_verified: true
  };
}

test('completed exige cuatro evidencias positivas', () => {
  const patch = buildCompletedAuditPatch({
    audit: startedAudit(),
    targetId: ID,
    evidence: verifiedEvidence(),
    finishedAt: FINISHED
  });

  assert.equal(patch.status, 'completed');
  assert.equal(patch.finished_at, FINISHED);
  assert.deepEqual(
    Object.values(patch).filter(value => value === true).length,
    4
  );
});

test('no permite completar con una evidencia ausente', () => {
  const evidence = verifiedEvidence();
  evidence.database_verified = false;

  assert.throws(
    () => buildCompletedAuditPatch({
      audit: startedAudit(),
      targetId: ID,
      evidence,
      finishedAt: FINISHED
    }),
    /cuatro verificaciones/
  );
});

test('no acepta una auditoria de otra cuenta', () => {
  assert.throws(
    () => buildCompletedAuditPatch({
      audit: startedAudit(),
      targetId: 'otra-cuenta',
      evidence: verifiedEvidence(),
      finishedAt: FINISHED
    }),
    /otra cuenta/
  );
});

test('no permite reutilizar una auditoria finalizada', () => {
  const audit = startedAudit();
  audit.status = 'completed';

  assert.throws(
    () => buildCompletedAuditPatch({
      audit,
      targetId: ID,
      evidence: verifiedEvidence(),
      finishedAt: FINISHED
    }),
    /incompatible/
  );
});

test('failed no inventa verificaciones positivas', () => {
  const patch = buildFailedAuditPatch({
    audit: startedAudit(),
    targetId: ID,
    finishedAt: FINISHED
  });

  assert.deepEqual(patch, {
    status: 'failed',
    finished_at: FINISHED
  });
});

test('no admite auditorias ya marcadas', () => {
  const audit = startedAudit();
  audit.auth_verified = true;

  assert.throws(
    () => buildFailedAuditPatch({
      audit,
      targetId: ID,
      finishedAt: FINISHED
    }),
    /incompatible/
  );
});
