import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };

vm.runInNewContext(
  fs.readFileSync(
    'assets/js/features/listing-photo-renewal.js',
    'utf8'
  ),
  context
);

const create =
  context.window.ROOMS_LISTING_PHOTO_RENEWAL.create;

const main = [{
  id: 'home-1',
  owner_id: 'owner-1',
  status: 'published',
  photos: ['https://public.example/home.jpg']
}];

const household = [{
  id: 'group-1',
  owner_id: 'owner-2',
  status: 'published',
  photos: ['https://public.example/group.jpg']
}];

let session = 'viewer-1';
let signingAllowed = true;
let sequence = 0;
let invalidations = 0;
const reconciliations = [];

function makePresentation() {
  const prepared = new Map();

  return {
    invalidate() {
      prepared.clear();
    },
    async prepare(items) {
      for (const item of items) {
        prepared.set(item.id, {
          ...item,
          photos: signingAllowed
            ? [`https://signed.example/${item.id}?token=${sequence}`]
            : []
        });
      }
      return true;
    },
    get(item) {
      return prepared.get(item.id) || {
        ...item,
        photos: []
      };
    }
  };
}

const mainPresentation = makePresentation();
const householdPresentation = makePresentation();

const renewal = create({
  cache: {
    invalidate() {
      invalidations++;
      sequence++;
    }
  },
  mainPresentation,
  householdPresentation,
  domGuard: {
    reconcile(urls) {
      reconciliations.push([...urls]);
    }
  },
  getMainListings: () => main,
  getHouseholdListings: () => household,
  getSessionUserId: () => session
});

assert.equal(await renewal.renew(), true);
assert.equal(invalidations, 1);
assert.equal(reconciliations.length, 1);
assert.equal(reconciliations[0].length, 2);

for (const url of reconciliations[0]) {
  assert.ok(url.startsWith('https://signed.example/'));
  assert.ok(!url.includes('public.example'));
}

console.log('OK Ambas presentaciones renuevan fotografias');
console.log('OK Solo se entregan URLs firmadas');

assert.equal(await renewal.renew(), true);
assert.equal(invalidations, 2);

assert.notEqual(
  reconciliations[0][0],
  reconciliations[1][0]
);

console.log('OK Renovacion solicita URLs nuevas');

signingAllowed = false;

assert.equal(await renewal.renew(), true);
assert.deepEqual(reconciliations[2], []);

console.log('OK Denegacion retira URLs anteriores');

session = null;

assert.equal(await renewal.renew(), false);
assert.equal(invalidations, 3);

console.log('OK Sin sesion no firma fotografias');

let release;
let started;

const begun = new Promise(resolve => {
  started = resolve;
});

const barrier = new Promise(resolve => {
  release = resolve;
});

const raceReconciliations = [];
let raceCalls = 0;
session = 'viewer-2';

const racePresentation = () => ({
  invalidate() {},
  async prepare() {
    raceCalls++;
    started();
    await barrier;
  },
  get(item) {
    return {
      ...item,
      photos: ['https://signed.example/late?token=old']
    };
  }
});

const racing = create({
  cache: { invalidate() {} },
  mainPresentation: racePresentation(),
  householdPresentation: racePresentation(),
  domGuard: {
    reconcile(urls) {
      raceReconciliations.push(urls);
    }
  },
  getMainListings: () => main,
  getHouseholdListings: () => household,
  getSessionUserId: () => session
});

const first = racing.renew();
const duplicate = racing.renew();

assert.equal(first, duplicate);

await begun;
assert.equal(raceCalls, 2);

racing.cancel();
release();

assert.equal(await first, false);
assert.equal(raceReconciliations.length, 0);

console.log('OK Renovaciones simultaneas compartidas');
console.log('OK Cancelacion descarta respuesta antigua');

let releaseSession;
let signalSession;

const sessionStarted = new Promise(resolve => {
  signalSession = resolve;
});

const sessionBarrier = new Promise(resolve => {
  releaseSession = resolve;
});

const switched = create({
  cache: { invalidate() {} },
  mainPresentation: {
    invalidate() {},
    async prepare() {
      signalSession();
      await sessionBarrier;
    },
    get(item) {
      return { ...item, photos: [] };
    }
  },
  householdPresentation: {
    invalidate() {},
    async prepare() {},
    get(item) {
      return { ...item, photos: [] };
    }
  },
  domGuard: {
    reconcile() {
      throw new Error('No actualizar tras cambio de sesion');
    }
  },
  getMainListings: () => main,
  getHouseholdListings: () => household,
  getSessionUserId: () => session
});

const pending = switched.renew();
await sessionStarted;

session = 'viewer-3';
releaseSession();

assert.equal(await pending, false);

console.log('OK Cambio de usuario descarta renovacion');

assert.throws(
  () => create({}),
  /dependencias de renovacion/
);

console.log('OK Dependencias obligatorias verificadas');
console.log('OK M8.63 COORDINADOR VALIDADO');
