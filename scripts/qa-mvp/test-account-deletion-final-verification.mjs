import assert from 'node:assert/strict';

import {
  verifyAccountDeletion
} from './account-deletion-final-verification.mjs';

const targetId = '12345678-1234-4234-8234-123456789abc';

function fixture({
  auth = true,
  database = true,
  storage = true
} = {}) {
  const calls = [];

  return {
    targetId,

    calls,

    async verifyAuthAbsent(id) {
      assert.equal(id, targetId);
      calls.push('auth');
      return auth;
    },

    async verifyDatabaseAbsent(id) {
      assert.equal(id, targetId);
      calls.push('database');
      return database;
    },

    async verifyStorageEmpty(id) {
      assert.equal(id, targetId);
      calls.push('storage');
      return storage;
    }
  };
}

const success = fixture();

const result = await verifyAccountDeletion(success);

assert.deepEqual(result, {
  status: 'DELETION_VERIFIED',
  userId: targetId,
  authVerified: true,
  databaseVerified: true,
  storageVerified: true
});

assert.deepEqual(
  [...success.calls].sort(),
  ['auth', 'database', 'storage']
);

console.log('OK Tres verificaciones obligatorias');

for (const field of ['auth', 'database', 'storage']) {
  await assert.rejects(
    verifyAccountDeletion(fixture({ [field]: false })),
    /no verificad/
  );

  await assert.rejects(
    verifyAccountDeletion(fixture({ [field]: null })),
    /no verificad/
  );

  console.log(`OK Resultado falso o nulo bloqueado: ${field}`);
}

await assert.rejects(
  verifyAccountDeletion({
    ...fixture(),
    verifyDatabaseAbsent: async () => {
      throw new Error('Supabase no disponible');
    }
  }),
  /Supabase no disponible/
);

console.log('OK Errores de Supabase no permiten cierre');

await assert.rejects(
  verifyAccountDeletion({
    ...fixture(),
    verifyStorageEmpty: undefined
  }),
  /Faltan comprobaciones/
);

console.log('OK No se admiten verificaciones incompletas');

console.log('ROOMS DELETION FINAL VERIFICATION OK');
