import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import dotenv from 'dotenv';
import { chromium } from 'playwright';

const QA = 'https://gpfmocptevpyzrwsubkj.supabase.co';

const config = JSON.parse(
  readFileSync(
    join(homedir(), '.config/rooms/qa-public.json'),
    'utf8'
  )
);

assert.equal(config.url, QA, 'STOP: proyecto no es QA');

const env = dotenv.parse(
  readFileSync('.env.rooms-test.local')
);

assert.ok(
  env.ROOMS_TEST_EMAIL &&
  env.ROOMS_TEST_PASSWORD &&
  env.ROOMS_TEST_USER_ID,
  'STOP: credenciales QA incompletas'
);

console.log('OK Proyecto y usuario QA identificados');

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

async function waitForServer(origin, child) {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) {
      throw Error('Servidor local finalizado');
    }

    try {
      const res = await fetch(origin, {
        signal: AbortSignal.timeout(1000)
      });
      if (res.ok) return;
    } catch {}

    await delay(100);
  }

  throw Error('Servidor local no disponible');
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    ROOMS_SUPABASE_ENV: 'qa'
  },
  stdio: 'ignore'
});

let browser;
let page;
let listingId = null;
let photoPath = null;
let ownerId = null;
let uploadSucceeded = false;
let clean = true;
let signedRequests = 0;
const errors = [];

try {
  await waitForServer(origin, server);

  const response = await fetch(
    `${origin}/assets/js/supabase-config.js`
  );
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes(QA));

  console.log('OK Servidor local aislado en QA');

  browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    serviceWorkers: 'block'
  });

  page = await context.newPage();

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  await page.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      url.hostname === 'supabase.co' ||
      url.hostname.endsWith('.supabase.co')
    ) {
      if (url.origin !== QA) {
        return route.abort();
      }

      if (
        request.method() === 'POST' &&
        url.pathname.startsWith(
          '/storage/v1/object/sign/listing-images/'
        )
      ) {
        signedRequests++;
      }
    }

    return route.continue();
  });

  await page.goto(origin, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.locator('#authGate').waitFor({
    state: 'visible',
    timeout: 20000
  });

  assert.equal(
    await page.evaluate(() => window.ROOMS_SUPABASE?.url),
    QA
  );

  await page.locator('#authEmail').fill(
    env.ROOMS_TEST_EMAIL
  );

  await page.locator('#authPassword').fill(
    env.ROOMS_TEST_PASSWORD
  );

  await page.locator('#authSubmit').click();

  await page.locator('#authGate').waitFor({
    state: 'hidden',
    timeout: 30000
  });

  await page.waitForFunction(
    () => Boolean(window.roomsBackend?.state?.user?.id),
    null,
    { timeout: 30000 }
  );

  ownerId = await page.evaluate(
    () => window.roomsBackend.state.user.id
  );

  assert.equal(
    ownerId,
    env.ROOMS_TEST_USER_ID,
    'STOP: usuario autenticado inesperado'
  );

  console.log('OK Login real con usuario esperado');

  // Crear exclusivamente una vivienda temporal QA.
  const created = await page.evaluate(async ownerId => {
    const db = window.roomsBackend.db;

    const { data, error } = await db
      .from('listings')
      .insert({
        owner_id: ownerId,
        kind: 'room',
        title: 'ROOMS QA M8.75 - TEMPORAL',
        zone: 'Centro',
        price: 777,
        rooms: 1,
        baths: 1,
        area: 18,
        furnished: true,
        features: [],
        photos: [],
        description:
          'Fixture temporal automatizado de privacidad.',
        location_precision: 'approximate'
      })
      .select('id,owner_id,status')
      .single();

    return {
      data,
      error: error?.message || null
    };
  }, ownerId);

  assert.ok(
    created.data?.id && !created.error,
    'No se pudo crear la vivienda QA: ' + created.error
  );

  listingId = created.data.id;

  assert.equal(created.data.owner_id, ownerId);

  console.log('OK Vivienda temporal creada en QA');

  const location = await page.evaluate(async id => {
    const { data, error } =
      await window.roomsBackend.db.rpc(
        'set_listing_private_location',
        {
          target_listing_id: id,
          target_exact_address:
            'Puerta del Sol, Madrid, Espana',
          target_exact_latitude: 40.4169,
          target_exact_longitude: -3.7035
        }
      );

    if (error) {
      return {
        ok: false,
        reason: 'RPC rechazada',
        error: error.message
      };
    }

    // Una RPC puede devolver null aunque se ejecute bien.
    // Comprobar el resultado persistido, no Boolean(data).
    const { data: listing, error: readError } =
      await window.roomsBackend.db
        .from('listings')
        .select(
          'id,location_precision,latitude,longitude'
        )
        .eq('id', id)
        .single();

    if (readError) {
      return {
        ok: false,
        reason: 'Lectura posterior fallida',
        error: readError.message
      };
    }

    const valid =
      listing?.id === id &&
      listing.location_precision === 'approximate' &&
      Number.isFinite(listing.latitude) &&
      Number.isFinite(listing.longitude);

    return {
      ok: valid,
      reason: valid
        ? 'Ubicacion persistida'
        : 'Coordenadas aproximadas no verificadas',
      error: null
    };
  }, listingId);

  assert.ok(
    location.ok,
    'Ubicacion QA: ' +
      location.reason +
      (location.error ? ' - ' + location.error : '')
  );

  console.log('OK Ubicacion privada de prueba asignada');

  photoPath =
    `${ownerId}/${listingId}/m875-${Date.now()}.png`;

  // PNG sintetico de 1x1, sin imagenes personales.
  const uploaded = await page.evaluate(
    async path => {
      const encoded =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ' +
        'AAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';

      const bytes = Uint8Array.from(
        atob(encoded),
        char => char.charCodeAt(0)
      );

      const file = new File(
        [bytes],
        'm875.png',
        { type: 'image/png' }
      );

      const bucket = window.roomsBackend.db.storage
        .from('listing-images');

      const { error } = await bucket.upload(
        path,
        file,
        {
          contentType: 'image/png',
          upsert: false
        }
      );

      if (error) {
        return {
          ok: false,
          error: error.message
        };
      }

      return {
        ok: true,
        publicReference:
          bucket.getPublicUrl(path).data.publicUrl
      };
    },
    photoPath
  );

  uploadSucceeded = Boolean(uploaded.ok);

  assert.ok(
    uploaded.ok,
    'Storage QA rechazo subida: ' + uploaded.error
  );

  console.log('OK PNG de prueba subido a Storage QA');

  const linked = await page.evaluate(
    async ({ id, reference }) => {
      const db = window.roomsBackend.db;

      const { data, error } = await db
        .from('listings')
        .update({
          photos: [reference]
        })
        .eq('id', id)
        .select('id,photos,status')
        .single();

      return {
        data,
        error: error?.message || null
      };
    },
    {
      id: listingId,
      reference: uploaded.publicReference
    }
  );

  assert.ok(
    linked.data?.photos?.length === 1 &&
    !linked.error,
    'No se pudo vincular la fotografia: ' + linked.error
  );

  assert.equal(
    linked.data.status,
    'published',
    'La vivienda no esta publicada'
  );

  console.log('OK Fotografia vinculada a vivienda publicada');

  // Leer una vez mas los datos del servidor y reconstruir
  // el frontend a traves de su propio ciclo de carga.
  await page.reload({
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await page.locator('#authGate').waitFor({
    state: 'hidden',
    timeout: 30000
  });

  const card = page.locator(
    `[data-real-listing="${listingId}"]`
  );

  await card.first().waitFor({
    state: 'attached',
    timeout: 30000
  });

  const signedImage = page.locator(
    `[data-real-listing="${listingId}"] ` +
    'img[src*="/storage/v1/object/sign/listing-images/"]'
  ).first();

  await signedImage.waitFor({
    state: 'attached',
    timeout: 30000
  });

  const imageStatus = await signedImage.evaluate(img => ({
    src: img.getAttribute('src'),
    loaded: img.complete && img.naturalWidth > 0
  }));

  assert.ok(
    imageStatus.src.includes(
      `/storage/v1/object/sign/listing-images/${photoPath}`
    ),
    'URL firmada no corresponde a la fotografia QA'
  );

  assert.ok(
    new URL(imageStatus.src).searchParams.has('token'),
    'La fotografia no contiene token temporal'
  );

  assert.ok(signedRequests > 0, 'No se solicito firma real');

  console.log('OK ROOMS muestra URL firmada real en Chromium');
  console.log('OK Storage QA recibio solicitud de firma');

  await signedImage.evaluate(img => {
    if (img.complete && img.naturalWidth > 0) return;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error('Imagen no cargada')),
        12000
      );

      img.addEventListener(
        'load',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );

      img.addEventListener(
        'error',
        () => {
          clearTimeout(timer);
          reject(Error('Storage no entrega imagen'));
        },
        { once: true }
      );
    });
  });

  console.log('OK Fotografia real descargada correctamente');

  const publicImages = await page.locator(
    'img[src*="/storage/v1/object/public/listing-images/"]'
  ).count();

  assert.equal(
    publicImages,
    0,
    'Se encontraron imagenes publicas en el DOM'
  );

  assert.deepEqual(errors, []);

  console.log('OK Sin URLs publicas en DOM');
  console.log('OK Sin errores JavaScript');
  console.log('OK M8.75 STORAGE REAL VALIDADO');

} catch (error) {
  console.error(
    'FALLO M8.75:',
    error?.message || String(error)
  );
  process.exitCode = 1;
} finally {
  if (listingId && page && !page.isClosed()) {
    try {
      const cleanup = await page.evaluate(
        async ({ id, owner, path, uploaded }) => {
          const db = window.roomsBackend?.db;

          if (!db) {
            return {
              storageOk: !uploaded,
              listingOk: false,
              error: 'Cliente QA no disponible'
            };
          }

          let storageOk = !uploaded;

          if (uploaded && path) {
            const { error } = await db.storage
              .from('listing-images')
              .remove([path]);

            storageOk = !error;
          }

          const { data, error } = await db
            .from('listings')
            .delete()
            .eq('id', id)
            .eq('owner_id', owner)
            .select('id');

          const { data: remaining, error: readError } =
            await db.from('listings')
              .select('id')
              .eq('id', id);

          return {
            storageOk,
            listingOk:
              !error &&
              !readError &&
              data?.length === 1 &&
              remaining?.length === 0
          };
        },
        {
          id: listingId,
          owner: ownerId,
          path: photoPath,
          uploaded: uploadSucceeded
        }
      );

      clean = cleanup.storageOk && cleanup.listingOk;

      if (clean) {
        console.log(
          'OK Fotografia y vivienda QA eliminadas'
        );
      } else {
        console.error(
          'ATENCION: limpieza incompleta',
          JSON.stringify(cleanup)
        );
      }
    } catch (error) {
      clean = false;
      console.error(
        'ATENCION: fallo de limpieza:',
        error.message
      );
    }

    if (!clean) {
      console.error(
        'IDENTIFICADOR QA PENDIENTE:',
        listingId
      );
      console.error(
        'RUTA STORAGE QA PENDIENTE:',
        photoPath
      );
      process.exitCode = 1;
    }
  }

  if (browser) {
    await browser.close().catch(() => {});
  }

  server.kill('SIGTERM');
}
