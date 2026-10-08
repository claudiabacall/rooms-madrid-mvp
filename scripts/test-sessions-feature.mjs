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
    'assets/js/features/sessions.js',
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


console.log('\n=== SESSIONS · INTEGRACION ===');

assert(
  htmlSource.includes(
    'assets/js/features/sessions.js'
  ),
  'index.html no carga sessions.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/sessions.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'sessions.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_SESSIONS_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Sessions'
);

for (const fn of [
  'ensureSessionsModal',
  'openSessionsManager',
  'signOutOtherSessions'
]) {
  const regex =
    new RegExp(
      `(?:async\\s+)?function\\s+${fn}\\s*\\(`
    );

  assert(
    !regex.test(appSource),
    `${fn} sigue duplicada en supabase-app.js`
  );
}

assert(
  /function\s+endSession\s*\(/.test(appSource),
  'endSession debe permanecer en supabase-app.js'
);

assert(
  /async\s+function\s+logoutFromRooms\s*\(/.test(appSource),
  'logoutFromRooms debe permanecer en supabase-app.js'
);

ok('Sessions cargada sin mover auth global');


console.log('\n=== SESSIONS · DOM ===');

const dom =
  new JSDOM(
    '<!doctype html><html><body></body></html>',
    {
      runScripts: 'outside-only',
      url: 'http://127.0.0.1/'
    }
  );

const { window } = dom;

window.eval(featureSource);

assert(
  window.ROOMS_SESSIONS_FEATURE?.create,
  'Sessions no expone factory'
);

ok('Factory Sessions disponible');


console.log('\n=== SESSIONS · FIXTURES ===');

const state = {
  user: {
    id: 'me'
  }
};

let signOutCalls = [];
let notifications = [];
let confirmResult = true;

window.confirm = () => confirmResult;

const db = {
  auth: {
    async signOut(options) {
      signOutCalls.push(options);

      return {
        error: null
      };
    }
  }
};

const feature =
  window.ROOMS_SESSIONS_FEATURE.create({
    db,
    state,

    showModal(element) {
      element.classList.add('open');
      element.setAttribute(
        'aria-hidden',
        'false'
      );
    },

    notify(message) {
      notifications.push(message);
    }
  });

assert(
  feature,
  'No se crea Sessions feature'
);

ok('Feature creada');


console.log('\n=== SESSIONS · CREAR MODAL ===');

const modal =
  feature.ensureSessionsModal();

assert(
  modal?.id === 'sessionsModal',
  'No se crea sessionsModal'
);

assert(
  modal.querySelector(
    '#signOutOtherSessions'
  ),
  'Falta botón para cerrar otras sesiones'
);

assert(
  window.document
    .querySelectorAll('#sessionsModal')
    .length === 1,
  'Debe existir un único modal'
);

const sameModal =
  feature.ensureSessionsModal();

assert(
  sameModal === modal,
  'ensureSessionsModal debe reutilizar modal existente'
);

ok('Modal creado y reutilizado');


console.log('\n=== SESSIONS · ABRIR ===');

feature.openSessionsManager();

assert(
  modal.getAttribute(
    'aria-hidden'
  ) === 'false',
  'El gestor de sesiones no se abre'
);

assert(
  modal.classList.contains('open'),
  'El modal no queda abierto'
);

ok('Gestor de sesiones abre correctamente');


console.log('\n=== SESSIONS · CANCELAR CONFIRMACION ===');

confirmResult = false;

await feature.signOutOtherSessions();

assert(
  signOutCalls.length === 0,
  'No debe llamar signOut si se cancela'
);

ok('Cancelación respeta confirmación');


console.log('\n=== SESSIONS · CERRAR OTRAS ===');

confirmResult = true;

await feature.signOutOtherSessions();

assert(
  signOutCalls.length === 1,
  'Debe llamar una vez a auth.signOut'
);

assert(
  signOutCalls[0]?.scope === 'others',
  'Debe usar scope "others"'
);

assert(
  notifications.at(-1) ===
    'Las demás sesiones se han cerrado.',
  'Notificación de éxito incorrecta'
);

const button =
  window.document.querySelector(
    '#signOutOtherSessions'
  );

assert(
  button.disabled === false,
  'El botón debe reactivarse'
);

assert(
  button.textContent.trim() ===
    'Cerrar las demás sesiones',
  'El texto del botón debe restaurarse'
);

ok('Cierre de otras sesiones correcto');


console.log('\n=== SESSIONS · SIN USUARIO ===');

state.user = null;

const beforeCalls =
  signOutCalls.length;

await feature.signOutOtherSessions();

assert(
  signOutCalls.length === beforeCalls,
  'Sin usuario no debe ejecutar signOut'
);

ok('Sin usuario no ejecuta acciones');


console.log('\nROOMS SESSIONS FEATURE OK');
