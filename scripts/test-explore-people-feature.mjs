import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/explore-people.js', 'utf8'
);
const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);
const html = fs.readFileSync('index.html', 'utf8');
const controller = fs.readFileSync(
  'assets/js/features/explore-controller.js', 'utf8'
);

console.log('\n=== EXPLORE PEOPLE ===');

const script = 'assets/js/features/explore-people.js';

assert(html.includes(`src="${script}"`));
assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);
assert(
  app.includes('ROOMS_EXPLORE_PEOPLE_FEATURE?.create')
);

for (const name of [
  'renderExplorePeople',
  'getExplorePeople'
]) {
  assert(
    new RegExp(`function ${name}\\s*\\(`).test(source)
  );
  assert(
    !new RegExp(`function ${name}\\s*\\(`).test(app)
  );
  assert(controller.includes(name));
}

assert(
  /const\s*\{\s*renderExplorePeople\s*,\s*getExplorePeople\s*\}\s*=\s*explorePeopleFeature/.test(app)
);

console.log('OK  Extraccion e integracion');
console.log('OK  Explore Controller conserva las referencias');

const escapeHtml = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function setup(profiles = [], {
  blocked = [],
  userId = 'my-user',
  connectionLabel = 'Conectar',
  withList = true
} = {}) {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <input id="exploreSearch">
        ${withList ? '<main id="exploreList"></main>' : ''}
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
    user: { id: userId },
    blockedUsers: new Set(blocked),
    profiles: new Map(
      profiles.map((profile, index) => [
        profile.id || `missing-${index}`,
        profile
      ])
    )
  };

  const normalizeExploreValue = value =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const labelSeeking = value => ({
    mates: 'Busca compañeros',
    room: 'Busca habitación',
    home: 'Tiene vivienda'
  })[value] || String(value ?? '');

  const feature =
    window.ROOMS_EXPLORE_PEOPLE_FEATURE.create({
      state,
      escapeHtml,
      normalizeExploreValue,
      labelSeeking,
      initials: name =>
        String(name).slice(0, 2).toUpperCase(),
      connectionButtonLabel: () => connectionLabel
    });

  return {
    document: window.document,
    feature,
    close: () => window.close()
  };
}

const profiles = [
  { id: 'my-user', alias: 'Mi perfil' },
  { id: 'blocked-user', alias: 'Bloqueado' },
  {
    id: 'person-1',
    alias: 'Lucía',
    age: 27,
    zones: ['Chamberí'],
    seeking: ['mates', 'room'],
    traits: ['tidy', 'social', 'calm', 'cook'],
    bio: 'Quiero compartir piso',
    avatar_url: 'https://example.com/avatar.jpg'
  },
  {
    id: 'person-2',
    name: 'Pablo',
    zones: ['Retiro'],
    seeking: ['home'],
    traits: ['night']
  },
  { id: '', alias: 'Sin identificador' }
];

{
  const t = setup(profiles, {
    blocked: ['blocked-user']
  });

  assert.deepEqual(
    Array.from(
      t.feature.getExplorePeople(),
      p => p.id
    ),
    ['person-1', 'person-2']
  );

  console.log(
    'OK  Usuario propio, bloqueados e invalidos excluidos'
  );

  const search =
    t.document.querySelector('#exploreSearch');

  for (const query of [
    '  LUCIA  ',
    'chamberi',
    'busca companeros',
    'social',
    'compartir piso'
  ]) {
    search.value = query;

    assert.deepEqual(
      Array.from(
        t.feature.getExplorePeople(),
        p => p.id
      ),
      ['person-1'],
      `Busqueda incorrecta: ${query}`
    );
  }

  search.value = 'no existe';

  assert.equal(
    t.feature.getExplorePeople().length,
    0
  );

  console.log(
    'OK  Busqueda por nombre, zona, intencion, bio y rasgos'
  );
  console.log('OK  Acentos y mayusculas normalizados');

  t.close();
}

{
  const t = setup();

  t.feature.renderExplorePeople([]);

  assert(
    t.document.body.textContent.includes(
      'No encontramos personas con esa búsqueda'
    )
  );
  assert(
    t.document.querySelector('#exploreMap').hidden
  );
  assert.equal(
    t.document.querySelectorAll(
      '.explore-person-card'
    ).length,
    0
  );

  console.log('OK  Estado vacio y mapa oculto');

  t.close();
}

{
  const t = setup(profiles, {
    connectionLabel: 'Solicitud enviada'
  });

  t.feature.renderExplorePeople([
    profiles[2],
    profiles[3]
  ]);

  const doc = t.document;
  const cards = doc.querySelectorAll(
    '.explore-person-card'
  );

  assert.equal(cards.length, 2);
  assert(doc.querySelector('#exploreMap').hidden);

  const heading = doc.querySelector(
    '.explore-results-heading'
  ).textContent.replace(/\s+/g, ' ').trim();

  assert(heading.includes('2 personas'));

  assert.equal(
    cards[0].dataset.realUser,
    'person-1'
  );

  for (const value of [
    'Lucía',
    '27',
    'Chamberí',
    'Busca compañeros',
    'Quiero compartir piso'
  ]) {
    assert(
      cards[0].textContent.includes(value),
      value
    );
  }

  assert.equal(
    cards[0].querySelectorAll(
      '.explore-person-traits span'
    ).length,
    3
  );

  assert(
    cards[0].querySelector(
      '.explore-person-photo img'
    )
  );
  assert(
    cards[1].querySelector(
      '.explore-person-placeholder'
    )
  );

  console.log(
    'OK  Tarjetas, zonas, intenciones y compatibilidad'
  );
  console.log(
    'OK  Avatar, iniciales y limite de rasgos'
  );

  const save = cards[0].querySelector(
    '[data-save-kind="person"]'
  );
  const connect = cards[0].querySelector(
    '[data-connect]'
  );
  const group = cards[0].querySelector(
    '[data-send-person-home]'
  );
  const detail = cards[0].querySelector(
    '[data-open-explore-person]'
  );

  assert(save);
  assert.equal(save.dataset.saveId, 'person-1');
  assert(connect);
  assert.equal(connect.dataset.userId, 'person-1');
  assert(
    connect.textContent.includes('Solicitud enviada')
  );
  assert.equal(
    group.dataset.sendPersonHome,
    'person-1'
  );
  assert.equal(
    detail.dataset.openExplorePerson,
    'person-1'
  );

  console.log(
    'OK  Guardar, conectar, grupo y ver perfil'
  );

  t.close();
}

{
  const t = setup();

  t.feature.renderExplorePeople([
    { id: 'person-empty' }
  ]);

  const text =
    t.document.body.textContent.replace(/\s+/g, ' ');

  assert(text.includes('1 persona'));
  assert(text.includes('Usuario de Rooms'));
  assert(text.includes('Perfil en Rooms'));
  assert(
    text.includes(
      'Todavía no ha añadido una descripción.'
    )
  );

  console.log('OK  Perfil incompleto');

  t.close();
}

{
  const t = setup();

  t.feature.renderExplorePeople([{
    id: 'person-safe',
    alias: '<script>alert(1)</script>',
    bio: '<img src=x onerror=alert(1)>',
    zones: ['<svg onload=alert(1)>'],
    traits: ['<b>peligroso</b>'],
    avatar_url:
      'https://example.com/a.jpg?x="><script>'
  }]);

  const doc = t.document;

  assert.equal(
    doc.querySelectorAll('script,svg').length,
    0
  );
  assert.equal(
    doc.querySelectorAll(
      '.explore-person-bio img'
    ).length,
    0
  );
  assert.equal(
    doc.querySelectorAll(
      '.explore-person-traits b'
    ).length,
    0
  );
  assert(
    doc.querySelector(
      '.explore-person-body h2'
    ).textContent.includes('<script>')
  );
  assert.equal(
    doc.querySelectorAll(
      '.explore-person-photo img'
    ).length,
    1
  );

  console.log('OK  Escapado HTML');

  t.close();
}

{
  const t = setup([], { withList: false });

  assert.doesNotThrow(() => {
    t.feature.renderExplorePeople([]);
  });

  console.log('OK  Contenedor ausente');

  t.close();
}

console.log('\nROOMS EXPLORE PEOPLE FEATURE OK');
