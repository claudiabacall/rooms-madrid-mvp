import assert from 'node:assert/strict';

import {
  buildAccountDeletionPlan
} from './account-deletion-plan.mjs';

const id = '12345678-1234-4234-8234-123456789abc';

const user = {
  id,
  email: 'rooms-delete-qa-test@example.com',
  user_metadata: {
    rooms_deletion_test: true
  }
};

let removals = 0;

const storage = {
  from(bucket) {
    return {
      async list(prefix) {
        if (
          bucket === 'avatars' &&
          prefix === id
        ) {
          return {
            data: [
              {
                name: 'avatar.png',
                id: 'image-1',
                metadata: { size: 100 }
              }
            ],
            error: null
          };
        }

        return { data: [], error: null };
      },
      async remove() {
        removals++;
        throw Error('Borrado prohibido en simulacion');
      }
    };
  }
};

const plan = await buildAccountDeletionPlan({
  storage,
  user,
  targetId: id
});

assert.equal(plan.mode, 'DRY_RUN');
assert.equal(plan.totalFiles, 1);
assert.equal(plan.buckets.length, 4);
assert.equal(plan.authDeletion, 'NOT_EXECUTED');
assert.equal(plan.storageDeletion, 'NOT_EXECUTED');
assert.equal(removals, 0);

console.log('OK Plan de baja generado');
console.log('OK Cuatro buckets incluidos');
console.log('OK Total de archivos calculado');
console.log('OK Ningun borrado ejecutado');

await assert.rejects(
  buildAccountDeletionPlan({
    storage,
    user: {
      ...user,
      user_metadata: { rooms_test_account: true }
    },
    targetId: id
  }),
  /no esta marcada/
);

console.log('OK Cuenta QA normal protegida');
console.log('ROOMS ACCOUNT DELETION DRY RUN OK');
