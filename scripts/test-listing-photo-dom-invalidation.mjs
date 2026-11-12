import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('index.html', 'utf8');

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const source = fs.readFileSync(
  'assets/js/features/listing-photo-dom-guard.js',
  'utf8'
);

const scripts = [
  'listing-photo-cache.js',
  'listing-photo-presentation.js',
  'listing-photo-dom-guard.js'
];

let last = -1;

for (const name of scripts) {
  const position = html.indexOf(
    `src="assets/js/features/${name}"`
  );

  assert.ok(position > last, name);
  last = position;
}

assert.ok(
  html.indexOf('src="assets/js/supabase-app.js"') > last
);

assert.match(
  app,
  /ROOMS_LISTING_PHOTO_DOM_GUARD\?\.create/
);

assert.match(
  app,
  /storageOrigin:\s*config\.url/
);

const functionStart = app.indexOf(
  'function invalidateListingPhotoDisplays(listingId)'
);

const functionEnd = app.indexOf(
  '// La cache se mantiene separada',
  functionStart
);

assert.ok(functionStart >= 0);
assert.ok(functionEnd > functionStart);

const invalidate = app.slice(functionStart, functionEnd);

for (const required of [
  'listingPhotoCache.invalidate(listingId)',
  'listingPhotoPresentation.invalidate(listingId)',
  'householdPhotoPresentation.invalidate(listingId)',
  'listingPhotoDomGuard.clear()'
]) {
  assert.ok(invalidate.includes(required), required);
}

assert.doesNotMatch(
  app,
  /listingPhotoDomGuard\.start\s*\(/
);

console.log('OK Modulos cargados en orden');
console.log('OK Invalidacion coordina las cuatro capas');
console.log('OK Sin temporizador prematuro');

const origin = 'https://qa.example.supabase.co';

const dom = new JSDOM(
  '<!doctype html><html><body></body></html>',
  {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  }
);

dom.window.eval(source);

const guard =
  dom.window.ROOMS_LISTING_PHOTO_DOM_GUARD.create({
    document: dom.window.document,
    storageOrigin: origin
  });

function addImage(url) {
  const img = dom.window.document.createElement('img');
  img.setAttribute('src', url);
  dom.window.document.body.appendChild(img);
  return img;
}

const signed = addImage(
  origin +
    '/storage/v1/object/sign/listing-images/' +
    'owner/listing/photo.jpg?token=valid'
);

const unrelated = addImage(
  'https://example.com/logo.png'
);

assert.equal(signed.isConnected, true);
assert.equal(unrelated.isConnected, true);

const removed = guard.clear();

assert.equal(removed, 1);
assert.equal(signed.isConnected, false);
assert.equal(unrelated.isConnected, true);

console.log('OK Invalidacion retira imagen firmada del DOM');
console.log('OK Conserva imagenes ajenas');

assert.match(
  app,
  /invalidateListingPhotosForSession\(event,\s*session\)/
);

assert.match(
  app,
  /invalidateListingPhotos:\s*\(\)\s*=>\s*invalidateListingPhotoDisplays\(\)/
);

assert.equal(
  (
    app.match(
      /invalidateListingPhotos:\s*listingId\s*=>\s*invalidateListingPhotoDisplays\(listingId\)/g
    ) || []
  ).length,
  2
);

console.log('OK Sesion, moderacion, edicion y borrado conectados');

dom.window.close();

console.log('OK M8.60 INVALIDACION DOM VALIDADA');
