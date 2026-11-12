import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/listing-photo-dom-guard.js',
  'utf8'
);

const origin = 'https://qa.example.supabase.co';

const dom = new JSDOM(
  '<!doctype html><html><body></body></html>',
  {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  }
);

const { window } = dom;
const doc = window.document;

window.eval(source);

const create =
  window.ROOMS_LISTING_PHOTO_DOM_GUARD.create;

let time = 100000;
let tick = null;
let stopped = false;

const guard = create({
  document: doc,
  storageOrigin: origin,
  now: () => time,
  setIntervalFn(fn, delay) {
    assert.equal(delay, 1000);
    tick = fn;
    return 1;
  },
  clearIntervalFn(id) {
    assert.equal(id, 1);
    stopped = true;
  }
});

const signed =
  origin +
  '/storage/v1/object/sign/listing-images/' +
  'owner/listing/photo.jpg?token=abc';

const publicUrl =
  origin +
  '/storage/v1/object/public/listing-images/' +
  'owner/listing/photo.jpg';

function addImage(url) {
  const img = doc.createElement('img');
  img.setAttribute('src', url);
  doc.body.appendChild(img);
  return img;
}

assert.equal(guard.isManagedSource(signed), true);
assert.equal(guard.isManagedSource(publicUrl), false);
assert.equal(
  guard.isManagedSource(
    'https://external.example/photo.jpg?token=abc'
  ),
  false
);

assert.equal(
  guard.isManagedSource(
    origin +
    '/storage/v1/object/sign/other-bucket/x?token=abc'
  ),
  false
);

console.log('OK Solo reconoce fotos firmadas del bucket');

const privateImage = addImage(signed);
const publicImage = addImage(publicUrl);
const externalImage = addImage(
  'https://external.example/photo.jpg'
);

assert.equal(guard.sweep(), 0);
assert.equal(privateImage.isConnected, true);

time += 14999;

assert.equal(guard.sweep(), 0);
assert.equal(privateImage.isConnected, true);

time += 1;

assert.equal(guard.sweep(), 1);
assert.equal(privateImage.isConnected, false);
assert.equal(publicImage.isConnected, true);
assert.equal(externalImage.isConnected, true);

console.log('OK Retira imagen firmada tras 15 segundos');
console.log('OK No elimina imagenes ajenas');

const changed = addImage(signed);
guard.sweep();

time += 5000;

changed.setAttribute(
  'src',
  signed.replace('token=abc', 'token=new')
);

guard.sweep();

time += 10000;

assert.equal(guard.sweep(), 0);
assert.equal(changed.isConnected, true);

console.log('OK Nueva URL reinicia vigilancia');

assert.equal(guard.clear(), 1);
assert.equal(changed.isConnected, false);
assert.equal(publicImage.isConnected, true);

console.log('OK Invalidacion retira fotos firmadas');
console.log('OK No afecta otras imagenes');

guard.start();
guard.start();

assert.equal(typeof tick, 'function');

const later = addImage(signed);

tick();

assert.equal(later.isConnected, true);

time += 15000;
tick();

assert.equal(later.isConnected, false);

guard.stop();

assert.equal(stopped, true);

console.log('OK Vigilancia periodica');
console.log('OK Inicio y parada controlados');

assert.throws(
  () => create({
    document: null,
    storageOrigin: origin
  }),
  /documento/
);

assert.throws(
  () => create({
    document: doc,
    storageOrigin: '%%%invalid'
  }),
  /origen Storage invalido/
);

console.log('OK Dependencias validadas');
console.log('OK M8.59 PROTECTOR DOM VALIDADO');

dom.window.close();
