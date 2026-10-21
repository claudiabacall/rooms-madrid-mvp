import assert from 'node:assert/strict';
import { inventoryUserStorage } from './account-storage-inventory.mjs';

const userId = '12345678-1234-4234-8234-123456789abc';
const calls = [];
let writes = 0;

const rootFiles = Array.from({ length: 205 }, (_, i) => ({
  name: `file-${String(i).padStart(3, '0')}.jpg`,
  id: `object-${i}`,
  metadata: { size: 100 }
}));

rootFiles.push({
  name: 'nested',
  id: null,
  metadata: null
});

const nestedFiles = [
  { name: 'inside.jpg', id: 'nested-object', metadata: { size: 20 } }
];

const storage = {
  from(bucket) {
    return {
      async list(prefix, options) {
        calls.push({ bucket, prefix, offset: options.offset });

        let entries = [];
        if (bucket === 'listing-images' && prefix === userId) {
          entries = rootFiles;
        } else if (
          bucket === 'listing-images' &&
          prefix === `${userId}/nested`
        ) {
          entries = nestedFiles;
        }

        return {
          data: entries.slice(
            options.offset,
            options.offset + options.limit
          ),
          error: null
        };
      },
      async remove() {
        writes++;
        throw new Error('No se debe borrar nada');
      }
    };
  }
};

const inventory = await inventoryUserStorage(storage, userId);

assert.equal(inventory['listing-images'].length, 206);
assert(inventory['listing-images'].includes(
  `${userId}/nested/inside.jpg`
));
console.log('OK 205 archivos y subcarpeta inventariados');

const listingPages = calls.filter(
  call => call.bucket === 'listing-images' &&
    call.prefix === userId
);

assert.deepEqual(
  listingPages.map(page => page.offset),
  [0, 100, 200]
);
console.log('OK Paginacion de 100 en 100');

assert.equal(new Set(inventory['listing-images']).size, 206);
console.log('OK Sin duplicados');

assert.equal(writes, 0);
console.log('OK Ninguna operacion de borrado');

const unsafeStorage = {
  from() {
    return {
      async list() {
        return {
          data: [{ name: '../otro-usuario', id: 'bad-object' }],
          error: null
        };
      }
    };
  }
};

await assert.rejects(
  inventoryUserStorage(unsafeStorage, userId),
  /no seguro/
);
console.log('OK Ruta sospechosa rechazada');

const paginatedErrorStorage = {
  from() {
    return {
      async list(_prefix, options) {
        if (options.offset === 100) {
          return {
            data: null,
            error: { message: 'Fallo en segunda pagina' }
          };
        }

        return {
          data: rootFiles.slice(0, 100),
          error: null
        };
      }
    };
  }
};

await assert.rejects(
  inventoryUserStorage(paginatedErrorStorage, userId),
  /Fallo en segunda pagina/
);
console.log('OK Fallo de paginacion detectado');

console.log('ROOMS STORAGE PAGINATION OK');
