import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

const renewalSource = fs.readFileSync(
  'assets/js/features/listing-photo-renewal.js',
  'utf8'
);

const modules = [
  'listing-photo-cache.js',
  'listing-photo-presentation.js',
  'listing-photo-dom-guard.js',
  'listing-photo-renewal.js'
];

let previous = -1;

for (const name of modules) {
  const index = html.indexOf(
    `src="assets/js/features/${name}"`
  );

  assert.ok(index > previous, name);
  previous = index;
}

assert.ok(
  html.indexOf('src="assets/js/supabase-app.js"') >
  previous
);

console.log('OK Modulos cargados en orden');

assert.match(
  app,
  /ROOMS_LISTING_PHOTO_RENEWAL\?\.create/
);

assert.match(
  app,
  /mainPresentation:\s*listingPhotoPresentation/
);

assert.match(
  app,
  /householdPresentation:\s*householdPhotoPresentation/
);

assert.match(
  app,
  /getSessionUserId:\s*\(\)\s*=>\s*state\.user\?\.id/
);

assert.match(
  app,
  /getHouseholdListings:[\s\S]*?state\.householdCandidates/
);

console.log('OK Coordinador conectado a ambas presentaciones');

const startAt = app.indexOf(
  'function startListingPhotoRenewalForSession(userId)'
);

const invalidateAt = app.indexOf(
  'function invalidateListingPhotoDisplays(listingId)',
  startAt
);

assert.ok(startAt >= 0);
assert.ok(invalidateAt > startAt);

const startSource = app.slice(startAt, invalidateAt);

assert.match(
  startSource,
  /state\.user\?\.id !== userId/
);

assert.match(
  startSource,
  /listingPhotoSessionUserId !== userId/
);

assert.match(
  startSource,
  /window\.setInterval\([\s\S]*?,\s*30000\)/
);

assert.match(
  startSource,
  /listingPhotoRenewal\.renew\(\)/
);

assert.doesNotMatch(
  app,
  /listingPhotoDomGuard\.start\s*\(/
);

console.log('OK Temporizador de 30 segundos');
console.log('OK Sin activar barrido de 15 segundos');

const stopAt = app.indexOf(
  'function stopListingPhotoRenewal()'
);

assert.ok(stopAt >= 0);

const stopSource = app.slice(stopAt, startAt);

assert.match(
  stopSource,
  /window\.clearInterval\(listingPhotoRenewalTimer\)/
);

assert.match(
  stopSource,
  /listingPhotoRenewal\.cancel\(\)/
);

const invalidateSource = app.slice(
  invalidateAt,
  app.indexOf(
    '// La cache se mantiene separada',
    invalidateAt
  )
);

assert.match(
  invalidateSource,
  /listingPhotoRenewal\.cancel\(\)/
);

assert.match(
  invalidateSource,
  /listingPhotoDomGuard\.clear\(\)/
);

assert.match(
  app,
  /stopListingPhotoRenewal\(\);\s*invalidateListingPhotoDisplays\(\)/
);

assert.match(
  app,
  /function endSession\(\)\s*\{\s*stopListingPhotoRenewal\(\)/
);

console.log('OK Sesion y mutaciones cancelan renovaciones');
console.log('OK Invalidaciones retiran fotos del DOM');

assert.match(
  app,
  /await Promise\.all\(\[\s*loadSavedItems\(\),\s*loadSavedCollections\(\),\s*loadRealNotifications\(\),\s*loadRealInbox\(\)\s*\]\);\s*[\s\S]*?startListingPhotoRenewalForSession\(session\.user\.id\)/
);

console.log('OK Inicio posterior a carga principal');

const context = { window: {} };

vm.runInNewContext(renewalSource, context);

const create =
  context.window.ROOMS_LISTING_PHOTO_RENEWAL.create;

let currentUser = 'viewer-1';
let releases = [];

const prepared = new Map();
const reconciled = [];

const presentation = {
  invalidate() {
    prepared.clear();
  },
  async prepare(listings) {
    await new Promise(resolve => {
      releases.push(resolve);
    });

    for (const listing of listings) {
      prepared.set(listing.id, {
        ...listing,
        photos: [
          `https://signed.example/${listing.id}?token=new`
        ]
      });
    }

    return true;
  },
  get(listing) {
    return prepared.get(listing.id) || {
      ...listing,
      photos: []
    };
  }
};

const coordinator = create({
  cache: { invalidate() {} },
  mainPresentation: presentation,
  householdPresentation: {
    invalidate() {},
    async prepare() {},
    get(listing) {
      return { ...listing, photos: [] };
    }
  },
  domGuard: {
    reconcile(urls) {
      reconciled.push([...urls]);
    }
  },
  getMainListings: () => [{
    id: 'home-1',
    photos: ['https://public.example/home.jpg']
  }],
  getHouseholdListings: () => [],
  getSessionUserId: () => currentUser
});

const pending = coordinator.renew();

await Promise.resolve();

assert.equal(releases.length, 1);

coordinator.cancel();
currentUser = null;
releases[0]();

assert.equal(await pending, false);
assert.equal(reconciled.length, 0);

console.log('OK Cierre durante renovacion no repinta fotos');

console.log('OK M8.65 RENOVACION AUTOMATICA INTEGRADA');
