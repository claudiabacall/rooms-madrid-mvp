import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/household-create.js', 'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== HOUSEHOLD CREATE ===');

assert(
  html.indexOf('features/household-create.js') <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_HOUSEHOLD_CREATE_FEATURE?.create')
);

assert(
  app.includes(".addEventListener('submit', createHousehold)")
);

assert(
  !/async function createHousehold\s*\(/.test(app)
);

console.log('OK  Integracion y carga correctas');

function setup({ failHousehold = false, failMember = false } = {}) {
  const dom = new JSDOM(`
    <body>
      <div id="createHouseholdModal" class="open"
        aria-hidden="false">
        <form id="createHouseholdForm">
          <input id="createHouseholdName" value="Hogar Test ROOMS">
          <button type="submit">Crear grupo</button>
        </form>
      </div>
    </body>
  `, {
    runScripts: 'outside-only',
    url: 'http://127.0.0.1/'
  });

  const { window } = dom;
  window.eval(source);

  const operations = [];
  const notifications = [];
  const renders = [];

  const state = {
    user: { id: 'user-123' },
    household: null,
    householdMembers: []
  };

  const db = {
    from(table) {
      return {
        insert(payload) {
          operations.push({ table, action: 'insert', payload });

          return Promise.resolve({
            error:
              table === 'households' && failHousehold
                ? { message: 'household error' }
                : table === 'household_members' && failMember
                  ? { message: 'member error' }
                  : null
          });
        },
        delete() {
          operations.push({ table, action: 'delete' });

          return {
            eq() {
              return {
                eq() {
                  return Promise.resolve({ error: null });
                }
              };
            }
          };
        }
      };
    }
  };

  const feature =
    window.ROOMS_HOUSEHOLD_CREATE_FEATURE.create({
      db,
      state,
      notify: message => notifications.push(message),
      renderRealHousehold: (...args) => renders.push(args)
    });

  const form = window.document.querySelector(
    '#createHouseholdForm'
  );

  return {
    window, feature, form, state,
    operations, notifications, renders
  };
}

async function run() {
  {
    const t = setup();

    await t.feature.createHousehold({
      preventDefault() {},
      currentTarget: t.form
    });

    assert.equal(t.operations.length, 2);
    assert.equal(t.operations[0].table, 'households');
    assert.equal(t.operations[1].table, 'household_members');

    assert.equal(
      t.operations[1].payload.household_id,
      t.operations[0].payload.id
    );

    assert.equal(t.state.household.name, 'Hogar Test ROOMS');
    assert.equal(t.state.householdMembers[0].role, 'owner');
    assert.equal(t.renders.length, 1);
    assert(t.notifications.includes('Hogar creado'));

    assert.equal(
      t.window.document.querySelector(
        '#createHouseholdModal'
      ).getAttribute('aria-hidden'),
      'true'
    );

    console.log('OK  Creacion completa');
    console.log('OK  Propietario vinculado');
    console.log('OK  Estado, render y modal correctos');
  }

  {
    const t = setup({ failHousehold: true });

    await t.feature.createHousehold({
      preventDefault() {},
      currentTarget: t.form
    });

    assert.equal(t.operations.length, 1);
    assert.equal(t.state.household, null);
    assert.equal(t.renders.length, 0);

    console.log('OK  Error creando Hogar controlado');
  }

  {
    const t = setup({ failMember: true });

    await t.feature.createHousehold({
      preventDefault() {},
      currentTarget: t.form
    });

    assert(
      t.operations.some(
        item => item.action === 'delete' &&
          item.table === 'households'
      )
    );

    assert.equal(t.state.household, null);
    assert.equal(t.renders.length, 0);

    console.log('OK  Rollback ante error de miembro');
  }

  {
    const t = setup();
    t.form.querySelector('#createHouseholdName').value = '   ';

    await t.feature.createHousehold({
      preventDefault() {},
      currentTarget: t.form
    });

    assert.equal(t.operations.length, 0);
    assert(
      t.notifications.includes('Pon un nombre a vuestro Hogar')
    );

    console.log('OK  Validacion de nombre vacio');
  }

  console.log('\nROOMS HOUSEHOLD CREATE FEATURE OK');
}

await run();
