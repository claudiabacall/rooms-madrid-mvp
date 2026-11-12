import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };

vm.runInNewContext(
  readFileSync(
    'assets/js/features/listing-photo-presentation.js',
    'utf8'
  ),
  context
);

const create =
  context.window.ROOMS_LISTING_PHOTO_PRESENTATION.create;

const listing = {
  id: 'listing-1',
  owner_id: 'owner-1',
  status: 'published',
  title: 'Habitacion',
  photos: ['https://public.example/photo.jpg']
};

let calls = 0;

const presentation = create({
  cache: {
    async resolve(item) {
      calls++;
      return {
        ...item,
        photos: ['https://signed.example/photo?token=ok']
      };
    }
  }
});

{
  const before = presentation.get(listing);

  assert.equal(before.photos.length, 0);
  assert.equal(listing.photos.length, 1);

  console.log('OK Sin preparacion no muestra URL publica');
}

{
  assert.equal(await presentation.prepare([listing]), true);

  const after = presentation.get(listing);

  assert.equal(
    after.photos[0],
    'https://signed.example/photo?token=ok'
  );

  assert.notEqual(after, listing);
  assert.notEqual(after.photos, listing.photos);

  assert.equal(
    listing.photos[0],
    'https://public.example/photo.jpg'
  );

  console.log('OK Solo muestra fotografia preparada');
  console.log('OK Datos originales intactos');
}

{
  const changed = {
    ...listing,
    photos: ['https://public.example/other.jpg']
  };

  assert.equal(presentation.get(changed).photos.length, 0);

  console.log('OK Cambio no preparado oculta fotografia');
}

{
  presentation.invalidate(listing.id);

  assert.equal(presentation.get(listing).photos.length, 0);

  console.log('OK Invalidacion por vivienda');
}

{
  await presentation.prepare([listing]);
  presentation.invalidate();

  assert.equal(presentation.get(listing).photos.length, 0);

  console.log('OK Invalidacion global');
}

{
  let release;
  let started;

  const begun = new Promise(resolve => {
    started = resolve;
  });

  const barrier = new Promise(resolve => {
    release = resolve;
  });

  const delayed = create({
    cache: {
      async resolve(item) {
        started();
        await barrier;

        return {
          ...item,
          photos: ['https://signed.example/old']
        };
      }
    }
  });

  const pending = delayed.prepare([listing]);
  await begun;

  delayed.invalidate();
  release();

  assert.equal(await pending, false);
  assert.equal(delayed.get(listing).photos.length, 0);

  console.log('OK Carga antigua no recupera fotos');
}

{
  const denied = create({
    cache: {
      async resolve() {
        throw new Error('Acceso denegado');
      }
    }
  });

  assert.equal(await denied.prepare([listing]), true);
  assert.equal(denied.get(listing).photos.length, 0);

  console.log('OK Error de Storage sin fallback publico');
}

{
  let active = 0;
  let maximum = 0;

  const limited = create({
    cache: {
      async resolve(item) {
        active++;
        maximum = Math.max(maximum, active);

        await new Promise(resolve =>
          setTimeout(resolve, 1)
        );

        active--;

        return {
          ...item,
          photos: ['https://signed.example/ok']
        };
      }
    }
  });

  const items = Array.from(
    { length: 12 },
    (_, index) => ({
      ...listing,
      id: String(index)
    })
  );

  assert.equal(await limited.prepare(items), true);
  assert.ok(maximum <= 4);
  assert.ok(maximum > 0);

  for (const item of items) {
    assert.equal(limited.get(item).photos.length, 1);
  }

  console.log('OK Preparacion limitada a cuatro viviendas');
}

{
  const empty = await presentation.prepare(null);

  assert.equal(empty, true);
  assert.equal(presentation.get(listing).photos.length, 0);

  console.log('OK Carga vacia controlada');
}


{
  let time = 100000;
  let requestCount = 0;

  const expiring = create({
    now: () => time,
    cache: {
      async resolve(item) {
        requestCount++;
        return {
          ...item,
          photos: [
            `https://signed.example/renewed-${requestCount}`
          ]
        };
      }
    }
  });

  await expiring.prepare([listing]);

  assert.equal(
    expiring.get(listing).photos[0],
    'https://signed.example/renewed-1'
  );

  time += 39999;
  assert.equal(expiring.get(listing).photos.length, 1);

  time += 1;
  assert.equal(expiring.get(listing).photos.length, 0);

  assert.equal(
    listing.photos[0],
    'https://public.example/photo.jpg'
  );

  console.log('OK URL visual caduca a los 40 segundos');
  console.log('OK Caducidad nunca recupera URL publica');

  await expiring.prepare([listing]);

  assert.equal(
    expiring.get(listing).photos[0],
    'https://signed.example/renewed-2'
  );

  console.log('OK Preparacion posterior renueva URL');
}

assert.equal(presentation.get(null), null);

assert.throws(
  () => create({ cache: null }),
  /Photo Cache/
);

console.log('OK Dependencias obligatorias validadas');
console.log('OK M8.47 PRESENTACION SEGURA VALIDADA');
