import assert from 'node:assert/strict';
import test from 'node:test';
import { createVerificationReaders } from './account-admin-verification-readers.mjs';

const targetId = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';
const url = 'https://example.supabase.co';

test('La clave secret solo utiliza apikey', async () => {
  let calls = 0;
  const readers = createVerificationReaders({
    url,
    key: 'sb_secret_test_ficticia',
    fetchImpl: async (_url, options) => {
      calls++;
      assert.equal(options.headers.apikey, 'sb_secret_test_ficticia');
      assert.equal(options.headers.Authorization, undefined);
      return { status: 404, ok: false };
    }
  });

  assert.deepEqual(await readers.getAuthUser(targetId), { absent: true });
  assert.equal(calls, 1);
});

test('Una clave JWT heredada conserva Bearer', async () => {
  const readers = createVerificationReaders({
    url,
    key: 'eyJ_test_ficticia',
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer eyJ_test_ficticia');
      return { status: 404, ok: false };
    }
  });

  assert.deepEqual(await readers.getAuthUser(targetId), { absent: true });
});

test('Un error administrativo 401 nunca acredita borrado', async () => {
  const readers = createVerificationReaders({
    url,
    key: 'sb_secret_test_ficticia',
    fetchImpl: async () => ({ status: 401, ok: false })
  });

  await assert.rejects(
    readers.getAuthUser(targetId),
    /Consulta Auth HTTP 401/
  );
});
