import assert from 'node:assert/strict';
import {
  inventoryUserStorage
} from './account-storage-inventory.mjs';

const id = '12345678-1234-4234-8234-123456789abc';
const other = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const calls = [];
const storage = {
  from(bucket) {
    return {
      async list(prefix, options) {
        calls.push({ bucket, prefix, offset: options.offset });

        if (bucket === 'avatars' && prefix === id) {
          return {
            data: [
              { name: 'avatar.png', id: 'file-1' },
              { name: 'historico', id: null, metadata: null }
            ],
            error: null
          };
        }

        if (
          bucket === 'avatars' &&
          prefix === `${id}/historico`
        ) {
          return {
            data: [
              { name: 'anterior.png', id: 'file-2' }
            ],
            error: null
          };
        }

        return { data: [], error: null };
      }
    };
  }
};

const inventory = await inventoryUserStorage(storage, id);

assert.deepEqual(inventory.avatars, [
  `${id}/avatar.png`,
  `${id}/historico/anterior.png`
]);
console.log('OK Archivos y subcarpetas inventariados');

assert.equal(Object.keys(inventory).length, 4);
console.log('OK Cuatro buckets inspeccionados');

assert(
  calls.every(call =>
    call.prefix === id ||
    call.prefix.startsWith(`${id}/`)
  )
);
console.log('OK Consultas limitadas al usuario');

assert(
  !calls.some(call => call.prefix.includes(other))
);
console.log('OK No se consultan carpetas ajenas');

await assert.rejects(
  inventoryUserStorage(storage, 'usuario-invalido'),
  /UUID/
);
console.log('OK Identificador invalido rechazado');

const failingStorage = {
  from() {
    return {
      async list() {
        return {
          data: null,
          error: { message: 'Acceso denegado' }
        };
      }
    };
  }
};

await assert.rejects(
  inventoryUserStorage(failingStorage, id),
  /Acceso denegado/
);
console.log('OK Errores de Storage no se ignoran');

console.log('ROOMS STORAGE INVENTORY OK');
