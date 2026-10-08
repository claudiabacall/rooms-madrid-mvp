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

const savedSource =
  fs.readFileSync(
    'assets/js/features/saved.js',
    'utf8'
  );

const supabaseSource =
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
  '\n=== SAVED FEATURE · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/saved.js'
  ),
  'index.html no carga saved.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/saved.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'saved.js debe cargarse antes de supabase-app.js'
);

ok(
  'saved.js carga antes de supabase-app.js'
);

for (
  const fn of [
    'loadSavedCollections',
    'createSavedCollection',
    'savedItemPresentation',
    'loadSavedItems',
    'sortSavedItems',
    'ensureCollectionDetailModal',
    'openSavedCollection',
    'renderSavedCollection',
    'showSavedItemsPicker',
    'addSavedItemToCollection',
    'removeSavedItemFromCollection'
  ]
) {
  const regex =
    new RegExp(
      `(?:async\\s+)?function\\s+${fn}\\s*\\(`
    );

  assert(
    !regex.test(
      supabaseSource
    ),
    `${fn} sigue duplicada en supabase-app.js`
  );
}

ok(
  'Funciones extraídas ya no están duplicadas'
);

assert(
  supabaseSource.includes(
    'window.ROOMS_SAVED_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Saved'
);

ok(
  'supabase-app.js consume el módulo Saved'
);


console.log(
  '\n=== SAVED FEATURE · ENTORNO DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <section id="savedView">
          <div class="collection-grid"></div>

          <button
            data-saved-filter="all"
            class="active">
            Todos <i>0</i>
          </button>

          <button data-saved-filter="room">
            Habitaciones <i>0</i>
          </button>

          <button data-saved-filter="flat">
            Pisos <i>0</i>
          </button>

          <button data-saved-filter="person">
            Personas <i>0</i>
          </button>

          <button data-saved-filter="post">
            Posts <i>0</i>
          </button>

          <button data-saved-filter="community">
            Comunidades <i>0</i>
          </button>

          <select id="savedSort">
            <option value="recent" selected>
              Recientes
            </option>
            <option value="price-asc">
              Precio asc
            </option>
            <option value="price-desc">
              Precio desc
            </option>
          </select>

          <h2 id="savedResultsTitle">
            0 elementos
          </h2>

          <div class="saved-grid"></div>
        </section>

        <button
          data-save-id="listing-room"
          data-action="save">
          ♡ <span>Guardar</span>
        </button>

        <button
          data-save-id="person-1">
          ♡
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

const {
  window
} = dom;

window.eval(
  savedSource
);

assert(
  window.ROOMS_SAVED_FEATURE
    ?.create,
  'Saved no expone factory'
);

ok(
  'Factory Saved disponible'
);


console.log(
  '\n=== SAVED FEATURE · FIXTURES ==='
);

const state = {
  user: {
    id: 'user-me'
  },

  listings:
    new Map([
      [
        'listing-room',
        {
          id:
            'listing-room',

          kind:
            'room',

          price:
            900,

          zone:
            'Chamberí',

          title:
            'Habitación Chamberí',

          photos:
            [
              'https://example.com/room.jpg'
            ]
        }
      ],

      [
        'listing-flat',
        {
          id:
            'listing-flat',

          kind:
            'apartment',

          price:
            1800,

          zone:
            'Salamanca',

          title:
            'Piso Salamanca',

          photos:
            []
        }
      ]
    ]),

  profiles:
    new Map([
      [
        'person-1',
        {
          id:
            'person-1',

          name:
            'Ana García',

          alias:
            'Ana',

          zones:
            ['Centro']
        }
      ]
    ]),

  posts:
    new Map([
      [
        'post-1',
        {
          id:
            'post-1',

          body:
            'Busco compañera para piso'
        }
      ]
    ]),

  communities:
    new Map([
      [
        'community-1',
        {
          id:
            'community-1',

          name:
            'Malasaña'
        }
      ]
    ]),

  savedCollections:
    new Map(),

  savedItems:
    new Set()
};

const savedRows = [
  {
    item_type:
      'room',

    item_id:
      'listing-room',

    created_at:
      '2026-10-07T10:00:00Z'
  },

  {
    item_type:
      'apartment',

    item_id:
      'listing-flat',

    created_at:
      '2026-10-06T10:00:00Z'
  },

  {
    item_type:
      'person',

    item_id:
      'person-1',

    created_at:
      '2026-10-05T10:00:00Z'
  },

  {
    item_type:
      'post',

    item_id:
      'post-1',

    created_at:
      '2026-10-04T10:00:00Z'
  },

  {
    item_type:
      'community',

    item_id:
      'community-1',

    created_at:
      '2026-10-03T10:00:00Z'
  }
];

const collections = [
  {
    id:
      'collection-1',

    user_id:
      'user-me',

    name:
      'Favoritos',

    visibility:
      'private',

    created_at:
      '2026-10-07T08:00:00Z'
  }
];

const collectionLinks = [
  {
    collection_id:
      'collection-1',

    saved_item_id:
      'saved-db-1'
  }
];

const savedDbRows = [
  {
    id:
      'saved-db-1',

    item_type:
      'room',

    item_id:
      'listing-room'
  }
];


function makeResult(
  data,
  error = null
) {
  return {
    data,
    error
  };
}


function createQuery(
  table
) {
  const query = {
    table,

    operation:
      'select',

    payload:
      null,

    select() {
      return this;
    },

    eq() {
      return this;
    },

    in() {
      return this;
    },

    order() {
      return Promise.resolve(
        resolveQuery(
          this
        )
      );
    },

    limit() {
      return Promise.resolve(
        resolveQuery(
          this
        )
      );
    },

    insert(payload) {
      this.operation =
        'insert';

      this.payload =
        payload;

      return this;
    },

    single() {
      return Promise.resolve(
        resolveQuery(
          this
        )
      );
    },

    then(resolve, reject) {
      return Promise.resolve(
        resolveQuery(
          this
        )
      ).then(
        resolve,
        reject
      );
    }
  };

  return query;
}


function resolveQuery(query) {
  if (
    query.table ===
      'saved_items'
  ) {
    if (
      query.operation ===
      'select'
    ) {
      return makeResult(
        savedRows
      );
    }
  }

  if (
    query.table ===
      'saved_collections'
  ) {
    if (
      query.operation ===
      'insert'
    ) {
      const created = {
        id:
          'collection-new',

        ...query.payload,

        created_at:
          '2026-10-07T12:00:00Z'
      };

      collections.unshift(
        created
      );

      return makeResult(
        created
      );
    }

    return makeResult(
      collections
    );
  }

  if (
    query.table ===
      'saved_collection_items'
  ) {
    return makeResult(
      collectionLinks
    );
  }

  return makeResult(
    []
  );
}


const db = {
  from(table) {
    return createQuery(
      table
    );
  }
};


let savedCount =
  null;

const feature =
  window
    .ROOMS_SAVED_FEATURE
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

      notify() {},

      updateSavedCount(
        value
      ) {
        savedCount =
          value;
      },

      connectionButtonLabel() {
        return 'Conectar';
      }
    });

assert(
  feature,
  'No se crea Saved feature'
);

ok(
  'Feature creada con dependencias inyectadas'
);


console.log(
  '\n=== SAVED FEATURE · PRESENTACION ==='
);

const listingPresentation =
  feature.savedItemPresentation({
    item_type:
      'room',

    item_id:
      'listing-room'
  });

assert(
  listingPresentation
    ?.title
    .includes(
      '900'
    ),
  'Listing guardado no presenta precio'
);

assert(
  listingPresentation
    ?.title
    .includes(
      'Chamberí'
    ),
  'Listing guardado no presenta zona'
);

const personPresentation =
  feature.savedItemPresentation({
    item_type:
      'person',

    item_id:
      'person-1'
  });

assert(
  personPresentation
    ?.title ===
    'Ana',
  'Persona guardada no usa alias'
);

ok(
  'Presentaciones listing/person correctas'
);


console.log(
  '\n=== SAVED FEATURE · CARGA ==='
);

await feature
  .loadSavedItems();

assert(
  savedCount === 5,
  `Esperaba savedCount=5 y salió ${savedCount}`
);

assert(
  state.savedItems.size ===
    5,
  'state.savedItems no contiene 5 elementos'
);

const cards =
  [
    ...window.document
      .querySelectorAll(
        '.saved-card'
      )
  ];

assert(
  cards.length === 5,
  `Esperaba 5 cards y hay ${cards.length}`
);

assert(
  window.document
    .querySelector(
      '#savedResultsTitle'
    )
    ?.textContent
    .trim() ===
    '5 elementos',
  'Título de resultados incorrecto'
);

assert(
  window.document
    .querySelector(
      '[data-save-id="listing-room"]:not([data-real-remove-saved])'
    )
    ?.classList
    .contains(
      'saved'
    ),
  'Botón de listing no queda marcado como guardado'
);

ok(
  'loadSavedItems actualiza estado y DOM'
);


console.log(
  '\n=== SAVED FEATURE · ORDEN ==='
);

feature.sortSavedItems(
  'price-asc'
);

let ordered =
  [
    ...window.document
      .querySelectorAll(
        '.saved-card'
      )
  ];

const pricedAsc =
  ordered
    .filter(
      card =>
        card.dataset
          .savedPrice !==
        undefined
    )
    .map(
      card =>
        Number(
          card.dataset
            .savedPrice
        )
    );

assert(
  pricedAsc[0] === 900 &&
  pricedAsc[1] === 1800,
  `Orden asc incorrecto: ${pricedAsc.join(',')}`
);

feature.sortSavedItems(
  'price-desc'
);

ordered =
  [
    ...window.document
      .querySelectorAll(
        '.saved-card'
      )
  ];

const pricedDesc =
  ordered
    .filter(
      card =>
        card.dataset
          .savedPrice !==
        undefined
    )
    .map(
      card =>
        Number(
          card.dataset
            .savedPrice
        )
    );

assert(
  pricedDesc[0] === 1800 &&
  pricedDesc[1] === 900,
  `Orden desc incorrecto: ${pricedDesc.join(',')}`
);

ok(
  'Orden precio asc/desc correcto'
);


console.log(
  '\n=== SAVED FEATURE · COLECCIONES ==='
);

await feature
  .loadSavedCollections();

assert(
  state.savedCollections
    .has(
      'collection-1'
    ),
  'Colección no entra en state'
);

assert(
  window.document
    .querySelector(
      '[data-real-collection="collection-1"]'
    ),
  'Colección no se renderiza'
);

const invalid =
  await feature
    .createSavedCollection(
      '   '
    );

assert(
  invalid?.error,
  'Nombre vacío debería fallar'
);

const created =
  await feature
    .createSavedCollection(
      'Madrid',
      'private'
    );

assert(
  created
    ?.data
    ?.name ===
    'Madrid',
  'No se crea colección válida'
);

assert(
  state.savedCollections
    .has(
      'collection-new'
    ),
  'Nueva colección no queda en state tras recarga'
);

ok(
  'Colecciones cargan, validan y crean'
);


console.log(
  '\n=== SAVED FEATURE · COLLECTION DETAIL ==='
);

const collectionState = {
  ...state,

  savedCollections:
    new Map([
      [
        'collection-1',
        {
          id:
            'collection-1',

          user_id:
            'user-me',

          name:
            'Favoritos',

          visibility:
            'private'
        }
      ]
    ]),

  currentCollectionId:
    null
};

const collectionRowsLive = [
  {
    id:
      'collection-1',

    user_id:
      'user-me',

    name:
      'Favoritos',

    visibility:
      'private',

    created_at:
      '2026-10-07T08:00:00Z'
  }
];

const collectionSavedRows = [
  {
    id:
      'saved-db-1',

    user_id:
      'user-me',

    item_type:
      'room',

    item_id:
      'listing-room',

    created_at:
      '2026-10-07T10:00:00Z'
  },

  {
    id:
      'saved-db-2',

    user_id:
      'user-me',

    item_type:
      'apartment',

    item_id:
      'listing-flat',

    created_at:
      '2026-10-06T10:00:00Z'
  }
];

const collectionLinksLive = [
  {
    collection_id:
      'collection-1',

    saved_item_id:
      'saved-db-1'
  }
];

function createCollectionQuery(
  table
) {
  return {
    table,

    operation:
      'select',

    payload:
      null,

    filters:
      [],

    inFilters:
      [],

    select() {
      return this;
    },

    eq(
      field,
      value
    ) {
      this.filters.push({
        field,
        value
      });

      return this;
    },

    in(
      field,
      values
    ) {
      this.inFilters.push({
        field,
        values
      });

      return this;
    },

    order() {
      return Promise.resolve(
        resolveCollectionQuery(
          this
        )
      );
    },

    limit() {
      return Promise.resolve(
        resolveCollectionQuery(
          this
        )
      );
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

    match(values) {
      Object.entries(
        values || {}
      ).forEach(
        ([field, value]) => {
          this.filters.push({
            field,
            value
          });
        }
      );

      return this;
    },

    then(
      resolve,
      reject
    ) {
      return Promise.resolve(
        resolveCollectionQuery(
          this
        )
      ).then(
        resolve,
        reject
      );
    }
  };
}

function matchesCollectionQuery(
  row,
  query
) {
  const equalFilters =
    query.filters.every(
      filter =>
        row[
          filter.field
        ] ===
        filter.value
    );

  const inFilters =
    query.inFilters.every(
      filter =>
        filter.values.includes(
          row[
            filter.field
          ]
        )
    );

  return (
    equalFilters &&
    inFilters
  );
}

function resolveCollectionQuery(
  query
) {
  if (
    query.table ===
      'saved_collections'
  ) {
    return makeResult(
      collectionRowsLive.filter(
        row =>
          matchesCollectionQuery(
            row,
            query
          )
      )
    );
  }

  if (
    query.table ===
      'saved_items'
  ) {
    return makeResult(
      collectionSavedRows.filter(
        row =>
          matchesCollectionQuery(
            row,
            query
          )
      )
    );
  }

  if (
    query.table ===
      'saved_collection_items'
  ) {
    if (
      query.operation ===
        'insert'
    ) {
      const exists =
        collectionLinksLive
          .some(
            row =>
              row.collection_id ===
                query.payload
                  .collection_id &&
              row.saved_item_id ===
                query.payload
                  .saved_item_id
          );

      if (!exists) {
        collectionLinksLive.push({
          ...query.payload
        });
      }

      return makeResult(
        query.payload
      );
    }

    if (
      query.operation ===
        'delete'
    ) {
      for (
        let index =
          collectionLinksLive.length -
          1;
        index >= 0;
        index -= 1
      ) {
        if (
          matchesCollectionQuery(
            collectionLinksLive[
              index
            ],
            query
          )
        ) {
          collectionLinksLive.splice(
            index,
            1
          );
        }
      }

      return makeResult(
        []
      );
    }

    return makeResult(
      collectionLinksLive.filter(
        row =>
          matchesCollectionQuery(
            row,
            query
          )
      )
    );
  }

  return makeResult(
    []
  );
}

const collectionDb = {
  from(table) {
    return createCollectionQuery(
      table
    );
  }
};

const collectionNotifications =
  [];

const collectionFeature =
  window
    .ROOMS_SAVED_FEATURE
    .create({
      db:
        collectionDb,

      state:
        collectionState,

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

      notify(message) {
        collectionNotifications
          .push(
            message
          );
      },

      updateSavedCount() {},

      connectionButtonLabel() {
        return 'Conectar';
      }
    });

assert(
  collectionFeature
    .ensureCollectionDetailModal,
  'Saved no expone ensureCollectionDetailModal'
);

assert(
  collectionFeature
    .openSavedCollection,
  'Saved no expone openSavedCollection'
);

assert(
  collectionFeature
    .renderSavedCollection,
  'Saved no expone renderSavedCollection'
);

assert(
  collectionFeature
    .showSavedItemsPicker,
  'Saved no expone showSavedItemsPicker'
);

assert(
  collectionFeature
    .addSavedItemToCollection,
  'Saved no expone addSavedItemToCollection'
);

assert(
  collectionFeature
    .removeSavedItemFromCollection,
  'Saved no expone removeSavedItemFromCollection'
);

ok(
  'API Collections expuesta por Saved'
);


console.log(
  '\n=== SAVED FEATURE · MODAL COLLECTION ==='
);

const collectionModal =
  collectionFeature
    .ensureCollectionDetailModal();

assert(
  collectionModal?.id ===
    'collectionDetailModal',
  'No se crea collectionDetailModal'
);

const sameCollectionModal =
  collectionFeature
    .ensureCollectionDetailModal();

assert(
  sameCollectionModal ===
    collectionModal,
  'El modal de colección debe reutilizarse'
);

assert(
  window.document
    .querySelectorAll(
      '#collectionDetailModal'
    )
    .length === 1,
  'Debe existir un único modal de colección'
);

ok(
  'Modal Collections creado y reutilizado'
);


console.log(
  '\n=== SAVED FEATURE · ABRIR COLLECTION ==='
);

await collectionFeature
  .openSavedCollection(
    'collection-1'
  );

assert(
  collectionState
    .currentCollectionId ===
    'collection-1',
  'No se guarda currentCollectionId'
);

assert(
  collectionModal
    .classList
    .contains(
      'open'
    ),
  'La colección no abre el modal'
);

assert(
  collectionModal
    .getAttribute(
      'aria-hidden'
    ) ===
    'false',
  'El modal abierto mantiene aria-hidden=true'
);

assert(
  window.document
    .querySelector(
      '#collectionDetailName'
    )
    ?.textContent ===
    'Favoritos',
  'Nombre de colección incorrecto'
);

assert(
  window.document
    .querySelectorAll(
      '.collection-detail-item'
    )
    .length === 1,
  'La colección debería renderizar un elemento'
);

assert(
  window.document
    .querySelector(
      '[data-remove-from-collection="saved-db-1"]'
    ),
  'No se renderiza acción de quitar elemento'
);

ok(
  'Colección abre y renderiza contenido'
);


console.log(
  '\n=== SAVED FEATURE · PICKER ==='
);

await collectionFeature
  .showSavedItemsPicker(
    'collection-1'
  );

const alreadyAddedButton =
  window.document
    .querySelector(
      '[data-add-to-collection="saved-db-1"]'
    );

const availableButton =
  window.document
    .querySelector(
      '[data-add-to-collection="saved-db-2"]'
    );

assert(
  alreadyAddedButton
    ?.disabled === true,
  'Elemento ya añadido debería estar deshabilitado'
);

assert(
  availableButton &&
  availableButton.disabled ===
    false,
  'Elemento disponible debería poder añadirse'
);

ok(
  'Picker distingue añadidos y disponibles'
);


console.log(
  '\n=== SAVED FEATURE · AÑADIR A COLLECTION ==='
);

await collectionFeature
  .addSavedItemToCollection(
    'saved-db-2'
  );

assert(
  collectionLinksLive
    .some(
      item =>
        item.collection_id ===
          'collection-1' &&
        item.saved_item_id ===
          'saved-db-2'
    ),
  'No se crea vínculo al añadir guardado'
);

assert(
  window.document
    .querySelector(
      '[data-add-to-collection="saved-db-2"]'
    )
    ?.disabled === true,
  'Tras añadir, el elemento debería quedar deshabilitado'
);

assert(
  collectionNotifications
    .at(-1) ===
    'Añadido a la colección',
  'Notificación al añadir incorrecta'
);

ok(
  'Añadir guardado actualiza datos y picker'
);


console.log(
  '\n=== SAVED FEATURE · QUITAR DE COLLECTION ==='
);

await collectionFeature
  .removeSavedItemFromCollection(
    'saved-db-1'
  );

assert(
  !collectionLinksLive
    .some(
      item =>
        item.collection_id ===
          'collection-1' &&
        item.saved_item_id ===
          'saved-db-1'
    ),
  'El vínculo eliminado sigue existiendo'
);

assert(
  !window.document
    .querySelector(
      '[data-remove-from-collection="saved-db-1"]'
    ),
  'El elemento quitado sigue renderizado'
);

assert(
  window.document
    .querySelector(
      '[data-remove-from-collection="saved-db-2"]'
    ),
  'El elemento restante no se renderiza'
);

assert(
  collectionNotifications
    .at(-1) ===
    'Quitado de la colección',
  'Notificación al quitar incorrecta'
);

ok(
  'Quitar guardado actualiza datos y colección'
);

console.log(
  '\nROOMS SAVED FEATURE OK'
);
