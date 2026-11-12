import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };

vm.runInNewContext(
  readFileSync(
    'assets/js/features/listing-photo-view.js',
    'utf8'
  ),
  context
);

const create =
  context.window.ROOMS_LISTING_PHOTO_VIEW.create;

const original = {
  id: 'listing-1',
  title: 'Habitacion de prueba',
  owner_id: 'owner-1',
  photos: [
    'https://example.test/public/1.png',
    'https://example.test/public/2.png'
  ]
};

const resolver = {
  async resolveListing() {
    return [
      'https://example.test/signed/1?token=test',
      'https://example.test/signed/2?token=test'
    ];
  }
};

const view = create({ resolver });

{
  const result = await view.projectListing(original);

  assert.notEqual(result, original);
  assert.notEqual(result.photos, original.photos);
  assert.equal(result.id, original.id);
  assert.equal(result.title, original.title);
  assert.equal(result.photos.length, 2);
  assert.match(result.photos[0], /signed/);
  assert.match(result.photos[1], /signed/);

  assert.equal(
    original.photos[0],
    'https://example.test/public/1.png'
  );

  console.log('OK Datos originales conservados');
  console.log('OK Copia visual con URLs temporales');
}

{
  const failing = create({
    resolver: {
      async resolveListing() {
        return [null, undefined];
      }
    }
  });

  const result = await failing.projectListing(original);

  assert.equal(result.photos.length, 0);
  assert.equal(original.photos.length, 2);

  console.log('OK Acceso denegado sin fallback publico');
}

{
  const failing = create({
    resolver: {
      async resolveListing() {
        throw Error('Storage unavailable');
      }
    }
  });

  const result = await failing.projectListing(original);

  assert.equal(result.photos.length, 0);

  console.log('OK Error Storage no rompe visualizacion');
}

{
  const result = await view.projectListings([
    { id: 'a', photos: [] },
    original,
    { id: 'c', photos: [] }
  ]);

  assert.deepEqual(
    Array.from(result, item => item.id),
    ['a', 'listing-1', 'c']
  );

  assert.equal(result[0].photos.length, 0);
  assert.equal(result[2].photos.length, 0);

  console.log('OK Orden de anuncios conservado');
  console.log('OK Anuncios sin fotos conservados');
}

{
  const result = await view.projectListings(null);

  assert.equal(result.length, 0);

  console.log('OK Datos vacios controlados');
}

{
  let active = 0;
  let maximum = 0;

  const limited = create({
    resolver: {
      async resolveListing() {
        active++;
        maximum = Math.max(maximum, active);

        await new Promise(resolve =>
          setTimeout(resolve, 1)
        );

        active--;
        return ['https://example.test/signed'];
      }
    }
  });

  const batch = await limited.projectListings(
    Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      photos: ['photo']
    }))
  );

  assert.equal(batch.length, 12);
  assert.ok(maximum <= 4);
  assert.ok(maximum > 0);

  console.log('OK Concurrencia limitada a cuatro anuncios');
}

assert.throws(
  () => create({ resolver: null }),
  /resolvedor/
);

console.log('OK Dependencias obligatorias validadas');
console.log('OK M8.35 MODELO VISUAL VALIDADO');
