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

let time = 100000;

const guard =
  window.ROOMS_LISTING_PHOTO_DOM_GUARD.create({
    document: doc,
    storageOrigin: origin,
    now: () => time
  });

const base =
  origin + '/storage/v1/object/sign/listing-images/';

const firstOld = base + 'owner/home/first.jpg?token=old';
const firstNew = base + 'owner/home/first.jpg?token=new';
const secondOld = base + 'owner/home/second.jpg?token=old';
const secondNew = base + 'owner/home/second.jpg?token=new';

const publicUrl =
  origin +
  '/storage/v1/object/public/listing-images/' +
  'owner/home/photo.jpg';

function addImage(source, parent = doc.body) {
  const img = doc.createElement('img');
  img.setAttribute('src', source);
  parent.appendChild(img);
  return img;
}

const card = doc.createElement('article');
card.id = 'test-card';
doc.body.appendChild(card);

const first = addImage(firstOld, card);
const repeated = addImage(firstOld, doc.body);
const second = addImage(secondOld, doc.body);
const publicImage = addImage(publicUrl);
const logo = addImage('https://external.example/logo.png');

const stableKey = guard.signedPhotoKey(firstOld);

assert.equal(stableKey, guard.signedPhotoKey(firstNew));
assert.notEqual(stableKey, guard.signedPhotoKey(secondOld));
assert.equal(guard.signedPhotoKey(publicUrl), null);

console.log('OK Token nuevo conserva identidad fotografica');
console.log('OK URL publica nunca cuenta como autorizada');

guard.sweep();
time += 5000;

const result = guard.reconcile([firstNew, secondNew]);

assert.equal(result.updated, 3);
assert.equal(result.removed, 0);
assert.equal(result.unchanged, 0);

assert.equal(first.getAttribute('src'), firstNew);
assert.equal(repeated.getAttribute('src'), firstNew);
assert.equal(second.getAttribute('src'), secondNew);
assert.equal(card.isConnected, true);

console.log('OK URLs renovadas en tres elementos');
console.log('OK Tarjeta y nodos originales conservados');

time += 14999;

assert.equal(guard.sweep(), 0);

console.log('OK Renovacion reinicia edad del enlace visible');

const unchanged = guard.reconcile([firstNew, secondNew]);

assert.equal(unchanged.unchanged, 3);
assert.equal(unchanged.updated, 0);

console.log('OK URL sin cambios no reinicia elemento');

const missing = guard.reconcile([firstNew]);

assert.equal(missing.removed, 1);
assert.equal(second.isConnected, false);
assert.equal(first.isConnected, true);
assert.equal(repeated.isConnected, true);

console.log('OK Foto sin autorizacion renovada retirada');

const malicious = guard.reconcile([
  publicUrl,
  'https://external.example/photo.jpg?token=x',
  origin + '/storage/v1/object/sign/other-bucket/x?token=y'
]);

assert.equal(malicious.removed, 2);
assert.equal(first.isConnected, false);
assert.equal(repeated.isConnected, false);
assert.equal(publicImage.isConnected, true);
assert.equal(logo.isConnected, true);

console.log('OK URLs ajenas no autorizan fotografias');
console.log('OK Imagenes externas y publicas no se modifican');

const third = addImage(firstOld);

const failClosed = guard.reconcile([]);

assert.equal(failClosed.removed, 1);
assert.equal(third.isConnected, false);

console.log('OK Sin autorizaciones retira fotos firmadas');

dom.window.close();

console.log('OK M8.62 RECONCILIACION DOM VALIDADA');
