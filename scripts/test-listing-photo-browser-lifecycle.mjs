import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

assert.match(
  app,
  /startListingPhotoRenewalForSession\(session\.user\.id\)/
);

assert.match(
  app,
  /window\.setInterval\([\s\S]*?,\s*30000\)/
);

assert.match(
  app,
  /listingPhotoRenewal\.cancel\(\)/
);

assert.match(
  app,
  /listingPhotoDomGuard\.clear\(\)/
);

for (const name of [
  'listing-photo-presentation.js',
  'listing-photo-dom-guard.js',
  'listing-photo-renewal.js'
]) {
  assert.ok(html.includes(
    `src="assets/js/features/${name}"`
  ));
}

console.log('OK Conexion automatica presente en aplicacion');

const browser = await chromium.launch({
  headless: true
});

const page = await browser.newPage();

const errors = [];

page.on('pageerror', error => {
  errors.push(error.message);
});

try {
  // Storage ficticio: ninguna peticion llega a Supabase.
  await page.route(
    'https://qa.example.supabase.co/**',
    route => route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ' +
        'AAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
        'base64'
      )
    })
  );

  await page.setContent(`
    <!doctype html>
    <html>
      <body>
        <article id="feedCard" data-real-listing="home-1">
          <div id="carousel" data-index="1">
            <img id="feedPhoto" data-carousel-slide class="active">
          </div>
          <button id="saveButton" class="saved">Guardado</button>
        </article>
        <article id="householdCard">
          <img id="householdPhoto">
        </article>
        <img id="brandLogo" src="data:image/png;base64,
          iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ
          AAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==">
      </body>
    </html>
  `);

  for (const path of [
    'assets/js/features/listing-photo-presentation.js',
    'assets/js/features/listing-photo-dom-guard.js',
    'assets/js/features/listing-photo-renewal.js'
  ]) {
    await page.addScriptTag({
      content: fs.readFileSync(path, 'utf8')
    });
  }

  const result = await page.evaluate(async () => {
    const assert = (condition, message) => {
      if (!condition) throw new Error(message);
    };

    const origin = 'https://qa.example.supabase.co';

    const pathFor = id =>
      `${origin}/storage/v1/object/sign/listing-images/` +
      `owner/${id}/photo.jpg`;

    const mainListing = {
      id: 'home-1',
      owner_id: 'owner',
      status: 'published',
      photos: ['https://public.example/home.jpg']
    };

    const householdListing = {
      id: 'household-1',
      owner_id: 'owner',
      status: 'published',
      photos: ['https://public.example/household.jpg']
    };

    let session = 'viewer-1';
    let version = 0;
    let allowed = true;
    let holdNext = false;
    let releasePending = null;
    let notifyPending = null;

    const cache = {
      invalidate() {
        version++;
      },
      async resolve(listing) {
        const currentVersion = version;

        if (holdNext) {
          holdNext = false;

          await new Promise(resolve => {
            releasePending = resolve;
            notifyPending();
          });
        }

        return {
          ...listing,
          photos: allowed
            ? [
                `${pathFor(listing.id)}?token=${currentVersion}`
              ]
            : []
        };
      }
    };

    const createPresentation =
      window.ROOMS_LISTING_PHOTO_PRESENTATION.create;

    const mainPresentation = createPresentation({ cache });
    const householdPresentation = createPresentation({ cache });

    const guard =
      window.ROOMS_LISTING_PHOTO_DOM_GUARD.create({
        document,
        storageOrigin: origin
      });

    const coordinator =
      window.ROOMS_LISTING_PHOTO_RENEWAL.create({
        cache,
        mainPresentation,
        householdPresentation,
        domGuard: guard,
        getMainListings: () => [mainListing],
        getHouseholdListings: () => [householdListing],
        getSessionUserId: () => session
      });

    await mainPresentation.prepare([mainListing]);
    await householdPresentation.prepare([householdListing]);

    const feedImage = document.querySelector('#feedPhoto');
    const householdImage =
      document.querySelector('#householdPhoto');

    feedImage.src = mainPresentation.get(mainListing).photos[0];
    householdImage.src =
      householdPresentation.get(householdListing).photos[0];

    const beforeFeed = feedImage.src;
    const beforeHousehold = householdImage.src;

    assert(
      !document.body.innerHTML.includes('public.example'),
      'Se ha expuesto una URL publica'
    );

    const renewed = await coordinator.renew();

    assert(renewed === true, 'Renovacion fallida');
    assert(feedImage.isConnected, 'Feed reconstruido');
    assert(householdImage.isConnected, 'Hogar reconstruido');
    assert(feedImage.src !== beforeFeed, 'Feed sin renovar');
    assert(
      householdImage.src !== beforeHousehold,
      'Hogar sin renovar'
    );

    assert(
      document.querySelector('#carousel').dataset.index === '1',
      'Indice de carrusel modificado'
    );

    assert(
      feedImage.classList.contains('active'),
      'Imagen activa modificada'
    );

    assert(
      document.querySelector('#saveButton')
        .classList.contains('saved'),
      'Estado de guardado modificado'
    );

    assert(
      document.querySelector('#brandLogo').isConnected,
      'Logo ajeno eliminado'
    );

    // Storage deniega ahora la firma de las fotos.
    allowed = false;

    await coordinator.renew();

    assert(!feedImage.isConnected, 'Foto denegada en Feed');
    assert(!householdImage.isConnected, 'Foto denegada en Hogar');
    assert(
      document.querySelector('#brandLogo').isConnected,
      'Logo ajeno eliminado tras denegacion'
    );

    // Simular una peticion pendiente durante el logout.
    allowed = true;
    await mainPresentation.prepare([mainListing]);

    const pendingImage = document.createElement('img');
    pendingImage.id = 'pendingPhoto';
    pendingImage.src =
      mainPresentation.get(mainListing).photos[0];

    document.querySelector('#feedCard').appendChild(pendingImage);

    const began = new Promise(resolve => {
      notifyPending = resolve;
    });

    holdNext = true;

    const oldRequest = coordinator.renew();

    await began;

    session = null;
    coordinator.cancel();
    guard.clear();

    assert(!pendingImage.isConnected, 'Logout no retira foto');

    releasePending();

    const oldResult = await oldRequest;

    assert(oldResult === false, 'Respuesta antigua aceptada');

    assert(
      !document.querySelector('#pendingPhoto'),
      'Respuesta antigua reconstruyo foto'
    );

    assert(
      guard.reconcile([]).removed === 0,
      'Quedaron URLs firmadas antiguas'
    );

    return {
      renewed,
      feedChanged: beforeFeed !== feedImage.src,
      householdChanged: beforeHousehold !== householdImage.src,
      carouselPreserved:
        document.querySelector('#carousel').dataset.index === '1',
      savedPreserved:
        document.querySelector('#saveButton')
          .classList.contains('saved'),
      logoPreserved:
        document.querySelector('#brandLogo').isConnected,
      revokedImagesRemoved:
        !feedImage.isConnected && !householdImage.isConnected,
      logoutRaceDiscarded: oldResult === false,
      publicUrlsInDom:
        document.querySelectorAll(
          'img[src*="/storage/v1/object/public/listing-images/"]'
        ).length
    };
  });

  assert.equal(result.renewed, true);
  assert.equal(result.carouselPreserved, true);
  assert.equal(result.savedPreserved, true);
  assert.equal(result.logoPreserved, true);
  assert.equal(result.revokedImagesRemoved, true);
  assert.equal(result.logoutRaceDiscarded, true);
  assert.equal(result.publicUrlsInDom, 0);
  assert.deepEqual(errors, []);

  console.log('OK URLs renovadas en Chromium');
  console.log('OK Feed y Hogar sin reconstruccion');
  console.log('OK Carrusel y Guardados conservados');
  console.log('OK Denegacion retira fotografias');
  console.log('OK Imagenes ajenas conservadas');
  console.log('OK Logout descarta respuesta pendiente');
  console.log('OK Sin URLs publicas en DOM de prueba');
  console.log('OK Sin errores JavaScript del navegador');
  console.log('OK M8.66 PLAYWRIGHT VALIDADO');
} finally {
  await browser.close();
}
