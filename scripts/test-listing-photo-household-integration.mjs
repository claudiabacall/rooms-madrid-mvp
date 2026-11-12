import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const household = fs.readFileSync(
  'assets/js/features/household-candidates.js',
  'utf8'
);

const presentationSource = fs.readFileSync(
  'assets/js/features/listing-photo-presentation.js',
  'utf8'
);

assert.match(
  app,
  /const householdPhotoPresentation\s*=/
);

assert.match(
  app,
  /householdPhotoPresentation\.invalidate\(listingId\)/
);

assert.match(
  app,
  /prepareListingPhotos:\s*listings\s*=>\s*householdPhotoPresentation\.prepare\(listings\)/
);

assert.match(
  app,
  /getListingPhotos:\s*listing\s*=>\s*householdPhotoPresentation\.get\(listing\)\?\.photos/
);

assert.match(
  household,
  /prepareListingPhotos\s*=\s*async\s*\(\)\s*=>\s*false/
);

assert.match(
  household,
  /getListingPhotos\s*=\s*\(\)\s*=>\s*\[\]/
);

assert.match(
  household,
  /await prepareListingPhotos\(\s*\(homes\s*\|\|\s*\[\]\)/
);

assert.match(
  household,
  /const authorizedPhotos = getListingPhotos\(listing\)/
);

assert.doesNotMatch(
  household,
  /listing\.photos/
);

const preparePosition = household.indexOf(
  'await prepareListingPhotos(',
  household.indexOf('state.householdCandidates = homes || [];')
);

const renderPosition = household.indexOf(
  'renderHouseholdCandidates();',
  preparePosition
);

assert.ok(preparePosition >= 0);
assert.ok(renderPosition > preparePosition);

console.log('OK Hogar prepara fotos antes de renderizar');
console.log('OK Sin lectura directa de fotos publicas');
console.log('OK Invalidacion global conectada');

const context = { window: {} };
vm.runInNewContext(presentationSource, context);

const create =
  context.window.ROOMS_LISTING_PHOTO_PRESENTATION.create;

const feedListing = {
  id: 'feed-1',
  owner_id: 'owner-1',
  status: 'published',
  photos: ['https://public.example/feed.jpg']
};

const householdListing = {
  id: 'household-1',
  owner_id: 'owner-2',
  status: 'published',
  photos: ['https://public.example/household.jpg']
};

let authorized = true;

const cache = {
  async resolve(listing) {
    return {
      ...listing,
      photos: authorized
        ? [`https://signed.example/${listing.id}?token=ok`]
        : []
    };
  }
};

const feedPresentation = create({ cache });
const householdPresentation = create({ cache });

await feedPresentation.prepare([feedListing]);

assert.equal(
  feedPresentation.get(feedListing).photos[0],
  'https://signed.example/feed-1?token=ok'
);

assert.equal(
  householdPresentation.get(householdListing).photos.length,
  0
);

console.log('OK Hogar no muestra fotos sin preparar');

await householdPresentation.prepare([householdListing]);

assert.equal(
  householdPresentation.get(householdListing).photos[0],
  'https://signed.example/household-1?token=ok'
);

assert.equal(
  feedPresentation.get(feedListing).photos[0],
  'https://signed.example/feed-1?token=ok'
);

console.log('OK Preparar Hogar no vacia Feed');

assert.equal(
  householdListing.photos[0],
  'https://public.example/household.jpg'
);

console.log('OK Referencia original intacta');

householdPresentation.invalidate(householdListing.id);

assert.equal(
  householdPresentation.get(householdListing).photos.length,
  0
);

assert.equal(
  feedPresentation.get(feedListing).photos.length,
  1
);

console.log('OK Invalidacion individual no afecta Feed');

authorized = false;
await householdPresentation.prepare([householdListing]);

assert.equal(
  householdPresentation.get(householdListing).photos.length,
  0
);

console.log('OK Acceso denegado sin fallback publico');

feedPresentation.invalidate();
householdPresentation.invalidate();

assert.equal(feedPresentation.get(feedListing).photos.length, 0);
assert.equal(
  householdPresentation.get(householdListing).photos.length,
  0
);

console.log('OK Ambas presentaciones admiten limpieza');

console.log('OK M8.57 HOGAR PRIVADO VALIDADO');
