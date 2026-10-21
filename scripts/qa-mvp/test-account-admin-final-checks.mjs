import test from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyAdministrativeDeletion
} from './account-admin-final-checks.mjs';

const TARGET = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';
const AUDIT = '11111111-1111-4111-8111-111111111111';
const TOKEN = '22222222-2222-4222-8222-222222222222';

function fixture(overrides = {}) {
  return {
    targetId: TARGET,
    auditId: AUDIT,
    claimToken: TOKEN,
    getAuthUser: async () => ({ absent: true }),
    getDatabaseVerification: async () => ({
      auth_absent: true,
      fk_relations_checked: 35,
      remaining_fk_rows: 0
    }),
    storage: {
      from() {
        return {
          async list() {
            return { data: [], error: null };
          }
        };
      }
    },
    ...overrides
  };
}

test('completa solo con tres verificaciones reales positivas', async () => {
  const result = await verifyAdministrativeDeletion(fixture());
  assert.equal(result.status, 'DELETION_VERIFIED');
  assert.equal(result.databaseVerified, true);
  assert.equal(result.storageVerified, true);
  assert.equal(result.authVerified, true);
});

test('bloquea si Auth aun existe', async () => {
  await assert.rejects(
    verifyAdministrativeDeletion(fixture({
      getAuthUser: async () => ({ absent: false })
    })),
    /Auth no verificada/
  );
});

test('bloquea si queda un registro en BD', async () => {
  await assert.rejects(
    verifyAdministrativeDeletion(fixture({
      getDatabaseVerification: async () => ({
        auth_absent: true,
        fk_relations_checked: 35,
        remaining_fk_rows: 1
      })
    })),
    /BD no verificados/
  );
});

test('bloquea cobertura insuficiente', async () => {
  await assert.rejects(
    verifyAdministrativeDeletion(fixture({
      getDatabaseVerification: async () => ({
        auth_absent: true,
        fk_relations_checked: 34,
        remaining_fk_rows: 0
      })
    })),
    /BD no verificados/
  );
});

test('bloquea respuesta BD incompleta', async () => {
  await assert.rejects(
    verifyAdministrativeDeletion(fixture({
      getDatabaseVerification: async () => ({
        auth_absent: true
      })
    })),
    /BD no verificados/
  );
});

test('bloquea archivos restantes', async () => {
  await assert.rejects(
    verifyAdministrativeDeletion(fixture({
      storage: {
        from() {
          return {
            async list(prefix) {
              return {
                data: [
                  { id: 'archivo', name: 'imagen.jpg', metadata: {} }
                ],
                error: null
              };
            }
          };
        }
      }
    })),
    /Storage no verificado/
  );
});

test('bloquea fallos de red', async () => {
  await assert.rejects(
    verifyAdministrativeDeletion(fixture({
      getDatabaseVerification: async () => {
        throw new Error('HTTP 503');
      }
    })),
    /HTTP 503/
  );
});

test('rechaza token administrativo ausente', async () => {
  await assert.rejects(
    verifyAdministrativeDeletion(fixture({
      claimToken: ''
    })),
    /Dependencias administrativas invalidas/
  );
});
