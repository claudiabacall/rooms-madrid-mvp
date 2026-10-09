import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/feed-person-card.js',
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

console.log('\n=== FEED PERSON CARD ===');

const script = 'assets/js/features/feed-person-card.js';

assert(html.includes(`src="${script}"`));

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_FEED_PERSON_CARD_FEATURE?.create')
);

assert(
  /function renderPersonCard\s*\(/.test(source)
);

assert(
  !/function renderPersonCard\s*\(/.test(app)
);

assert(
  feedCore.includes('renderPersonCard(item)')
);

console.log('OK  Extraccion e integracion');

const context = { window: {} };
vm.runInNewContext(source, context);

const factory =
  context.window.ROOMS_FEED_PERSON_CARD_FEATURE.create;

function setup({
  blocked = [],
  saved = [],
  buttonLabel = 'Conectar'
} = {}) {
  const state = {
    blockedUsers: new Set(blocked),
    savedItems: new Set(saved)
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
    escapeHtml,
    initials: name => name.slice(0, 2).toUpperCase(),
    labelSeeking: value =>
      value === 'mates'
        ? 'Busca compañeros'
        : 'Sin búsqueda definida',
    connectionButtonLabel: () => buttonLabel
  });

  const render = profile =>
    feature.renderPersonCard(profile);

  const parse = profile => {
    const dom = new JSDOM(
      '<!doctype html><body></body>'
    );

    dom.window.document.body.innerHTML = render(profile);
    return dom;
  };

  return { render, parse };
}

{
  const t = setup({ blocked: ['user-blocked'] });

  assert.equal(t.render(null), '');
  assert.equal(
    t.render({
      id: 'user-blocked',
      alias: 'Usuario bloqueado'
    }),
    ''
  );

  console.log('OK  Usuarios bloqueados excluidos');
}

{
  const t = setup();

  const dom = t.parse({
    id: 'user-1',
    alias: 'Lucia',
    name: 'Nombre secundario',
    age: 27,
    zones: ['Chamberi', 'Centro'],
    seeking: ['mates'],
    traits: ['tidy', 'social', 'calm', 'cook'],
    bio: 'Busco un piso tranquilo'
  });

  const doc = dom.window.document;
  const card = doc.querySelector('.person-feed-card');

  assert(card);
  assert.equal(card.dataset.realUser, 'user-1');
  assert.equal(card.dataset.feedType, 'person');

  assert(
    card.querySelector('h2').textContent.includes('Lucia, 27')
  );

  assert(
    card.textContent.includes('Busca compañeros')
  );

  assert(card.textContent.includes('Chamberi'));
  assert(
    card.textContent.includes('Busco un piso tranquilo')
  );

  assert.equal(
    doc.querySelectorAll('.person-traits span').length,
    3
  );

  assert(card.textContent.includes('Ordenado'));
  assert(card.textContent.includes('Sociable'));
  assert(card.textContent.includes('Tranquilo'));

  assert.equal(
    doc.querySelector('.real-person-placeholder')
      .textContent,
    'LU'
  );

  console.log('OK  Perfil, edad, zona y busqueda');
  console.log('OK  Preferencias limitadas a tres');
  console.log('OK  Iniciales sin fotografia');

  dom.window.close();
}

{
  const t = setup({
    saved: ['person:user-2'],
    buttonLabel: 'Solicitud enviada'
  });

  const dom = t.parse({
    id: 'user-2',
    alias: 'Pablo',
    avatar_url: 'https://example.com/avatar.jpg'
  });

  const doc = dom.window.document;

  const image = doc.querySelector(
    '.real-person-photo img'
  );

  assert(image);
  assert.equal(
    image.getAttribute('src'),
    'https://example.com/avatar.jpg'
  );

  const save = doc.querySelector('[data-person-save]');

  assert(save);
  assert(save.classList.contains('saved'));
  assert.equal(save.dataset.saveKind, 'person');
  assert.equal(save.dataset.saveId, 'user-2');
  assert.equal(save.textContent, '♥');

  const connect = doc.querySelector('[data-connect]');

  assert(connect);
  assert.equal(connect.dataset.userId, 'user-2');
  assert.equal(connect.textContent, 'Solicitud enviada');

  console.log('OK  Fotografia y estado guardado');
  console.log('OK  Boton de conexion');

  dom.window.close();
}

{
  const t = setup();

  const dom = t.parse({
    id: 'user-3',
    name: 'Maria'
  });

  const doc = dom.window.document;

  const save = doc.querySelector('[data-person-save]');

  assert(save);
  assert(!save.classList.contains('saved'));
  assert.equal(save.textContent, '♡');

  assert(
    doc.body.textContent.includes(
      'Sin preferencias de convivencia'
    )
  );

  assert(doc.body.textContent.includes('Bio sin completar'));
  assert(doc.body.textContent.includes('Zona sin definir'));

  console.log('OK  Perfil incompleto y no guardado');

  dom.window.close();
}

{
  const t = setup();

  const dom = t.parse({
    id: 'safe-user',
    alias: '<script>alert(1)</script>',
    zones: ['<img src=x>'],
    traits: ['<svg onload=alert(1)>'],
    bio: '<b>Inyeccion</b>',
    avatar_url: 'https://example.com/a.jpg?x="><script>'
  });

  const doc = dom.window.document;

  assert.equal(
    doc.querySelectorAll('script,svg').length,
    0
  );

  assert.equal(
    doc.querySelectorAll('.person-traits svg').length,
    0
  );

  assert(
    doc.querySelector('h2').textContent.includes('<script>')
  );

  assert.equal(
    doc.querySelectorAll('.real-person-photo img').length,
    1
  );

  console.log('OK  Escapado HTML de datos de perfil');

  dom.window.close();
}

console.log('\nROOMS FEED PERSON CARD FEATURE OK');
