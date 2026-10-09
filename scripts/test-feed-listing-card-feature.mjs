import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/feed-listing-card.js',
  'utf8'
);

const feedCore = fs.readFileSync(
  'assets/js/features/feed-core.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== FEED LISTING CARD ===');

const script =
  'assets/js/features/feed-listing-card.js';

assert(html.includes(`src="${script}"`));

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_FEED_LISTING_CARD_FEATURE?.create')
);

assert(
  /function renderListingCard\s*\(/.test(source)
);

assert(
  !/function renderListingCard\s*\(/.test(app)
);

assert(
  feedCore.includes('renderListingCard(item)')
);

assert(
  app.indexOf('const feedListingCardFeature') >
  app.indexOf('function renderRealFeed(')
);

console.log('OK  Extraccion e integracion');
console.log('OK  Feed mantiene llamada a renderListingCard');

const context = {
  window: {},
  Intl,
  Date,
  Number,
  Array
};

vm.runInNewContext(source, context);

const factory =
  context.window.ROOMS_FEED_LISTING_CARD_FEATURE.create;

assert.equal(typeof factory, 'function');

function setup(blocked = []) {
  const state = {
    blockedUsers: new Set(blocked)
  };

  const escapeHtml = value =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const feature = factory({
    state,
    escapeHtml
  });

  const render = listing =>
    feature.renderListingCard(listing);

  const parse = listing => {
    const dom = new JSDOM(
      '<!doctype html><body></body>'
    );

    dom.window.document.body.innerHTML =
      render(listing);

    return dom;
  };

  return {
    state,
    render,
    parse
  };
}

{
  const t = setup(['blocked-user']);

  assert.equal(t.render(null), '');

  assert.equal(
    t.render({
      id: 'blocked-listing',
      owner_id: 'blocked-user'
    }),
    ''
  );

  console.log('OK  Viviendas de usuarios bloqueados');
}

{
  const t = setup();

  const dom = t.parse({
    id: 'listing-1',
    owner_id: 'user-1',
    kind: 'room',
    zone: 'Chamberi',
    title: 'Habitacion luminosa',
    price: 950,
    available_from: '2026-11-01',
    rooms: 2,
    baths: 1,
    area: 85,
    furnished: true,
    features: [
      'Amueblado',
      'Terraza',
      'Ascensor',
      'Balcon',
      'Extra'
    ],
    description: 'Junto al metro',
    photos: []
  });

  const doc = dom.window.document;
  const card = doc.querySelector(
    '.rooms-home-property-card'
  );

  assert(card);
  assert.equal(
    card.dataset.realListing,
    'listing-1'
  );
  assert.equal(
    card.dataset.feedType,
    'home'
  );

  assert(
    card.textContent.includes('Habitacion luminosa')
  );
  assert(card.textContent.includes('950'));
  assert(card.textContent.includes('Chamberi'));
  assert(card.textContent.includes('Junto al metro'));

  assert(
    card.querySelector(
      '.rooms-home-property-placeholder'
    )
  );

  assert.equal(
    card.querySelectorAll(
      '.rooms-home-property-features span'
    ).length,
    4
  );

  console.log('OK  Tarjeta de habitacion y datos');
  console.log('OK  Placeholder y limite de caracteristicas');

  dom.window.close();
}

{
  const t = setup();

  const dom = t.parse({
    id: 'listing-2',
    kind: 'apartment',
    title: 'Piso entero',
    zone: 'Salamanca',
    price: 1800,
    photos: [
      'https://example.com/uno.jpg',
      'https://example.com/dos.jpg',
      'https://example.com/tres.jpg'
    ]
  });

  const doc = dom.window.document;
  const card = doc.querySelector(
    '.rooms-home-property-card'
  );

  assert.equal(card.dataset.feedType, 'flat');

  assert.equal(
    card.querySelectorAll('[data-carousel-slide]').length,
    3
  );

  assert(
    card.querySelector('[data-carousel-prev]')
  );

  assert(
    card.querySelector('[data-carousel-next]')
  );

  assert.equal(
    card.querySelectorAll(
      '.rooms-home-gallery-dots i'
    ).length,
    3
  );

  assert.equal(
    card.querySelector(
      '[data-save-kind]'
    ).dataset.saveKind,
    'apartment'
  );

  assert.equal(
    card.querySelector(
      '[data-save-id]'
    ).dataset.saveId,
    'listing-2'
  );

  console.log('OK  Piso entero y carrusel');
  console.log('OK  Controles de guardado y apertura');

  dom.window.close();
}

{
  const t = setup();

  const dom = t.parse({
    id: 'single-photo',
    kind: 'room',
    photos: ['https://example.com/foto.jpg']
  });

  const doc = dom.window.document;

  assert.equal(
    doc.querySelectorAll('[data-carousel-slide]').length,
    1
  );

  assert.equal(
    doc.querySelectorAll('[data-carousel-prev]').length,
    0
  );

  assert.equal(
    doc.querySelectorAll('[data-carousel-next]').length,
    0
  );

  console.log('OK  Una foto sin flechas de carrusel');

  dom.window.close();
}

{
  const t = setup();

  const dom = t.parse({
    id: 'safe-listing',
    kind: 'room',
    title: '<script>alert(1)</script>',
    zone: '<img src=x>',
    description: '<svg onload=alert(1)>',
    features: [
      '<b>Inyeccion</b>'
    ],
    photos: [
      'https://example.com/foto.jpg?x="><script>'
    ]
  });

  const doc = dom.window.document;

  assert.equal(
    doc.querySelectorAll('script,svg').length,
    0
  );

  assert.equal(
    doc.querySelectorAll(
      '.rooms-home-property-features b'
    ).length,
    0
  );

  assert(
    doc.querySelector(
      '.rooms-home-property-heading h2'
    ).textContent.includes('<script>')
  );

  assert.equal(
    doc.querySelectorAll(
      '[data-carousel-slide]'
    ).length,
    1
  );

  console.log('OK  Escapado de titulos y descripciones');
  console.log('OK  Escapado de caracteristicas y fotos');

  dom.window.close();
}

{
  const t = setup();

  const dom = t.parse({
    id: 'external-listing',
    kind: 'external',
    price: null,
    photos: null
  });

  const doc = dom.window.document;

  assert(
    doc.body.textContent.includes('Fuente externa')
  );

  assert(
    doc.body.textContent.includes(
      'Precio sin definir'
    )
  );

  assert(
    doc.body.textContent.includes(
      'Disponibilidad sin definir'
    )
  );

  console.log('OK  Vivienda externa sin datos inventados');

  dom.window.close();
}

console.log('\nROOMS FEED LISTING CARD FEATURE OK');
