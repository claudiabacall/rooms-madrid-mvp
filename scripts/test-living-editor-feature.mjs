import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';


function assertSameData(actual, expected) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(actual)),
    JSON.parse(JSON.stringify(expected))
  );
}


const featurePath =
  'assets/js/features/living-editor.js';

const source = fs.readFileSync(
  featurePath, 'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const html = fs.readFileSync(
  'index.html', 'utf8'
);

console.log('\n=== LIVING EDITOR V2 ===');

assert(html.includes(featurePath));
assert(
  html.indexOf(featurePath) <
  html.indexOf('assets/js/supabase-app.js')
);
assert(
  app.includes('ROOMS_LIVING_EDITOR_FEATURE?.create')
);
assert(!source.includes(".from('match_preferences')"));
assert(!source.includes('state.matchPreferences'));

console.log('OK  Integracion sin escritura V1');

const dom = new JSDOM(
  `<!doctype html><body>
    <button data-open-living-editor>Editar</button>
  </body>`,
  {
    url: 'http://127.0.0.1/',
    runScripts: 'outside-only'
  }
);

const { window } = dom;
const { document } = window;

for (const path of [
  'assets/js/rooms-dna-v2-config.js',
  'assets/js/rooms-dna-engine.js',
  'assets/js/rooms-dna-archetypes.js',
  featurePath
]) {
  window.eval(fs.readFileSync(path, 'utf8'));
}

const config = window.ROOMS_DNA_V2;
const engine = window.ROOMS_DNA_ENGINE;
const archetypes = window.ROOMS_DNA_ARCHETYPES;

const questions = config.interactions.filter(
  item => item.act === 'living'
);

assert.equal(questions.length, 4);

const answers = {};

for (const question of config.interactions) {
  if (question.type === 'priority_board') {
    answers[question.id] = question.options
      .filter(option => option.id.endsWith('_like'))
      .map(option => option.id);
  } else if (
    question.type === 'interest' ||
    question.type === 'self_reported_trait'
  ) {
    answers[question.id] = [
      question.options[0].id
    ];
  } else {
    answers[question.id] =
      question.options[0].id;
  }
}

assert.equal(Object.keys(answers).length, 10);

const initialDna = engine.calculate(
  answers, config
);

const initialClassification =
  archetypes.classify(initialDna);

assert(initialClassification.primary);
assert.equal(initialDna.ignoredAnswers.length, 0);

const state = {
  user: { id: 'user-test' },
  profile: { id: 'user-test' },
  preferences: { answers: {} },
  roomsDna: {
    user_id: 'user-test',
    revision: 0,
    model_version: 2,
    answers: structuredClone(answers),
    dimensions: initialDna.dimensions,
    categories: initialDna.categorical,
    classification: {
      primary: {
        id: initialClassification.primary.id
      }
    }
  }
};

const notifications = [];
let profileUpdates = 0;
let savedPayload = null;
let savedUser = null;
let failure = false;
let calls = 0;

const db = {
  from(table) {
    assert.equal(table, 'rooms_dna');

    return {
      update(payload) {
        calls++;
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
              ['user_id', 'user-test'],
              ['model_version', 2],
              ['revision', 0]
            ]);

            savedUser = filters[0][1];

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

const feature =
  window.ROOMS_LIVING_EDITOR_FEATURE.create({
    state,
    db,
    notify: message => notifications.push(message),
    updateOwnProfile: () => {
      profileUpdates++;
    }
  });

assert.equal(
  typeof feature.openLivingEditor,
  'function'
);

console.log('OK  Factory creada');

feature.openLivingEditor();

const modal = document.querySelector(
  '#livingEditorModal'
);

assert(modal);
assert(modal.classList.contains('open'));
assert.equal(
  modal.querySelectorAll('.living-editor-group').length,
  4
);

assert.equal(
  feature.ensureLivingEditorModal(),
  modal
);

console.log('OK  Cuatro preguntas V2 y modal unico');

for (const question of questions) {
  const buttons = [
    ...modal.querySelectorAll(
      '[data-living-v2-question]'
    )
  ].filter(button =>
    button.dataset.livingV2Question === question.id
  );

  assert.equal(
    buttons.length,
    question.options.length
  );

  const previous = buttons.find(button =>
    button.dataset.livingV2Option ===
      answers[question.id]
  );

  assert(previous);
  assert.equal(
    previous.getAttribute('aria-pressed'),
    'true'
  );

  const next = buttons[1];
  next.click();

  assert(next.classList.contains('active'));
  assert.equal(
    next.getAttribute('aria-pressed'),
    'true'
  );
}

console.log('OK  Recuperacion y edicion de respuestas');

const before = structuredClone(
  state.roomsDna.answers
);

const submit = async () => {
  modal.querySelector('#livingEditorForm')
    .dispatchEvent(new window.Event(
      'submit',
      { bubbles: true, cancelable: true }
    ));

  await new Promise(resolve =>
    setImmediate(resolve)
  );
};

await submit();

assert.equal(calls, 1);
assert.equal(savedUser, 'user-test');
assert.equal(profileUpdates, 1);

for (const question of questions) {
  assert.equal(
    savedPayload.answers[question.id],
    question.options[1].id
  );
}

for (const question of config.interactions) {
  if (question.act === 'living') continue;

  assertSameData(
    JSON.parse(JSON.stringify(savedPayload.answers[question.id])),
    JSON.parse(JSON.stringify(before[question.id]))
  );
}

console.log('OK  Solo cambian las cuatro respuestas LIVING');
console.log('OK  VIBE, HOME y WORLD conservados');

const expectedDna = engine.calculate(
  savedPayload.answers,
  config
);

const expectedClassification =
  archetypes.classify(expectedDna);

assertSameData(
  JSON.parse(JSON.stringify(savedPayload.dimensions)),
  JSON.parse(JSON.stringify(expectedDna.dimensions))
);

assertSameData(
  JSON.parse(JSON.stringify(savedPayload.categories)),
  JSON.parse(JSON.stringify(expectedDna.categorical))
);

assert.equal(
  savedPayload.classification.primary.id,
  expectedClassification.primary.id
);

assert(Array.isArray(savedPayload.evidence));
assert(savedPayload.calculated_at);

console.log('OK  Dimensiones recalculadas');
console.log('OK  Clasificacion y evidencias actualizadas');

assert.equal(
  state.roomsDna.answers.friends_tuesday,
  questions[0].options[1].id
);

assert.equal(modal.classList.contains('open'), false);
assert(notifications.includes('Rooms DNA actualizado'));

console.log('OK  Estado y perfil actualizados tras guardar');

feature.openLivingEditor();
failure = true;

const stateBeforeFailure =
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
  stateBeforeFailure
);

assert.equal(profileUpdates, 1);
assert(modal.classList.contains('open'));

assert(notifications.includes(
  'No se pudieron guardar tus hábitos'
));

console.log('OK  Error Supabase no modifica estado');

modal.querySelector('[data-close-living-editor]')
  .click();

assert.equal(modal.classList.contains('open'), false);
assert.equal(document.body.style.overflow, '');

console.log('OK  Cierre correcto');

state.roomsDna = null;

const modalCount =
  document.querySelectorAll('#livingEditorModal').length;

feature.openLivingEditor();

assert.equal(
  document.querySelectorAll('#livingEditorModal').length,
  modalCount
);

assert(!modal.classList.contains('open'));

assert(notifications.includes(
  'Completa primero tu ROOMS DNA V2'
));

console.log('OK  Sin DNA V2 no se abre editor');

dom.window.close();

console.log('\nROOMS LIVING EDITOR V2 OK');
