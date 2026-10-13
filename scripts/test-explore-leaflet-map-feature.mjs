import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const path = 'assets/js/features/explore-leaflet-map.js';
const source = fs.readFileSync(path, 'utf8');
const app = fs.readFileSync('assets/js/supabase-app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== EXPLORE LEAFLET MAP ===');

assert(html.includes(`src="${path}"`));
assert(html.indexOf(path) < html.indexOf('assets/js/supabase-app.js'));
assert(app.includes('ROOMS_EXPLORE_LEAFLET_MAP_FEATURE?.create'));
assert(!app.includes('function initExploreLeafletMap(listings)'));

console.log('OK  Extraccion e integracion');

const dom = new JSDOM(`
  <!doctype html>
  <body>
    <div id="realExploreMap"></div>
    <div id="mapVisibleCount"></div>
    <div id="realMapCard"></div>
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

let currentMap;
let removed = 0;
let invalidated = 0;
const markers = [];

window.L = {
  map() {
    const map = {
      handlers: {},
      setView(center, zoom) {
        this.center = center;
        this.zoom = zoom;
        return this;
      },
      fitBounds(bounds) {
        this.fitted = bounds;
        return this;
      },
      getBounds() {
        return {
          contains: coords =>
            coords[0] >= 40 && coords[0] <= 41
        };
      },
      on(events, handler) {
        this.handlers[events] = handler;
        return this;
      },
      invalidateSize() {
        invalidated++;
      },
      remove() {
        removed++;
      }
    };
    currentMap = map;
    return map;
  },
  tileLayer() {
    return { addTo() { return this; } };
  },
  divIcon(options) {
    return options;
  },
  marker(coords, options) {
    const element = document.createElement('div');
    element.className = options.icon.className;
    document.body.append(element);

    const marker = {
      coords,
      options,
      handlers: {},
      addTo() { return this; },
      on(event, handler) {
        this.handlers[event] = handler;
        return this;
      },
      getElement() { return element; }
    };

    markers.push(marker);
    return marker;
  }
};

window.eval(source);

const feature =
  window.ROOMS_EXPLORE_LEAFLET_MAP_FEATURE.create({
    escapeHtml: value => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;'),
    renderRealMapCard: item =>
      `<article>${item.id}</article>`
  });

assert.equal(typeof feature.initExploreLeafletMap, 'function');
assert.equal(typeof feature.destroyExploreLeafletMap, 'function');

console.log('OK  Factory y API disponibles');

const listings = [
  { id: 'a', latitude: 40.42, longitude: -3.7, price: 900 },
  { id: 'b', latitude: 40.45, longitude: -3.6, price: 1200 },
  { id: 'invalid', latitude: 200, longitude: -3.7 },
  { id: 'outside', latitude: 39.5, longitude: -3.5 }
];

feature.initExploreLeafletMap(listings);

assert.equal(markers.length, 3);
assert.equal(currentMap.fitted.length, 3);
assert(markers[0].options.icon.html.includes('900'));

console.log('OK  Marcadores, precios y coordenadas');

timers.shift()();

assert.equal(invalidated, 1);
assert.equal(
  document.querySelector('#mapVisibleCount').textContent,
  '2 viviendas en esta zona'
);

const card = document.querySelector('#realMapCard');
assert.equal(card.dataset.mapSelected, 'a');

console.log('OK  Viviendas visibles y tarjeta inicial');

markers[1].handlers.click();

assert.equal(card.dataset.mapSelected, 'b');
assert(card.innerHTML.includes('b'));
assert(markers[1].getElement().classList.contains('active'));

console.log('OK  Seleccion de marcador');

feature.destroyExploreLeafletMap();
assert.equal(removed, 1);

console.log('OK  Destruccion del mapa');

feature.initExploreLeafletMap([]);
timers.shift()();

assert.equal(
  document.querySelector('#mapVisibleCount').textContent,
  '0 viviendas en esta zona'
);
assert.equal(card.hidden, true);

console.log('OK  Estado sin viviendas visibles');

feature.destroyExploreLeafletMap();

delete window.L;
feature.initExploreLeafletMap(listings);

console.log('OK  Leaflet no disponible');
console.log('\nROOMS EXPLORE LEAFLET MAP FEATURE OK');
