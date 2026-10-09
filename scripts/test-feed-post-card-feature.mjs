import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/feed-post-card.js',
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

console.log('\n=== FEED POST CARD ===');

const script = 'assets/js/features/feed-post-card.js';

assert(html.includes(`src="${script}"`));
assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_FEED_POST_CARD_FEATURE?.create')
);
assert(
  /function renderPostCard\s*\(/.test(source)
);
assert(
  !/function renderPostCard\s*\(/.test(app)
);
assert(
  feedCore.includes('renderPostCard(item)')
);

console.log('OK  Extraccion e integracion');

const context = { window: {}, Date, Intl, Number };
vm.runInNewContext(source, context);

const factory =
  context.window.ROOMS_FEED_POST_CARD_FEATURE.create;

function setup({
  blocked = [],
  saved = [],
  liked = [],
  profiles = [],
  communities = [],
  listings = [],
  likes = [],
  comments = []
} = {}) {
  const state = {
    blockedUsers: new Set(blocked),
    savedItems: new Set(saved),
    userPostLikes: new Set(liked),
    profiles: new Map(profiles.map(x => [x.id, x])),
    communities: new Map(communities.map(x => [x.id, x])),
    listings: new Map(listings.map(x => [x.id, x])),
    postLikes: new Map(likes),
    postComments: new Map(comments)
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
    initials: name => String(name).slice(0, 2),
    relativeTime: () => 'Hace 2 horas'
  });

  const render = post =>
    feature.renderPostCard(post);

  const parse = post => {
    const dom = new JSDOM(
      '<!doctype html><body></body>'
    );
    dom.window.document.body.innerHTML = render(post);
    return dom;
  };

  return { render, parse };
}

const basePost = {
  id: 'post-1',
  author_id: 'user-1',
  post_type: 'question',
  body: '¿Qué tal es el barrio?',
  created_at: '2026-10-09'
};

{
  const t = setup({ blocked: ['user-1'] });

  assert.equal(t.render(null), '');
  assert.equal(t.render(basePost), '');

  console.log('OK  Publicaciones bloqueadas excluidas');
}

{
  const categories = [
    ['question', 'PREGUNTA', 'Responder'],
    ['recommendation', 'RECOMENDACIÓN', 'Comentar'],
    ['neighborhood', 'BARRIO', 'Comentar'],
    ['warning', 'AVISO', 'Comentar'],
    ['experience', 'EXPERIENCIA', 'Comentar'],
    ['housing', 'VIVIENDA', 'Comentar']
  ];

  for (const [type, label, action] of categories) {
    const t = setup();
    const dom = t.parse({
      ...basePost,
      post_type: type
    });

    const doc = dom.window.document;
    const card = doc.querySelector(
      '.home-editorial-post'
    );

    assert(card);
    assert(
      card.classList.contains(
        `home-editorial-post--${type}`
      )
    );
    assert(
      doc.querySelector('.home-post-accent')
        .textContent.includes(label)
    );
    assert(
      doc.querySelector(
        '[data-community-post-comments]'
      ).textContent.includes(action)
    );

    dom.window.close();
  }

  console.log('OK  Seis tipos de publicacion');
}

{
  const t = setup();

  const dom = t.parse({
    ...basePost,
    post_type: 'warning',
    expires_at: '2099-12-31'
  });

  assert(
    dom.window.document.querySelector(
      '.home-post-warning-date'
    )
  );

  dom.window.close();

  const expired = t.render({
    ...basePost,
    post_type: 'warning',
    expires_at: '2020-01-01'
  });

  assert.equal(expired, '');

  console.log('OK  Avisos vigentes y caducados');
}

{
  const t = setup({
    profiles: [{
      id: 'user-1',
      alias: 'Lucia',
      avatar_url: 'https://example.com/avatar.jpg'
    }],
    communities: [{
      id: 'community-1',
      name: 'Chamberi'
    }],
    listings: [{
      id: 'listing-1',
      title: 'Habitacion luminosa',
      price: 950,
      photos: ['https://example.com/home.jpg']
    }]
  });

  const dom = t.parse({
    ...basePost,
    post_type: 'housing',
    community_id: 'community-1',
    listing_id: 'listing-1',
    zone: 'Madrid',
    media_urls: ['https://example.com/post.jpg']
  });

  const doc = dom.window.document;

  assert(
    doc.querySelector(
      '.home-post-author b'
    ).textContent.includes('Lucia')
  );

  assert.equal(
    doc.querySelector(
      '[data-real-community-open]'
    ).dataset.realCommunityOpen,
    'community-1'
  );

  assert.equal(
    doc.querySelector(
      '.home-post-listing'
    ).dataset.realListing,
    'listing-1'
  );

  assert(
    doc.body.textContent.includes('950')
  );

  assert(
    doc.querySelector('.home-post-media img')
  );

  assert(
    doc.querySelector('.home-post-zone')
  );

  console.log('OK  Autor, comunidad y vivienda vinculada');
  console.log('OK  Imagenes y zona');

  dom.window.close();
}

{
  const t = setup({
    saved: ['post:post-1'],
    liked: ['post-1'],
    likes: [['post-1', 5]],
    comments: [['post-1', [{ id: 1 }, { id: 2 }]]]
  });

  const dom = t.parse(basePost);
  const doc = dom.window.document;

  const like = doc.querySelector(
    '[data-community-post-like]'
  );
  const comments = doc.querySelector(
    '[data-community-post-comments]'
  );
  const save = doc.querySelector(
    '[data-save-kind="post"]'
  );
  const report = doc.querySelector(
    '[data-real-report]'
  );

  assert(like.classList.contains('active'));
  assert(like.textContent.includes('5'));
  assert(comments.textContent.includes('2'));
  assert(save.classList.contains('saved'));
  assert.equal(save.dataset.saveId, 'post-1');
  assert.equal(report.dataset.reportType, 'post');
  assert.equal(report.dataset.reportId, 'post-1');
  assert.equal(report.dataset.reportUser, 'user-1');

  assert(
    doc.querySelector(
      '[data-community-comments-panel]'
    )
  );

  console.log('OK  Me gusta, comentarios y guardados');
  console.log('OK  Reportes y panel de comentarios');

  dom.window.close();
}

{
  const t = setup();

  const dom = t.parse({
    ...basePost,
    author_id: 'unknown-user',
    community_id: 'unknown-community',
    listing_id: 'unknown-listing',
    media_urls: null
  });

  const doc = dom.window.document;

  assert(
    doc.body.textContent.includes('Usuario de Rooms')
  );
  assert(
    !doc.querySelector('.home-post-listing')
  );
  assert(
    !doc.querySelector('.home-post-media img')
  );
  assert(
    !doc.querySelector('[data-real-community-open]')
  );

  console.log('OK  Datos ausentes controlados');

  dom.window.close();
}

{
  const t = setup({
    profiles: [{
      id: 'user-1',
      alias: '<script>alert(1)</script>'
    }],
    communities: [{
      id: 'community-x',
      name: '<img src=x>'
    }],
    listings: [{
      id: 'listing-x',
      title: '<svg onload=alert(1)>',
      price: null
    }]
  });

  const dom = t.parse({
    ...basePost,
    id: 'post-safe',
    author_id: 'user-1',
    community_id: 'community-x',
    listing_id: 'listing-x',
    body: '<b>Texto peligroso</b>',
    zone: '<script>alert(2)</script>',
    media_urls: [
      'https://example.com/a.jpg?x="><img src=x>'
    ]
  });

  const doc = dom.window.document;

  assert.equal(
    doc.querySelectorAll('script,svg').length,
    0
  );

  assert.equal(
    doc.querySelectorAll('.home-post-body b').length,
    0
  );

  assert(
    doc.querySelector('.home-post-body')
      .textContent.includes('<b>')
  );

  assert.equal(
    doc.querySelectorAll('.home-post-media img').length,
    1
  );

  assert.equal(
    doc.querySelectorAll('.home-post-listing svg').length,
    0
  );

  console.log('OK  Escapado HTML en publicaciones');

  dom.window.close();
}

console.log('\nROOMS FEED POST CARD FEATURE OK');
