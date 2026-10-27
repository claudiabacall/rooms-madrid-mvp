import test from 'node:test';
import assert from 'node:assert/strict';

import {
  executeDisposableAccountDeletion
} from './account-deletion-coordinator.mjs';

const targetId = 'd022e620-aedb-4ee0-8995-c15c4ac5545f';
const auditId = '11111111-1111-4111-8111-111111111111';
const claimToken = '22222222-2222-4222-8222-222222222222';

const claim = {
  id: auditId,
  target_user_id: targetId,
  claim_token: claimToken,
  status: 'processing',
  claimed_at: '2026-10-27T09:00:00Z',
  finished_at: null
};

const barrier = {
  verified: true,
  databaseWritesBlocked: true,
  storageWritesBlocked: true,
  inFlightWritesDrained: true
};

test(
  'no elimina Auth si la barrera se pierde despues de Storage',
  async () => {
    let checks = 0;
    let authCalls = 0;

    const user = {
      id: targetId,
      email: 'rooms-delete-qa-barrier@example.com',
      app_metadata: {},
      user_metadata: { rooms_deletion_test: true }
    };

    await assert.rejects(
      executeDisposableAccountDeletion({
        user,
        targetId,
        confirmation: `DELETE ACCOUNT ${targetId}`,
        auditId,
        claimToken,
        storage: {
          from: () => ({
            list: async () => ({
              data: [],
              error: null
            }),
            remove: async () => ({
              data: [],
              error: null
            })
          })
        },
        verifyDeletionClaim: async () => claim,
        inspectSharedImpact: async () => ({
          communityMembersAffected: 0,
          householdMembersAffected: 0,
          ownedCommunities: 0,
          ownedHouseholds: 0
        }),
        verifyWriteBarrier: async () => {
          checks++;
          return checks === 1
            ? barrier
            : {
                ...barrier,
                storageWritesBlocked: false
              };
        },
        verifyStorageEmpty: async () => ({
          verified: true,
          remainingFiles: 0
        }),
        deleteAuthUser: async () => {
          authCalls++;
          return { deleted: true };
        }
      }),
      /Barrera revocada antes de eliminar Auth/
    );

    assert.equal(checks, 2);
    assert.equal(authCalls, 0);
  }
);

console.log('ROOMS BARRIER RUNTIME · SIN OPERACIONES REALES');
