import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/explore-communities.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== EXPLORE COMMUNITIES ===');

const script =
  'assets/js/features/explore-communities.js';

assert(html.includes(`src="${script}"`));

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes(
    'ROOMS_EXPLORE_COMMUNITIES_FEATURE?.create'
  )
);

for (const name of [
  'getExploreCommunities',
  'renderExploreCommunities'
]) {
  assert(
    new RegExp(`function ${name}\\s*\\(`).test(source)
  );

  assert(
    !new RegExp(`function ${name}\\s*\\(`).test(app)
  );

  assert(
    new RegExp(`\\b${name}\\b`).test(app)
  );
}

console.log('OK  Extraccion e integracion');

const escapeHtml = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function setup(communities = []) {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <input id="exploreSearch">
        <main id="exploreList"></main>
        <div id="exploreMap"></div>
      </body>
    </html>
  `, {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  });

  const { window } = dom;
  window.eval(source);

  const state = {
    communities: new Map(
      communities.map(community => [
        community.id,
        community
      ])
    )
  };

  const feature =
    window.ROOMS_EXPLORE_COMMUNITIES_FEATURE.create({
      state,
      escapeHtml
    });

  return {
    dom,
    document: window.document,
    feature,
    close: () => window.close()
  };
}

const communities = [
  {
    id: 'com-1',
    name: 'Chamberi',
    description: 'Vecinos del barrio',
    visibility: 'public'
  },
  {
    id: 'com-2',
    name: 'Universidad',
    description: 'Estudiantes de Madrid',
    visibility: 'private',
    image_url: 'https://example.com/community.jpg'
  },
  {
    id: 'com-3',
    name: 'Retiro',
    description: 'Comunidad tranquila',
    visibility: 'public'
  }
];

{
  const t = setup(communities);
  const input = t.document.querySelector('#exploreSearch');

  assert.equal(
    t.feature.getExploreCommunities().length,
    3
  );

  input.value = '  UNIVERSIDAD  ';

  assert.deepEqual(
    Array.from(
      t.feature.getExploreCommunities(),
      item => item.id
    ),
    ['com-2']
  );

  input.value = 'estudiantes';

  assert.equal(
    t.feature.getExploreCommunities()[0].id,
    'com-2'
  );

  input.value = 'private';

  assert.equal(
    t.feature.getExploreCommunities()[0].id,
    'com-2'
  );

  input.value = 'barrio';

  assert.equal(
    t.feature.getExploreCommunities()[0].id,
    'com-1'
  );

  console.log(
    'OK  Busqueda por nombre, descripcion y visibilidad'
  );
  console.log('OK  Normalizacion de busqueda');

  t.close();
}

{
  const t = setup();

  t.feature.renderExploreCommunities([]);

  assert(
    t.document.querySelector('#exploreMap').hidden
  );

  assert(
    t.document.body.textContent.includes(
      'No encontramos comunidades'
    )
  );

  assert.equal(
    t.document.querySelectorAll(
      '.explore-community-card'
    ).length,
    0
  );

  console.log('OK  Resultados vacios y mapa oculto');

  t.close();
}

{
  const t = setup(communities);

  t.feature.renderExploreCommunities(communities);

  const doc = t.document;
  const cards = doc.querySelectorAll(
    '.explore-community-card'
  );

  assert.equal(cards.length, 3);

  assert(
    doc.querySelector('#exploreMap').hidden
  );

  assert(
    doc.querySelector(
      '.explore-results-heading'
    ).textContent.includes('3')
  );

  assert(
    cards[0].textContent.includes('ABIERTA')
  );

  assert(
    cards[1].textContent.includes('PRIVADA')
  );

  assert(
    cards[0].querySelector(
      '.explore-community-placeholder'
    )
  );

  assert(
    cards[1].querySelector(
      '.explore-community-media img'
    )
  );

  const button = cards[1].querySelector(
    '[data-real-community-open]'
  );

  assert.equal(
    button.dataset.realCommunityOpen,
    'com-2'
  );

  assert.equal(
    cards[1].dataset.realCommunity,
    'com-2'
  );

  console.log('OK  Tarjetas publicas y privadas');
  console.log('OK  Imagenes, placeholders y acceso');
  console.log('OK  Renderizado oculta el mapa');

  t.close();
}

{
  const t = setup();

  t.feature.renderExploreCommunities([{
    id: 'single',
    name: 'Una comunidad'
  }]);

  const doc = t.document;

  assert(
    doc.querySelector(
      '.explore-results-heading'
    ).textContent.includes('1')
  );

  assert(
    doc.querySelector(
      '.explore-results-heading'
    ).textContent.includes('comunidad')
  );

  assert(
    doc.body.textContent.includes(
      'Comunidad de Rooms'
    )
  );

  console.log(
    'OK  Singular y descripcion por defecto'
  );

  t.close();
}

{
  const t = setup();

  t.feature.renderExploreCommunities([{
    id: 'safe-community',
    name: '<script>alert(1)</script>',
    description: '<img src=x onerror=alert(1)>',
    visibility: 'private',
    image_url: 'https://example.com/a.jpg?x="><svg>'
  }]);

  const doc = t.document;

  assert.equal(
    doc.querySelectorAll('script,svg').length,
    0
  );

  assert.equal(
    doc.querySelectorAll(
      '.explore-community-body img'
    ).length,
    0
  );

  assert(
    doc.querySelector(
      '.explore-community-body h2'
    ).textContent.includes('<script>')
  );

  assert.equal(
    doc.querySelectorAll(
      '.explore-community-media img'
    ).length,
    1
  );

  assert.equal(
    doc.querySelector(
      '[data-real-community-open]'
    ).dataset.realCommunityOpen,
    'safe-community'
  );

  console.log('OK  Escapado HTML');

  t.close();
}

console.log(
  '\nROOMS EXPLORE COMMUNITIES FEATURE OK'
);
