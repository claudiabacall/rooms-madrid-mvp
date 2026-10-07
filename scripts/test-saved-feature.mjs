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
    'sortSavedItems'
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
  '\nROOMS SAVED FEATURE OK'
);
