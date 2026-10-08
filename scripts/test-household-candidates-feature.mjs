import fs from 'node:fs';
import { JSDOM } from 'jsdom';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function ok(message) {
  console.log(`OK  ${message}`);
}

const featureSource =
  fs.readFileSync(
    'assets/js/features/household-candidates.js',
    'utf8'
  );

const appSource =
  fs.readFileSync(
    'assets/js/supabase-app.js',
    'utf8'
  );

const htmlSource =
  fs.readFileSync(
    'index.html',
    'utf8'
  );


console.log(
  '\n=== HOUSEHOLD CANDIDATES · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/household-candidates.js'
  ),
  'index no carga Household Candidates'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/household-candidates.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'Household Candidates debe cargar antes del monolito'
);

assert(
  appSource.includes(
    'window.ROOMS_HOUSEHOLD_CANDIDATES_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Household Candidates'
);

assert(
  appSource.includes(
    'let loadHouseholdCandidatesImpl ='
  ),
  'Falta bridge loadHouseholdCandidates'
);

assert(
  /async\s+function\s+loadHouseholdCandidates\s*\(\.\.\.args\)/.test(
    appSource
  ),
  'Falta función bridge loadHouseholdCandidates'
);

for (const fn of [
  'addPersonToHousehold',
  'renderHouseholdCandidates',
  'getHouseholdVoteSummary',
  'renderHouseholdVoteControls',
  'voteHouseholdCandidate',
  'removeHouseholdPersonCandidate',
  'removeHouseholdCandidate'
]) {
  const regex =
    new RegExp(
      `(?:async\\s+)?function\\s+${fn}\\s*\\(`
    );

  assert(
    !regex.test(appSource),
    `${fn} sigue duplicada en supabase-app.js`
  );

  assert(
    regex.test(featureSource),
    `${fn} no está en household-candidates.js`
  );
}

assert(
  /async\s+function\s+loadHouseholdCandidates\s*\(\)/.test(
    featureSource
  ),
  'La implementación loadHouseholdCandidates falta en la feature'
);

const createSource = fs.readFileSync(
  'assets/js/features/household-create.js',
  'utf8'
);

assert(
  !/async\s+function\s+createHousehold\s*\(/.test(appSource),
  'createHousehold sigue duplicada en el monolito'
);

assert(
  /async\s+function\s+createHousehold\s*\(/.test(createSource),
  'Falta createHousehold en su modulo'
);

assert(
  htmlSource.includes(
    'assets/js/features/household-create.js'
  ),
  'index no carga Household Create'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/household-create.js'
  ) < htmlSource.indexOf(
    'assets/js/supabase-app.js'
  ),
  'Household Create debe cargar antes del monolito'
);

assert(
  appSource.includes(
    'window.ROOMS_HOUSEHOLD_CREATE_FEATURE?.create'
  ),
  'Falta inicializacion de Household Create'
);

assert(
  appSource.includes(
    ".addEventListener('submit', createHousehold)"
  ),
  'Formulario Household desconectado'
);

ok(
  'Candidates separado con bridge estable'
);


console.log(
  '\n=== HOUSEHOLD CANDIDATES · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <section
          data-real-household-panel="candidates">
        </section>
      </body>
    </html>`,
    {
      runScripts:
        'outside-only',

      url:
        'http://127.0.0.1/'
    }
  );

const { window } = dom;

window.eval(
  featureSource
);

assert(
  window.ROOMS_HOUSEHOLD_CANDIDATES_FEATURE?.create,
  'Feature no expone factory'
);

ok(
  'Factory disponible'
);


console.log(
  '\n=== HOUSEHOLD CANDIDATES · FIXTURES ==='
);

const notifications = [];

let searchGroupRenders = 0;

const state = {
  user: {
    id: 'user-me'
  },

  household: {
    id: 'house-1',
    name: 'Chamberí Crew'
  },

  householdCandidates: [],
  householdPersonCandidates: [],
  householdCandidateVotes: [],

  profiles:
    new Map([
      [
        'person-1',
        {
          id: 'person-1',
          alias: 'Ana',
          seeking: [
            'room'
          ],
          bio: 'Buscando piso'
        }
      ]
    ])
};

const results = {
  household_candidates: {
    data: [],
    error: null
  },

  household_person_candidates: {
    data: [],
    error: null
  },

  household_candidate_votes: {
    data: [],
    error: null
  }
};

const writes = [];

function queryFor(table) {
  const context = {
    table,
    operation: 'select',
    payload: null,
    filters: []
  };

  const builder = {
    select() {
      return builder;
    },

    eq(field, value) {
      context.filters.push([
        field,
        value
      ]);

      return builder;
    },

    order() {
      return builder;
    },

    insert(payload) {
      context.operation = 'insert';
      context.payload = payload;

      writes.push({
        table,
        operation: 'insert',
        payload
      });

      return Promise.resolve({
        error: null
      });
    },

    upsert(payload) {
      context.operation = 'upsert';
      context.payload = payload;

      writes.push({
        table,
        operation: 'upsert',
        payload
      });

      return Promise.resolve({
        error: null
      });
    },

    delete() {
      context.operation = 'delete';

      return builder;
    },

    then(resolve, reject) {
      if (
        context.operation === 'delete'
      ) {
        writes.push({
          table,
          operation: 'delete',
          filters:
            context.filters
        });

        return Promise.resolve({
          data: [
            {
              user_id:
                'person-1'
            }
          ],
          error: null
        }).then(
          resolve,
          reject
        );
      }

      return Promise.resolve(
        results[table] || {
          data: [],
          error: null
        }
      ).then(
        resolve,
        reject
      );
    }
  };

  return builder;
}

const db = {
  from(table) {
    return queryFor(
      table
    );
  }
};

const feature =
  window
    .ROOMS_HOUSEHOLD_CANDIDATES_FEATURE
    .create({
      db,
      state,

      notify(message) {
        notifications.push(
          message
        );
      },

      escapeHtml(value) {
        return String(
          value ?? ''
        )
          .replaceAll(
            '&',
            '&amp;'
          )
          .replaceAll(
            '<',
            '&lt;'
          )
          .replaceAll(
            '>',
            '&gt;'
          )
          .replaceAll(
            '"',
            '&quot;'
          );
      },

      initials(name) {
        return String(name || '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(
            part =>
              part[0]
          )
          .join('')
          .toUpperCase();
      },

      labelSeeking(value) {
        return (
          value === 'room'
            ? 'Habitación'
            : String(value || '')
        );
      },

      renderSearchGroupsHome() {
        searchGroupRenders += 1;
      }
    });

assert(
  feature?.loadHouseholdCandidates,
  'Falta loadHouseholdCandidates'
);

assert(
  feature?.voteHouseholdCandidate,
  'Falta voteHouseholdCandidate'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== HOUSEHOLD CANDIDATES · LOAD EMPTY ==='
);

await feature.loadHouseholdCandidates();

assert(
  Array.isArray(
    state.householdCandidates
  ),
  'householdCandidates debe ser array'
);

assert(
  state.householdCandidates.length ===
    0,
  'Homes debería estar vacío'
);

assert(
  Array.isArray(
    state.householdPersonCandidates
  ),
  'householdPersonCandidates debe ser array'
);

assert(
  state.householdPersonCandidates.length ===
    0,
  'People debería estar vacío'
);

assert(
  Array.isArray(
    state.householdCandidateVotes
  ),
  'Votes debe ser array'
);

assert(
  searchGroupRenders ===
    1,
  'Load debe refrescar Search Groups'
);

ok(
  'Carga vacía correcta'
);


console.log(
  '\n=== HOUSEHOLD CANDIDATES · VOTE SUMMARY ==='
);

state.householdCandidateVotes = [
  {
    candidate_type:
      'person',

    candidate_id:
      'person-1',

    user_id:
      'user-me',

    vote:
      'like'
  },

  {
    candidate_type:
      'person',

    candidate_id:
      'person-1',

    user_id:
      'other',

    vote:
      'maybe'
  }
];

const summary =
  feature.getHouseholdVoteSummary(
    'person',
    'person-1'
  );

assert(
  summary.like === 1,
  'Like count incorrecto'
);

assert(
  summary.maybe === 1,
  'Maybe count incorrecto'
);

assert(
  summary.dislike === 0,
  'Dislike count incorrecto'
);

assert(
  summary.mine ===
    'like',
  'Mine incorrecto'
);

ok(
  'Resumen de votos correcto'
);


console.log(
  '\n=== HOUSEHOLD CANDIDATES · VOTE CONTROLS ==='
);

const controls =
  feature.renderHouseholdVoteControls(
    'person',
    'person-1'
  );

assert(
  controls.includes(
    'data-household-vote="like"'
  ),
  'Falta botón like'
);

assert(
  controls.includes(
    'data-household-vote="maybe"'
  ),
  'Falta botón maybe'
);

assert(
  controls.includes(
    'data-household-vote="dislike"'
  ),
  'Falta botón dislike'
);

assert(
  controls.includes(
    'class="active"'
  ),
  'Voto propio debe aparecer activo'
);

ok(
  'Controles de voto correctos'
);


console.log(
  '\n=== HOUSEHOLD CANDIDATES · ADD PERSON ==='
);

const writesBeforeAdd =
  writes.length;

await feature.addPersonToHousehold(
  'person-1'
);

assert(
  writes.length ===
    writesBeforeAdd + 1,
  'Añadir persona debe escribir DB'
);

assert(
  writes.at(-1).table ===
    'household_person_candidates',
  'Tabla add person incorrecta'
);

assert(
  writes.at(-1).payload.household_id ===
    'house-1',
  'household_id add person incorrecto'
);

assert(
  writes.at(-1).payload.user_id ===
    'person-1',
  'user_id add person incorrecto'
);

assert(
  notifications.at(-1) ===
    'Persona añadida a vuestro Hogar',
  'Mensaje add person incorrecto'
);

ok(
  'Añadir persona correcto'
);


console.log(
  '\n=== HOUSEHOLD CANDIDATES · SELF ==='
);

const writesBeforeSelf =
  writes.length;

await feature.addPersonToHousehold(
  'user-me'
);

assert(
  writes.length ===
    writesBeforeSelf,
  'Self no debe escribir DB'
);

assert(
  notifications.at(-1) ===
    'No puedes añadirte a ti misma',
  'Mensaje self incorrecto'
);

ok(
  'Self controlado'
);


console.log(
  '\n=== HOUSEHOLD CANDIDATES · RENDER EMPTY ==='
);

state.householdCandidates =
  [];

state.householdPersonCandidates =
  [];

feature.renderHouseholdCandidates();

const panel =
  window.document.querySelector(
    '[data-real-household-panel="candidates"]'
  );

assert(
  panel,
  'Falta panel Candidates'
);

assert(
  panel.innerHTML.length >
    0,
  'Render vacío debe generar contenido'
);

ok(
  'Render vacío correcto'
);


console.log(
  '\nROOMS HOUSEHOLD CANDIDATES FEATURE OK'
);
