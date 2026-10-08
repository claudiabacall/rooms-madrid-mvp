import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/household-core.js', 'utf8'
);
const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);
const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== HOUSEHOLD CORE ===');

assert(
  html.indexOf('features/household-core.js') !== -1 &&
  html.indexOf('features/household-core.js') <
  html.indexOf('assets/js/supabase-app.js')
);
assert(app.includes('ROOMS_HOUSEHOLD_CORE_FEATURE?.create'));

for (const name of [
  'renderEmptyHousehold',
  'renderSearchGroupsHome',
  'renderRealHousehold',
  'loadHousehold'
]) {
  assert(
    !new RegExp(
      `(?:async\\s+)?function\\s+${name}\\s*\\(`
    ).test(app),
    `${name} sigue en el monolito`
  );
  assert(
    new RegExp(
      `(?:async\\s+)?function\\s+${name}\\s*\\(`
    ).test(source),
    `${name} falta en Household Core`
  );
}

console.log('OK  Integracion y extraccion correctas');

function setup({
  memberships = [],
  owned = [],
  members = [],
  membersError = null
} = {}) {
  const dom = new JSDOM(`
    <body>
      <div id="searchGroupsGrid"></div>
      <main id="householdView"></main>
    </body>
  `, {
    runScripts: 'outside-only',
    url: 'http://127.0.0.1/'
  });

  const { window } = dom;
  window.eval(source);

  const queries = [];
  let candidateLoads = 0;

  const state = {
    user: { id: 'user-1' },
    household: null,
    households: [],
    householdMembers: [],
    householdMembersError: false,
    householdCandidates: [],
    householdPersonCandidates: [],
    householdCandidateVotes: []
  };

  const db = {
    from(table) {
      const query = {
        select() { return this; },
        eq(field, value) {
          queries.push({ table, field, value });
          return this;
        },
        in() { return this; },
        order() {
          if (table === 'household_members') {
            return Promise.resolve({
              data: memberships, error: null
            });
          }

          if (table === 'households') {
            const ownerQuery = queries.some(
              item =>
                item.table === 'households' &&
                item.field === 'owner_id'
            );

            return Promise.resolve({
              data: ownerQuery ? owned : memberships.map(
                item => ({
                  id: item.household_id,
                  name: 'Grupo compartido',
                  owner_id: 'other-user',
                  created_at: '2026-10-01'
                })
              ),
              error: null
            });
          }
        }
      };
      return query;
    },
    rpc() {
      return Promise.resolve({
        data: members,
        error: membersError
      });
    }
  };

  const feature = window.ROOMS_HOUSEHOLD_CORE_FEATURE.create({
    db,
    state,
    escapeHtml: value => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('"', '&quot;'),
    initials: name => name.slice(0, 1).toUpperCase(),
    loadHouseholdCandidates: async () => {
      candidateLoads++;
    }
  });

  return {
    window, feature, state, queries,
    get candidateLoads() { return candidateLoads; }
  };
}

async function run() {
  {
    const t = setup();
    await t.feature.loadHousehold();

    assert.equal(t.state.household, null);
    assert(
      t.window.document.querySelector('#householdView')
        .textContent.includes('Crea un Hogar')
    );
    assert.equal(t.candidateLoads, 0);
    console.log('OK  Estado sin Hogares');
  }

  {
    const t = setup({
      owned: [{
        id: 'home-1',
        name: 'Nuestro Hogar',
        owner_id: 'user-1',
        created_at: '2026-10-01'
      }],
      members: [{
        user_id: 'user-1',
        name: 'Claudia',
        role: 'owner'
      }]
    });

    await t.feature.loadHousehold();

    assert.equal(t.state.household.id, 'home-1');
    assert.equal(t.state.householdMembers.length, 1);
    assert.equal(t.candidateLoads, 1);

    const view = t.window.document.querySelector('#householdView');
    assert(view.textContent.includes('Nuestro Hogar'));
    assert(view.textContent.includes('Claudia'));
    assert(view.querySelector('#inviteRealHousehold'));

    console.log('OK  Carga de Hogar propietario');
    console.log('OK  Miembros y render correctos');
    console.log('OK  Candidates conectado');
  }

  {
    const t = setup({
      owned: [
        {
          id: 'home-1',
          name: 'Primer Hogar',
          owner_id: 'user-1',
          created_at: '2026-10-01'
        },
        {
          id: 'home-2',
          name: 'Segundo Hogar',
          owner_id: 'user-1',
          created_at: '2026-10-02'
        }
      ]
    });

    await t.feature.loadHousehold('home-2');

    assert.equal(t.state.household.id, 'home-2');

    console.log('OK  Seleccion de Hogar preferido');
  }

  {
    const t = setup({
      owned: [{
        id: 'home-1',
        name: 'Hogar con error',
        owner_id: 'user-1',
        created_at: '2026-10-01'
      }],
      membersError: { message: 'rpc error' }
    });

    await t.feature.loadHousehold();

    assert.equal(t.state.householdMembersError, true);
    assert.equal(t.state.householdMembers.length, 0);

    console.log('OK  Error de carga de miembros controlado');
  }

  console.log('\nROOMS HOUSEHOLD CORE FEATURE OK');
}

await run();
