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
    'assets/js/features/household-invites.js',
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
  '\n=== HOUSEHOLD INVITES · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/household-invites.js'
  ),
  'index no carga Household Invites'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/household-invites.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'Household Invites debe cargar antes del monolito'
);

assert(
  appSource.includes(
    'window.ROOMS_HOUSEHOLD_INVITES_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Household Invites'
);

for (const fn of [
  'ensureHouseholdInviteModal',
  'openHouseholdInviteModal',
  'generateHouseholdInvitation',
  'copyHouseholdInvitation',
  'ensureIncomingHouseholdInviteModal',
  'handleIncomingHouseholdInvite',
  'acceptIncomingHouseholdInvite'
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
    `${fn} no está en household-invites.js`
  );
}

assert(
  !/async\s+function\s+addPersonToHousehold\s*\(/.test(
    appSource
  ),
  'addPersonToHousehold ya no debe vivir en el monolito'
);

assert(
  /async\s+function\s+addPersonToHousehold\s*\(/.test(
    candidatesSource
  ),
  'addPersonToHousehold debe vivir en Household Candidates'
);

ok(
  'Invites separado sin arrastrar Candidates'
);


console.log(
  '\n=== HOUSEHOLD INVITES · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <button
          data-main-view="household">
          Household
        </button>
      </body>
    </html>`,
    {
      runScripts:
        'outside-only',

      url:
        'http://127.0.0.1/?foo=1'
    }
  );

const { window } = dom;

window.eval(
  featureSource
);

assert(
  window.ROOMS_HOUSEHOLD_INVITES_FEATURE?.create,
  'Feature no expone factory'
);

ok(
  'Factory disponible'
);


console.log(
  '\n=== HOUSEHOLD INVITES · FIXTURES ==='
);

const notifications = [];

let householdReloads = 0;
let householdNavigationClicks = 0;

window.document
  .querySelector(
    '[data-main-view="household"]'
  )
  .addEventListener(
    'click',
    () => {
      householdNavigationClicks += 1;
    }
  );

const state = {
  user: {
    id: 'user-me'
  },

  household: {
    id: 'house-1',
    name: 'Chamberí Crew',
    owner_id: 'user-me'
  },

  pendingHouseholdInvite:
    null
};

let invitationInsertResult = {
  data: {
    token: 'token-created'
  },
  error: null
};

let invitationLookupResult = {
  data: null,
  error: null
};

let invitationAcceptResult = {
  data: null,
  error: null
};

const dbCalls = [];

const db = {
  from(table) {
    return {
      insert(payload) {
        dbCalls.push({
          kind: 'insert',
          table,
          payload
        });

        return {
          select() {
            return {
              single() {
                return Promise.resolve(
                  invitationInsertResult
                );
              }
            };
          }
        };
      }
    };
  },

  rpc(name, payload) {
    dbCalls.push({
      kind: 'rpc',
      name,
      payload
    });

    if (
      name ===
      'get_household_invitation'
    ) {
      return Promise.resolve(
        invitationLookupResult
      );
    }

    if (
      name ===
      'accept_household_invitation'
    ) {
      return Promise.resolve(
        invitationAcceptResult
      );
    }

    return Promise.resolve({
      data: null,
      error: null
    });
  }
};

const feature =
  window
    .ROOMS_HOUSEHOLD_INVITES_FEATURE
    .create({
      db,
      state,

      notify(message) {
        notifications.push(message);
      },

      async loadHousehold() {
        householdReloads += 1;
      }
    });

assert(
  feature?.openHouseholdInviteModal,
  'Falta openHouseholdInviteModal'
);

assert(
  feature?.handleIncomingHouseholdInvite,
  'Falta handleIncomingHouseholdInvite'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== HOUSEHOLD INVITES · OPEN OWNER ==='
);

feature.openHouseholdInviteModal();

const outgoingModal =
  window.document.querySelector(
    '#householdInviteModal'
  );

assert(
  outgoingModal,
  'No crea householdInviteModal'
);

assert(
  outgoingModal.classList.contains(
    'open'
  ),
  'Modal de invitación no se abre'
);

assert(
  window.document.body.style.overflow ===
    'hidden',
  'Modal abierto debe bloquear scroll'
);

ok(
  'Modal owner correcto'
);


console.log(
  '\n=== HOUSEHOLD INVITES · NON OWNER ==='
);

outgoingModal.classList.remove(
  'open'
);

window.document.body.style.overflow =
  '';

state.household.owner_id =
  'other-user';

feature.openHouseholdInviteModal();

assert(
  !outgoingModal.classList.contains(
    'open'
  ),
  'No owner no debe abrir modal'
);

assert(
  notifications.at(-1) ===
    'Solo el propietario del Hogar puede invitar personas',
  'Mensaje no owner incorrecto'
);

state.household.owner_id =
  'user-me';

ok(
  'Restricción owner correcta'
);


console.log(
  '\n=== HOUSEHOLD INVITES · GENERATE ==='
);

feature.openHouseholdInviteModal();

await feature.generateHouseholdInvitation();

const insertCall =
  dbCalls.find(
    item =>
      item.kind === 'insert' &&
      item.table ===
        'household_invitations'
  );

assert(
  insertCall,
  'No inserta household_invitations'
);

assert(
  insertCall.payload.household_id ===
    'house-1',
  'household_id incorrecto'
);

assert(
  insertCall.payload.invited_by ===
    'user-me',
  'invited_by incorrecto'
);

const inviteInput =
  window.document.querySelector(
    '#householdInviteLink'
  );

assert(
  inviteInput.value.includes(
    '?invite=token-created'
  ),
  'No genera URL de invitación'
);

assert(
  notifications.at(-1) ===
    'Invitación creada',
  'Mensaje generación incorrecto'
);

ok(
  'Generación correcta'
);


console.log(
  '\n=== HOUSEHOLD INVITES · INCOMING VALID ==='
);

window.history.replaceState(
  {},
  '',
  '/?invite=token-valid'
);

invitationLookupResult = {
  data: {
    invitation_status:
      'pending',

    expires_at:
      new Date(
        Date.now() + 60_000
      ).toISOString(),

    household_name:
      'Malasaña House'
  },

  error:
    null
};

await feature.handleIncomingHouseholdInvite();

assert(
  state.pendingHouseholdInvite?.token ===
    'token-valid',
  'No guarda token entrante'
);

assert(
  state.pendingHouseholdInvite?.household_name ===
    'Malasaña House',
  'No guarda datos de invitación'
);

const incomingModal =
  window.document.querySelector(
    '#incomingHouseholdInviteModal'
  );

assert(
  incomingModal.classList.contains(
    'open'
  ),
  'Modal incoming no se abre'
);

assert(
  incomingModal
    .querySelector(
      '#incomingHouseholdName'
    )
    .textContent.includes(
      'Malasaña House'
    ),
  'Nombre de Hogar incorrecto'
);

ok(
  'Invitación entrante válida correcta'
);


console.log(
  '\n=== HOUSEHOLD INVITES · EXPIRED ==='
);

incomingModal.classList.remove(
  'open'
);

state.pendingHouseholdInvite =
  null;

window.history.replaceState(
  {},
  '',
  '/?invite=token-expired'
);

invitationLookupResult = {
  data: {
    invitation_status:
      'pending',

    expires_at:
      new Date(
        Date.now() - 60_000
      ).toISOString(),

    household_name:
      'Expired'
  },

  error:
    null
};

await feature.handleIncomingHouseholdInvite();

assert(
  state.pendingHouseholdInvite ===
    null,
  'Invitación caducada no debe guardarse'
);

assert(
  notifications.at(-1) ===
    'Esta invitación ha caducado',
  'Mensaje de caducidad incorrecto'
);

ok(
  'Caducidad controlada'
);


console.log(
  '\n=== HOUSEHOLD INVITES · ACCEPT ==='
);

state.pendingHouseholdInvite = {
  token:
    'token-accept',

  household_name:
    'Chamberí Crew'
};

incomingModal.classList.add(
  'open'
);

window.history.replaceState(
  {},
  '',
  '/?invite=token-accept&foo=1'
);

invitationAcceptResult = {
  data: null,
  error: null
};

const reloadsBeforeAccept =
  householdReloads;

await feature.acceptIncomingHouseholdInvite();

const acceptCall =
  dbCalls.find(
    item =>
      item.kind === 'rpc' &&
      item.name ===
        'accept_household_invitation' &&
      item.payload?._token ===
        'token-accept'
  );

assert(
  acceptCall,
  'No llama accept_household_invitation'
);

assert(
  state.pendingHouseholdInvite ===
    null,
  'Debe limpiar pending invite'
);

assert(
  householdReloads ===
    reloadsBeforeAccept + 1,
  'Debe recargar Household'
);

assert(
  !window.location.search.includes(
    'invite='
  ),
  'Debe retirar invite de la URL'
);

assert(
  window.location.search.includes(
    'foo=1'
  ),
  'Debe conservar otros query params'
);

assert(
  notifications.at(-1) ===
    'Ya formas parte del Hogar',
  'Mensaje accept incorrecto'
);

assert(
  householdNavigationClicks ===
    1,
  'Debe navegar a Household'
);

ok(
  'Aceptación correcta'
);


console.log(
  '\n=== HOUSEHOLD INVITES · ACCEPT ERROR ==='
);

state.pendingHouseholdInvite = {
  token:
    'token-error'
};

invitationAcceptResult = {
  data: null,

  error: {
    message:
      'boom'
  }
};

const reloadsBeforeError =
  householdReloads;

await feature.acceptIncomingHouseholdInvite();

assert(
  state.pendingHouseholdInvite?.token ===
    'token-error',
  'Error no debe limpiar invitación'
);

assert(
  householdReloads ===
    reloadsBeforeError,
  'Error no debe recargar Household'
);

assert(
  notifications.at(-1) ===
    'No se pudo aceptar la invitación',
  'Mensaje accept error incorrecto'
);

ok(
  'Error de aceptación controlado'
);


console.log(
  '\nROOMS HOUSEHOLD INVITES FEATURE OK'
);
