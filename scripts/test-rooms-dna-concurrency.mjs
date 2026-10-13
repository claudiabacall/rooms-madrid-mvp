import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  `<!doctype html><body>
    <button id="editHomePreferences">Home</button>
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
  'assets/js/rooms-dna-archetypes.js',
  'assets/js/features/living-editor.js'
]) {
  window.eval(fs.readFileSync(file, 'utf8'));
}

const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const start = app.indexOf(
  '  let savingHomePreferences = false;'
);

const end = app.indexOf(
  "  document.addEventListener('click', event => {\n    if (!event.target.closest('#trustRecommendations'))",
  start
);

assert(start >= 0 && end > start);

const homeSource = app.slice(start, end);
const config = window.ROOMS_DNA_V2;

const answers = {};

for (const question of config.interactions) {
  if (question.type === 'priority_board') {
    answers[question.id] = question.items.map(
      item => `${item.id}_like`
    );
  } else if (
    question.type === 'interest' ||
    question.type === 'self_reported_trait'
  ) {
    answers[question.id] = [
      question.options[0].id
    ];
  } else {
    answers[question.id] = question.options[0].id;
  }
}

const copy = value =>
  JSON.parse(JSON.stringify(value));

const initial = {
  user_id: 'test-concurrency',
  model_version: 2,
  revision: 0,
  answers: copy(answers)
};

let server = copy(initial);

const state = {
  user: { id: initial.user_id },
  profile: { id: initial.user_id },
  preferences: { answers: {} },
  roomsDna: copy(initial)
};

const notifications = [];
const writes = [];
let profileUpdates = 0;

const db = {
  from(table) {
    assert.equal(table, 'rooms_dna');

    return {
      update(payload) {
        const filters = [];

        const query = {
          eq(key, value) {
            filters.push([key, value]);
            return query;
          },
          select() {
            return query;
          },
          async single() {
            const values = Object.fromEntries(filters);

            assert.equal(
              values.user_id, initial.user_id
            );
            assert.equal(values.model_version, 2);
            assert(
              Number.isSafeInteger(values.revision),
              'Falta revision en el update'
            );

            writes.push({
              revision: values.revision,
              accepted: values.revision === server.revision
            });

            if (values.revision !== server.revision) {
              return {
                data: null,
                error: {
                  code: 'PGRST116',
                  message: 'No matching row'
                }
              };
            }

            server = {
              ...server,
              ...copy(payload),
              revision: server.revision + 1
            };

            return {
              data: copy(server),
              error: null
            };
          }
        };

        return query;
      }
    };
  }
};

const notify = message =>
  notifications.push(message);

const updateOwnProfile = () => {
  profileUpdates++;
};

const living =
  window.ROOMS_LIVING_EDITOR_FEATURE.create({
    state,
    db,
    notify,
    updateOwnProfile
  });

const createHome = window.eval(
  `(function(state, db, notify, updateOwnProfile) {
    ${homeSource}
    return { openHomePreferencesEditor };
  })`
);

const home = createHome(
  state, db, notify, updateOwnProfile
);

const flush = () =>
  new Promise(resolve => setImmediate(resolve));

async function submit(selector) {
  document.querySelector(selector).dispatchEvent(
    new window.Event('submit', {
      bubbles: true,
      cancelable: true
    })
  );
  await flush();
}

console.log('\n=== ROOMS DNA V2 CONCURRENCY ===');

// Ambos editores parten de revision 0.
living.openLivingEditor();
home.openHomePreferencesEditor();

const livingButton = [
  ...document.querySelectorAll(
    '[data-living-v2-question]'
  )
].find(button => {
  const question = config.interactions.find(
    q => q.id === button.dataset.livingV2Question
  );
  return button.dataset.livingV2Option ===
    question?.options?.[1]?.id;
});

assert(livingButton);
livingButton.click();

await submit('#livingEditorForm');

assert.equal(server.revision, 1);
assert.equal(state.roomsDna.revision, 1);
assert.equal(writes.length, 1);
assert.equal(profileUpdates, 1);

console.log('OK  Living guarda revision 0 -> 1');

// Home sigue abierto con revision 0.
// No puede sobrescribir los cambios de Living.
await submit('#homePreferencesForm');

assert.equal(server.revision, 1);
assert.equal(state.roomsDna.revision, 1);
assert.equal(writes.length, 1);
assert.equal(profileUpdates, 1);

console.log('OK  Home abierto antes no sobrescribe Living');

// Ahora Home se reabre sobre revision 1.
home.openHomePreferencesEditor();

// Otra pestaña actualiza el servidor a revision 2.
// El estado de esta pestaña sigue en revision 1.
server = {
  ...server,
  revision: 2,
  answers: {
    ...server.answers,
    world_interests: [
      config.interactions
        .find(item => item.id === 'world_interests')
        .options.at(-1).id
    ]
  }
};

const stateBeforeConflict = copy(state.roomsDna);
const originalError = console.error;
console.error = () => {};

try {
  await submit('#homePreferencesForm');
} finally {
  console.error = originalError;
}

assert.equal(writes.length, 2);
assert.equal(writes[1].revision, 1);
assert.equal(writes[1].accepted, false);
assert.equal(server.revision, 2);
assert.deepEqual(
  copy(state.roomsDna),
  stateBeforeConflict
);
assert.equal(profileUpdates, 1);

console.log('OK  Supabase simulado rechaza revision obsoleta');
console.log('OK  Conflicto no modifica estado local');
console.log('OK  Cambios de otra pestaña conservados');

// Sincronizamos el estado como ocurriria tras
// recargar los datos desde Supabase.
state.roomsDna = copy(server);
home.openHomePreferencesEditor();

await submit('#homePreferencesForm');

assert.equal(server.revision, 3);
assert.equal(state.roomsDna.revision, 3);
assert.equal(writes.length, 3);
assert.equal(writes[2].accepted, true);
assert.equal(profileUpdates, 2);

assert.equal(
  server.answers.world_interests[0],
  config.interactions
    .find(item => item.id === 'world_interests')
    .options.at(-1).id
);

console.log('OK  Recarga permite guardar revision nueva');
console.log('OK  Respuestas ajenas conservadas');

assert(
  notifications.some(message =>
    message.toLowerCase().includes('reabre')
  ),
  'Falta aviso de revision obsoleta'
);

console.log('OK  Usuario informado del conflicto');

dom.window.close();

console.log('\nROOMS DNA CONCURRENCY OK');
