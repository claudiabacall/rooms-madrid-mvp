import {
  assertDisposableAccount,
  STORAGE_BUCKETS
} from './account-deletion-guards.mjs';

import {
  inventoryUserStorage
} from './account-storage-inventory.mjs';

export async function buildAccountDeletionPlan({
  storage,
  user,
  targetId
}) {
  assertDisposableAccount(user, targetId);

  const inventory = await inventoryUserStorage(
    storage,
    targetId
  );

  const buckets = STORAGE_BUCKETS.map(bucket => ({
    bucket,
    paths: inventory[bucket],
    count: inventory[bucket].length
  }));

  return {
    mode: 'DRY_RUN',
    userId: targetId,
    totalFiles: buckets.reduce(
      (sum, item) => sum + item.count,
      0
    ),
    buckets,
    authDeletion: 'NOT_EXECUTED',
    storageDeletion: 'NOT_EXECUTED'
  };
}
