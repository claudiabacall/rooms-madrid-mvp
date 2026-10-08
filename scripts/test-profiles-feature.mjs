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
    'assets/js/features/profiles.js',
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

const profileEditorSource =
  fs.readFileSync(
    'assets/js/features/profile-editor.js',
    'utf8'
  );

const ownProfileSource =
  fs.readFileSync(
    'assets/js/features/own-profile.js',
    'utf8'
  );


console.log(
  '\n=== PROFILES FEATURE · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/profiles.js'
  ),
  'index.html no carga profiles.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/profiles.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'profiles.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_PROFILES_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Profiles'
);

assert(
  !/async\s+function\s+openRealUser\s*\(/.test(
    appSource
  ),
  'openRealUser sigue duplicada en supabase-app.js'
);

assert(
  !/function\s+ensureProfileEditorModal\s*\(/.test(
    appSource
  ),
  'ensureProfileEditorModal no debe seguir en supabase-app.js'
);

assert(
  /function\s+ensureProfileEditorModal\s*\(/.test(
    profileEditorSource
  ),
  'ensureProfileEditorModal debe vivir en profile-editor.js'
);

assert(
  !/function\s+renderOwnPublicProfile\s*\(/.test(
    appSource
  ),
  'renderOwnPublicProfile no debe seguir en supabase-app.js'
);

assert(
  /function\s+renderOwnPublicProfile\s*\(/.test(
    ownProfileSource
  ),
  'renderOwnPublicProfile debe vivir en own-profile.js'
);

ok(
  'Perfil ajeno extraído sin arrastrar perfil propio'
);


console.log(
  '\n=== PROFILES FEATURE · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>

        <div
          id="userProfileModal"
          aria-hidden="true"
        >
          <div class="profile-hero"></div>

          <div class="user-profile-content"></div>

          <div class="profile-fixed-actions">
            CTA antiguo
          </div>
        </div>

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
  window.ROOMS_PROFILES_FEATURE?.create,
  'Profiles no expone factory'
);

ok(
  'Factory Profiles disponible'
);


console.log(
  '\n=== PROFILES FEATURE · FIXTURES ==='
);

const state = {
  targetProfile:
    null,

  savedItems:
    new Set([
      'person:user-target'
    ]),

  blockedUsers:
    new Set()
};

const connectionCalls =
  [];

let updateConnectCalls =
  0;

let shownModal =
  null;

const feature =
  window
    .ROOMS_PROFILES_FEATURE
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

      initials(name) {
        return String(
          name || 'R'
        )
          .split(/\s+/)
          .slice(0, 2)
          .map(
            part =>
              part[0]
          )
          .join('')
          .toUpperCase();
      },

      labelSeeking(value) {
        const labels = {
          room:
            'Habitación',

          flat:
            'Piso',

          mates:
            'Compañeros'
        };

        return (
          labels[value] ||
          value
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

      async loadConnection(userId) {
        connectionCalls.push(
          userId
        );
      },

      connectionButtonLabel() {
        return 'Conectar';
      },

      updateConnectButtons() {
        updateConnectCalls += 1;
      },

      showModal(modal) {
        shownModal =
          modal;

        modal.classList.add(
          'open'
        );

        modal.setAttribute(
          'aria-hidden',
          'false'
        );
      }
    });

assert(
  feature?.openRealUser,
  'Profiles no expone openRealUser'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== PROFILES FEATURE · PERFIL NORMAL ==='
);

const profile = {
  id:
    'user-target',

  alias:
    'Ana',

  name:
    'Ana García',

  age:
    29,

  bio:
    'Trabajo en diseño <Madrid>',

  avatar_url:
    null,

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
    1000,

  move_in_date:
    '2026-11-15',

  duration:
    'long',

  traits: [
    'tidy',
    'social'
  ],

  interests: [
    'Arte',
    'Viajes'
  ]
};

await feature.openRealUser(
  profile
);

const modal =
  window.document
    .querySelector(
      '#userProfileModal'
    );

const content =
  modal.querySelector(
    '.user-profile-content'
  );

assert(
  state.targetProfile ===
    profile,
  'No se guarda targetProfile'
);

assert(
  connectionCalls.length ===
    1 &&
  connectionCalls[0] ===
    'user-target',
  'Debe cargar la conexión del perfil'
);

assert(
  content.textContent.includes(
    'Ana'
  ),
  'No se renderiza nombre'
);

assert(
  content.textContent.includes(
    'Habitación'
  ),
  'No se renderiza seeking'
);

assert(
  content.textContent.includes(
    'Chamberí'
  ),
  'No se renderizan zonas'
);

assert(
  content.textContent.includes(
    '700–1000 €'
  ),
  'No se renderiza presupuesto'
);

assert(
  content.querySelector(
    '[data-open-real-match="user-target"]'
  ),
  'Falta CTA de compatibilidad'
);

assert(
  content.querySelector(
    '[data-connect][data-user-id="user-target"]'
  ),
  'Falta CTA conectar'
);

assert(
  content.querySelector(
    '[data-send-person-home="user-target"]'
  ),
  'Falta CTA añadir a grupo'
);

const saveButton =
  content.querySelector(
    '[data-person-save][data-save-id="user-target"]'
  );

assert(
  saveButton,
  'Falta CTA guardar'
);

assert(
  saveButton.classList.contains(
    'saved'
  ),
  'Perfil guardado no aparece marcado'
);

assert(
  saveButton.textContent.includes(
    'Guardado'
  ),
  'CTA guardado tiene texto incorrecto'
);

assert(
  content.querySelector(
    '[data-real-report][data-report-user="user-target"]'
  ),
  'Falta Reportar perfil'
);

assert(
  content.querySelector(
    '[data-real-block-user="user-target"]'
  ),
  'Falta Bloquear usuario'
);

assert(
  !content.innerHTML.includes(
    '<Madrid>'
  ),
  'Bio no se escapa correctamente'
);

const fixedActions =
  modal.querySelector(
    '.profile-fixed-actions'
  );

assert(
  fixedActions.hidden ===
    true,
  'CTA inferior duplicado debe ocultarse'
);

assert(
  fixedActions.innerHTML ===
    '',
  'CTA inferior duplicado debe vaciarse'
);

assert(
  updateConnectCalls ===
    1,
  'Debe actualizar botones de conexión'
);

assert(
  shownModal ===
    modal,
  'Debe abrir userProfileModal'
);

ok(
  'Perfil normal renderiza datos y acciones'
);


console.log(
  '\n=== PROFILES FEATURE · AVATAR ==='
);

await feature.openRealUser({
  ...profile,

  avatar_url:
    'https://example.com/ana.jpg'
});

assert(
  modal.querySelector(
    '.profile-hero img'
  )?.getAttribute(
    'src'
  ) ===
    'https://example.com/ana.jpg',
  'Avatar real no se renderiza'
);

ok(
  'Avatar real renderizado'
);


console.log(
  '\n=== PROFILES FEATURE · BLOQUEADO ==='
);

state.blockedUsers.add(
  'user-target'
);

await feature.openRealUser(
  profile
);

const blockedContent =
  modal.querySelector(
    '.user-profile-content'
  );

const connectButton =
  blockedContent.querySelector(
    '[data-connect]'
  );

assert(
  connectButton?.disabled ===
    true,
  'Usuario bloqueado debe tener conectar deshabilitado'
);

assert(
  connectButton.textContent.includes(
    'Bloqueado'
  ),
  'CTA bloqueado incorrecto'
);

assert(
  !blockedContent.querySelector(
    '[data-open-real-match]'
  ),
  'Usuario bloqueado no debe mostrar compatibilidad'
);

assert(
  !blockedContent.querySelector(
    '[data-send-person-home]'
  ),
  'Usuario bloqueado no debe poder añadirse a grupo'
);

assert(
  !blockedContent.querySelector(
    '[data-person-save]'
  ),
  'Usuario bloqueado no debe poder guardarse'
);

assert(
  blockedContent
    .querySelector(
      '[data-real-block-user]'
    )
    ?.textContent
    .includes(
      'Desbloquear'
    ),
  'Debe ofrecer Desbloquear usuario'
);

ok(
  'Estado bloqueado limita acciones'
);


console.log(
  '\n=== PROFILES FEATURE · SIN PERFIL ==='
);

const callsBeforeEmpty =
  connectionCalls.length;

await feature.openRealUser(
  null
);

assert(
  connectionCalls.length ===
    callsBeforeEmpty,
  'Sin perfil no debe cargar conexión'
);

ok(
  'Sin perfil no ejecuta acciones'
);


console.log(
  '\nROOMS PROFILES FEATURE OK'
);
