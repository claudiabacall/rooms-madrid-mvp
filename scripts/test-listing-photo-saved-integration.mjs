import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const saved = fs.readFileSync(
  'assets/js/features/saved.js', 'utf8'
);

const moduleSource = fs.readFileSync(
  'assets/js/features/listing-photo-presentation.js',
  'utf8'
);

assert.match(
  app,
  /ROOMS_SAVED_FEATURE\?\.create\(\{\s*getListingPhotos:/
);

assert.match(
  app,
  /listingPhotoPresentation\.get\(listing\)\?\.photos/
);

assert.match(
  saved,
  /getListingPhotos = \(\) => \[\]/
);

assert.doesNotMatch(
  saved,
  /listing\.photos/
);

assert.equal(
  (saved.match(/getListingPhotos\(listing\)/g) || []).length,
  6
);

console.log('OK Seis accesos fotograficos protegidos');

const context = { window: {} };
vm.runInNewContext(moduleSource, context);

const listing = {
  id: 'listing-1',
  owner_id: 'owner-1',
  status: 'published',
  photos: ['https://public.example/photo.jpg']
};

let allow = true;

const presentation =
  context.window.ROOMS_LISTING_PHOTO_PRESENTATION.create({
    cache: {
      async resolve(item) {
        return {
          ...item,
          photos: allow
            ? ['https://signed.example/photo?token=ok']
            : []
        };
      }
    }
  });

const getListingPhotos = item =>
  presentation.get(item)?.photos || [];

assert.equal(getListingPhotos(listing).length, 0);
console.log('OK Sin preparar oculta foto publica');

await presentation.prepare([listing]);

assert.equal(
  getListingPhotos(listing)[0],
  'https://signed.example/photo?token=ok'
);

assert.equal(
  listing.photos[0],
  'https://public.example/photo.jpg'
);

console.log('OK Fotografia firmada disponible');
console.log('OK Original intacto');

presentation.invalidate(listing.id);

assert.equal(getListingPhotos(listing).length, 0);

console.log('OK Invalidacion segura');

allow = false;
await presentation.prepare([listing]);

assert.equal(getListingPhotos(listing).length, 0);

console.log('OK Acceso denegado sin fallback');
console.log('OK M8.54B GUARDADOS PRIVADOS VALIDADO');
