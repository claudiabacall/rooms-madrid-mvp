import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const path = 'assets/js/features/own-activity.js';
const source = fs.readFileSync(path, 'utf8');
const app = fs.readFileSync('assets/js/supabase-app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== OWN ACTIVITY ===');

assert(html.includes(`src="${path}"`));
assert(html.indexOf(path) < html.indexOf('assets/js/supabase-app.js'));
assert(app.includes('ROOMS_OWN_ACTIVITY_FEATURE?.create'));
assert(!/function refreshOwnActivity\s*\(/.test(app));
assert(!/function renderOwnActivity\s*\(/.test(app));
assert(/function refreshOwnActivity\s*\(/.test(source));
assert(/function renderOwnActivity\s*\(/.test(source));

console.log('OK  Extraccion e integracion');

const dom = new JSDOM(`
  <!doctype html>
  <body>
    <button data-own-activity="posts" class="active"></button>
    <button data-own-activity="listings"></button>
    <div id="ownActivityPreview"></div>
  </body>
`, {
  url: 'http://127.0.0.1/',
  runScripts: 'outside-only'
});

const { window } = dom;
const { document } = window;

const state = {
  user: null,
  listings: new Map(),
  posts: new Map()
};

const escapeHtml = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

window.eval(source);

const feature = window.ROOMS_OWN_ACTIVITY_FEATURE.create({
  state,
  escapeHtml,
  relativeTime: () => 'hace un dia'
});

assert.equal(typeof feature.refreshOwnActivity, 'function');
assert.equal(typeof feature.renderOwnActivity, 'function');

console.log('OK  Factory y funciones disponibles');

const preview = document.querySelector('#ownActivityPreview');
const postsTab = document.querySelector('[data-own-activity="posts"]');
const listingsTab = document.querySelector('[data-own-activity="listings"]');

feature.refreshOwnActivity();
assert.equal(preview.innerHTML, '');

console.log('OK  Usuario sin sesion protegido');

state.user = { id: 'user-1' };

state.listings.set('listing-1', {
  id: 'listing-1',
  owner_id: 'user-1',
  kind: 'apartment',
  title: '<Piso>',
  zone: 'Chamberi',
  price: 1800,
  description: '<script>alert(1)</script>',
  photos: ['https://example.com/piso.jpg']
});

state.listings.set('listing-2', {
  id: 'listing-2',
  owner_id: 'other-user',
  kind: 'room',
  price: 500
});

state.posts.set('post-1', {
  id: 'post-1',
  author_id: 'user-1',
  body: '<b>Mi publicacion</b>',
  created_at: '2026-10-13'
});

state.posts.set('post-2', {
  id: 'post-2',
  author_id: 'other-user',
  body: 'Publicacion ajena'
});

feature.refreshOwnActivity();

assert.equal(postsTab.textContent, 'Publicaciones (1)');
assert.equal(listingsTab.textContent, 'Anuncios (1)');
assert(postsTab.classList.contains('active'));
assert(!listingsTab.classList.contains('active'));

console.log('OK  Contadores y pestana activa');

assert(preview.textContent.includes('Mi publicacion'));
assert(preview.textContent.includes('hace un dia'));
assert(!preview.textContent.includes('Publicacion ajena'));
assert(!preview.querySelector('b'));

console.log('OK  Publicaciones propias y escapado HTML');

feature.refreshOwnActivity('listings');

assert(listingsTab.classList.contains('active'));
assert(!postsTab.classList.contains('active'));

const cards = preview.querySelectorAll('.own-real-listing');
assert.equal(cards.length, 1);
assert.equal(cards[0].dataset.realListing, 'listing-1');
assert(cards[0].querySelector('[data-edit-listing="listing-1"]'));
assert(preview.textContent.includes('Piso entero'));
assert(preview.textContent.includes(
  Number(1800).toLocaleString('es-ES')
));
assert(preview.querySelector('img'));
assert(!preview.querySelector('script'));
assert(preview.innerHTML.includes('&lt;script&gt;'));

console.log('OK  Viviendas propias, precio, edicion y seguridad');

state.listings.clear();
state.posts.clear();

feature.refreshOwnActivity('listings');
assert(preview.textContent.includes('Aún no tienes anuncios'));

feature.refreshOwnActivity('posts');
assert(preview.textContent.includes('Aún no tienes publicaciones'));

assert.equal(postsTab.textContent, 'Publicaciones (0)');
assert.equal(listingsTab.textContent, 'Anuncios (0)');

console.log('OK  Estados vacios y contadores a cero');

preview.remove();
assert.doesNotThrow(() => feature.refreshOwnActivity());

console.log('OK  Contenedor ausente controlado');

dom.window.close();

console.log('\nROOMS OWN ACTIVITY FEATURE OK');
