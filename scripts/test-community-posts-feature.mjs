import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = fs.readFileSync(
  'assets/js/features/community-posts.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync(
  'index.html',
  'utf8'
);

console.log('\n=== COMMUNITY POSTS FEATURE ===');

const script =
  'assets/js/features/community-posts.js';

assert(
  html.includes(`src="${script}"`),
  'Falta registrar Community Posts'
);

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js'),
  'Community Posts debe cargarse antes del monolito'
);

assert(
  app.includes('ROOMS_COMMUNITY_POSTS_FEATURE?.create'),
  'Falta inicializar Community Posts'
);

assert(
  !/\bfunction renderCommunityPost\s*\(/.test(app),
  'renderCommunityPost sigue declarado en el monolito'
);

const context = {
  window: {},
  console,
  Intl,
  Date,
  Number,
  Array,
  Map,
  Set
};

vm.runInNewContext(source, context, {
  filename: script
});

const factory =
  context.window.ROOMS_COMMUNITY_POSTS_FEATURE?.create;

assert.equal(typeof factory, 'function');

console.log('OK  Modulo cargado e integrado');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setup() {
  const state = {
    user: { id: 'user-1' },

    profiles: new Map([
      ['user-2', {
        alias: 'Ana Rooms',
        avatar_url: 'https://example.com/ana.jpg'
      }]
    ]),

    listings: new Map([
      ['listing-1', {
        id: 'listing-1',
        title: 'Piso en Chamberi',
        zone: 'Chamberi',
        price: 850,
        photos: ['https://example.com/piso.jpg']
      }]
    ]),

    userPostLikes: new Set(),
    postLikes: new Map(),
    postComments: new Map(),
    savedItems: new Set()
  };

  const feature = factory({
    state,
    escapeHtml,
    initials: name =>
      String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase(),
    relativeTime: () => 'Hace poco'
  });

  const basePost = {
    id: 'post-1',
    author_id: 'user-2',
    post_type: 'question',
    body: 'Busco recomendaciones',
    created_at: '2026-10-01T10:00:00Z',
    media_urls: [],
    listing_id: null,
    zone: null,
    expires_at: null
  };

  return {
    state,
    render: changes =>
      feature.renderCommunityPost({
        ...basePost,
        ...changes
      })
  };
}

{
  const t = setup();

  for (const [type, label] of [
    ['question', 'Pregunta'],
    ['recommendation', 'Recomendación'],
    ['neighborhood', 'Barrio'],
    ['warning', 'Aviso'],
    ['experience', 'Experiencia'],
    ['housing', 'Vivienda']
  ]) {
    const output = t.render({ post_type: type });

    assert(
      output.includes(label),
      `No aparece la etiqueta ${label}`
    );
  }

  console.log('OK  Seis tipos de publicaciones');
}

{
  const t = setup();
  const output = t.render({});

  assert(output.includes('Ana Rooms'));
  assert(output.includes('ana.jpg'));
  assert(output.includes('Hace poco'));
  assert(output.includes('Busco recomendaciones'));
  assert(output.includes('data-community-post="post-1"'));

  console.log('OK  Autor, avatar, fecha y contenido');
}

{
  const t = setup();

  const output = t.render({
    media_urls: ['https://example.com/imagen.jpg'],
    zone: 'Chamberi'
  });

  assert(output.includes('imagen.jpg'));
  assert(output.includes('Chamberi'));
  assert(output.includes('community-post-media'));

  console.log('OK  Imagen y zona');
}

{
  const t = setup();

  const output = t.render({
    listing_id: 'listing-1'
  });

  assert(
    output.includes('data-real-listing="listing-1"')
  );

  assert(output.includes('Piso en Chamberi'));
  assert(output.includes('850'));
  assert(output.includes('piso.jpg'));

  console.log('OK  Vivienda vinculada');
}

{
  const t = setup();

  const output = t.render({
    post_type: 'warning',
    expires_at: '2026-11-15'
  });

  assert(output.includes('AVISO VIGENTE HASTA'));

  const ordinary = t.render({
    post_type: 'question',
    expires_at: '2026-11-15'
  });

  assert(
    !ordinary.includes('AVISO VIGENTE HASTA')
  );

  console.log('OK  Fecha de caducidad de avisos');
}

{
  const t = setup();

  t.state.userPostLikes.add('post-1');
  t.state.postLikes.set('post-1', 7);
  t.state.postComments.set('post-1', [
    { id: 'comment-1' },
    { id: 'comment-2' }
  ]);
  t.state.savedItems.add('post:post-1');

  const output = t.render({});

  assert(
    output.includes('data-community-post-like="post-1"')
  );

  assert(
    output.includes('data-community-post-comments="post-1"')
  );

  assert(
    output.includes('data-save-kind="post"')
  );

  assert(
    output.includes('data-save-id="post-1"')
  );

  assert(
    output.includes('data-real-report')
  );

  assert(
    output.includes('data-community-comments-panel="post-1"')
  );

  assert(output.includes('7'));
  assert(output.includes('Guardado'));

  console.log('OK  Likes, comentarios, guardados y reportes');
}

{
  const t = setup();

  const output = t.render({
    body: '<script>alert("XSS")</script>',
    zone: '<img src=x onerror=alert(1)>'
  });

  assert(
    output.includes('&lt;script&gt;'),
    'No se ha escapado el contenido'
  );

  assert(
    !output.includes('<script>'),
    'El contenido incluye HTML sin escapar'
  );

  assert(
    output.includes('&lt;img'),
    'La zona no se ha escapado'
  );

  console.log('OK  Escape de contenido HTML');
}

console.log('\nROOMS COMMUNITY POSTS FEATURE OK');
