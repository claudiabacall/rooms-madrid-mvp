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
  ownedCommunities = 0,
  ownedHouseholds = 0,
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
      auditId: '11111111-1111-4111-8111-111111111111',
      claimToken: '22222222-2222-4222-8222-222222222222',
      async verifyDeletionClaim({ auditId, targetId, claimToken }) {
        operations.push('claim');
        return {
          id: auditId,
          target_user_id: targetId,
          claim_token: claimToken,
          status: 'processing',
          claimed_at: '2026-10-22T10:00:00.000Z',
          finished_at: null
        };
      },
      async inspectSharedImpact() {
        operations.push('impact');
        return {
          communityMembersAffected: members,
          householdMembersAffected: householdMembers,
          ownedCommunities,
          ownedHouseholds
        };
      },
      async verifyWriteBarrier() {
        operations.push('barrier');
        return {
          verified: true,
          databaseWritesBlocked: true,
          storageWritesBlocked: true,
          inFlightWritesDrained: true
        };
      },
      async verifyStorageEmpty() {
        operations.push('final-storage');
        return {
          verified: true,
          remainingFiles: files.size
        };
      },
      async deleteAuthUser() {
        operations.push('auth');
        return { deleted: authSuccess };
      }
    }
  };
}

const missingClaim = fixture();
delete missingClaim.args.verifyDeletionClaim;

await assert.rejects(
  executeDisposableAccountDeletion(missingClaim.args),
  /Reclamacion administrativa requerida/
);
assert.deepEqual(missingClaim.operations, []);
console.log('OK Sin verificador administrativo no se inicia baja');

const invalidClaim = fixture();
invalidClaim.args.verifyDeletionClaim = async () => {
  invalidClaim.operations.push('claim');
  return {
    id: invalidClaim.args.auditId,
    target_user_id: id,
    claim_token: invalidClaim.args.claimToken,
    status: 'started',
    claimed_at: null,
    finished_at: null
  };
};

await assert.rejects(
  executeDisposableAccountDeletion(invalidClaim.args),
  /Reclamacion administrativa no vigente/
);
assert.deepEqual(invalidClaim.operations, ['claim']);
console.log('OK Auditoria started bloquea toda operacion');

const wrongToken = fixture();
wrongToken.args.verifyDeletionClaim = async () => {
  wrongToken.operations.push('claim');
  return {
    id: wrongToken.args.auditId,
    target_user_id: id,
    claim_token: '44444444-4444-4444-8444-444444444444',
    status: 'processing',
    claimed_at: '2026-10-22T10:00:00.000Z',
    finished_at: null
  };
};

await assert.rejects(
  executeDisposableAccountDeletion(wrongToken.args),
  /Reclamacion administrativa no vigente/
);
assert.deepEqual(wrongToken.operations, ['claim']);
console.log('OK Token incorrecto bloquea toda operacion');

const blocked = fixture({ members: 2 });

await assert.rejects(
  executeDisposableAccountDeletion(blocked.args),
  /titularidad o miembros afectados/
);

assert.deepEqual(blocked.operations, ['claim', 'impact']);
console.log('OK Comunidad compartida bloquea toda eliminacion');

const household = fixture({ householdMembers: 1 });

await assert.rejects(
  executeDisposableAccountDeletion(household.args),
  /titularidad o miembros afectados/
);

assert.deepEqual(household.operations, ['claim', 'impact']);
console.log('OK Hogar compartido protegido');

const communityOwner = fixture({
  ownedCommunities: 1
});

await assert.rejects(
  executeDisposableAccountDeletion(communityOwner.args),
  /titularidad o miembros afectados/
);

assert.deepEqual(communityOwner.operations, ['claim', 'impact']);
console.log('OK Propietario de comunidad protegido');

const householdOwner = fixture({
  ownedHouseholds: 1
});

await assert.rejects(
  executeDisposableAccountDeletion(householdOwner.args),
  /titularidad o miembros afectados/
);

assert.deepEqual(householdOwner.operations, ['claim', 'impact']);
console.log('OK Propietario de hogar protegido');

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

const revoked = fixture();
let claimReads = 0;
revoked.args.verifyDeletionClaim = async ({
  auditId, targetId, claimToken
}) => {
  revoked.operations.push('claim');
  claimReads++;
  return {
    id: auditId,
    target_user_id: targetId,
    claim_token: claimToken,
    status: claimReads === 1 ? 'processing' : 'failed',
    claimed_at: '2026-10-22T10:00:00.000Z',
    finished_at: claimReads === 1
      ? null
      : '2026-10-22T10:05:00.000Z'
  };
};

await assert.rejects(
  executeDisposableAccountDeletion(revoked.args),
  /revocada antes de Auth/
);
assert.equal(claimReads, 2);
assert(revoked.operations.includes('remove'));
assert(!revoked.operations.includes('auth'));
console.log('OK Claim revocado impide eliminar Auth');

const lateUpload = fixture();
let lateClaimReads = 0;
let lateFile = false;

const originalClaim = lateUpload.args.verifyDeletionClaim;

lateUpload.args.verifyDeletionClaim = async args => {
  const claim = await originalClaim(args);
  lateClaimReads++;

  // La subida aparece tras la limpieza inicial
  // y antes de la ultima verificacion de Storage.
  if (lateClaimReads === 2) lateFile = true;

  return claim;
};

lateUpload.args.verifyStorageEmpty = async () => {
  lateUpload.operations.push('final-storage');
  return {
    verified: true,
    remainingFiles: lateFile ? 1 : 0
  };
};

await assert.rejects(
  executeDisposableAccountDeletion(lateUpload.args),
  /Storage ha cambiado antes de eliminar Auth/
);

assert.equal(lateClaimReads, 2);
assert(lateUpload.operations.includes('remove'));
assert(lateUpload.operations.includes('final-storage'));
assert(!lateUpload.operations.includes('auth'));

console.log(
  'OK Archivo tardio detectado: Auth no eliminado'
);

const missingFinalCheck = fixture();
delete missingFinalCheck.args.verifyStorageEmpty;

await assert.rejects(
  executeDisposableAccountDeletion(missingFinalCheck.args),
  /Faltan operaciones administrativas/
);

assert.deepEqual(missingFinalCheck.operations, []);
console.log(
  'OK Sin verificacion independiente no comienza la baja'
);

const missingBarrier = fixture();
delete missingBarrier.args.verifyWriteBarrier;

await assert.rejects(
  executeDisposableAccountDeletion(missingBarrier.args),
  /Faltan operaciones administrativas/
);

assert.deepEqual(missingBarrier.operations, []);
console.log('OK Sin verificador de barrera no comienza baja');

const rejectedBarrier = fixture();
rejectedBarrier.args.verifyWriteBarrier = async () => {
  rejectedBarrier.operations.push('barrier');
  return {
    verified: false,
    databaseWritesBlocked: true,
    storageWritesBlocked: false,
    inFlightWritesDrained: false
  };
};

await assert.rejects(
  executeDisposableAccountDeletion(rejectedBarrier.args),
  /Barrera de escrituras no verificada/
);

assert(rejectedBarrier.operations.includes('impact'));
assert(rejectedBarrier.operations.includes('barrier'));
assert(!rejectedBarrier.operations.includes('remove'));
assert(!rejectedBarrier.operations.includes('auth'));

console.log(
  'OK Barrera incompleta impide limpiar Storage y Auth'
);

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
