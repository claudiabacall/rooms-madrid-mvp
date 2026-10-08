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
    'assets/js/features/own-profile.js',
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

const profilePrivacySource =
  fs.readFileSync(
    'assets/js/features/profile-privacy.js',
    'utf8'
  );


console.log(
  '\n=== OWN PROFILE · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/own-profile.js'
  ),
  'index.html no carga own-profile.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/own-profile.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'own-profile.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_OWN_PROFILE_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Own Profile'
);

for (const fn of [
  'ensureOwnPublicProfileModal',
  'canShowOwnProfileSection',
  'renderOwnPublicProfile',
  'openOwnPublicProfile'
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
  /function\s+ensureHomePreferencesModal\s*\(/.test(
    appSource
  ),
  'Home Preferences no debe moverse'
);

assert(
  !/function\s+renderProfilePrivacySettings\s*\(/.test(
    appSource
  ),
  'renderProfilePrivacySettings no debe seguir en supabase-app.js'
);

assert(
  /function\s+renderProfilePrivacySettings\s*\(/.test(
    profilePrivacySource
  ),
  'renderProfilePrivacySettings debe vivir en profile-privacy.js'
);

ok(
  'Own Profile separado de Home Preferences y Profile Privacy'
);


console.log(
  '\n=== OWN PROFILE · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <button id="previewOwnPublicProfile">
          Vista pública
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
  window.ROOMS_OWN_PROFILE_FEATURE?.create,
  'Own Profile no expone factory'
);

ok(
  'Factory disponible'
);


console.log(
  '\n=== OWN PROFILE · FIXTURES ==='
);

const state = {
  user: {
    id:
      'user-me',

    email_confirmed_at:
      '2026-10-01T10:00:00Z'
  },

  profile: {
    id:
      'user-me',

    name:
      'Claudia Villanueva',

    alias:
      'Clau',

    age:
      29,

    bio:
      'Diseño & producto',

    avatar_url:
      null,

    interests: [
      'music',
      'travel'
    ],

    seeking: [
      'room',
      'mates'
    ],

    zones: [
      'Chamberí',
      'Centro'
    ],

    budget_min:
      700,

    budget_max:
      1100,

    move_in_date:
      '2026-11-15',

    duration:
      '12+'
  },

  preferences: {
    answers: {
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
  },

  matchPreferences: {
    living: {
      0: {
        option:
          1
      },

      1: {
        option:
          2
      }
    }
  }
};

const feature =
  window
    .ROOMS_OWN_PROFILE_FEATURE
    .create({
      state,

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

      formatBudget(profile) {
        if (
          profile.budget_min != null &&
          profile.budget_max != null
        ) {
          return `${profile.budget_min}–${profile.budget_max} €`;
        }

        return 'Sin definir';
      },

      roomsDnaLivingRows() {
        return [
          [
            'Limpieza',
            'Normal'
          ],

          [
            'Horarios',
            'Nocturno'
          ]
        ];
      }
    });

assert(
  feature?.renderOwnPublicProfile,
  'Falta renderOwnPublicProfile'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== OWN PROFILE · PRIVACIDAD ==='
);

assert(
  feature.canShowOwnProfileSection(
    'living',
    'public'
  ) === true,
  'Living público debería mostrarse'
);

assert(
  feature.canShowOwnProfileSection(
    'budget',
    'public'
  ) === false,
  'Budget connections no debe verse públicamente'
);

assert(
  feature.canShowOwnProfileSection(
    'budget',
    'connection'
  ) === true,
  'Budget connections debe verse para conexión'
);

state.preferences.answers.privacy.controls.search =
  'private';

assert(
  feature.canShowOwnProfileSection(
    'search',
    'public'
  ) === false,
  'Search privado no debe mostrarse'
);

state.preferences.answers.privacy.controls.search =
  'public';

ok(
  'Controles de privacidad respetados'
);


console.log(
  '\n=== OWN PROFILE · RENDER ==='
);

const modal =
  feature.renderOwnPublicProfile();

assert(
  modal?.id ===
    'ownPublicProfileModal',
  'No se crea ownPublicProfileModal'
);

assert(
  modal.querySelector(
    '#ownPublicVerification'
  ).textContent.includes(
    'EMAIL VERIFICADO'
  ),
  'No refleja email verificado'
);

assert(
  modal.querySelector(
    '#ownPublicName'
  ).textContent ===
    'Clau, 29',
  'Nombre o edad incorrectos'
);

assert(
  modal.querySelector(
    '#ownPublicBio'
  ).textContent ===
    'Diseño & producto',
  'Bio incorrecta'
);

assert(
  modal.querySelector(
    '#ownPublicSeeking'
  ).textContent.includes(
    'Habitación'
  ),
  'Seeking no renderiza Habitación'
);

assert(
  modal.querySelector(
    '#ownPublicSeeking'
  ).textContent.includes(
    'Compañeros'
  ),
  'Seeking no renderiza Compañeros'
);

assert(
  modal.querySelector(
    '#ownPublicZones'
  ).textContent.includes(
    'Chamberí'
  ),
  'Zonas no renderizadas'
);

assert(
  modal.querySelector(
    '#ownPublicDuration'
  ).textContent ===
    'Más de 1 año',
  'Duración incorrecta'
);

assert(
  modal.querySelector(
    '#ownPublicInterests'
  ).textContent.includes(
    'Música'
  ),
  'Interés Música no renderizado'
);

assert(
  modal.querySelector(
    '#ownPublicInterests'
  ).textContent.includes(
    'Viajes'
  ),
  'Interés Viajes no renderizado'
);

assert(
  modal.querySelector(
    '#ownPublicLiving'
  ).textContent.includes(
    'Limpieza'
  ),
  'Living no renderizado'
);

assert(
  modal.querySelector(
    '#ownPublicLiving'
  ).textContent.includes(
    'Nocturno'
  ),
  'Valores Living no renderizados'
);

const topBudget =
  modal.querySelector(
    '#ownPublicBudget'
  ).closest(
    'span'
  );

assert(
  topBudget.hidden ===
    true,
  'Budget connections debe ocultarse en vista pública'
);

const livingSection =
  modal.querySelector(
    '#ownPublicLiving'
  ).closest(
    '.user-section'
  );

assert(
  livingSection.hidden ===
    false,
  'Living público debe mostrarse'
);

ok(
  'Vista pública renderiza datos y privacidad'
);


console.log(
  '\n=== OWN PROFILE · AVATAR ==='
);

state.profile = {
  ...state.profile,

  avatar_url:
    'https://example.com/avatar.jpg'
};

feature.renderOwnPublicProfile();

const avatar =
  modal.querySelector(
    '#ownPublicAvatar img'
  );

assert(
  avatar?.getAttribute(
    'src'
  ) ===
    'https://example.com/avatar.jpg',
  'Avatar real no se renderiza'
);

ok(
  'Avatar real renderizado'
);


console.log(
  '\n=== OWN PROFILE · OPEN/CLOSE ==='
);

state.profile.avatar_url =
  null;

feature.openOwnPublicProfile();

assert(
  modal.classList.contains(
    'open'
  ),
  'openOwnPublicProfile no abre modal'
);

assert(
  modal.getAttribute(
    'aria-hidden'
  ) ===
    'false',
  'aria-hidden incorrecto al abrir'
);

assert(
  window.document.body.style.overflow ===
    'hidden',
  'Body no se bloquea al abrir'
);

const close =
  modal.querySelector(
    '[data-close-own-public-profile]'
  );

close.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles:
        true
    }
  )
);

assert(
  !modal.classList.contains(
    'open'
  ),
  'Modal no se cierra'
);

assert(
  modal.getAttribute(
    'aria-hidden'
  ) ===
    'true',
  'aria-hidden incorrecto al cerrar'
);

assert(
  window.document.body.style.overflow ===
    '',
  'Body no se libera al cerrar'
);

ok(
  'Apertura y cierre correctos'
);


console.log(
  '\n=== OWN PROFILE · SIN PERFIL ==='
);

const previousProfile =
  state.profile;

state.profile =
  null;

const emptyResult =
  feature.renderOwnPublicProfile();

assert(
  emptyResult ===
    undefined,
  'Sin profile debe devolver undefined'
);

state.profile =
  previousProfile;

ok(
  'Sin perfil no renderiza'
);


console.log(
  '\nROOMS OWN PROFILE FEATURE OK'
);
