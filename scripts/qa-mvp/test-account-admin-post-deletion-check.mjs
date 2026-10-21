import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkPostDeletion
} from './account-admin-post-deletion-check.mjs';

const TARGET = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';
const AUDIT = '11111111-1111-4111-8111-111111111111';
const TOKEN = '22222222-2222-4222-8222-222222222222';

function fixture({
  authStatus = 404,
  remainingRows = 0,
  checked = 35,
  files = [],
  databaseStatus = 200,
  storageDatabaseStatus = 200,
  storageRows = 0
} = {}) {
  const calls = [];

  const config = {
    url: 'https://example.supabase.co',
    key: 'clave-simulada',
    targetId: TARGET,
    auditId: AUDIT,
    claimToken: TOKEN,

    fetchImpl: async (url, options = {}) => {
      const path = new URL(url).pathname;
      calls.push({
        path,
        method: options.method || 'GET'
      });

      if (path.startsWith('/auth/v1/admin/users/')) {
        return {
          status: authStatus,
          ok: authStatus >= 200 && authStatus < 300,
          json: async () => ({ id: TARGET })
        };
      }

      if (path === '/rest/v1/rpc/rooms_admin_verify_deleted_storage') {
        return {
          status: storageDatabaseStatus,
          ok: storageDatabaseStatus >= 200 &&
              storageDatabaseStatus < 300,
          json: async () => [{
            archivos_restantes: storageRows,
            por_owner: 0,
            por_owner_id: 0,
            por_ruta: 0,
            fuera_de_buckets_previstos: 0,
            buckets_afectados: 0
          }]
        };
      }

      if (path === '/rest/v1/rpc/rooms_admin_verify_deleted_user') {
        return {
          status: databaseStatus,
          ok: databaseStatus >= 200 && databaseStatus < 300,
          json: async () => [{
            auth_absent: true,
            fk_relations_checked: checked,
            remaining_fk_rows: remainingRows
          }]
        };
      }

      throw new Error('Endpoint inesperado en prueba');
    },

    storage: {
      from() {
        return {
          async list() {
            return {
              data: files.map(name => ({
                id: 'simulado',
                name,
                metadata: {}
              })),
              error: null
            };
          }
        };
      }
    }
  };

  return { config, calls };
}

test('integra Auth, RPC y Storage sin borrar datos', async () => {
  const { config, calls } = fixture();

  const result = await checkPostDeletion(config);

  assert.equal(result.status, 'DELETION_VERIFIED');
  assert.equal(result.authVerified, true);
  assert.equal(result.databaseVerified, true);
  assert.equal(result.storageVerified, true);
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map(call => call.method),
    ['POST', 'GET', 'POST']
  );
});

test('bloquea Auth existente', async () => {
  await assert.rejects(
    checkPostDeletion(fixture({ authStatus: 200 }).config),
    /Auth no verificada/
  );
});

test('bloquea registros restantes', async () => {
  await assert.rejects(
    checkPostDeletion(fixture({ remainingRows: 1 }).config),
    /BD no verificados/
  );
});

test('bloquea archivos restantes', async () => {
  await assert.rejects(
    checkPostDeletion(fixture({
      files: ['archivo.jpg']
    }).config),
    /Storage no verificado/
  );
});

test('bloquea errores de la RPC', async () => {
  await assert.rejects(
    checkPostDeletion(fixture({
      databaseStatus: 503
    }).config),
    /HTTP 503/
  );
});

test('bloquea si Storage DB conserva archivos', async () => {
  await assert.rejects(
    checkPostDeletion(fixture({
      storageRows: 1
    }).config),
    /Storage DB no acredita ausencia total/
  );
});

test('bloquea si falla la RPC de Storage', async () => {
  await assert.rejects(
    checkPostDeletion(fixture({
      storageDatabaseStatus: 503
    }).config),
    /Storage DB HTTP 503/
  );
});
