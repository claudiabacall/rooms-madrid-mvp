import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const featureSource = fs.readFileSync(
  'assets/js/features/own-activity.js', 'utf8'
);

const presentationSource = fs.readFileSync(
  'assets/js/features/listing-photo-presentation.js',
  'utf8'
);

assert.match(
  app,
  /ROOMS_OWN_ACTIVITY_FEATURE\?\.create\(\{\s*getListingPhotos:\s*listing\s*=>\s*listingPhotoPresentation\.get\(listing\)\?\.photos/
);

assert.match(
  featureSource,
  /getListingPhotos = \(\) => \[\]/
);

assert.match(
  featureSource,
  /const photo = getListingPhotos\(listing\)\?\.\[0\]/
);

assert.doesNotMatch(
  featureSource,
  /listing\.photos/
);

console.log('OK Modulo conectado a presentacion privada');

const dom = new JSDOM(
  `<!doctype html>
   <html><body>
     <button data-own-activity="listings" class="active">
       Anuncios
     </button>
     <div id="ownActivityPreview"></div>
   </body></html>`,
  {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  }
);

const { window } = dom;

window.eval(featureSource);
window.eval(presentationSource);

const original = {
  id: 'listing-1',
  owner_id: 'owner-1',
  status: 'published',
  kind: 'room',
  title: 'Habitacion de prueba',
  zone: 'Madrid',
  price: 750,
  description: 'Anuncio de prueba',
  photos: ['https://public.example/photo.jpg']
};

const state = {
  user: { id: 'owner-1' },
  listings: new Map([[original.id, original]]),
  posts: new Map()
};

let allowed = true;

const presentation =
  window.ROOMS_LISTING_PHOTO_PRESENTATION.create({
    cache: {
      async resolve(listing) {
        return {
          ...listing,
          photos: allowed
            ? ['https://signed.example/photo?token=ok']
            : []
        };
      }
    }
  });

const feature =
  window.ROOMS_OWN_ACTIVITY_FEATURE.create({
    state,
    escapeHtml: value =>
      String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;'),
    relativeTime: () => 'Ahora',
    getListingPhotos: listing =>
      presentation.get(listing)?.photos || []
  });

function html() {
  feature.refreshOwnActivity('listings');

  return window.document.querySelector(
    '#ownActivityPreview'
  ).innerHTML;
}

{
  const result = html();

  assert.ok(!result.includes('public.example/photo.jpg'));
  assert.ok(result.includes('own-listing-placeholder'));
  assert.ok(result.includes('data-edit-listing="listing-1"'));

  console.log('OK Sin preparar no muestra foto publica');
  console.log('OK Boton de edicion conservado');
}

{
  await presentation.prepare([original]);
  const result = html();

  assert.ok(result.includes('signed.example/photo'));
  assert.ok(!result.includes('public.example/photo.jpg'));
  assert.equal(
    original.photos[0],
    'https://public.example/photo.jpg'
  );

  console.log('OK Foto firmada en Mi actividad');
  console.log('OK Anuncio original intacto');
}

{
  presentation.invalidate(original.id);

  const result = html();

  assert.ok(!result.includes('signed.example/photo'));
  assert.ok(!result.includes('public.example/photo.jpg'));

  console.log('OK Invalidacion segura');
}

{
  allowed = false;
  await presentation.prepare([original]);

  const result = html();

  assert.ok(!result.includes('signed.example/photo'));
  assert.ok(!result.includes('public.example/photo.jpg'));

  console.log('OK Denegacion sin fallback publico');
}

{
  state.user = { id: 'another-user' };

  const result = html();

  assert.ok(!result.includes('data-edit-listing="listing-1"'));

  console.log('OK No aparecen anuncios de otros usuarios');
}

console.log('OK M8.55 MI ACTIVIDAD PRIVADA VALIDADA');
