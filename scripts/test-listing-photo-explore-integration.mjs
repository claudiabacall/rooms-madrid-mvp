import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const mapSource = fs.readFileSync(
  'assets/js/features/explore-map-card.js', 'utf8'
);

const exploreSource = fs.readFileSync(
  'assets/js/features/explore-render.js', 'utf8'
);

const viewSource = fs.readFileSync(
  'assets/js/features/explore-view.js', 'utf8'
);

assert.match(
  app,
  /function renderPrivateMapCard\(listing\)/
);

assert.match(
  app,
  /renderRealMapCard\(\s*listingPhotoPresentation\.get\(original\)/
);

assert.equal(
  (app.match(
    /renderRealMapCard: renderPrivateMapCard/g
  ) || []).length,
  3
);

assert.match(
  app,
  /renderRealExplore:\s*listings\s*=>\s*renderRealExplore\(\s*listings\.map/
);

console.log('OK Cuatro entradas de Explore protegidas');

const dom = new JSDOM(`
  <!doctype html>
  <html><body>
    <div id="exploreList"></div>
    <div id="exploreMap"></div>
  </body></html>
`, {
  url: 'http://127.0.0.1/',
  runScripts: 'outside-only'
});

const { window } = dom;

window.eval(mapSource);
window.eval(exploreSource);
window.eval(viewSource);

const original = {
  id: 'listing-1',
  owner_id: 'owner-1',
  kind: 'room',
  title: 'Habitacion de prueba',
  zone: 'Madrid',
  price: 750,
  latitude: 40.42,
  longitude: -3.7,
  photos: ['https://public.example/photo.jpg']
};

const state = {
  listings: new Map([[original.id, original]])
};

let authorized = true;

const presentation = {
  get(listing) {
    return {
      ...listing,
      photos: authorized
        ? ['https://signed.example/photo?token=ok']
        : []
    };
  }
};

const escapeHtml = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const { renderRealMapCard } =
  window.ROOMS_EXPLORE_MAP_CARD_FEATURE.create({
    escapeHtml
  });

function renderPrivateMapCard(listing) {
  if (!listing) return '';

  return renderRealMapCard(
    presentation.get(
      state.listings.get(listing.id) || listing
    )
  );
}

const explore =
  window.ROOMS_EXPLORE_RENDER_FEATURE.create({
    escapeHtml,
    renderRealMapCard: renderPrivateMapCard,
    destroyExploreLeafletMap() {},
    initExploreLeafletMap() {}
  });

window.ROOMS_EXPLORE_VIEW_FEATURE.create({
  state,
  renderFilteredExplore() {},
  renderRealMapCard: renderPrivateMapCard
});

function renderList() {
  explore.renderRealExplore(
    [original].map(item => presentation.get(item))
  );
}

{
  renderList();

  const html = window.document.body.innerHTML;

  assert.ok(html.includes('signed.example/photo'));
  assert.ok(!html.includes('public.example/photo.jpg'));
  assert.equal(
    original.photos[0],
    'https://public.example/photo.jpg'
  );

  console.log('OK Lista muestra URL firmada');
  console.log('OK Tarjeta inicial del mapa segura');
  console.log('OK Anuncio original no modificado');
}

{
  const pin = window.document.createElement('button');
  pin.dataset.realMapPin = original.id;
  window.document.body.appendChild(pin);

  pin.click();

  const html = window.document.querySelector(
    '#realMapCard'
  ).innerHTML;

  assert.ok(html.includes('signed.example/photo'));
  assert.ok(!html.includes('public.example/photo.jpg'));

  console.log('OK Seleccion de marcador usa URL firmada');
}

{
  authorized = false;
  renderList();

  let html = window.document.body.innerHTML;

  assert.ok(!html.includes('public.example/photo.jpg'));
  assert.ok(!html.includes('signed.example/photo'));

  const pin = window.document.querySelector(
    '[data-real-map-pin]'
  );

  pin.click();

  html = window.document.querySelector(
    '#realMapCard'
  ).innerHTML;

  assert.ok(!html.includes('public.example/photo.jpg'));
  assert.ok(!html.includes('signed.example/photo'));

  console.log('OK Denegacion sin recuperar fotos publicas');
  console.log('OK Marcadores respetan invalidacion');
}

console.log('OK M8.51 EXPLORE Y MAPA VALIDADOS');
