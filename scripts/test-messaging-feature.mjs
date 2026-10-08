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
    'assets/js/features/messaging.js',
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

console.log('\n=== MESSAGING · INTEGRACION ===');

assert(
  htmlSource.includes(
    'assets/js/features/messaging.js'
  ),
  'index.html no carga messaging.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/messaging.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'messaging.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_MESSAGING_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Messaging'
);

const functions = [
  'loadConversationPreferences',
  'getConversationPreference',
  'saveConversationPreference',
  'toggleConversationMute',
  'deleteConversationForMe',
  'loadRealNotifications',
  'loadRealInbox',
  'ensureConversationOptionsMenu',
  'renderConversationOptionsMenu',
  'closeConversationOptionsMenu',
  'openRealConversation',
  'renderMessages',
  'messageBubble',
  'sendMessage',
  'subscribeToMessages'
];

for (const fn of functions) {
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


console.log('\n=== MESSAGING · DOM ===');

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>

        <button id="openNotifications">
          Avisos
          <i></i>
        </button>

        <div id="notificationsModal">
          <div class="notification-list"></div>
        </div>

        <div id="chatInboxModal">
          <input id="chatInboxSearch">
          <div class="conversation-list"></div>
        </div>

        <div
          class="modal"
          id="conversationModal"
          aria-hidden="true"
        >
          <div class="conversation-shell">
            <header>
              <span id="conversationSymbol"></span>
              <img id="conversationAvatar" hidden>
              <b id="conversationName"></b>
              <small id="conversationContext"></small>
            </header>

            <div id="conversationBody"></div>

            <input id="conversationInput">
          </div>
        </div>

      </body>
    </html>`,
    {
      runScripts: 'outside-only',
      url: 'http://127.0.0.1/'
    }
  );

const { window } = dom;

window.confirm = () => true;

window.eval(featureSource);

assert(
  window.ROOMS_MESSAGING_FEATURE?.create,
  'Messaging no expone factory'
);

ok('Factory Messaging disponible');


console.log('\n=== MESSAGING · FIXTURES ===');

const ana = {
  id: 'user-2',
  name: 'Ana García',
  alias: 'Ana',
  avatar_url: null
};

const state = {
  user: {
    id: 'me'
  },

  chatTarget: ana,

  blockedUsers: new Set(),

  conversationPreferences:
    new Map(),

  incomingRequests:
    new Map(),

  channel: null
};

let connections = [
  {
    id: 'connection-1',
    requester_id: 'me',
    recipient_id: 'user-2',
    status: 'accepted',
    created_at: '2026-10-08T08:00:00Z',
    updated_at: '2026-10-08T08:00:00Z'
  }
];

let messages = [
  {
    id: 'message-1',
    sender_id: 'user-2',
    recipient_id: 'me',
    body: 'Hola Claudia',
    created_at: '2026-10-08T08:30:00Z',
    read_at: null
  }
];

let preferenceRows = [];

let notifications = [];

let hiddenModals = 0;
let removedChannels = 0;
let realtimeCallback = null;
let channelName = null;


function clone(value) {
  if (value == null) {
    return value;
  }

  return JSON.parse(
    JSON.stringify(value)
  );
}


function applyFilters(rows, filters) {
  return rows.filter(row =>
    filters.every(filter => {
      if (filter.kind === 'eq') {
        return (
          row[filter.column] ===
          filter.value
        );
      }

      if (filter.kind === 'is') {
        return (
          row[filter.column] ===
          filter.value
        );
      }

      if (filter.kind === 'lte') {
        return (
          new Date(
            row[filter.column]
          ).getTime() <=
          new Date(
            filter.value
          ).getTime()
        );
      }

      return true;
    })
  );
}


function createQuery(table) {
  let operation = 'select';
  let payload = null;
  let singleResult = false;
  let orderBy = null;

  const filters = [];

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

    upsert(value) {
      operation = 'upsert';
      payload = value;
      return this;
    },

    delete() {
      operation = 'delete';
      return this;
    },

    eq(column, value) {
      filters.push({
        kind: 'eq',
        column,
        value
      });

      return this;
    },

    is(column, value) {
      filters.push({
        kind: 'is',
        column,
        value
      });

      return this;
    },

    lte(column, value) {
      filters.push({
        kind: 'lte',
        column,
        value
      });

      return this;
    },

    or() {
      return this;
    },

    order(column, options = {}) {
      orderBy = {
        column,
        ascending:
          options.ascending !== false
      };

      return this;
    },

    limit() {
      return this;
    },

    single() {
      singleResult = true;

      return Promise.resolve(
        resolveQuery()
      );
    },

    maybeSingle() {
      singleResult = true;

      return Promise.resolve(
        resolveQuery()
      );
    },

    then(resolve, reject) {
      return Promise.resolve(
        resolveQuery()
      ).then(
        resolve,
        reject
      );
    }
  };


  function sourceRows() {
    if (table === 'messages') {
      return messages;
    }

    if (table === 'connections') {
      return connections;
    }

    return preferenceRows;
  }


  function resolveQuery() {
    const source =
      sourceRows();

    if (operation === 'insert') {
      if (table === 'messages') {
        const row = {
          id:
            `message-${messages.length + 1}`,
          created_at:
            '2026-10-08T10:00:00Z',
          read_at: null,
          ...payload
        };

        messages.push(row);

        return {
          data:
            singleResult
              ? clone(row)
              : [clone(row)],
          error: null
        };
      }

      return {
        data: clone(payload),
        error: null
      };
    }


    if (operation === 'update') {
      const rows =
        applyFilters(
          source,
          filters
        );

      rows.forEach(row => {
        Object.assign(
          row,
          payload
        );
      });

      return {
        data:
          singleResult
            ? clone(rows[0] || null)
            : clone(rows),
        error: null
      };
    }


    if (operation === 'upsert') {
      const row =
        Array.isArray(payload)
          ? payload[0]
          : payload;

      const index =
        preferenceRows.findIndex(item => {
          const candidates = [
            ['user_id', 'other_user_id'],
            ['user_id', 'peer_id'],
            ['owner_id', 'other_user_id'],
            ['owner_id', 'profile_id']
          ];

          return candidates.some(
            ([a, b]) =>
              row?.[a] != null &&
              row?.[b] != null &&
              item?.[a] === row[a] &&
              item?.[b] === row[b]
          );
        });

      if (index >= 0) {
        preferenceRows[index] = {
          ...preferenceRows[index],
          ...clone(row)
        };
      } else {
        preferenceRows.push(
          clone(row)
        );
      }

      return {
        data:
          singleResult
            ? clone(row)
            : [clone(row)],
        error: null
      };
    }


    let rows =
      applyFilters(
        source,
        filters
      );

    if (orderBy) {
      rows =
        [...rows].sort((a, b) => {
          const left =
            a[orderBy.column];

          const right =
            b[orderBy.column];

          const leftTime =
            Date.parse(left);

          const rightTime =
            Date.parse(right);

          let comparison;

          if (
            Number.isFinite(leftTime) &&
            Number.isFinite(rightTime)
          ) {
            comparison =
              leftTime - rightTime;
          } else {
            comparison =
              String(left ?? '')
                .localeCompare(
                  String(right ?? '')
                );
          }

          return orderBy.ascending
            ? comparison
            : -comparison;
        });
    }

    /*
      Los .or(...) se dejan neutros aquí.
      Las fixtures solo contienen registros
      pertenecientes al usuario actual.
    */

    if (singleResult) {
      return {
        data:
          clone(rows[0] || null),
        error: null
      };
    }

    return {
      data: clone(rows),
      error: null
    };
  }

  return query;
}


const db = {
  from(table) {
    return createQuery(table);
  },

  channel(name) {
    channelName = name;

    const channel = {
      on(
        type,
        config,
        callback
      ) {
        assert(
          type ===
            'postgres_changes',
          'Realtime debe usar postgres_changes'
        );

        assert(
          config?.table ===
            'messages',
          'Realtime debe escuchar messages'
        );

        realtimeCallback =
          callback;

        return channel;
      },

      subscribe() {
        return channel;
      }
    };

    return channel;
  },

  removeChannel() {
    removedChannels += 1;
  }
};


const acceptedConnection = {
  id: 'connection-1',
  requester_id: 'me',
  recipient_id: 'user-2',
  status: 'accepted'
};


const feature =
  window
    .ROOMS_MESSAGING_FEATURE
    .create({
      db,
      state,

      notify(message) {
        notifications.push(message);
      },

      showModal(element) {
        if (!element) return;

        element.classList.add(
          'open'
        );

        element.setAttribute(
          'aria-hidden',
          'false'
        );
      },

      hideAllModals() {
        hiddenModals += 1;

        window.document
          .querySelectorAll('.modal')
          .forEach(element => {
            element.classList.remove(
              'open'
            );

            element.setAttribute(
              'aria-hidden',
              'true'
            );
          });
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

      relativeTime() {
        return 'AHORA';
      },

      async fetchProfiles(ids) {
        return new Map(
          ids.map(id => [
            id,
            id === 'user-2'
              ? ana
              : {
                  id,
                  name: 'Usuario'
                }
          ])
        );
      },

      getConnectionForUser(userId) {
        return (
          userId === 'user-2'
            ? acceptedConnection
            : null
        );
      },

      async loadConnection(userId) {
        return (
          userId === 'user-2'
            ? acceptedConnection
            : null
        );
      }
    });

assert(
  feature,
  'No se crea Messaging feature'
);

ok('Feature creada');


console.log('\n=== MESSAGING · PREFERENCIA DEFAULT ===');

const preference =
  feature
    .getConversationPreference(
      'user-2'
    );

assert(
  preference &&
    preference.muted === false,
  'Preferencia por defecto debe estar sin silenciar'
);

ok('Preferencia por defecto correcta');


console.log('\n=== MESSAGING · BURBUJAS ===');

const ownBubble =
  feature.messageBubble({
    sender_id: 'me',
    recipient_id: 'user-2',
    body: '<Hola>',
    created_at:
      '2026-10-08T09:00:00Z'
  });

assert(
  ownBubble.includes(
    'chat-message mine'
  ),
  'Mensaje propio debe renderizarse como mine'
);

assert(
  ownBubble.includes(
    '&lt;Hola&gt;'
  ),
  'El cuerpo del mensaje debe escaparse'
);

const otherBubble =
  feature.messageBubble({
    sender_id: 'user-2',
    recipient_id: 'me',
    body: 'Buenas',
    created_at:
      '2026-10-08T09:01:00Z'
  });

assert(
  otherBubble.includes(
    'chat-message other'
  ),
  'Mensaje recibido debe renderizarse como other'
);

assert(
  otherBubble.includes('Ana'),
  'Mensaje recibido debe mostrar el nombre'
);

ok('Burbujas propias y recibidas correctas');


console.log('\n=== MESSAGING · RENDER CHAT ===');

await feature.renderMessages();

const conversationBody =
  window.document.querySelector(
    '#conversationBody'
  );

assert(
  conversationBody.textContent.includes(
    'Hola Claudia'
  ),
  'La conversación no renderiza mensajes'
);

assert(
  conversationBody.querySelector(
    '.chat-message.other'
  ),
  'Mensaje recibido no tiene clase other'
);

ok('Historial de conversación renderizado');


console.log('\n=== MESSAGING · ENVIAR ===');

await feature.sendMessage(
  '   Mensaje nuevo   '
);

const sent =
  messages.find(
    item =>
      item.sender_id === 'me' &&
      item.recipient_id ===
        'user-2' &&
      item.body ===
        'Mensaje nuevo'
  );

assert(
  sent,
  'sendMessage no insertó el mensaje limpio'
);

assert(
  conversationBody.textContent.includes(
    'Mensaje nuevo'
  ),
  'El chat no se re-renderizó tras enviar'
);

ok('Envío persiste y re-renderiza');


console.log('\n=== MESSAGING · INBOX ===');

await feature.loadRealInbox();

const inbox =
  window.document.querySelector(
    '#chatInboxModal .conversation-list'
  );

assert(
  inbox.querySelector(
    '[data-real-chat="user-2"]'
  ),
  'Inbox no renderiza la conversación aceptada'
);

assert(
  inbox.textContent.includes('Ana'),
  'Inbox no muestra el perfil'
);

assert(
  inbox.textContent.includes(
    'Mensaje nuevo'
  ),
  'Inbox no muestra el último mensaje'
);

ok('Inbox real renderizado');


console.log('\n=== MESSAGING · NOTIFICACIONES ===');

messages.push({
  id: 'message-unread',
  sender_id: 'user-2',
  recipient_id: 'me',
  body: 'Mensaje pendiente',
  created_at:
    '2026-10-08T10:15:00Z',
  read_at: null
});

await feature
  .loadRealNotifications();

const notificationList =
  window.document.querySelector(
    '#notificationsModal .notification-list'
  );

assert(
  notificationList.textContent.includes(
    'Ana'
  ),
  'Notificaciones no muestran al remitente'
);

assert(
  notificationList.textContent.includes(
    'Mensaje pendiente'
  ),
  'Notificaciones no muestran mensaje pendiente'
);

assert(
  state.incomingRequests
    instanceof window.Map,
  'incomingRequests debe seguir siendo Map'
);

ok('Notificaciones reales renderizadas');


console.log('\n=== MESSAGING · ABRIR CONVERSACION ===');

await feature.openRealConversation(
  ana
);

const modal =
  window.document.querySelector(
    '#conversationModal'
  );

assert(
  state.chatTarget?.id ===
    'user-2',
  'openRealConversation no fija chatTarget'
);

assert(
  modal.getAttribute(
    'aria-hidden'
  ) === 'false',
  'Modal de conversación no se abre'
);

assert(
  window.document
    .querySelector(
      '#conversationName'
    )
    .textContent === 'Ana',
  'Nombre de conversación incorrecto'
);

assert(
  hiddenModals >= 1,
  'No se cerraron modales anteriores'
);

ok('Conversación real se abre correctamente');


console.log('\n=== MESSAGING · OPCIONES ===');

feature.renderConversationOptionsMenu();

const options =
  window.document.querySelector(
    '#realConversationOptionsMenu'
  );

assert(
  options,
  'No se crea menú de opciones'
);

assert(
  options.querySelector(
    '[data-real-chat-action="mute"]'
  ),
  'Falta acción silenciar'
);

assert(
  options.querySelector(
    '[data-real-chat-action="report"]'
  ),
  'Falta acción reportar'
);

assert(
  options.querySelector(
    '[data-real-chat-action="block"]'
  ),
  'Falta acción bloquear'
);

assert(
  options.querySelector(
    '[data-real-chat-action="delete"]'
  ),
  'Falta acción eliminar'
);

ok('Opciones de conversación completas');


console.log('\n=== MESSAGING · REALTIME ===');

feature.subscribeToMessages();

assert(
  channelName ===
    'messages-me',
  'Canal realtime incorrecto'
);

assert(
  typeof realtimeCallback ===
    'function',
  'No se registró callback realtime'
);

assert(
  state.channel,
  'state.channel no guarda suscripción'
);

realtimeCallback({
  new: {
    id: 'message-realtime',
    sender_id: 'user-2',
    recipient_id: 'me',
    body: 'Realtime',
    created_at:
      '2026-10-08T10:30:00Z'
  }
});

await new Promise(resolve =>
  setTimeout(resolve, 0)
);

ok('Suscripción realtime configurada');


console.log('\n=== MESSAGING · RESUSCRIPCION ===');

feature.subscribeToMessages();

assert(
  removedChannels >= 1,
  'No se elimina el canal anterior al resuscribir'
);

ok('Canal anterior se elimina correctamente');


console.log('\nROOMS MESSAGING FEATURE OK');
