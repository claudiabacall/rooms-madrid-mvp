import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/explore-map-card.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const leaflet = fs.readFileSync(
  'assets/js/features/explore-leaflet-map.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

const exploreView = fs.readFileSync(
  'assets/js/features/explore-view.js',
  'utf8'
);

console.log('\n=== EXPLORE MAP CARD ===');

const script = 'assets/js/features/explore-map-card.js';

assert(html.includes(`src="${script}"`));

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_EXPLORE_MAP_CARD_FEATURE?.create')
);

assert(
  /function renderRealMapCard\s*\(/.test(source)
);

assert(
  !/function renderRealMapCard\s*\(/.test(app)
);

assert(
  /const\s*\{\s*renderRealMapCard\s*\}\s*=\s*exploreMapCardFeature/.test(app)
);

assert(
  exploreView.includes('renderRealMapCard(listing)')
);

assert(
  leaflet.includes('renderRealMapCard(item)') &&
  leaflet.includes('renderRealMapCard(next)') &&
  app.includes('renderRealMapCard(first)')
);

assert(leaflet.includes('let exploreLeafletMap = null;'));
assert(
  leaflet.includes('let exploreLeafletMarkers = new Map();')
);

assert(
  html.includes(
    'src="assets/js/features/explore-leaflet-map.js"'
  )
);

assert(
  html.indexOf('assets/js/features/explore-map-card.js') <
  html.indexOf('assets/js/features/explore-leaflet-map.js')
);

assert(
  html.indexOf('assets/js/features/explore-leaflet-map.js') <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_EXPLORE_LEAFLET_MAP_FEATURE?.create')
);

assert(
  !app.includes('let exploreLeafletMap = null;')
);

console.log('OK  Extraccion e integracion');
console.log('OK  Explore View mantiene el renderizador');
console.log('OK  Leaflet conserva su estado y referencias');

const dom = new JSDOM(
  '<!doctype html><body></body>',
  {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  }
);

dom.window.eval(source);

const factory =
  dom.window.ROOMS_EXPLORE_MAP_CARD_FEATURE.create;

const escapeHtml = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const { renderRealMapCard } = factory({ escapeHtml });

function parse(item) {
  const root = dom.window.document.createElement('div');
  root.innerHTML = renderRealMapCard(item);
  return root;
}

assert.equal(renderRealMapCard(null), '');

console.log('OK  Vivienda inexistente');

{
  const root = parse({
    id: 'room-1',
    kind: 'room',
    title: 'Habitacion luminosa',
    zone: 'Chamberi',
    price: 850,
    rooms: 2,
    baths: 1,
    area: 70,
    features: [
      'Ascensor', 'Terraza', 'Amueblado', 'Garaje'
    ],
    available_from: '2026-11-15',
    photos: ['https://example.com/room.jpg']
  });

  assert(
    root.querySelector('.real-map-card-media img')
  );

  assert(
    root.textContent.includes('Habitación')
  );

  assert(root.textContent.includes('Chamberi'));
  assert(root.textContent.includes('850'));
  assert(root.textContent.includes('2 hab'));
  assert(root.textContent.includes('1 baño'));
  assert(root.textContent.includes('70 m²'));

  assert.equal(
    root.querySelectorAll(
      '.real-map-card-features span'
    ).length,
    3
  );

  assert(
    !root.textContent.includes('Garaje')
  );

  assert(
    root.querySelector('.real-map-card-availability')
  );

  assert.equal(
    root.querySelector(
      '[data-real-map-open]'
    ).dataset.realMapOpen,
    'room-1'
  );

  console.log('OK  Habitacion, precio y caracteristicas');
  console.log('OK  Disponibilidad y fotografia');
  console.log('OK  Boton para abrir vivienda');
}

{
  const root = parse({
    id: 'flat-1',
    kind: 'apartment',
    zone: 'Retiro',
    price: 1800,
    baths: 2,
    photos: []
  });

  assert(root.textContent.includes('Piso entero'));

  assert(
    root.querySelector('.real-map-card-placeholder')
  );

  assert(root.textContent.includes('Retiro'));
  assert(root.textContent.includes('2 baños'));

  assert(
    !root.querySelector('.real-map-card-features')
  );

  assert(
    !root.querySelector('.real-map-card-availability')
  );

  console.log('OK  Piso entero y placeholder');
}

{
  const root = parse({
    id: 'empty-1',
    kind: 'room',
    photos: [],
    features: null,
    available_from: 'fecha-no-valida'
  });

  assert(
    root.textContent.includes('Zona sin definir')
  );

  assert(
    root.textContent.includes('Precio sin definir')
  );

  assert(
    !root.querySelector('.real-map-card-specs')
  );

  assert(
    !root.querySelector('.real-map-card-availability')
  );

  console.log('OK  Datos incompletos y fecha invalida');
}

{
  const root = parse({
    id: 'safe-1',
    kind: 'room',
    zone: '<script>alert(1)</script>',
    title: '<svg onload=alert(1)>',
    photos: [
      'https://example.com/a.jpg?x="><script>'
    ],
    features: [
      '<img src=x onerror=alert(1)>'
    ]
  });

  assert.equal(
    root.querySelectorAll('script,svg').length,
    0
  );

  assert.equal(
    root.querySelectorAll(
      '.real-map-card-features img'
    ).length,
    0
  );

  assert.equal(
    root.querySelectorAll('.real-map-card-media img')
      .length,
    1
  );

  assert(
    root.querySelector('h2')
      .textContent.includes('<script>')
  );

  console.log('OK  Escapado HTML de textos y fotografias');
}

dom.window.close();

console.log('\nROOMS EXPLORE MAP CARD FEATURE OK');
