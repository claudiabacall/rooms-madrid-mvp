import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/publish-community-fields.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== PUBLISH COMMUNITY FIELDS ===');

const script =
  'assets/js/features/publish-community-fields.js';

assert(html.includes(`src="${script}"`));

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes(
    'ROOMS_PUBLISH_COMMUNITY_FIELDS_FEATURE?.create'
  )
);

assert(
  app.indexOf('const publishCommunityFieldsFeature') <
  app.indexOf('const publishStepsFeature')
);

for (const name of [
  'selectedCommunityPostType',
  'renderCommunityPostFields',
  'enhanceCommunityPostComposer'
]) {
  const pattern = new RegExp(
    `function\\s+${name}\\s*\\(`
  );

  assert(pattern.test(source), `Falta ${name}`);
  assert(!pattern.test(app), `${name} sigue en monolito`);
}

console.log('OK  Modulo extraido e integrado');
console.log('OK  Inicializacion anterior a Publish Steps');

function setup({
  listings = [],
  userId = 'user-1',
  selectedType = 'Pregunta'
} = {}) {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div id="composer">
          <button
            data-selectable
            aria-pressed="true"
          >${selectedType}</button>
          <textarea></textarea>
        </div>
      </body>
    </html>
  `, {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  });

  const { window } = dom;

  window.setTimeout = callback => {
    callback();
    return 1;
  };

  window.eval(source);

  const state = {
    user: { id: userId },
    listings: new Map(
      listings.map(listing => [listing.id, listing])
    )
  };

  const escapeHtml = value =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const feature =
    window.ROOMS_PUBLISH_COMMUNITY_FIELDS_FEATURE.create({
      state,
      escapeHtml
    });

  const content =
    window.document.querySelector('#composer');

  return {
    window,
    state,
    feature,
    content,
    close: () => window.close()
  };
}

{
  const t = setup();

  assert.equal(
    t.feature.selectedCommunityPostType(t.content),
    'Pregunta'
  );

  t.content.querySelector('[data-selectable]')
    .setAttribute('aria-pressed', 'false');

  assert.equal(
    t.feature.selectedCommunityPostType(t.content),
    'Pregunta'
  );

  console.log('OK  Seleccion y valor por defecto');

  t.close();
}

{
  const categories = [
    ['Pregunta', 'data-post-zone'],
    ['Recomendación', 'data-post-zone'],
    ['Barrio', 'data-post-zone'],
    ['Aviso', 'data-post-expires'],
    ['Experiencia', 'data-post-zone']
  ];

  for (const [type, selector] of categories) {
    const t = setup({ selectedType: type });

    t.feature.renderCommunityPostFields(t.content);

    assert(
      t.content.querySelector(`[${selector}]`),
      `Campo ausente: ${type}`
    );

    assert.equal(
      t.content.querySelectorAll(
        '#communityPostExtraFields'
      ).length,
      1
    );

    if (type === 'Barrio') {
      assert(
        t.content.querySelector(
          '[data-post-zone]'
        ).required
      );
    }

    t.feature.renderCommunityPostFields(t.content);

    assert.equal(
      t.content.querySelectorAll(
        '#communityPostExtraFields'
      ).length,
      1
    );

    t.close();
  }

  console.log('OK  Cinco categorias y campos especificos');
  console.log('OK  No duplica campos al renderizar');
}

{
  const t = setup({
    selectedType: 'Vivienda',
    listings: [
      {
        id: 'listing-1',
        owner_id: 'user-1',
        status: 'published',
        title: 'Habitación <script>',
        price: 950
      },
      {
        id: 'listing-2',
        owner_id: 'user-2',
        status: 'published',
        title: 'Vivienda ajena'
      },
      {
        id: 'listing-3',
        owner_id: 'user-1',
        status: 'draft',
        title: 'Borrador'
      }
    ]
  });

  t.feature.renderCommunityPostFields(t.content);

  const select = t.content.querySelector(
    '[data-post-listing]'
  );

  assert(select);
  assert.equal(select.options.length, 2);
  assert.equal(select.options[1].value, 'listing-1');

  assert(
    select.options[1].textContent.includes(
      'Habitación <script>'
    )
  );

  assert(
    !select.querySelector('script')
  );

  assert(
    !t.content.textContent.includes('Vivienda ajena')
  );

  console.log('OK  Solo viviendas propias y publicadas');
  console.log('OK  Escapado de contenido HTML');

  t.close();
}

{
  const t = setup({ selectedType: 'Vivienda' });

  t.feature.renderCommunityPostFields(t.content);

  assert(
    !t.content.querySelector('[data-post-listing]')
  );

  assert(
    t.content.textContent.includes(
      'No tienes viviendas publicadas'
    )
  );

  console.log('OK  Estado sin viviendas publicadas');

  t.close();
}

{
  const t = setup();

  t.feature.enhanceCommunityPostComposer(t.content);
  t.feature.enhanceCommunityPostComposer(t.content);

  const button = t.content.querySelector(
    '[data-selectable]'
  );

  assert.equal(
    button.dataset.communityTypeListener,
    'true'
  );

  button.textContent = 'Aviso';
  button.click();

  assert(
    t.content.querySelector('[data-post-expires]')
  );

  assert.equal(
    t.content.querySelectorAll(
      '#communityPostExtraFields'
    ).length,
    1
  );

  console.log('OK  Listener actualiza campos dinamicos');

  t.close();
}

{
  const t = setup();

  t.content.querySelector('textarea').remove();

  t.feature.renderCommunityPostFields(t.content);

  assert.equal(
    t.content.querySelector('#communityPostExtraFields'),
    null
  );

  t.feature.renderCommunityPostFields(null);
  t.feature.enhanceCommunityPostComposer(null);

  console.log('OK  Contenido ausente controlado');

  t.close();
}

console.log('\nROOMS PUBLISH COMMUNITY FIELDS FEATURE OK');
