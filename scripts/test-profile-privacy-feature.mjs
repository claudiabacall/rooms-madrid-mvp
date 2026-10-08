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
    'assets/js/features/profile-privacy.js',
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

const accountSettingsSource =
  fs.readFileSync(
    'assets/js/features/account-settings.js',
    'utf8'
  );


console.log(
  '\n=== PROFILE PRIVACY · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/profile-privacy.js'
  ),
  'index.html no carga profile-privacy.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/profile-privacy.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'profile-privacy.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_PROFILE_PRIVACY_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Profile Privacy'
);

for (const fn of [
  'renderProfilePrivacySettings',
  'applyProfilePrivacyControls',
  'detectProfilePrivacyLevel',
  'renderProfilePrivacyLevel'
]) {
  const regex =
    new RegExp(
      `function\\s+${fn}\\s*\\(`
    );

  assert(
    !regex.test(appSource),
    `${fn} sigue duplicada en supabase-app.js`
  );
}

assert(
  !appSource.includes(
    'const profilePrivacyPresets ='
  ),
  'profilePrivacyPresets sigue en supabase-app.js'
);

assert(
  !/function\s+renderAccountSettings\s*\(/.test(
    appSource
  ),
  'renderAccountSettings no debe seguir en supabase-app.js'
);

assert(
  /function\s+renderAccountSettings\s*\(/.test(
    accountSettingsSource
  ),
  'renderAccountSettings debe vivir en account-settings.js'
);

ok(
  'Profile Privacy y Account Settings están separados'
);


console.log(
  '\n=== PROFILE PRIVACY · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>

        <div id="privacyLevels">
          <button
            type="button"
            data-profile-privacy-level="open">
            Open
          </button>

          <button
            type="button"
            data-profile-privacy-level="balanced">
            Balanced
          </button>

          <button
            type="button"
            data-profile-privacy-level="private">
            Private
          </button>
        </div>

        <div
          data-profile-privacy-row="living">
          <button
            type="button"
            data-privacy-value="public">
            Public
          </button>
          <button
            type="button"
            data-privacy-value="connections">
            Connections
          </button>
          <button
            type="button"
            data-privacy-value="private">
            Private
          </button>
        </div>

        <div
          data-profile-privacy-row="search">
          <button
            type="button"
            data-privacy-value="public">
            Public
          </button>
          <button
            type="button"
            data-privacy-value="connections">
            Connections
          </button>
          <button
            type="button"
            data-privacy-value="private">
            Private
          </button>
        </div>

        <div
          data-profile-privacy-row="budget">
          <button
            type="button"
            data-privacy-value="public">
            Public
          </button>
          <button
            type="button"
            data-privacy-value="connections">
            Connections
          </button>
          <button
            type="button"
            data-privacy-value="private">
            Private
          </button>
        </div>

        <div
          data-profile-privacy-row="activity">
          <button
            type="button"
            data-privacy-value="public">
            Public
          </button>
          <button
            type="button"
            data-privacy-value="connections">
            Connections
          </button>
          <button
            type="button"
            data-privacy-value="private">
            Private
          </button>
        </div>

        <button
          type="button"
          id="saveProfilePrivacy">
          Guardar
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

let openSettingsCalls =
  0;

window.openSettings =
  (...args) => {
    openSettingsCalls += 1;

    return {
      args
    };
  };

window.eval(
  featureSource
);

assert(
  window.ROOMS_PROFILE_PRIVACY_FEATURE?.create,
  'Profile Privacy no expone factory'
);

ok(
  'Factory disponible'
);


console.log(
  '\n=== PROFILE PRIVACY · FIXTURES ==='
);

const state = {
  user: {
    id:
      'user-me'
  },

  preferences: {
    answers: {
      existing:
        'keep-me',

      privacy: {
        level:
          'balanced',

        controls: {
          living:
            'public',

          search:
            'public',

          budget:
            'connections',

          activity:
            'public'
        }
      }
    }
  }
};

const notifications =
  [];

let upsertPayload =
  null;

let upsertError =
  null;

const db = {
  from(table) {
    assert(
      table ===
        'onboarding_preferences',
      `Tabla inesperada: ${table}`
    );

    return {
      upsert(payload) {
        upsertPayload =
          payload;

        return Promise.resolve({
          error:
            upsertError
        });
      }
    };
  }
};

const feature =
  window
    .ROOMS_PROFILE_PRIVACY_FEATURE
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
  feature?.renderProfilePrivacySettings,
  'Falta renderProfilePrivacySettings'
);

assert(
  feature?.detectProfilePrivacyLevel,
  'Falta detectProfilePrivacyLevel'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== PROFILE PRIVACY · RENDER ==='
);

feature.renderProfilePrivacySettings();

const balancedButton =
  window.document.querySelector(
    '[data-profile-privacy-level="balanced"]'
  );

assert(
  balancedButton.classList.contains(
    'active'
  ),
  'Balanced debería estar activo'
);

assert(
  balancedButton.getAttribute(
    'aria-pressed'
  ) ===
    'true',
  'aria-pressed de Balanced incorrecto'
);

const budgetConnections =
  window.document.querySelector(
    '[data-profile-privacy-row="budget"] [data-privacy-value="connections"]'
  );

assert(
  budgetConnections.classList.contains(
    'active'
  ),
  'Budget connections debería estar activo'
);

const livingPublic =
  window.document.querySelector(
    '[data-profile-privacy-row="living"] [data-privacy-value="public"]'
  );

assert(
  livingPublic.classList.contains(
    'active'
  ),
  'Living public debería estar activo'
);

ok(
  'Render desde state correcto'
);


console.log(
  '\n=== PROFILE PRIVACY · PRESETS ==='
);

const privateButton =
  window.document.querySelector(
    '[data-profile-privacy-level="private"]'
  );

privateButton.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles:
        true
    }
  )
);

for (
  const row of
  window.document.querySelectorAll(
    '[data-profile-privacy-row]'
  )
) {
  const active =
    row.querySelector(
      '[data-privacy-value].active'
    );

  assert(
    active?.dataset.privacyValue ===
      'private',
    `${row.dataset.profilePrivacyRow} no aplica preset private`
  );
}

assert(
  feature.detectProfilePrivacyLevel() ===
    'private',
  'No detecta preset private'
);

ok(
  'Preset private y detección correctos'
);


console.log(
  '\n=== PROFILE PRIVACY · CUSTOM ==='
);

const livingPublicButton =
  window.document.querySelector(
    '[data-profile-privacy-row="living"] [data-privacy-value="public"]'
  );

livingPublicButton.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles:
        true
    }
  )
);

assert(
  feature.detectProfilePrivacyLevel() ===
    'custom',
  'Cambio manual debería producir custom'
);

assert(
  !window.document
    .querySelector(
      '[data-profile-privacy-level="private"]'
    )
    .classList
    .contains(
      'active'
    ),
  'Private no debe seguir activo tras custom'
);

ok(
  'Cambio manual produce nivel custom'
);


console.log(
  '\n=== PROFILE PRIVACY · SAVE ==='
);

window.document
  .querySelector(
    '#saveProfilePrivacy'
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
  upsertPayload?.user_id ===
    'user-me',
  'Save no usa usuario autenticado'
);

assert(
  upsertPayload
    ?.answers
    ?.existing ===
    'keep-me',
  'Save debe conservar respuestas existentes'
);

assert(
  upsertPayload
    ?.answers
    ?.privacy
    ?.level ===
    'custom',
  'Save no guarda nivel custom'
);

assert(
  upsertPayload
    ?.answers
    ?.privacy
    ?.controls
    ?.living ===
    'public',
  'Save no guarda living public'
);

assert(
  upsertPayload
    ?.answers
    ?.privacy
    ?.controls
    ?.search ===
    'private',
  'Save no guarda search private'
);

assert(
  state.preferences
    ?.answers
    ?.privacy
    ?.level ===
    'custom',
  'state.preferences no se actualiza'
);

assert(
  notifications.includes(
    'Privacidad actualizada'
  ),
  'Falta notificación de guardado'
);

ok(
  'Privacidad guardada y state actualizado'
);


console.log(
  '\n=== PROFILE PRIVACY · ERROR SAVE ==='
);

upsertError =
  new Error(
    'db error'
  );

const notificationsBeforeError =
  notifications.length;

window.document
  .querySelector(
    '#saveProfilePrivacy'
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
  notifications.length ===
    notificationsBeforeError + 1,
  'Error debe generar una notificación'
);

assert(
  notifications.at(-1) ===
    'No se pudo guardar tu privacidad',
  'Mensaje de error incorrecto'
);

ok(
  'Error de guardado controlado'
);


console.log(
  '\n=== PROFILE PRIVACY · OPEN SETTINGS ==='
);

upsertError =
  null;

const wrappedResult =
  window.openSettings(
    'settings'
  );

assert(
  openSettingsCalls ===
    1,
  'Wrapper no delega en openSettings original'
);

assert(
  wrappedResult?.args?.[0] ===
    'settings',
  'Wrapper no devuelve resultado original'
);

state.preferences.answers.privacy = {
  level:
    'open',

  controls: {
    living:
      'public',

    search:
      'public',

    budget:
      'public',

    activity:
      'public'
  }
};

window.openSettings();

await new Promise(
  resolve =>
    setTimeout(resolve, 0)
);

assert(
  window.document
    .querySelector(
      '[data-profile-privacy-level="open"]'
    )
    .classList
    .contains(
      'active'
    ),
  'Abrir Settings no refresca Privacy'
);

ok(
  'openSettings conserva comportamiento y refresca Privacy'
);


console.log(
  '\nROOMS PROFILE PRIVACY FEATURE OK'
);
