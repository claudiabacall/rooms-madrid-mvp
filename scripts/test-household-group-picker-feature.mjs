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
    'assets/js/features/household-group-picker.js',
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

const candidatesSource =
  fs.readFileSync(
    'assets/js/features/household-candidates.js',
    'utf8'
  );


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/household-group-picker.js'
  ),
  'index.html no carga Household Group Picker'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/household-group-picker.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'Household Group Picker debe cargar antes del monolito'
);

assert(
  appSource.includes(
    'window.ROOMS_HOUSEHOLD_GROUP_PICKER_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Household Group Picker'
);

for (const fn of [
  'ensureGroupPickerModal',
  'openGroupPicker',
  'closeGroupPicker',
  'addListingToGroup',
  'addPersonToGroup',
  'addListingToHousehold'
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
    `${fn} no está en household-group-picker.js`
  );
}

assert(
  /async\s+function\s+loadHouseholdCandidates\s*\(\.\.\.args\)/.test(
    appSource
  ),
  'Debe permanecer el bridge loadHouseholdCandidates en supabase-app.js'
);

assert(
  /async\s+function\s+loadHouseholdCandidates\s*\(\)/.test(
    candidatesSource
  ),
  'La implementación loadHouseholdCandidates debe vivir en Household Candidates'
);

ok(
  'Group Picker separado de Household Candidates'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body></body>
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
  window.ROOMS_HOUSEHOLD_GROUP_PICKER_FEATURE?.create,
  'Feature no expone factory'
);

ok(
  'Factory disponible'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · FIXTURES ==='
);

const notifications = [];

let candidateReloads = 0;
let groupHomeRenders = 0;

const state = {
  user: {
    id: 'user-me'
  },

  households: [
    {
      id: 'house-1',
      name: 'Chamberí Crew'
    },
    {
      id: 'house-2',
      name: 'Malasaña'
    }
  ],

  household: {
    id: 'house-1',
    name: 'Chamberí Crew'
  },

  profiles:
    new Map([
      [
        'person-1',
        {
          id: 'person-1',
          alias: 'Ana'
        }
      ]
    ]),

  blockedUsers:
    new Set(),

  pendingGroupCandidate:
    null
};

let nextDbError = null;
const inserts = [];

const db = {
  from(table) {
    return {
      insert(payload) {
        inserts.push({
          table,
          payload
        });

        return Promise.resolve({
          error: nextDbError
        });
      }
    };
  }
};

const feature =
  window
    .ROOMS_HOUSEHOLD_GROUP_PICKER_FEATURE
    .create({
      db,
      state,

      notify(message) {
        notifications.push(message);
      },

      escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
      },

      async loadHouseholdCandidates() {
        candidateReloads += 1;
      },

      renderSearchGroupsHome() {
        groupHomeRenders += 1;
      }
    });

assert(
  feature?.openGroupPicker,
  'Falta openGroupPicker'
);

assert(
  feature?.addPersonToGroup,
  'Falta addPersonToGroup'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · OPEN ==='
);

feature.openGroupPicker(
  'person',
  'person-1'
);

const modal =
  window.document.querySelector(
    '#groupPickerModal'
  );

assert(
  modal,
  'No se crea groupPickerModal'
);

assert(
  modal.classList.contains('open'),
  'Modal no se abre'
);

assert(
  state.pendingGroupCandidate?.type ===
    'person',
  'No guarda candidate type'
);

assert(
  state.pendingGroupCandidate?.id ===
    'person-1',
  'No guarda candidate id'
);

assert(
  modal.querySelectorAll(
    '[data-pick-group]'
  ).length ===
    2,
  'No renderiza todos los grupos'
);

assert(
  window.document.body.style.overflow ===
    'hidden',
  'Modal abierto debe bloquear scroll'
);

ok(
  'Apertura y render de grupos correctos'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · CLOSE ==='
);

feature.closeGroupPicker();

assert(
  !modal.classList.contains('open'),
  'Modal no se cierra'
);

assert(
  modal.getAttribute('aria-hidden') ===
    'true',
  'Modal cerrado debe quedar aria-hidden'
);

assert(
  window.document.body.style.overflow ===
    '',
  'Cerrar modal debe restaurar scroll'
);

ok(
  'Cierre correcto'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · SIN GRUPOS ==='
);

const householdsBackup =
  state.households;

state.households = [];

const notificationsBeforeEmpty =
  notifications.length;

feature.openGroupPicker(
  'listing',
  'listing-1'
);

assert(
  notifications.length ===
    notificationsBeforeEmpty + 1,
  'Sin grupos debe notificar'
);

assert(
  notifications.at(-1) ===
    'Crea primero un grupo de búsqueda',
  'Mensaje sin grupos incorrecto'
);

state.households =
  householdsBackup;

ok(
  'Sin grupos controlado'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · ADD LISTING ==='
);

nextDbError = null;

const listingReloadsBefore =
  candidateReloads;

await feature.addListingToGroup(
  'listing-1',
  'house-1'
);

assert(
  inserts.at(-1).table ===
    'household_candidates',
  'Tabla de listing incorrecta'
);

assert(
  inserts.at(-1).payload.household_id ===
    'house-1',
  'household_id incorrecto'
);

assert(
  inserts.at(-1).payload.listing_id ===
    'listing-1',
  'listing_id incorrecto'
);

assert(
  candidateReloads ===
    listingReloadsBefore + 1,
  'Grupo activo debe refrescar candidatos'
);

assert(
  notifications.at(-1) ===
    'Vivienda añadida al grupo',
  'Mensaje listing incorrecto'
);

ok(
  'Añadir vivienda correcto'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · DUPLICATE LISTING ==='
);

nextDbError = {
  code: '23505'
};

const reloadsBeforeDuplicate =
  candidateReloads;

await feature.addListingToGroup(
  'listing-1',
  'house-1'
);

assert(
  notifications.at(-1) ===
    'Esta vivienda ya está en ese grupo',
  'Duplicado listing no controlado'
);

assert(
  candidateReloads ===
    reloadsBeforeDuplicate,
  'Duplicado no debe refrescar candidatos'
);

nextDbError = null;

ok(
  'Duplicado vivienda controlado'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · ADD PERSON ==='
);

const rendersBeforePerson =
  groupHomeRenders;

const reloadsBeforePerson =
  candidateReloads;

const personResult =
  await feature.addPersonToGroup(
    'person-1',
    'house-1'
  );

assert(
  personResult === true,
  'Añadir persona debe devolver true'
);

assert(
  inserts.at(-1).table ===
    'household_person_candidates',
  'Tabla de person incorrecta'
);

assert(
  inserts.at(-1).payload.user_id ===
    'person-1',
  'user_id incorrecto'
);

assert(
  candidateReloads ===
    reloadsBeforePerson + 1,
  'Persona en grupo activo debe refrescar candidatos'
);

assert(
  groupHomeRenders ===
    rendersBeforePerson + 1,
  'Añadir persona debe refrescar tarjetas de grupos'
);

assert(
  notifications.at(-1) ===
    'Ana añadida a Chamberí Crew',
  'Mensaje de persona incorrecto'
);

ok(
  'Añadir persona correcto'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · BLOCKED PERSON ==='
);

state.blockedUsers.add(
  'blocked-1'
);

const insertsBeforeBlocked =
  inserts.length;

const blockedResult =
  await feature.addPersonToGroup(
    'blocked-1',
    'house-1'
  );

assert(
  blockedResult === false,
  'Usuario bloqueado debe devolver false'
);

assert(
  inserts.length ===
    insertsBeforeBlocked,
  'Usuario bloqueado no debe escribir DB'
);

assert(
  notifications.at(-1) ===
    'No puedes añadir a un usuario bloqueado.',
  'Mensaje bloqueado incorrecto'
);

ok(
  'Usuario bloqueado controlado'
);


console.log(
  '\n=== HOUSEHOLD GROUP PICKER · SELF ==='
);

const selfResult =
  await feature.addPersonToGroup(
    'user-me',
    'house-1'
  );

assert(
  selfResult === false,
  'No debe permitir añadirse a sí misma'
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
  '\n=== HOUSEHOLD GROUP PICKER · DIRECT HOUSEHOLD ==='
);

nextDbError = null;

const directBefore =
  candidateReloads;

await feature.addListingToHousehold(
  'listing-direct'
);

assert(
  inserts.at(-1).table ===
    'household_candidates',
  'Direct Household usa tabla incorrecta'
);

assert(
  inserts.at(-1).payload.household_id ===
    'house-1',
  'Direct Household usa household incorrecto'
);

assert(
  candidateReloads ===
    directBefore + 1,
  'Direct Household debe refrescar candidatos'
);

assert(
  notifications.at(-1) ===
    'Añadido a Candidatos de tu Hogar',
  'Mensaje Direct Household incorrecto'
);

ok(
  'Añadir directamente al Hogar correcto'
);


console.log(
  '\nROOMS HOUSEHOLD GROUP PICKER FEATURE OK'
);
