import assert from 'node:assert/strict';
import {
  executeDisposableAccountDeletion
} from './account-deletion-coordinator.mjs';

const id = '12345678-1234-4234-8234-123456789abc';

const user = {
  id,
  email: 'rooms-delete-qa-test@example.com',
  user_metadata: { rooms_deletion_test: true }
};

function fixture({
  members = 0,
  householdMembers = 0,
  removalError = false,
  authSuccess = true
} = {}) {
  const operations = [];
  const files = new Set([`${id}/avatar.jpg`]);

  const storage = {
    from() {
      return {
        async list(prefix, options) {
          operations.push('list');
          const entries = [...files]
            .filter(path => path.startsWith(`${prefix}/`))
            .map(path => ({
              name: path.slice(prefix.length + 1),
              id: path,
              metadata: { size: 10 }
            }));

          return {
            data: entries.slice(
              options.offset,
              options.offset + options.limit
            ),
            error: null
          };
        },

        async remove(paths) {
          operations.push('remove');

          if (removalError) {
            return {
              error: { message: 'Storage no disponible' }
            };
          }

          for (const path of paths) files.delete(path);
          return { data: paths, error: null };
        }
      };
    }
  };

  return {
    operations,
    args: {
      user,
      targetId: id,
      confirmation: `DELETE ACCOUNT ${id}`,
      storage,
      async inspectSharedImpact() {
        operations.push('impact');
        return {
          communityMembersAffected: members,
          householdMembersAffected: householdMembers
        };
      },
      async deleteAuthUser() {
        operations.push('auth');
        return { deleted: authSuccess };
      }
    }
  };
}

const blocked = fixture({ members: 2 });

await assert.rejects(
  executeDisposableAccountDeletion(blocked.args),
  /otros miembros afectados/
);

assert.deepEqual(blocked.operations, ['impact']);
console.log('OK Comunidad compartida bloquea toda eliminacion');

const household = fixture({ householdMembers: 1 });

await assert.rejects(
  executeDisposableAccountDeletion(household.args),
  /otros miembros afectados/
);

assert.deepEqual(household.operations, ['impact']);
console.log('OK Hogar compartido protegido');

const unauthorized = fixture();

await assert.rejects(
  executeDisposableAccountDeletion({
    ...unauthorized.args,
    confirmation: 'NO AUTORIZADO'
  }),
  /Confirmacion/
);

assert.deepEqual(unauthorized.operations, []);
console.log('OK Sin confirmacion no hay operaciones');

const storageFailure = fixture({ removalError: true });

await assert.rejects(
  executeDisposableAccountDeletion(storageFailure.args),
  /Storage no disponible/
);

assert(!storageFailure.operations.includes('auth'));
console.log('OK Fallo Storage impide borrar Auth');

const success = fixture();
const result = await executeDisposableAccountDeletion(
  success.args
);

assert.equal(result.status, 'AUTH_DELETION_CONFIRMED');
assert.equal(result.databaseVerification, 'PENDING');
assert.equal(success.operations.at(-1), 'auth');

const lastRemove = success.operations.lastIndexOf('remove');
const lastList = success.operations.lastIndexOf('list');
const authIndex = success.operations.indexOf('auth');

assert(lastRemove >= 0);
assert(lastList > lastRemove);
assert(authIndex > lastList);

console.log('OK Storage verificado antes de Auth');
console.log('OK Baja simulada con dependencias vacias');
console.log('OK Verificacion final de BD sigue pendiente');

const authFailure = fixture({ authSuccess: false });

await assert.rejects(
  executeDisposableAccountDeletion(authFailure.args),
  /Auth no confirmada/
);

console.log('OK Error administrativo detectado');
console.log('ROOMS ACCOUNT DELETION COORDINATOR OK');
