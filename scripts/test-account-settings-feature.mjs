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
    'assets/js/features/account-settings.js',
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

const exploreViewSource =
  fs.readFileSync(
    'assets/js/features/explore-view.js',
    'utf8'
  );


console.log(
  '\n=== ACCOUNT SETTINGS · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/account-settings.js'
  ),
  'index.html no carga account-settings.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/account-settings.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'account-settings.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_ACCOUNT_SETTINGS_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Account Settings'
);

for (const fn of [
  'renderAccountSettings',
  'requestPasswordChange',
  'logoutFromRooms'
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
  !/function\s+sortExploreListings\s*\(/.test(
    appSource
  ),
  'sortExploreListings no debe seguir en supabase-app.js'
);

assert(
  /function\s+sortExploreListings\s*\(/.test(
    exploreViewSource
  ),
  'sortExploreListings debe vivir en explore-view.js'
);

ok(
  'Account Settings y Explore View están separados'
);


console.log(
  '\n=== ACCOUNT SETTINGS · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>

        <b id="settingsAccountEmail">
          Cargando…
        </b>

        <button
          id="changePassword"
          type="button">
          Cambiar contraseña
        </button>

        <button
          id="realLogoutButton"
          type="button">
          Cerrar sesión
        </button>

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
  window.ROOMS_ACCOUNT_SETTINGS_FEATURE?.create,
  'Account Settings no expone factory'
);

ok(
  'Factory disponible'
);


console.log(
  '\n=== ACCOUNT SETTINGS · FIXTURES ==='
);

const state = {
  user: {
    id:
      'user-me',

    email:
      'claudia@example.com'
  }
};

const notifications =
  [];

let resetCalls =
  0;

let resetEmail =
  null;

let resetOptions =
  null;

let resetError =
  null;

let signOutCalls =
  0;

let signOutError =
  null;

const db = {
  auth: {
    async resetPasswordForEmail(
      email,
      options
    ) {
      resetCalls += 1;
      resetEmail =
        email;
      resetOptions =
        options;

      return {
        error:
          resetError
      };
    },

    async signOut() {
      signOutCalls += 1;

      return {
        error:
          signOutError
      };
    }
  }
};

const feature =
  window
    .ROOMS_ACCOUNT_SETTINGS_FEATURE
    .create({
      db,
      state,

      notify(message) {
        notifications.push(
          message
        );
      }
    });

assert(
  feature?.renderAccountSettings,
  'Falta renderAccountSettings'
);

assert(
  feature?.requestPasswordChange,
  'Falta requestPasswordChange'
);

assert(
  feature?.logoutFromRooms,
  'Falta logoutFromRooms'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== ACCOUNT SETTINGS · RENDER ==='
);

const emailNode =
  window.document.querySelector(
    '#settingsAccountEmail'
  );

assert(
  emailNode.textContent ===
    'claudia@example.com',
  'La creación de la feature debe renderizar el email'
);

state.user.email =
  'nuevo@example.com';

feature.renderAccountSettings();

assert(
  emailNode.textContent ===
    'nuevo@example.com',
  'renderAccountSettings no refresca el email'
);

state.user.email =
  null;

feature.renderAccountSettings();

assert(
  emailNode.textContent ===
    'Sin email',
  'Sin email debe mostrar fallback'
);

state.user.email =
  'claudia@example.com';

ok(
  'Email de cuenta renderizado correctamente'
);


console.log(
  '\n=== ACCOUNT SETTINGS · PASSWORD ==='
);

const passwordResult =
  await feature.requestPasswordChange();

assert(
  passwordResult ===
    undefined,
  'requestPasswordChange no necesita devolver valor'
);

assert(
  resetCalls ===
    1,
  'Debe llamar una vez a resetPasswordForEmail'
);

assert(
  resetEmail ===
    'claudia@example.com',
  'Debe usar el email autenticado'
);

assert(
  resetOptions?.redirectTo ===
    window.location.origin,
  'redirectTo debe usar window.location.origin'
);

assert(
  notifications.at(-1) ===
    'Te hemos enviado un email para cambiar tu contraseña',
  'Notificación de password incorrecta'
);

ok(
  'Cambio de contraseña correcto'
);


console.log(
  '\n=== ACCOUNT SETTINGS · PASSWORD SIN EMAIL ==='
);

const resetCallsBeforeNoEmail =
  resetCalls;

state.user.email =
  null;

await feature.requestPasswordChange();

assert(
  resetCalls ===
    resetCallsBeforeNoEmail,
  'Sin email no debe llamar a Supabase'
);

assert(
  notifications.at(-1) ===
    'No encontramos el email de tu cuenta',
  'Mensaje sin email incorrecto'
);

state.user.email =
  'claudia@example.com';

ok(
  'Password sin email controlado'
);


console.log(
  '\n=== ACCOUNT SETTINGS · PASSWORD ERROR ==='
);

resetError =
  new Error(
    'reset error'
  );

const notificationsBeforeResetError =
  notifications.length;

await feature.requestPasswordChange();

assert(
  notifications.length ===
    notificationsBeforeResetError + 1,
  'Error de password debe notificar'
);

assert(
  notifications.at(-1) ===
    'No se pudo enviar el email',
  'Mensaje de error de password incorrecto'
);

resetError =
  null;

ok(
  'Error de cambio de contraseña controlado'
);


console.log(
  '\n=== ACCOUNT SETTINGS · LOGOUT ==='
);

await feature.logoutFromRooms();

assert(
  signOutCalls ===
    1,
  'Debe llamar a db.auth.signOut'
);

assert(
  notifications.at(-1) ===
    'Sesión cerrada',
  'Notificación de logout incorrecta'
);

ok(
  'Logout correcto'
);


console.log(
  '\n=== ACCOUNT SETTINGS · LOGOUT ERROR ==='
);

signOutError =
  new Error(
    'logout error'
  );

const notificationsBeforeLogoutError =
  notifications.length;

await feature.logoutFromRooms();

assert(
  signOutCalls ===
    2,
  'Logout error debe seguir llamando a Supabase'
);

assert(
  notifications.length ===
    notificationsBeforeLogoutError + 1,
  'Error de logout debe notificar'
);

assert(
  notifications.at(-1) ===
    'No se pudo cerrar la sesión',
  'Mensaje de error de logout incorrecto'
);

signOutError =
  null;

ok(
  'Error de logout controlado'
);


console.log(
  '\n=== ACCOUNT SETTINGS · HOOK PASSWORD ==='
);

const resetCallsBeforeClick =
  resetCalls;

window.document
  .querySelector(
    '#changePassword'
  )
  .dispatchEvent(
    new window.MouseEvent(
      'click',
      {
        bubbles:
          true
      }
    )
  );

await new Promise(
  resolve =>
    setTimeout(resolve, 0)
);

assert(
  resetCalls ===
    resetCallsBeforeClick + 1,
  '#changePassword no dispara requestPasswordChange'
);

ok(
  'Hook changePassword conectado'
);


console.log(
  '\n=== ACCOUNT SETTINGS · HOOK LOGOUT ==='
);

const signOutCallsBeforeClick =
  signOutCalls;

window.document
  .querySelector(
    '#realLogoutButton'
  )
  .dispatchEvent(
    new window.MouseEvent(
      'click',
      {
        bubbles:
          true
      }
    )
  );

await new Promise(
  resolve =>
    setTimeout(resolve, 0)
);

assert(
  signOutCalls ===
    signOutCallsBeforeClick + 1,
  '#realLogoutButton no dispara logoutFromRooms'
);

ok(
  'Hook realLogoutButton conectado'
);


console.log(
  '\nROOMS ACCOUNT SETTINGS FEATURE OK'
);
