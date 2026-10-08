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
    'assets/js/features/matching.js',
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


console.log(
  '\n=== MATCHING FEATURE · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/matching.js'
  ),
  'index.html no carga matching.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/matching.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'matching.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_MATCHING_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Matching'
);

for (const fn of [
  'normalizeMatchValue',
  'calculateRealMatch',
  'loadRealMatchProfile',
  'ensureRealMatchModal',
  'openRealMatch'
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

const profilesSource =
  fs.readFileSync(
    'assets/js/features/profiles.js',
    'utf8'
  );

assert(
  !/async\s+function\s+openRealUser\s*\(/.test(
    appSource
  ),
  'openRealUser no debe seguir en supabase-app.js'
);

assert(
  /async\s+function\s+openRealUser\s*\(/.test(
    profilesSource
  ),
  'openRealUser debe vivir en profiles.js'
);

ok(
  'Matching aislado y Profiles separado'
);


console.log(
  '\n=== MATCHING FEATURE · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <div
          id="matchModal"
          aria-hidden="true"
        ></div>
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
  window.ROOMS_MATCHING_FEATURE?.create,
  'Matching no expone factory'
);

ok(
  'Factory Matching disponible'
);


console.log(
  '\n=== MATCHING FEATURE · FIXTURES ==='
);

const state = {
  user: {
    id: 'user-me'
  },

  profile: {
    zones: [
      'Chamberí',
      'Centro'
    ],

    budget_min:
      700,

    budget_max:
      1100,

    move_in_date:
      '2026-11-01',

    duration:
      'long'
  },

  preferences: {
    answers: {
      living: {
        0: {
          option: 1
        },

        1: {
          option: 2
        }
      }
    }
  },

  blockedUsers:
    new Set()
};

let rpcCalls = [];
let rpcData = null;
let rpcError = null;
let shownModal = null;

const db = {
  async rpc(
    name,
    payload
  ) {
    rpcCalls.push({
      name,
      payload
    });

    return {
      data:
        rpcData,

      error:
        rpcError
    };
  }
};

const feature =
  window
    .ROOMS_MATCHING_FEATURE
    .create({
      db,
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
  feature,
  'No se crea Matching feature'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== MATCHING FEATURE · NORMALIZACION ==='
);

assert(
  feature.normalizeMatchValue(
    '  CHAMBERÍ '
  ) ===
    'chamberí',
  'normalizeMatchValue incorrecto'
);

ok(
  'Normalización correcta'
);


console.log(
  '\n=== MATCHING FEATURE · CALCULO ==='
);

const match =
  feature.calculateRealMatch({
    zones: [
      'chamberí'
    ],

    budget_min:
      800,

    budget_max:
      1200,

    move_in_date:
      '2026-11-15',

    duration:
      'long',

    living_visible:
      true,

    living: {
      0: {
        option: 1
      },

      1: {
        option: 3
      }
    },

    seeking: [
      'room'
    ]
  });

assert(
  match.comparedFactors === 5,
  `Esperaba 5 factores y hay ${match.comparedFactors}`
);

assert(
  match.factors.find(
    item =>
      item.key ===
      'zones'
  )?.score === 100,
  'Zonas compatibles deberían puntuar 100'
);

assert(
  match.factors.find(
    item =>
      item.key ===
      'budget'
  )?.score === 100,
  'Presupuesto solapado debería puntuar 100'
);

assert(
  match.factors.find(
    item =>
      item.key ===
      'date'
  )?.score === 100,
  'Fecha a 14 días debería puntuar 100'
);

assert(
  match.factors.find(
    item =>
      item.key ===
      'duration'
  )?.score === 100,
  'Duración igual debería puntuar 100'
);

assert(
  match.factors.find(
    item =>
      item.key ===
      'living'
  )?.score === 75,
  'Convivencia debería promediar 75'
);

assert(
  match.score === 95,
  `Score esperado 95 y salió ${match.score}`
);

ok(
  'Cálculo de compatibilidad correcto'
);


console.log(
  '\n=== MATCHING FEATURE · PRIVACIDAD LIVING ==='
);

const privateLiving =
  feature.calculateRealMatch({
    zones:
      [],

    living_visible:
      false,

    living: {
      0: {
        option: 1
      }
    }
  });

assert(
  !privateLiving.factors.some(
    item =>
      item.key ===
      'living'
  ),
  'Living privado no debe entrar en el cálculo'
);

ok(
  'Privacidad de convivencia respetada'
);


console.log(
  '\n=== MATCHING FEATURE · RPC ==='
);

rpcData = {
  zones: [
    'Chamberí'
  ]
};

const loaded =
  await feature
    .loadRealMatchProfile(
      'user-target'
    );

assert(
  rpcCalls.length === 1,
  'Debe ejecutarse una RPC'
);

assert(
  rpcCalls[0].name ===
    'get_match_profile',
  'RPC incorrecta'
);

assert(
  rpcCalls[0]
    .payload
    .target_user_id ===
    'user-target',
  'target_user_id incorrecto'
);

assert(
  loaded?.zones?.[0] ===
    'Chamberí',
  'No devuelve datos RPC'
);

ok(
  'Perfil de match carga por RPC'
);


console.log(
  '\n=== MATCHING FEATURE · MODAL ==='
);

const modal =
  feature.ensureRealMatchModal();

assert(
  modal?.querySelector(
    '#realMatchContent'
  ),
  'No se prepara realMatchContent'
);

assert(
  modal.querySelector(
    '[data-close-real-match]'
  ),
  'Falta control de cierre'
);

ok(
  'Modal Matching preparado'
);


console.log(
  '\n=== MATCHING FEATURE · OPEN ==='
);

rpcData = {
  zones: [
    'Chamberí'
  ],

  budget_min:
    800,

  budget_max:
    1000,

  move_in_date:
    '2026-11-01',

  duration:
    'long',

  living_visible:
    false,

  seeking: [
    'room'
  ]
};

await feature.openRealMatch({
  id:
    'user-target',

  alias:
    'Ana'
});

const content =
  modal.querySelector(
    '#realMatchContent'
  );

assert(
  shownModal === modal,
  'openRealMatch no abre matchModal'
);

assert(
  content.textContent.includes(
    'ANA'
  ),
  'No se renderiza el nombre'
);

assert(
  content.textContent.includes(
    '%'
  ),
  'No se renderiza porcentaje'
);

assert(
  content.querySelector(
    '.real-match-hero'
  ),
  'Falta hero de compatibilidad'
);

ok(
  'openRealMatch carga y renderiza compatibilidad'
);


console.log(
  '\n=== MATCHING FEATURE · BLOQUEADOS ==='
);

const callsBeforeBlock =
  rpcCalls.length;

state.blockedUsers.add(
  'blocked-user'
);

await feature.openRealMatch({
  id:
    'blocked-user',

  alias:
    'Blocked'
});

assert(
  rpcCalls.length ===
    callsBeforeBlock,
  'Usuario bloqueado no debe consultar RPC'
);

ok(
  'Usuario bloqueado no abre Matching'
);


console.log(
  '\n=== MATCHING FEATURE · SIN USUARIO ==='
);

state.user =
  null;

const callsBeforeLogout =
  rpcCalls.length;

const noUser =
  await feature
    .loadRealMatchProfile(
      'user-target'
    );

assert(
  noUser === null,
  'Sin sesión debe devolver null'
);

assert(
  rpcCalls.length ===
    callsBeforeLogout,
  'Sin sesión no debe llamar RPC'
);

ok(
  'Sin usuario no consulta Matching'
);


console.log(
  '\nROOMS MATCHING FEATURE OK'
);
