import assert from 'node:assert/strict';
import {
  deleteDisposableAccountStorage
} from './account-storage-cleanup.mjs';

const id = '12345678-1234-4234-8234-123456789abc';

const user = {
  id,
  email: 'rooms-delete-qa-test@example.com',
  user_metadata: { rooms_deletion_test: true }
};

function mockStorage({ failRemove = false } = {}) {
  const objects = new Map([
    ['avatars', new Set([`${id}/avatar.jpg`])],
    ['listing-images', new Set(
      Array.from({ length: 125 }, (_, i) =>
        `${id}/listing-${String(i).padStart(3, '0')}.jpg`
      )
    )],
    ['community-images', new Set()],
    ['community-post-media', new Set()]
  ]);

  const removals = [];

  return {
    removals,
    from(bucket) {
      const files = objects.get(bucket);
      assert(files, `Bucket inesperado: ${bucket}`);

      return {
        async list(prefix, options) {
          const entries = [...files]
            .filter(path => path.startsWith(`${prefix}/`))
            .map(path => ({
              name: path.slice(prefix.length + 1),
              id: path,
              metadata: { size: 10 }
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

          return {
            data: entries.slice(
              options.offset,
              options.offset + options.limit
            ),
            error: null
          };
        },

        async remove(paths) {
          removals.push({ bucket, paths });

          if (failRemove) {
            return {
              error: { message: 'Fallo controlado' }
            };
          }

          for (const path of paths) {
            files.delete(path);
          }

          return { data: paths, error: null };
        }
      };
    }
  };
}

const storage = mockStorage();

await assert.rejects(
  deleteDisposableAccountStorage({
    storage,
    user,
    targetId: id,
    confirmation: 'NO AUTORIZADO'
  }),
  /Confirmacion/
);

assert.equal(storage.removals.length, 0);
console.log('OK Sin confirmacion no se borra');

await assert.rejects(
  deleteDisposableAccountStorage({
    storage,
    user: {
      ...user,
      user_metadata: { rooms_test_account: true }
    },
    targetId: id,
    confirmation: `DELETE STORAGE ${id}`
  }),
  /no esta marcada/
);

assert.equal(storage.removals.length, 0);
console.log('OK Cuenta QA normal protegida');

const result = await deleteDisposableAccountStorage({
  storage,
  user,
  targetId: id,
  confirmation: `DELETE STORAGE ${id}`
});

assert.equal(result.status, 'STORAGE_VERIFIED_EMPTY');
assert.equal(result.plannedFiles, 126);
assert.equal(result.remainingFiles, 0);
assert.equal(result.authDeletion, 'NOT_EXECUTED');

assert.deepEqual(
  storage.removals.map(item => item.paths.length),
  [1, 100, 25]
);

console.log('OK Eliminacion simulada por lotes');
console.log('OK 126 archivos procesados');
console.log('OK Inventario final vacio');
console.log('OK Supabase Auth no se modifica');

const failingStorage = mockStorage({ failRemove: true });

await assert.rejects(
  deleteDisposableAccountStorage({
    storage: failingStorage,
    user,
    targetId: id,
    confirmation: `DELETE STORAGE ${id}`
  }),
  /Fallo controlado/
);

console.log('OK Error de borrado detiene el proceso');
console.log('ROOMS STORAGE CLEANUP ENGINE OK');
