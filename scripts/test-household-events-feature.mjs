import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/household-events.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== HOUSEHOLD EVENTS ===');

assert(
  html.includes('assets/js/features/household-events.js'),
  'Falta Household Events en HTML'
);

assert(
  html.indexOf('assets/js/features/household-events.js') <
  html.indexOf('assets/js/supabase-app.js'),
  'Orden de scripts incorrecto'
);

assert(
  app.includes('ROOMS_HOUSEHOLD_EVENTS_FEATURE?.create'),
  'Falta inicializacion'
);

console.log('OK  Integracion correcta');

const dom = new JSDOM(`
  <body>
    <main id="communitiesView"></main>
    <main id="householdView" hidden></main>

    <button data-open-search-group="home-1">Abrir</button>
    <button data-household-vote="like"
      data-candidate-type="listing"
      data-candidate-id="listing-1">Votar</button>
    <button data-send-person-home="person-1">Persona</button>
    <button data-send-home-id="listing-1">Vivienda</button>
    <button data-remove-household-person="person-1">
      Quitar persona
    </button>
    <button data-remove-household-candidate="listing-1">
      Quitar vivienda
    </button>

    <button id="acceptHouseholdInvite">Aceptar</button>
    <button id="generateHouseholdInvite">Generar</button>
    <button id="copyHouseholdInviteLink">Copiar</button>
    <button id="inviteRealHousehold">Invitar</button>
    <button id="createHouseholdButton">Crear</button>

    <div id="createHouseholdModal"></div>
    <div id="householdInviteModal" class="open"></div>
    <div id="incomingHouseholdInviteModal" class="open"></div>

    <button data-close-create-household>Cerrar</button>
    <button data-close-household-invite>Cerrar invitacion</button>
    <button id="dismissHouseholdInvite">Descartar</button>

    <button data-real-household-tab="candidates">Candidatos</button>
    <button data-real-household-tab="members">Miembros</button>

    <section data-real-household-panel="candidates"></section>
    <section data-real-household-panel="members" hidden></section>

    <button data-household-go-explore>Explorar</button>
    <button data-bottom-nav="explore">Explore</button>
  </body>
`, {
  runScripts: 'outside-only',
  url: 'http://127.0.0.1/'
});

const { window } = dom;
const document = window.document;

window.scrollTo = () => {};

window.eval(source);

assert(
  window.ROOMS_HOUSEHOLD_EVENTS_FEATURE?.create,
  'Factory no disponible'
);

const calls = [];

const record = name => (...args) => {
  calls.push({ name, args });
};

const state = {
  listings: new Map([
    ['listing-1', { id: 'listing-1' }]
  ])
};

window.ROOMS_HOUSEHOLD_EVENTS_FEATURE.create({
  state,
  notify: record('notify'),
  loadHousehold: record('loadHousehold'),
  voteHouseholdCandidate: record('vote'),
  openGroupPicker: record('picker'),
  removeHouseholdPersonCandidate: record('removePerson'),
  removeHouseholdCandidate: record('removeListing'),
  acceptIncomingHouseholdInvite: record('acceptInvite'),
  openHouseholdInviteModal: record('openInvite'),
  generateHouseholdInvitation: record('generateInvite'),
  copyHouseholdInvitation: record('copyInvite'),
  ensureCreateHouseholdModal: () =>
    document.querySelector('#createHouseholdModal')
});

function click(selector) {
  const element = document.querySelector(selector);
  assert(element, `No existe ${selector}`);
  element.click();
}

function expectCall(name, args) {
  const call = calls.findLast(item => item.name === name);
  assert(call, `No se ejecuto ${name}`);

  if (args) {
    assert.deepEqual(
      Array.from(call.args),
      args,
      `Argumentos incorrectos en ${name}`
    );
  }
}

click('[data-open-search-group]');
expectCall('loadHousehold', ['home-1']);

assert.equal(
  document.querySelector('#householdView').hidden,
  false
);
console.log('OK  Apertura y navegacion de Hogar');

click('[data-household-vote]');
expectCall('vote', ['listing', 'listing-1', 'like']);
console.log('OK  Votaciones conectadas');

click('[data-send-person-home]');
expectCall('picker', ['person', 'person-1']);

click('[data-send-home-id]');
expectCall('picker', ['listing', 'listing-1']);
console.log('OK  Envio de personas y viviendas');

click('[data-remove-household-person]');
expectCall('removePerson', ['person-1']);

click('[data-remove-household-candidate]');
expectCall('removeListing', ['listing-1']);
console.log('OK  Eliminacion de candidatos');

click('#acceptHouseholdInvite');
expectCall('acceptInvite');

click('#generateHouseholdInvite');
expectCall('generateInvite');

click('#copyHouseholdInviteLink');
expectCall('copyInvite');

click('#inviteRealHousehold');
expectCall('openInvite');
console.log('OK  Invitaciones conectadas');

click('#createHouseholdButton');

assert(
  document.querySelector('#createHouseholdModal')
    .classList.contains('open')
);
console.log('OK  Modal de creacion');

click('[data-close-create-household]');

assert(
  !document.querySelector('#createHouseholdModal')
    .classList.contains('open')
);

click('[data-close-household-invite]');

assert(
  !document.querySelector('#householdInviteModal')
    .classList.contains('open')
);

click('#dismissHouseholdInvite');

assert(
  !document.querySelector('#incomingHouseholdInviteModal')
    .classList.contains('open')
);
console.log('OK  Cierre de modales');

click('[data-real-household-tab="members"]');

assert.equal(
  document.querySelector(
    '[data-real-household-panel="members"]'
  ).hidden,
  false
);

assert.equal(
  document.querySelector(
    '[data-real-household-panel="candidates"]'
  ).hidden,
  true
);
console.log('OK  Cambio de pestanas');

let exploreClicks = 0;

document.querySelector(
  '[data-bottom-nav="explore"]'
).addEventListener('click', () => {
  exploreClicks++;
});

click('[data-household-go-explore]');

assert.equal(exploreClicks, 1);
console.log('OK  Navegacion hacia Explore');

console.log('\nROOMS HOUSEHOLD EVENTS FEATURE OK');

dom.window.close();
