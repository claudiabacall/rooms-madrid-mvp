import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/feed-community-card.js',
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

console.log('\n=== FEED COMMUNITY CARD ===');

const script = 'assets/js/features/feed-community-card.js';

assert(html.includes(`src="${script}"`));
assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);
assert(
  app.includes('ROOMS_FEED_COMMUNITY_CARD_FEATURE?.create')
);
assert(
  /function renderCommunityCard\s*\(/.test(source)
);
assert(
  !/function renderCommunityCard\s*\(/.test(app)
);
assert(feedCore.includes('renderCommunityCard(item)'));

console.log('OK  Extraccion e integracion');

const context = { window: {} };
vm.runInNewContext(source, context);

const factory =
  context.window.ROOMS_FEED_COMMUNITY_CARD_FEATURE.create;

assert.equal(typeof factory, 'function');

function setup(counts = []) {
  const state = {
    communityMemberCounts: new Map(counts)
  };

  const escapeHtml = value =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const feature = factory({ state, escapeHtml });

  const parse = community => {
    const dom = new JSDOM(
      '<!doctype html><body></body>'
    );
    dom.window.document.body.innerHTML =
      feature.renderCommunityCard(community);
    return dom;
  };

  return { feature, parse };
}

{
  const t = setup([['community-1', 1]]);

  const dom = t.parse({
    id: 'community-1',
    name: 'Chamberi',
    visibility: 'private',
    description: 'Vecinos y compañeros de piso'
  });

  const doc = dom.window.document;
  const card = doc.querySelector(
    '.home-community-social-card'
  );

  assert(card);
  assert.equal(card.dataset.feedType, 'community');
  assert.equal(
    card.dataset.realCommunity,
    'community-1'
  );
  assert(doc.body.textContent.includes('PRIVADA'));
  assert(doc.body.textContent.includes('1 miembro'));
  assert(
    doc.body.textContent.includes(
      'Vecinos y compañeros de piso'
    )
  );

  const button = doc.querySelector(
    '[data-real-community-open]'
  );

  assert(button);
  assert.equal(
    button.dataset.realCommunityOpen,
    'community-1'
  );
  assert(button.textContent.includes('Entrar'));

  console.log('OK  Comunidad privada y un miembro');
  console.log('OK  Acceso a la comunidad');

  dom.window.close();
}

{
  const t = setup([['community-2', 1200]]);

  const dom = t.parse({
    id: 'community-2',
    name: 'Madrid Centro',
    visibility: 'public',
    description: 'Comunidad abierta'
  });

  const text = dom.window.document.body.textContent;

  assert(text.includes('PÚBLICA'));
  assert(
    /1[.\s\u00a0\u202f]?200 miembros/.test(text),
    'Debe mostrar 1200 miembros con formato localizado'
  );
  assert(text.includes('Madrid Centro'));

  console.log('OK  Comunidad publica y miles de miembros');

  dom.window.close();
}

{
  const t = setup();

  const dom = t.parse({
    id: 'community-3',
    name: 'Nueva comunidad'
  });

  const text = dom.window.document.body.textContent;

  assert(text.includes('0 miembros'));
  assert(
    text.includes(
      'Personas que comparten un lugar'
    )
  );

  console.log('OK  Sin miembros ni descripcion');

  dom.window.close();
}

{
  const t = setup();

  const dom = t.parse({
    id: 'community-safe',
    name: '<script>alert(1)</script>',
    description: '<img src=x onerror=alert(1)>',
    visibility: 'private'
  });

  const doc = dom.window.document;

  assert.equal(doc.querySelectorAll('script').length, 0);
  assert.equal(
    doc.querySelectorAll(
      '.home-community-main-copy img'
    ).length,
    0
  );
  assert(
    doc.querySelector(
      '.home-community-main-copy h2'
    ).textContent.includes('<script>')
  );
  assert.equal(
    doc.querySelector(
      '[data-real-community-open]'
    ).dataset.realCommunityOpen,
    'community-safe'
  );

  console.log('OK  Escapado HTML y atributos seguros');

  dom.window.close();
}

console.log('\nROOMS FEED COMMUNITY CARD FEATURE OK');
