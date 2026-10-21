import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyDeletionAudit
} from './account-admin-recovery-read.mjs';

function audit(status = 'started') {
  return {
    status,
    claim_token: null,
    claimed_at: null,
    finished_at: null,
    storage_verified: false,
    auth_verified: false,
    database_verified: false,
    shared_impact_verified: false
  };
}

test('started permanece sin reclamar', () => {
  const result = classifyDeletionAudit(audit());
  assert.equal(result.classification, 'NOT_CLAIMED');
  assert.equal(result.deletionAuthorized, false);
});

test('processing exige revision y nunca reintenta', () => {
  const row = audit('processing');
  row.claim_token = 'token-simulado';
  row.claimed_at = '2026-10-21T18:00:00Z';

  const result = classifyDeletionAudit(row);
  assert.equal(result.manualReviewRequired, true);
  assert.equal(result.automaticRetryAllowed, false);
});

test('processing inconsistente se bloquea', () => {
  assert.throws(
    () => classifyDeletionAudit(audit('processing')),
    /inconsistente/
  );
});

test('failed exige conciliacion', () => {
  const row = audit('failed');
  row.finished_at = '2026-10-21T18:00:00Z';

  const result = classifyDeletionAudit(row);
  assert.equal(result.manualReviewRequired, true);
  assert.equal(result.automaticRetryAllowed, false);
});

test('completed sin cuatro evidencias se rechaza', () => {
  const row = audit('completed');
  row.finished_at = '2026-10-21T18:00:00Z';

  assert.throws(
    () => classifyDeletionAudit(row),
    /sin evidencias/
  );
});
