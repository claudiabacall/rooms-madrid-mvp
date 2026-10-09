import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/feed-core.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== FEED CORE ===');

const script = 'assets/js/features/feed-core.js';

assert(html.includes(`src="${script}"`));
assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);
assert(app.includes('ROOMS_FEED_CORE_FEATURE?.create'));
assert(/function renderRealFeed\s*\(/.test(source));
assert(!/function renderRealFeed\s*\(/.test(app));
assert(
  app.includes(
    'renderRealFeed(listings || [], profiles || [], posts || [], communities || [])'
  )
);
assert(
  /const\s*\{\s*renderRealFeed\s*\}\s*=\s*feedCoreFeature/.test(app),
  'Feed Core debe exponer renderRealFeed al monolito'
);

const communityManagement = fs.readFileSync(
  'assets/js/features/community-management.js',
  'utf8'
);

assert(
  /\brenderRealFeed\s*\(/.test(communityManagement),
  'Community Management debe mantener su llamada a Feed Core'
);

console.log('OK  Extraccion e integracion');

function setup({
  blocked = [],
  filter = 'all',
  withFeed = true
} = {}) {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <button
          data-feed-filter="${filter}"
          class="active"
        ></button>
        ${withFeed ? '<main id="personalFeed"></main>' : ''}
      </body>
    </html>
  `, {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  });

  const { window } = dom;

  window.eval(source);

  const calls = [];

  function card(kind, type) {
    return item => {
      calls.push([kind, item.id]);
      return `<article
        data-feed-type="${type}"
        data-test-id="${item.id}"
      >${kind}:${item.id}</article>`;
    };
  }

  const state = {
    blockedUsers: new Set(blocked)
  };

  const feature =
    window.ROOMS_FEED_CORE_FEATURE.create({
      state,
      renderListingCard: card('listing', 'home'),
      renderPersonCard: card('profile', 'person'),
      renderPostCard: card('post', 'post'),
      renderCommunityCard: card('community', 'community')
    });

  return {
    window,
    document: window.document,
    feature,
    calls,
    feed: window.document.querySelector('#personalFeed'),
    close: () => window.close()
  };
}

{
  const t = setup();

  t.feature.renderRealFeed(
    [{ id: 'home-1', created_at: '2026-10-01' }],
    [{ id: 'person-1', created_at: '2026-10-04' }],
    [{ id: 'post-1', created_at: '2026-10-03' }],
    [{ id: 'community-1', created_at: '2026-10-02' }]
  );

  const ids = [
    ...t.feed.querySelectorAll('[data-test-id]')
  ].map(element => element.dataset.testId);

  assert.deepEqual(ids, [
    'person-1',
    'post-1',
    'community-1',
    'home-1'
  ]);

  assert.equal(t.calls.length, 4);

  console.log('OK  Cuatro contenidos y orden cronologico');

  t.close();
}

{
  const t = setup({
    blocked: ['blocked-user']
  });

  t.feature.renderRealFeed(
    [],
    [
      { id: 'blocked-user' },
      { id: 'visible-user' },
      { id: null },
      null
    ],
    [],
    []
  );

  const cards = t.feed.querySelectorAll(
    '[data-feed-type="person"]'
  );

  assert.equal(cards.length, 1);
  assert.equal(cards[0].dataset.testId, 'visible-user');
  assert.equal(
    t.calls.filter(call => call[0] === 'profile').length,
    1
  );

  console.log('OK  Perfiles bloqueados y no validos excluidos');

  t.close();
}

{
  const t = setup({ filter: 'post' });

  t.feature.renderRealFeed(
    [{ id: 'home-1' }],
    [{ id: 'person-1' }],
    [{ id: 'post-1' }],
    [{ id: 'community-1' }]
  );

  const cards = [
    ...t.feed.querySelectorAll('[data-feed-type]')
  ];

  assert.equal(cards.length, 4);

  for (const card of cards) {
    assert.equal(
      card.hidden,
      card.dataset.feedType !== 'post'
    );
  }

  console.log('OK  Filtro activo aplicado');

  t.close();
}

{
  const t = setup();

  t.feature.renderRealFeed([], [], [], []);

  assert(
    t.feed.textContent.includes(
      'Todavía no hay contenido en Rooms'
    )
  );

  assert(
    t.feed.querySelector('[data-open-real-publish]')
  );

  console.log('OK  Estado vacio y boton de publicacion');

  t.close();
}

{
  const t = setup({ withFeed: false });

  assert.doesNotThrow(() => {
    t.feature.renderRealFeed([], [], [], []);
  });

  assert.equal(t.calls.length, 0);

  console.log('OK  Contenedor ausente controlado');

  t.close();
}

{
  const t = setup();

  t.feature.renderRealFeed(
    [
      { id: 'sin-fecha' },
      { id: 'reciente', created_at: '2026-10-09' }
    ],
    [],
    [],
    []
  );

  const ids = [
    ...t.feed.querySelectorAll('[data-test-id]')
  ].map(element => element.dataset.testId);

  assert.deepEqual(ids, ['reciente', 'sin-fecha']);

  console.log('OK  Contenidos sin fecha');

  t.close();
}

console.log('\nROOMS FEED CORE FEATURE OK');
