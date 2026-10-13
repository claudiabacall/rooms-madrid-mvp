import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const path = 'assets/js/features/explore-render.js';
const source = fs.readFileSync(path, 'utf8');
const app = fs.readFileSync('assets/js/supabase-app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== EXPLORE RENDER ===');

assert(html.includes(`src="${path}"`));
assert(html.indexOf(path) < html.indexOf('assets/js/supabase-app.js'));
assert(app.includes('ROOMS_EXPLORE_RENDER_FEATURE?.create'));
assert(!/function renderRealExplore\s*\(/.test(app));
assert(/function renderRealExplore\s*\(/.test(source));

console.log('OK  Extraccion e integracion');

const dom = new JSDOM(`
  <!doctype html>
  <body>
    <div id="exploreList"></div>
    <div id="exploreMap"></div>
  </body>
`, {
  url: 'http://127.0.0.1/',
  runScripts: 'outside-only'
});

const { window } = dom;
const { document } = window;

const timers = [];
window.setTimeout = fn => {
  timers.push(fn);
  return timers.length;
};

let destroyed = 0;
let initialized = 0;
let initializedListings;

window.eval(source);

const escapeHtml = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const feature = window.ROOMS_EXPLORE_RENDER_FEATURE.create({
  escapeHtml,
  renderRealMapCard: item =>
    item ? `<span>Mapa: ${escapeHtml(item.title)}</span>` : '',
  destroyExploreLeafletMap: () => { destroyed++; },
  initExploreLeafletMap: listings => {
    initialized++;
    initializedListings = listings;
  }
});

assert.equal(typeof feature.renderRealExplore, 'function');

console.log('OK  Factory disponible');

feature.renderRealExplore([]);

assert(document.querySelector('#exploreList').textContent
  .includes('Todavía no hay viviendas'));
assert(document.querySelector('#exploreMap').textContent
  .includes('Sin viviendas en el mapa'));
assert.equal(destroyed, 1);
assert.equal(timers.length, 0);

console.log('OK  Estado sin viviendas');

const listings = [
  {
    id: 'room-1',
    kind: 'room',
    title: '<Habitacion>',
    description: '<script>alert(1)</script>',
    zone: 'Chamberi',
    price: 850,
    photos: ['https://example.com/room.jpg'],
    latitude: 40.42,
    longitude: -3.7
  },
  {
    id: 'flat-2',
    kind: 'apartment',
    title: 'Piso luminoso',
    zone: 'Retiro',
    price: 1800,
    photos: [],
    latitude: 40.41,
    longitude: -3.68
  }
];

feature.renderRealExplore(listings);

const list = document.querySelector('#exploreList');
const cards = list.querySelectorAll('.explore-property-card');

assert.equal(cards.length, 2);
assert(
  /2\s+resultados/.test(list.textContent)
);
assert(list.textContent.includes('850'));
assert(
  list.textContent.includes(
    Number(1800).toLocaleString('es-ES')
  )
);
assert(list.textContent.includes('Piso entero'));

console.log('OK  Tarjetas, precios y tipos de vivienda');

assert.equal(cards[0].dataset.realListing, 'room-1');
assert(cards[0].querySelector('[data-save-id="room-1"]'));
assert(cards[0].querySelector('[data-send-home-id="room-1"]'));
assert(cards[0].querySelector('.explore-property-open'));

console.log('OK  Guardar, abrir y enviar a grupo');

assert(!list.querySelector('script'));
assert(list.innerHTML.includes('&lt;Habitacion&gt;'));
assert(list.innerHTML.includes('&lt;script&gt;'));

console.log('OK  Escapado HTML');

const map = document.querySelector('#exploreMap');

assert(map.querySelector('#realExploreMap'));
assert(map.querySelector('#mapVisibleCount'));
assert.equal(
  map.querySelector('#realMapCard').dataset.mapSelected,
  'room-1'
);
assert.equal(destroyed, 2);
assert.equal(timers.length, 1);

timers.shift()();

assert.equal(initialized, 1);
assert.equal(initializedListings, listings);

console.log('OK  Mapa, tarjeta inicial e inicializacion');

feature.renderRealExplore([{
  id: 'no-coords',
  title: 'Sin coordenadas',
  kind: 'room'
}]);

assert.equal(
  document.querySelector('#realMapCard').dataset.mapSelected,
  'no-coords'
);

console.log('OK  Vivienda sin coordenadas');

dom.window.close();

console.log('\nROOMS EXPLORE RENDER FEATURE OK');
