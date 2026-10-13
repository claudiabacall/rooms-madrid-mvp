import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';


function assertSameData(actual, expected) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(actual)),
    JSON.parse(JSON.stringify(expected))
  );
}


const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const startMarker =
  '  let savingHomePreferences = false;';

const endMarker =
  "  document.addEventListener('click', event => {\n    if (!event.target.closest('#trustRecommendations'))";

const start = app.indexOf(startMarker);
const end = app.indexOf(endMarker, start);

assert(start >= 0 && end > start);

const editorSource = app.slice(start, end);

assert(editorSource.includes(".from('rooms_dna')"));
assert(!editorSource.includes(".from('match_preferences')"));

console.log('\n=== HOME PREFERENCES DNA V2 ===');
console.log('OK  Editor V2 localizado');

const dom = new JSDOM(
  `<!doctype html><body>
    <button id="editHomePreferences">Editar vivienda</button>
  </body>`,
  {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  }
);

const { window } = dom;
const { document } = window;

for (const file of [
  'assets/js/rooms-dna-v2-config.js',
  'assets/js/rooms-dna-engine.js',
  'assets/js/rooms-dna-archetypes.js'
]) {
  window.eval(fs.readFileSync(file, 'utf8'));
}

const config = window.ROOMS_DNA_V2;
const engine = window.ROOMS_DNA_ENGINE;
const archetypes = window.ROOMS_DNA_ARCHETYPES;

const question = config.interactions.find(
  item => item.id === 'home_priorities'
);

assert(question);
assert.equal(question.items.length, 5);
assert.equal(question.levels.length, 3);

const initialAnswers = {};

for (const interaction of config.interactions) {
  if (interaction.id === 'home_priorities') {
    initialAnswers[interaction.id] =
      question.items.map(item =>
        `${item.id}_like`
      );
  } else if (
    interaction.type === 'interest' ||
    interaction.type === 'self_reported_trait'
  ) {
    initialAnswers[interaction.id] = [
      interaction.options[0].id
    ];
  } else {
    initialAnswers[interaction.id] =
      interaction.options[0].id;
  }
}

assert.equal(Object.keys(initialAnswers).length, 10);

const initialDna = engine.calculate(
  initialAnswers,
  config
);

assert.equal(initialDna.ignoredAnswers.length, 0);

const state = {
  user: { id: 'home-test-user' },
  profile: { id: 'home-test-user' },
  preferences: { answers: {} },
  roomsDna: {
    user_id: 'home-test-user',
    revision: 0,
    model_version: config.version,
    answers: structuredClone(initialAnswers),
    dimensions: initialDna.dimensions,
    categories: initialDna.categorical
  }
};

const notifications = [];
let profileUpdates = 0;
let writes = 0;
let savedPayload = null;
let failure = false;

const db = {
  from(table) {
    assert.equal(table, 'rooms_dna');

    return {
      update(payload) {
        writes++;
        savedPayload = payload;

        const filters = [];
        const query = {
          eq(column, value) {
            filters.push([column, value]);
            return query;
          },
          select() {
            return query;
          },
          async single() {
            assertSameData(filters, [
              ['user_id', 'home-test-user'],
              ['model_version', 2],
              ['revision', 0]
            ]);

            if (failure) {
              return {
                data: null,
                error: { message: 'Error simulado' }
              };
            }

            return {
              data: {
                ...state.roomsDna,
                ...payload,
                revision: state.roomsDna.revision + 1
              },
              error: null
            };
          }
        };

        return query;
      }
    };
  }
};

const createEditor = window.eval(
  `(function(state, db, notify, updateOwnProfile) {
    ${editorSource}
    return {
      ensureHomePreferencesModal,
      openHomePreferencesEditor
    };
  })`
);

const editor = createEditor(
  state,
  db,
  message => notifications.push(message),
  () => { profileUpdates++; }
);

editor.openHomePreferencesEditor();

const modal = document.querySelector(
  '#homePreferencesModal'
);

assert(modal);
assert(modal.classList.contains('open'));

assert.equal(
  modal.querySelectorAll('.living-editor-group').length,
  5
);

assert.equal(
  modal.querySelectorAll('[data-home-v2-item]').length,
  15
);

assert.equal(
  editor.ensureHomePreferencesModal(),
  modal
);

console.log('OK  Cinco caracteristicas y quince opciones');
console.log('OK  Modal reutilizable');

for (const item of question.items) {
  const buttons = [
    ...modal.querySelectorAll(
      '[data-home-v2-item]'
    )
  ].filter(button =>
    button.dataset.homeV2Item === item.id
  );

  assert.equal(buttons.length, 3);

  const initial = buttons.find(
    button => button.dataset.homeV2Level === 'like'
  );

  assert.equal(
    initial.getAttribute('aria-pressed'),
    'true'
  );

  const next = buttons.find(
    button => button.dataset.homeV2Level === 'need'
  );

  next.click();

  assert(next.classList.contains('active'));
  assert.equal(
    next.getAttribute('aria-pressed'),
    'true'
  );

  assert.equal(
    buttons.filter(button =>
      button.classList.contains('active')
    ).length,
    1
  );
}

console.log('OK  Seleccion exclusiva por caracteristica');

const previousAnswers =
  structuredClone(state.roomsDna.answers);

async function submit() {
  modal.querySelector('#homePreferencesForm')
    .dispatchEvent(new window.Event('submit', {
      bubbles: true,
      cancelable: true
    }));

  await new Promise(resolve => setImmediate(resolve));
}

await submit();

assert.equal(writes, 1);
assert.equal(profileUpdates, 1);

assertSameData(
  Array.from(savedPayload.answers.home_priorities),
  Array.from(question.items, item => `${item.id}_need`)
);

for (const interaction of config.interactions) {
  if (interaction.id === 'home_priorities') continue;

  assertSameData(
    savedPayload.answers[interaction.id],
    previousAnswers[interaction.id]
  );
}

console.log('OK  Cinco prioridades actualizadas');
console.log('OK  Otras nueve interacciones conservadas');

const expectedDna = engine.calculate(
  savedPayload.answers,
  config
);

const expectedClassification =
  archetypes.classify(expectedDna);

const normalized = value =>
  JSON.parse(JSON.stringify(value));

assertSameData(
  normalized(savedPayload.dimensions),
  normalized(expectedDna.dimensions)
);

assertSameData(
  normalized(savedPayload.categories),
  normalized(expectedDna.categorical)
);

assert.equal(
  savedPayload.classification.primary.id,
  expectedClassification.primary.id
);

assert(Array.isArray(savedPayload.evidence));
assert(savedPayload.calculated_at);
assert(savedPayload.updated_at);

console.log('OK  Dimensiones y categorias recalculadas');
console.log('OK  Arquetipo y evidencias actualizados');

assertSameData(
  Array.from(state.roomsDna.answers.home_priorities),
  Array.from(question.items, item => `${item.id}_need`)
);

assert.equal(modal.classList.contains('open'), false);
assert(notifications.includes('Preferencias actualizadas'));

console.log('OK  Estado actualizado tras persistencia');

editor.openHomePreferencesEditor();

failure = true;

const previousState =
  JSON.stringify(state.roomsDna);

const originalError = console.error;
console.error = () => {};

try {
  await submit();
} finally {
  console.error = originalError;
}

assert.equal(
  JSON.stringify(state.roomsDna),
  previousState
);

assert.equal(profileUpdates, 1);
assert(modal.classList.contains('open'));

assert(
  notifications.includes(
    'No se pudieron guardar tus preferencias'
  )
);

console.log('OK  Error Supabase conserva estado');

modal.querySelector('[data-close-home-preferences]')
  .click();

assert(!modal.classList.contains('open'));
assert.equal(document.body.style.overflow, '');

console.log('OK  Cierre del editor');

state.roomsDna = null;

editor.openHomePreferencesEditor();

assert(!modal.classList.contains('open'));

assert(
  notifications.includes(
    'Completa primero tu ROOMS DNA V2'
  )
);

console.log('OK  Sin DNA V2 no se permite editar');

dom.window.close();

console.log('\nROOMS HOME PREFERENCES V2 OK');
