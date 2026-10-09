import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/publish-steps.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== PUBLISH STEPS ===');

const script = 'assets/js/features/publish-steps.js';

assert(html.includes(`src="${script}"`));

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_PUBLISH_STEPS_FEATURE?.create')
);

assert(
  app.includes('selectedCommunityPostType')
);

for (const name of [
  'currentPublishType',
  'currentPublishStep',
  'capturePublishStep'
]) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\(`);
  assert(pattern.test(source), `Falta ${name}`);
  assert(!pattern.test(app), `${name} sigue en el monolito`);
}

console.log('OK  Extraccion e integracion correctas');

function setup({
  label = 'OFRECER HABITACIÓN',
  width = '33.3333%',
  initialType = null
} = {}) {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <span id="publishFlowKind"></span>
        <span id="publishProgressBar"></span>
        <div id="publishFlowContent"></div>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'http://127.0.0.1/'
  });

  const { window } = dom;
  window.eval(source);

  const document = window.document;
  document.querySelector('#publishFlowKind').textContent =
    label;

  document.querySelector('#publishProgressBar').style.width =
    width;

  const state = {
    publishType: initialType,
    publishDraft: {
      steps: {},
      files: []
    }
  };

  const selectedCalls = [];

  const feature =
    window.ROOMS_PUBLISH_STEPS_FEATURE.create({
      state,
      publishTotals: {
        room: 3,
        apartment: 3,
        mate: 2,
        external: 3,
        post: 2
      },
      selectedCommunityPostType: content => {
        selectedCalls.push(content);
        return 'question';
      }
    });

  return {
    window,
    document,
    state,
    feature,
    selectedCalls,
    content: document.querySelector('#publishFlowContent'),
    close: () => window.close()
  };
}

{
  const cases = [
    ['OFRECER HABITACIÓN', 'room'],
    ['PUBLICAR PISO', 'apartment'],
    ['BUSCAR COMPAÑERO', 'mate'],
    ['COMPARTIR EXTERNA', 'external'],
    ['CREAR PUBLICACIÓN', 'post'],
    ['DESCONOCIDO', null]
  ];

  for (const [label, expected] of cases) {
    const t = setup({ label });

    assert.equal(
      t.feature.currentPublishType(),
      expected
    );

    t.close();
  }

  console.log('OK  Tipos de publicacion identificados');
}

{
  const t = setup({
    label: 'OFRECER HABITACIÓN',
    width: '66.6667%'
  });

  assert.equal(t.feature.currentPublishStep(), 1);

  t.document.querySelector('#publishProgressBar').style.width =
    '100%';

  assert.equal(t.feature.currentPublishStep(), 2);

  t.close();

  console.log('OK  Progreso de tres pasos');
}

{
  const t = setup({
    label: 'CREAR PUBLICACIÓN',
    width: '100%'
  });

  assert.equal(t.feature.currentPublishStep(), 1);

  t.close();

  console.log('OK  Progreso de dos pasos');
}

{
  const t = setup();

  t.content.innerHTML = `
    <input value=" 950 ">
    <textarea>  Descripcion  </textarea>
    <select><option selected>Madrid</option></select>
    <input type="file">
    <input data-exact-address value=" Calle Mayor 1 ">
    <input data-auto-zone-input value="Madrid Centro">
    <button
      data-selectable
      aria-pressed="true"
    > Amueblado </button>
    <button
      data-selectable
      aria-pressed="false"
    > Terraza </button>
  `;

  const snapshot = t.feature.capturePublishStep();

  assert.equal(snapshot.type, 'room');
  assert.equal(snapshot.step, 0);

  assert.deepEqual(
    Array.from(snapshot.values),
    ['950', 'Descripcion', 'Madrid']
  );

  assert.deepEqual(
    Array.from(snapshot.selected),
    ['Amueblado']
  );

  assert.equal(
    snapshot.meta.exactAddress,
    'Calle Mayor 1'
  );

  assert(t.state.publishDraft.steps[0]);

  console.log('OK  Captura de campos y seleccion');
  console.log('OK  Direccion exacta conservada');

  t.close();
}

{
  const t = setup({
    label: 'CREAR PUBLICACIÓN',
    width: '50%'
  });

  t.content.innerHTML = `
    <textarea>Pregunta de prueba</textarea>
    <input data-post-zone value="  Chamberi  ">
    <input data-post-expires value="2026-12-31">
    <select data-post-listing>
      <option value="listing-1" selected>Vivienda</option>
    </select>
  `;

  const snapshot = t.feature.capturePublishStep();

  assert.equal(snapshot.type, 'post');
  assert.equal(snapshot.meta.zone, 'Chamberi');
  assert.equal(snapshot.meta.expiresAt, '2026-12-31');
  assert.equal(snapshot.meta.listingId, 'listing-1');
  assert.equal(snapshot.meta.communityPostType, 'question');
  assert.equal(t.selectedCalls.length, 1);

  console.log('OK  Metadata de publicacion comunitaria');

  t.close();
}

{
  const t = setup({
    label: 'OFRECER HABITACIÓN',
    initialType: 'post'
  });

  t.state.publishDraft.steps[9] = {
    values: ['anterior']
  };

  t.content.innerHTML = '<input value="Nueva vivienda">';

  const snapshot = t.feature.capturePublishStep();

  assert.equal(snapshot.type, 'room');
  assert.equal(t.state.publishType, 'room');
  assert.equal(t.state.publishDraft.steps[9], undefined);
  assert(t.state.publishDraft.steps[0]);

  console.log('OK  Cambio de tipo reinicia el borrador');

  t.close();
}

{
  const t = setup({ label: 'DESCONOCIDO' });

  assert.equal(t.feature.capturePublishStep(), null);
  assert.deepEqual(
    Object.keys(t.state.publishDraft.steps),
    []
  );

  console.log('OK  Tipo desconocido controlado');

  t.close();
}

console.log('\nROOMS PUBLISH STEPS FEATURE OK');
