import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const path = 'assets/js/features/living-editor.js';
const source = fs.readFileSync(path, 'utf8');
const app = fs.readFileSync('assets/js/supabase-app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== LIVING EDITOR ===');

assert(html.includes(`src="${path}"`));
assert(html.indexOf(path) < html.indexOf('assets/js/supabase-app.js'));
assert(app.includes('ROOMS_LIVING_EDITOR_FEATURE?.create'));
assert(!/function\s+ensureLivingEditorModal\s*\(/.test(app));
assert(!/function\s+openLivingEditor\s*\(/.test(app));

console.log('OK  Extraccion e integracion');

const dom = new JSDOM(`
  <!doctype html>
  <body>
    <button data-open-living-editor>Editar convivencia</button>
  </body>
`, {
  url: 'http://127.0.0.1/',
  runScripts: 'outside-only'
});

const { window } = dom;
const { document } = window;

window.ROOMS_DNA = {
  thisOrThat: [{
    id: 'social',
    target: 'living_self',
    title: 'Vida social',
    left: { id: 'quiet', label: 'Tranquilo' },
    right: { id: 'social', label: 'Social' }
  }],
  scenarios: [{
    id: 'cleaning',
    title: 'Limpieza'
  }],
  scenarioScale: [
    { id: 'low', label: 'Flexible' },
    { id: 'high', label: 'Estricto' }
  ],
  dynamicImportance: [{
    id: 'noise',
    prompt: 'Importancia del ruido'
  }],
  importanceScale: [
    { id: 'low', label: 'Poca' },
    { id: 'high', label: 'Mucha' }
  ],
  dealbreakers: [{
    id: 'smoking',
    label: 'Fumar'
  }],
  dealbreakerScale: [
    { id: 'adapt', label: 'Me adapto' },
    { id: 'dealbreaker', label: 'Imprescindible' }
  ]
};

const state = {
  user: null,
  profile: { id: 'user-1' },
  preferences: {},
  matchPreferences: {
    living_self: {
      this_or_that: { social: 'quiet' },
      scenarios: { cleaning: 'low' }
    },
    living_importance: { noise: 'low' },
    dealbreakers: { smoking: false }
  }
};

let savedPayload = null;
let savedUser = null;
let shouldFail = false;
let profileUpdates = 0;
const notifications = [];

const db = {
  from(table) {
    assert.equal(table, 'match_preferences');
    return {
      update(payload) {
        savedPayload = payload;
        return {
          eq(column, value) {
            assert.equal(column, 'user_id');
            savedUser = value;
            return {
              select() {
                return {
                  async single() {
                    if (shouldFail) {
                      return {
                        data: null,
                        error: { message: 'test error' }
                      };
                    }

                    return {
                      data: {
                        ...state.matchPreferences,
                        ...payload
                      },
                      error: null
                    };
                  }
                };
              }
            };
          }
        };
      }
    };
  }
};

window.eval(source);

const feature = window.ROOMS_LIVING_EDITOR_FEATURE.create({
  state,
  db,
  notify: message => notifications.push(message),
  updateOwnProfile: () => { profileUpdates++; }
});

assert.equal(typeof feature.openLivingEditor, 'function');
assert.equal(typeof feature.ensureLivingEditorModal, 'function');

console.log('OK  Factory disponible');

feature.openLivingEditor();
assert.equal(document.querySelector('#livingEditorModal'), null);

console.log('OK  Usuario sin sesion protegido');

state.user = { id: 'user-1' };
feature.openLivingEditor();

const modal = document.querySelector('#livingEditorModal');

assert(modal);
assert(modal.classList.contains('open'));
assert.equal(modal.getAttribute('aria-hidden'), 'false');
assert.equal(document.body.style.overflow, 'hidden');

assert.equal(feature.ensureLivingEditorModal(), modal);
assert.equal(document.querySelectorAll('#livingEditorModal').length, 1);

console.log('OK  Apertura y modal reutilizable');

const selected = selector => modal.querySelector(selector);

assert.equal(
  selected('[data-living-dna-this="social"][data-living-dna-value="quiet"]')
    .getAttribute('aria-pressed'),
  'true'
);

assert.equal(
  selected('[data-living-dna-scenario="cleaning"][data-living-dna-value="low"]')
    .getAttribute('aria-pressed'),
  'true'
);

console.log('OK  Recuperacion de respuestas anteriores');

function click(selector) {
  const button = selected(selector);
  assert(button, `Boton no encontrado: ${selector}`);
  button.click();
  assert(button.classList.contains('active'));
}

click('[data-living-dna-this="social"][data-living-dna-value="social"]');
click('[data-living-dna-scenario="cleaning"][data-living-dna-value="high"]');
click('[data-living-dna-importance="noise"][data-living-dna-value="high"]');
click('[data-living-dna-dealbreaker="smoking"][data-living-dna-value="dealbreaker"]');

console.log('OK  Seleccion de respuestas');

const submit = async () => {
  modal.querySelector('#livingEditorForm')
    .dispatchEvent(new window.Event('submit', {
      bubbles: true,
      cancelable: true
    }));

  await new Promise(resolve => setImmediate(resolve));
};

await submit();

assert.equal(savedUser, 'user-1');
assert.equal(savedPayload.living_self.this_or_that.social, 'social');
assert.equal(savedPayload.living_self.scenarios.cleaning, 'high');
assert.equal(savedPayload.living_importance.noise, 'high');
assert.equal(savedPayload.dealbreakers.smoking, true);
assert(savedPayload.updated_at);
assert.equal(profileUpdates, 1);
assert.equal(modal.classList.contains('open'), false);
assert(notifications.includes('Rooms DNA actualizado'));

console.log('OK  Persistencia y actualizacion del perfil');

feature.openLivingEditor();
shouldFail = true;

const originalError = console.error;
console.error = () => {};

try {
  await submit();
} finally {
  console.error = originalError;
}

assert(modal.classList.contains('open'));
assert.equal(profileUpdates, 1);
assert(notifications.includes('No se pudieron guardar tus hábitos'));

console.log('OK  Error de Supabase controlado');

const close = modal.querySelector('[data-close-living-editor]');
close.click();

assert.equal(modal.classList.contains('open'), false);
assert.equal(modal.getAttribute('aria-hidden'), 'true');
assert.equal(document.body.style.overflow, '');

console.log('OK  Cierre del modal');

document.querySelector('[data-open-living-editor]').click();

assert(modal.classList.contains('open'));

console.log('OK  Evento de apertura conectado');

dom.window.close();

console.log('\nROOMS LIVING EDITOR FEATURE OK');
