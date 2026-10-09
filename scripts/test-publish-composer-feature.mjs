import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/publish-composer.js',
  'utf8'
);
const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);
const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== PUBLISH COMPOSER ===');

const script = 'assets/js/features/publish-composer.js';

assert(html.includes(`src="${script}"`));
assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);
assert(
  app.includes('ROOMS_PUBLISH_COMPOSER_FEATURE?.create')
);

for (const name of [
  'prepareListingLocationField',
  'preparePublishStep',
  'preparePhotoUploader',
  'renderPublishPreview'
]) {
  const pattern = new RegExp(
    `function\\s+${name}\\s*\\(`
  );
  assert(pattern.test(source), `Falta ${name}`);
  assert(!pattern.test(app), `${name} sigue en el monolito`);
}

console.log('OK  Extraccion e integracion');

function setup({
  type = 'room',
  step = 0,
  profile = {},
  steps = {}
} = {}) {
  const dom = new JSDOM(
    '<!doctype html><div id="publishFlowContent"></div>',
    {
      url: 'http://127.0.0.1/',
      runScripts: 'outside-only'
    }
  );

  const { window } = dom;
  window.eval(source);

  const content = window.document.querySelector(
    '#publishFlowContent'
  );
  const state = {
    publishType: type,
    publishDraft: { steps, files: [] },
    profile
  };
  const notices = [];
  const communityCalls = [];

  const escapeHtml = value =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const feature =
    window.ROOMS_PUBLISH_COMPOSER_FEATURE.create({
      state,
      currentPublishType: () => type,
      currentPublishStep: () => step,
      enhanceCommunityPostComposer: element => {
        communityCalls.push(element);
      },
      escapeHtml,
      formatBudget: () => '900 €',
      initials: value => String(value).slice(0, 2),
      notify: message => notices.push(message)
    });

  return {
    window,
    content,
    state,
    feature,
    notices,
    communityCalls,
    close: () => window.close()
  };
}

{
  const t = setup();

  t.content.innerHTML = `
    <label>
      Zona
      <input required value="Chamberi">
    </label>
  `;

  t.feature.prepareListingLocationField(
    t.content,
    'room',
    0,
    { meta: { exactAddress: 'Calle Mayor 1' } }
  );

  assert(t.content.querySelector('[data-exact-address]'));
  assert.equal(
    t.content.querySelector('[data-exact-address]').value,
    'Calle Mayor 1'
  );
  assert(
    t.content.querySelector('[data-auto-zone-input]')
  );
  assert.equal(
    t.content.querySelector('[data-auto-zone-input]').required,
    false
  );

  t.feature.prepareListingLocationField(
    t.content,
    'room',
    0,
    { meta: { exactAddress: 'Gran Via 5' } }
  );

  assert.equal(
    t.content.querySelectorAll('[data-exact-address]').length,
    1
  );
  assert.equal(
    t.content.querySelector('[data-exact-address]').value,
    'Gran Via 5'
  );

  console.log('OK  Direccion privada y sin duplicados');
  t.close();
}

{
  const t = setup({ type: 'mate' });

  t.content.innerHTML = `
    <input>
    <input>
    <input>
  `;

  t.state.profile = {
    zones: ['Centro', 'Chamberi'],
    move_in_date: '2026-11-01'
  };

  t.feature.preparePublishStep();

  const inputs = t.content.querySelectorAll('input');

  assert.equal(inputs[0].value, 'Centro, Chamberi');
  assert.equal(inputs[1].value, '900 €');
  assert.equal(inputs[2].value, '2026-11-01');

  console.log('OK  Datos del formulario de compañeros');
  t.close();
}

{
  const t = setup({
    type: 'post',
    steps: {
      0: { values: ['Texto guardado'], selected: [] }
    }
  });

  t.content.innerHTML = `
    <textarea></textarea>
    <div class="post-preview"></div>
  `;

  t.feature.preparePublishStep();

  assert.equal(
    t.content.querySelector('textarea').value,
    'Texto guardado'
  );
  assert.equal(t.communityCalls.length, 1);

  console.log('OK  Restauracion de borrador comunitario');
  t.close();
}

{
  const t = setup();

  t.content.innerHTML = `
    <button class="photo-drop"></button>
  `;

  t.feature.preparePhotoUploader(t.content);
  t.feature.preparePhotoUploader(t.content);

  const input = t.content.querySelector('input[type="file"]');

  assert(input);
  assert.equal(
    t.content.querySelectorAll('input[type="file"]').length,
    1
  );
  assert.equal(input.multiple, true);
  assert(input.accept.includes('image/webp'));

  const files = [
    { name: 'foto.jpg', size: 5000 }
  ];

  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files
  });

  input.dispatchEvent(
    new t.window.Event('change')
  );

  assert.equal(t.state.publishDraft.files.length, 1);
  assert(
    t.content.querySelector('.photo-drop')
      .textContent.includes('1 foto seleccionada')
  );

  console.log('OK  Selector de fotografias sin duplicados');
  t.close();
}

{
  const t = setup();
  t.content.innerHTML = `
    <button class="photo-drop"></button>
  `;

  t.feature.preparePhotoUploader(t.content);

  const input = t.content.querySelector('input[type="file"]');

  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [
      { name: 'grande.jpg', size: 11 * 1024 * 1024 }
    ]
  });

  input.dispatchEvent(
    new t.window.Event('change')
  );

  assert.equal(t.state.publishDraft.files.length, 0);
  assert.equal(t.notices.length, 1);

  console.log('OK  Limite de 10 MB');
  t.close();
}

{
  const t = setup({
    type: 'room',
    steps: {
      0: {
        values: ['950', '<script>'],
        selected: []
      },
      1: {
        selected: ['Terraza', '<img>']
      }
    }
  });

  t.content.innerHTML = `
    <div class="publish-preview"></div>
  `;

  t.feature.renderPublishPreview('room', 2, t.content);

  const preview = t.content.querySelector(
    '.publish-preview'
  );

  assert(preview.textContent.includes('950'));
  assert(preview.textContent.includes('Terraza'));
  assert(!preview.querySelector('script'));
  assert(!preview.querySelector('img'));

  console.log('OK  Vista previa y escapado HTML');
  t.close();
}

{
  const t = setup({
    type: 'external'
  });

  t.content.innerHTML = `
    <div class="imported-listing"></div>
  `;

  t.feature.renderPublishPreview(
    'external',
    2,
    t.content
  );

  assert(
    t.content.textContent.includes('FUENTE EXTERNA')
  );

  console.log('OK  Vista previa externa');
  t.close();
}

console.log('\nROOMS PUBLISH COMPOSER FEATURE OK');
