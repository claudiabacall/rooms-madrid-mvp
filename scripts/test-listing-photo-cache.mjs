import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };

vm.runInNewContext(
  readFileSync(
    'assets/js/features/listing-photo-cache.js',
    'utf8'
  ),
  context
);

const create = context.window.ROOMS_LISTING_PHOTO_CACHE.create;

let clock = 100000;
let calls = 0;

const source = {
  id: 'listing-1',
  owner_id: 'owner-1',
  status: 'published',
  photos: ['stable-photo-1']
};

const cache = create({
  now: () => clock,
  view: {
    async projectListing(listing) {
      calls++;
      return {
        ...listing,
        photos: [`https://signed.example/${calls}`]
      };
    }
  }
});

const first = await cache.resolve(source);
assert.equal(first.photos[0], 'https://signed.example/1');
assert.equal(source.photos[0], 'stable-photo-1');
console.log('OK Primera URL temporal obtenida');

clock += 30000;
const second = await cache.resolve(source);
assert.equal(second.photos[0], first.photos[0]);
assert.equal(calls, 1);
console.log('OK URL valida reutilizada');

clock += 15001;
const third = await cache.resolve(source);
assert.equal(third.photos[0], 'https://signed.example/2');
assert.equal(calls, 2);
console.log('OK URL renovada antes del minuto');

const changed = {
  ...source,
  photos: ['stable-photo-2']
};

await cache.resolve(changed);
assert.equal(calls, 3);
console.log('OK Cambio de fotografia invalida cache');

cache.invalidate(source.id);
await cache.resolve(changed);
assert.equal(calls, 4);
console.log('OK Invalidacion explicita');

const denied = create({
  now: () => clock,
  view: {
    async projectListing(listing) {
      calls++;
      return { ...listing, photos: [] };
    }
  }
});

const before = calls;
assert.equal((await denied.resolve(source)).photos.length, 0);
assert.equal((await denied.resolve(source)).photos.length, 0);
assert.equal(calls, before + 2);
console.log('OK Acceso denegado no se almacena');
console.log('OK Sin fallback a URL publica');

let concurrentCalls = 0;
const concurrent = create({
  now: () => clock,
  view: {
    async projectListing(listing) {
      concurrentCalls++;
      await new Promise(resolve => setTimeout(resolve, 5));
      return { ...listing, photos: ['https://signed.example/shared'] };
    }
  }
});

const results = await Promise.all([
  concurrent.resolve(source),
  concurrent.resolve(source),
  concurrent.resolve(source)
]);

assert.equal(concurrentCalls, 1);
assert.equal(results.length, 3);
assert.ok(results.every(
  result => result.photos[0] === 'https://signed.example/shared'
));
console.log('OK Peticiones simultaneas compartidas');

cache.invalidate();
console.log('OK Limpieza completa disponible');

assert.throws(
  () => create({ view: null }),
  /Photo View/
);
console.log('OK Dependencias verificadas');


{
  let release;
  let started;
  const begun = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });

  const delayed = create({
    view: {
      async projectListing(listing) {
        started();
        await barrier;
        return {
          ...listing,
          photos: ['https://signed.example/stale']
        };
      }
    }
  });

  const outstanding = delayed.resolve(source);
  await begun;

  delayed.invalidate(source.id);
  release();

  const result = await outstanding;
  assert.equal(result.photos.length, 0);
  console.log('OK Respuesta anterior a invalidacion descartada');
}

{
  let release;
  let started;
  const begun = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });

  const delayed = create({
    view: {
      async projectListing(listing) {
        started();
        await barrier;
        return {
          ...listing,
          photos: ['https://signed.example/stale-global']
        };
      }
    }
  });

  const outstanding = delayed.resolve(source);
  await begun;

  delayed.invalidate();
  release();

  const result = await outstanding;
  assert.equal(result.photos.length, 0);
  console.log('OK Respuesta anterior a cierre de sesion descartada');
}

{
  let release;
  let started;
  let calls = 0;

  const begun = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });

  const delayed = create({
    view: {
      async projectListing(listing) {
        calls++;
        if (calls === 1) {
          started();
          await barrier;
        }
        return {
          ...listing,
          photos: [`https://signed.example/${calls}`]
        };
      }
    }
  });

  const oldRequest = delayed.resolve(source);
  await begun;

  delayed.invalidate(source.id);

  const newResult = await delayed.resolve(source);
  assert.equal(newResult.photos[0], 'https://signed.example/2');

  release();

  const oldResult = await oldRequest;
  assert.equal(oldResult.photos.length, 0);

  const cachedResult = await delayed.resolve(source);
  assert.equal(cachedResult.photos[0], newResult.photos[0]);
  assert.equal(calls, 2);

  console.log('OK Respuesta antigua no sobrescribe URL renovada');
}

console.log('OK M8.38 GESTOR DE RENOVACION VALIDADO');
