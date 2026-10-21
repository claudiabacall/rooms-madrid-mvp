import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createVerificationReaders
} from './account-admin-verification-readers.mjs';

const TARGET = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';
const AUDIT = '11111111-1111-4111-8111-111111111111';
const TOKEN = '22222222-2222-4222-8222-222222222222';

function readers(status, data) {
  return createVerificationReaders({
    url: 'https://example.supabase.co',
    key: 'clave-simulada',
    fetchImpl: async () => ({
      status,
      ok: status >= 200 && status < 300,
      json: async () => data
    })
  });
}

test('Auth 404 acredita ausencia', async () => {
  const result = await readers(404, {}).getAuthUser(TARGET);
  assert.equal(result.absent, true);
});

test('Auth existente no acredita eliminacion', async () => {
  const result = await readers(200, { id: TARGET })
    .getAuthUser(TARGET);
  assert.equal(result.absent, false);
});

test('Auth 503 se bloquea', async () => {
  await assert.rejects(
    readers(503, {}).getAuthUser(TARGET),
    /HTTP 503/
  );
});

test('BD devuelve evidencia estructurada', async () => {
  const result = await readers(200, [{
    auth_absent: true,
    fk_relations_checked: 35,
    remaining_fk_rows: 0
  }]).getDatabaseVerification({
    auditId: AUDIT,
    targetId: TARGET,
    claimToken: TOKEN
  });

  assert.equal(result.remaining_fk_rows, 0);
});

test('BD rechaza respuesta vacia', async () => {
  await assert.rejects(
    readers(200, []).getDatabaseVerification({
      auditId: AUDIT,
      targetId: TARGET,
      claimToken: TOKEN
    }),
    /incompleta/
  );
});

test('BD rechaza evidencia no valida', async () => {
  await assert.rejects(
    readers(200, [{
      auth_absent: true,
      fk_relations_checked: '35',
      remaining_fk_rows: 0
    }]).getDatabaseVerification({
      auditId: AUDIT,
      targetId: TARGET,
      claimToken: TOKEN
    }),
    /invalida/
  );
});

test('BD bloquea error de permisos', async () => {
  await assert.rejects(
    readers(403, {}).getDatabaseVerification({
      auditId: AUDIT,
      targetId: TARGET,
      claimToken: TOKEN
    }),
    /HTTP 403/
  );
});
