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

const moderationSource =
  fs.readFileSync(
    'assets/js/features/moderation.js',
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
  '\n=== MODERATION · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/moderation.js'
  ),
  'index.html no carga moderation.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/moderation.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'moderation.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_MODERATION_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Moderation'
);

for (
  const fn of [
    'openRealReport',
    'submitRealReport',
    'showMyRealReports',
    'loadUserBlocks',
    'updateBlockedUsersCount',
    'ensureBlockedUsersModal',
    'openBlockedUsersManager',
    'openRealBlock',
    'removeConnectionWithUser',
    'removeBlockedUserFromSavedAndGroups',
    'confirmRealBlock',
    'unblockRealUser'
  ]
) {
  const regex =
    new RegExp(
      `(?:async\\s+)?function\\s+${fn}\\s*\\(`
    );

  assert(
    !regex.test(appSource),
    `${fn} sigue duplicada en supabase-app.js`
  );
}

ok(
  'Moderation cargada y sin funciones duplicadas'
);


console.log(
  '\n=== MODERATION · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>

        <div
          class="modal"
          id="reportModal"
          aria-hidden="true"
        >
          <div id="reportTarget"></div>

          <div class="report-reasons">
            <button
              type="button"
              aria-checked="false"
            >
              Spam
            </button>
          </div>

          <textarea id="reportDetails"></textarea>

          <button
            id="submitReport"
            type="button"
          >
            Enviar reporte
          </button>
        </div>

        <div
          class="modal"
          id="blockModal"
          aria-hidden="true"
        >
          <h2>Bloquear usuario</h2>

          <button
            id="confirmBlock"
            type="button"
          >
            Bloquear usuario
          </button>
        </div>

        <span id="blockedUsersCount">
          0 personas
        </span>

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
  moderationSource
);

assert(
  window.ROOMS_MODERATION_FEATURE?.create,
  'Moderation no expone factory'
);

ok(
  'Factory Moderation disponible'
);


console.log(
  '\n=== MODERATION · FIXTURES ==='
);

const state = {
  user: {
    id: 'me'
  },

  reportTarget:
    null,

  blockTarget:
    null,

  blockedUsers:
    new Set(),

  connectionsByUser:
    new Map([
      [
        'user-2',
        {
          id:
            'connection-1'
        }
      ]
    ]),

  incomingRequests:
    new Map(),

  targetProfile:
    null,

  connection:
    null,

  savedItems:
    new Set([
      'person:user-2'
    ]),

  household:
    null,

  profiles:
    new Map()
};

const notifications = [];

let insertedReport =
  null;

let insertedBlock =
  null;

let savedReloads =
  0;

let inboxReloads =
  0;

let notificationReloads =
  0;

let connectRefreshes =
  0;


function result(
  data = null,
  error = null
) {
  return {
    data,
    error
  };
}


function makeQuery(table) {
  return {
    table,

    operation:
      'select',

    payload:
      null,

    select() {
      this.operation =
        'select';

      return this;
    },

    insert(payload) {
      this.operation =
        'insert';

      this.payload =
        payload;

      return this;
    },

    delete() {
      this.operation =
        'delete';

      return this;
    },

    eq() {
      return this;
    },

    match() {
      return this;
    },

    or() {
      return this;
    },

    order() {
      return Promise.resolve(
        resolveQuery(this)
      );
    },

    then(resolve, reject) {
      return Promise.resolve(
        resolveQuery(this)
      ).then(
        resolve,
        reject
      );
    }
  };
}


function resolveQuery(query) {
  if (
    query.table ===
      'reports'
  ) {
    if (
      query.operation ===
        'insert'
    ) {
      insertedReport =
        query.payload;

      return result();
    }

    return result([
      {
        id:
          'report-1',

        status:
          'pending',

        reason:
          'Spam',

        target_type:
          'profile',

        created_at:
          '2026-10-07T12:00:00Z'
      }
    ]);
  }

  if (
    query.table ===
      'user_blocks'
  ) {
    if (
      query.operation ===
        'select'
    ) {
      return result([
        {
          blocked_id:
            'user-2'
        }
      ]);
    }

    if (
      query.operation ===
        'insert'
    ) {
      insertedBlock =
        query.payload;
    }

    return result();
  }

  if (
    query.table ===
      'connections'
  ) {
    return result();
  }

  if (
    query.table ===
      'saved_items'
  ) {
    return result();
  }

  if (
    query.table ===
      'household_person_candidates'
  ) {
    return result();
  }

  return result();
}


const db = {
  from(table) {
    return makeQuery(
      table
    );
  },

  async rpc(name) {
    if (
      name ===
      'get_blocked_profiles'
    ) {
      return result([
        {
          id:
            'user-2',

          name:
            'Ana García',

          alias:
            'Ana',

          avatar_url:
            null
        }
      ]);
    }

    return result([]);
  }
};


function notify(message) {
  notifications.push(
    message
  );
}


function showModal(modal) {
  modal?.setAttribute(
    'aria-hidden',
    'false'
  );
}


function hideAllModals() {
  window.document
    .querySelectorAll(
      '.modal'
    )
    .forEach(
      modal =>
        modal.setAttribute(
          'aria-hidden',
          'true'
        )
    );
}


const feature =
  window
    .ROOMS_MODERATION_FEATURE
    .create({
      db,

      state,

      notify,

      showModal,

      hideAllModals,

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

      updateConnectButtons() {
        connectRefreshes +=
          1;
      },

      async loadSavedItems() {
        savedReloads +=
          1;
      },

      async loadHouseholdCandidates() {},

      async loadRealInbox() {
        inboxReloads +=
          1;
      },

      async loadRealNotifications() {
        notificationReloads +=
          1;
      },

      openRealUser() {}
    });

assert(
  feature,
  'No se crea Moderation feature'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== MODERATION · REPORTAR ==='
);

const reportButton =
  window.document
    .createElement(
      'button'
    );

reportButton.dataset.reportType =
  'profile';

reportButton.dataset.reportId =
  'user-2';

reportButton.dataset.reportUser =
  'user-2';

feature.openRealReport(
  reportButton
);

assert(
  state.reportTarget?.id ===
    'user-2',
  'openRealReport no guarda target'
);

assert(
  window.document
    .querySelector(
      '#reportModal'
    )
    .getAttribute(
      'aria-hidden'
    ) === 'false',
  'Modal de reporte no abre'
);

await feature
  .submitRealReport();

assert(
  notifications.at(-1) ===
    'Selecciona un motivo para continuar.',
  'Reporte sin motivo debería bloquearse'
);

const reason =
  window.document
    .querySelector(
      '.report-reasons button'
    );

reason.setAttribute(
  'aria-checked',
  'true'
);

window.document
  .querySelector(
    '#reportDetails'
  )
  .value =
    'Contenido no deseado';

await feature
  .submitRealReport();

assert(
  insertedReport
    ?.reporter_id ===
    'me',
  'reporter_id incorrecto'
);

assert(
  insertedReport
    ?.reported_user_id ===
    'user-2',
  'reported_user_id incorrecto'
);

assert(
  insertedReport
    ?.reason ===
    'Spam',
  'motivo incorrecto'
);

assert(
  state.reportTarget ===
    null,
  'reportTarget no se limpia'
);

ok(
  'Reporte valida, persiste y limpia estado'
);


console.log(
  '\n=== MODERATION · CARGAR BLOQUEOS ==='
);

await feature
  .loadUserBlocks();

assert(
  state.blockedUsers
    .has(
      'user-2'
    ),
  'loadUserBlocks no carga usuario'
);

assert(
  window.document
    .querySelector(
      '#blockedUsersCount'
    )
    .textContent
    .includes(
      '1 persona'
    ),
  'contador de bloqueados incorrecto'
);

ok(
  'Bloqueos cargados y contador actualizado'
);


console.log(
  '\n=== MODERATION · MANAGER ==='
);

await feature
  .openBlockedUsersManager();

const manager =
  window.document
    .querySelector(
      '#blockedUsersModal'
    );

assert(
  manager,
  'No se crea modal de bloqueados'
);

assert(
  manager.textContent.includes(
    'Ana'
  ),
  'Usuario bloqueado no aparece'
);

assert(
  manager.querySelector(
    '[data-unblock-user="user-2"]'
  ),
  'Botón de desbloquear ausente'
);

ok(
  'Manager de bloqueados renderiza perfiles'
);


console.log(
  '\n=== MODERATION · BLOQUEAR ==='
);

state.blockedUsers.clear();

const blockTarget =
  window.document
    .createElement(
      'button'
    );

blockTarget.dataset.realBlockUser =
  'user-2';

blockTarget.dataset.realBlockName =
  'Ana';

feature.openRealBlock(
  blockTarget
);

assert(
  state.blockTarget?.id ===
    'user-2',
  'openRealBlock no guarda target'
);

await feature
  .confirmRealBlock();

assert(
  insertedBlock
    ?.blocker_id ===
    'me',
  'blocker_id incorrecto'
);

assert(
  insertedBlock
    ?.blocked_id ===
    'user-2',
  'blocked_id incorrecto'
);

assert(
  state.blockedUsers
    .has(
      'user-2'
    ),
  'Usuario no queda bloqueado en state'
);

assert(
  !state.connectionsByUser
    .has(
      'user-2'
    ),
  'Conexión no se elimina del state'
);

assert(
  !state.savedItems
    .has(
      'person:user-2'
    ),
  'Perfil bloqueado no se limpia de savedItems'
);

assert(
  savedReloads === 1,
  'Guardados no se recargan'
);

assert(
  inboxReloads === 1,
  'Inbox no se recarga'
);

assert(
  notificationReloads === 1,
  'Notificaciones no se recargan'
);

assert(
  connectRefreshes >= 1,
  'Botones de conexión no se actualizan'
);

ok(
  'Bloqueo limpia relaciones y refresca estado'
);


console.log(
  '\n=== MODERATION · DESBLOQUEAR ==='
);

window.confirm =
  () => true;

manager.setAttribute(
  'aria-hidden',
  'true'
);

await feature
  .unblockRealUser(
    'user-2',
    'Ana'
  );

assert(
  !state.blockedUsers
    .has(
      'user-2'
    ),
  'Usuario sigue bloqueado tras desbloquear'
);

ok(
  'Desbloqueo correcto'
);


console.log(
  '\nROOMS MODERATION FEATURE OK'
);
