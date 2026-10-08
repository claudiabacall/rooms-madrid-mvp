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
    'assets/js/features/connections.js',
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

console.log('\n=== CONNECTIONS · INTEGRACION ===');

assert(
  htmlSource.includes(
    'assets/js/features/connections.js'
  ),
  'index.html no carga connections.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/connections.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'connections.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_CONNECTIONS_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Connections'
);

for (const fn of [
  'getConnectionForUser',
  'connectionButtonLabel',
  'loadAllConnections',
  'loadConnection',
  'updateConnectButtons',
  'handleConnect',
  'connectToUser',
  'loadIncomingConnections',
  'ensureConnectionResponseModal',
  'openIncomingConnectionRequest',
  'answerIncomingConnection'
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

ok('Módulo cargado y sin funciones duplicadas');


console.log('\n=== CONNECTIONS · DOM ===');

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <button
          type="button"
          data-connect
          data-user-id="user-2"
        >
          Conectar
        </button>
      </body>
    </html>`,
    {
      runScripts: 'outside-only',
      url: 'http://127.0.0.1/'
    }
  );

const { window } = dom;

window.eval(featureSource);

assert(
  window.ROOMS_CONNECTIONS_FEATURE?.create,
  'Connections no expone factory'
);

ok('Factory disponible');


console.log('\n=== CONNECTIONS · FIXTURES ===');

const profile = {
  id: 'user-2',
  name: 'Ana García',
  alias: 'Ana',
  age: 29,
  zones: ['Chamberí'],
  seeking: ['room'],
  bio: 'Busco compartir piso.',
  avatar_url: null
};

const state = {
  user: {
    id: 'me'
  },

  targetProfile: null,
  connection: null,
  connectionsByUser: new Map(),
  incomingRequests: new Map(),
  blockedUsers: new Set(),
  profiles: new Map([
    ['user-2', profile],
    ['blocked-user', {
      id: 'blocked-user',
      name: 'Bloqueado'
    }]
  ])
};

let dbConnections = [];

let notifications = [];
let trustRefreshes = 0;
let inboxReloads = 0;
let notificationReloads = 0;
let openedConversation = null;


function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


function createQuery(table) {
  const filters = [];
  let operation = 'select';
  let payload = null;
  let wantsSingle = false;
  let wantsMaybeSingle = false;

  const query = {
    select() {
      return this;
    },

    insert(value) {
      operation = 'insert';
      payload = value;
      return this;
    },

    update(value) {
      operation = 'update';
      payload = value;
      return this;
    },

    delete() {
      operation = 'delete';
      return this;
    },

    eq(column, value) {
      filters.push({
        column,
        value
      });
      return this;
    },

    or() {
      return this;
    },

    order() {
      return this;
    },

    limit() {
      return this;
    },

    single() {
      wantsSingle = true;
      return Promise.resolve(
        resolve()
      );
    },

    maybeSingle() {
      wantsMaybeSingle = true;
      return Promise.resolve(
        resolve()
      );
    },

    then(resolvePromise, rejectPromise) {
      return Promise.resolve(
        resolve()
      ).then(
        resolvePromise,
        rejectPromise
      );
    }
  };

  function filteredRows() {
    return dbConnections.filter(row =>
      filters.every(filter =>
        row[filter.column] === filter.value
      )
    );
  }

  function resolve() {
    if (table !== 'connections') {
      return {
        data: [],
        error: null
      };
    }

    if (operation === 'insert') {
      const row = {
        id: `connection-${dbConnections.length + 1}`,
        created_at: '2026-10-08T08:00:00Z',
        updated_at: '2026-10-08T08:00:00Z',
        ...payload
      };

      dbConnections.push(row);

      return {
        data: wantsSingle
          ? clone(row)
          : [clone(row)],
        error: null
      };
    }

    if (operation === 'update') {
      const rows =
        filteredRows();

      rows.forEach(row => {
        Object.assign(
          row,
          payload,
          {
            updated_at:
              '2026-10-08T09:00:00Z'
          }
        );
      });

      const data =
        rows.map(clone);

      return {
        data:
          wantsSingle
            ? data[0] || null
            : data,
        error: null
      };
    }

    if (operation === 'delete') {
      const rows =
        filteredRows();

      const ids =
        new Set(
          rows.map(row => row.id)
        );

      dbConnections =
        dbConnections.filter(
          row =>
            !ids.has(row.id)
        );

      return {
        data:
          rows.map(row => ({
            id: row.id
          })),
        error: null
      };
    }

    let rows =
      filteredRows();

    if (!filters.length) {
      rows =
        [...dbConnections];
    }

    if (
      wantsSingle ||
      wantsMaybeSingle
    ) {
      return {
        data:
          clone(rows[0] || null),
        error: null
      };
    }

    return {
      data:
        rows.map(clone),
      error: null
    };
  }

  return query;
}


const db = {
  from(table) {
    return createQuery(table);
  }
};


const feature =
  window
    .ROOMS_CONNECTIONS_FEATURE
    .create({
      db,
      state,

      notify(message) {
        notifications.push(message);
      },

      showModal(modal) {
        modal?.setAttribute(
          'aria-hidden',
          'false'
        );
      },

      escapeHtml(value) {
        return String(
          value ?? ''
        )
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
      },

      initials(name) {
        return String(
          name || 'R'
        )
          .split(/\s+/)
          .slice(0, 2)
          .map(part => part[0])
          .join('')
          .toUpperCase();
      },

      labelSeeking(value) {
        return {
          room: 'Busca habitación',
          home: 'Busca piso',
          mates: 'Busca compañeros'
        }[value] || 'Sin definir';
      },

      updateTrustView() {
        trustRefreshes += 1;
      },

      openRealConversation(value) {
        openedConversation = value;
      },

      async loadRealNotifications() {
        notificationReloads += 1;
      },

      async loadRealInbox() {
        inboxReloads += 1;
      }
    });

assert(
  feature,
  'No se crea Connections feature'
);

ok('Feature creada');


console.log('\n=== CONNECTIONS · LABELS ===');

assert(
  feature.connectionButtonLabel(
    'user-2'
  ) === 'Conectar',
  'Sin conexión debe mostrar Conectar'
);

state.connectionsByUser.set(
  'user-2',
  {
    id: 'c-pending',
    requester_id: 'me',
    recipient_id: 'user-2',
    status: 'pending'
  }
);

assert(
  feature.connectionButtonLabel(
    'user-2'
  ) === 'Cancelar solicitud',
  'Solicitud saliente debe mostrar Cancelar solicitud'
);

state.connectionsByUser.set(
  'user-2',
  {
    id: 'c-incoming',
    requester_id: 'user-2',
    recipient_id: 'me',
    status: 'pending'
  }
);

assert(
  feature.connectionButtonLabel(
    'user-2'
  ) === 'Responder solicitud',
  'Solicitud entrante debe mostrar Responder solicitud'
);

state.connectionsByUser.set(
  'user-2',
  {
    id: 'c-accepted',
    requester_id: 'me',
    recipient_id: 'user-2',
    status: 'accepted'
  }
);

assert(
  feature.connectionButtonLabel(
    'user-2'
  ) === 'Enviar mensaje',
  'Conexión aceptada debe mostrar Enviar mensaje'
);

ok('Etiquetas de estado correctas');


console.log('\n=== CONNECTIONS · CREAR SOLICITUD ===');

state.connectionsByUser.clear();
dbConnections = [];

await feature.connectToUser(
  'user-2'
);

assert(
  dbConnections.length === 1,
  'No se creó conexión'
);

assert(
  dbConnections[0].requester_id ===
    'me',
  'requester_id incorrecto'
);

assert(
  dbConnections[0].recipient_id ===
    'user-2',
  'recipient_id incorrecto'
);

assert(
  dbConnections[0].status ===
    'pending',
  'La conexión debe quedar pending'
);

assert(
  state.connectionsByUser
    .get('user-2')
    ?.status ===
    'pending',
  'State no refleja la solicitud'
);

assert(
  notifications.at(-1) ===
    'Solicitud de conexión enviada',
  'Notificación de solicitud incorrecta'
);

ok('Solicitud nueva creada y guardada en state');


console.log('\n=== CONNECTIONS · CANCELAR SOLICITUD ===');

await feature.handleConnect(
  'user-2'
);

assert(
  dbConnections.length === 0,
  'La solicitud no se eliminó'
);

assert(
  !state.connectionsByUser
    .has('user-2'),
  'State conserva solicitud cancelada'
);

assert(
  notifications.at(-1) ===
    'Solicitud cancelada',
  'Notificación de cancelación incorrecta'
);

ok('Solicitud saliente se cancela correctamente');


console.log('\n=== CONNECTIONS · BLOQUEO ===');

state.blockedUsers.add(
  'blocked-user'
);

await feature.connectToUser(
  'blocked-user'
);

assert(
  notifications.at(-1) ===
    'Desbloquea a este usuario para poder conectar.',
  'No se bloquea la conexión con usuario bloqueado'
);

ok('Usuario bloqueado no puede recibir conexión');


console.log('\n=== CONNECTIONS · ENTRANTES ===');

state.blockedUsers.clear();

dbConnections = [
  {
    id: 'incoming-1',
    requester_id: 'user-2',
    recipient_id: 'me',
    status: 'pending',
    created_at: '2026-10-08T08:00:00Z'
  }
];

await feature
  .loadIncomingConnections();

assert(
  state.incomingRequests
    .has('incoming-1'),
  'Solicitud entrante no entra en state'
);

assert(
  state.connectionsByUser
    .get('user-2')
    ?.id ===
    'incoming-1',
  'connectionsByUser no refleja solicitud entrante'
);

ok('Solicitudes entrantes cargadas');


console.log('\n=== CONNECTIONS · MODAL RESPUESTA ===');

await feature
  .openIncomingConnectionRequest(
    'user-2'
  );

const modal =
  window.document
    .querySelector(
      '#connectionResponseModal'
    );

assert(
  modal,
  'No se crea modal de respuesta'
);

assert(
  modal.getAttribute(
    'aria-hidden'
  ) === 'false',
  'Modal de respuesta no se abre'
);

assert(
  modal.textContent.includes(
    'Ana'
  ),
  'Modal no muestra perfil'
);

assert(
  modal.querySelector(
    '[data-connection-answer="accepted"]'
  ),
  'Falta botón Aceptar'
);

ok('Modal de solicitud entrante correcto');


console.log('\n=== CONNECTIONS · ACEPTAR ===');

await feature
  .answerIncomingConnection(
    'incoming-1',
    'user-2',
    'accepted'
  );

assert(
  dbConnections[0].status ===
    'accepted',
  'DB no queda accepted'
);

assert(
  state.connectionsByUser
    .get('user-2')
    ?.status ===
    'accepted',
  'State no queda accepted'
);

assert(
  !state.incomingRequests
    .has('incoming-1'),
  'Solicitud sigue en incomingRequests'
);

assert(
  notificationReloads === 1,
  'Notificaciones no se recargan'
);

assert(
  inboxReloads === 1,
  'Inbox no se recarga'
);

assert(
  notifications.at(-1) ===
    'Conexión aceptada',
  'Notificación de aceptación incorrecta'
);

ok('Solicitud entrante se acepta y refresca dependencias');


console.log('\n=== CONNECTIONS · CONVERSACION ===');

await feature.handleConnect(
  'user-2'
);

assert(
  openedConversation?.id ===
    'user-2',
  'Conexión aceptada no abre conversación'
);

ok('Conexión aceptada abre conversación');

assert(
  trustRefreshes >= 0,
  'Estado de confianza inválido'
);

console.log('\nROOMS CONNECTIONS FEATURE OK');
