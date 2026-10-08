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
    'assets/js/features/explore-filters.js',
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

const controllerSource =
  fs.readFileSync(
    'assets/js/features/explore-controller.js',
    'utf8'
  );


console.log(
  '\n=== EXPLORE FILTERS · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/explore-filters.js'
  ),
  'index.html no carga explore-filters.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/explore-filters.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'explore-filters.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_EXPLORE_FILTERS_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Explore Filters'
);

for (const fn of [
  'normalizeExploreValue',
  'readExploreFiltersFromModal',
  'listingMatchesExploreFilters',
  'getExploreResults',
  'updateExploreFilterPreview',
  'resetExploreFilters'
]) {
  const regex =
    new RegExp(
      `function\\s+${fn}\\s*\\(`
    );

  assert(
    !regex.test(appSource),
    `${fn} sigue duplicada en supabase-app.js`
  );

  assert(
    regex.test(featureSource),
    `${fn} no está en explore-filters.js`
  );
}

assert(
  /function\s+renderFilteredExplore\s*\(\.\.\.args\)/.test(
    appSource
  ),
  'Debe permanecer el bridge renderFilteredExplore en supabase-app.js'
);

assert(
  /function\s+renderFilteredExplore\s*\(\)/.test(
    controllerSource
  ),
  'La implementación renderFilteredExplore debe vivir en explore-controller.js'
);

assert(
  appSource.includes(
    'COMMUNITY COMMENT SUBMIT'
  ),
  'Community no debe moverse'
);

ok(
  'Filters separado de Controller y Community'
);


console.log(
  '\n=== EXPLORE FILTERS · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>

        <input
          id="exploreSearch"
          value=""
        >

        <div id="exploreFilterModal">

          <button
            type="button"
            data-explore-zone="Chamberí"
            aria-pressed="false">
            Chamberí
          </button>

          <button
            type="button"
            data-explore-zone="Centro"
            aria-pressed="false">
            Centro
          </button>

          <button
            type="button"
            id="addExploreZone">
            Añadir
          </button>

          <button
            type="button"
            data-explore-feature="Terraza"
            aria-pressed="false">
            Terraza
          </button>

          <button
            type="button"
            data-explore-feature="Ascensor"
            aria-pressed="false">
            Ascensor
          </button>

          <input
            id="exploreBudgetMin"
            type="number"
          >

          <input
            id="exploreBudgetMax"
            type="number"
          >

          <select id="exploreTypeFilter">
            <option value=""></option>
            <option value="room">Habitación</option>
            <option value="apartment">Piso</option>
          </select>

          <input
            id="exploreDateFilter"
            type="date"
          >

          <select id="exploreDurationFilter">
            <option value=""></option>
            <option value="6–12 meses">
              6–12 meses
            </option>
          </select>

          <select id="exploreRoomsFilter">
            <option value=""></option>
            <option value="2">2+</option>
          </select>

          <button
            type="button"
            id="applyExploreFilters"
            data-apply-explore-filters>
            Ver resultados
          </button>

          <button
            type="button"
            data-clear-explore-filters>
            Limpiar
          </button>

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
  window.ROOMS_EXPLORE_FILTERS_FEATURE?.create,
  'Explore Filters no expone factory'
);

ok(
  'Factory disponible'
);


console.log(
  '\n=== EXPLORE FILTERS · FIXTURES ==='
);

const listings = [
  {
    id:
      'listing-1',

    zone:
      'Chamberí',

    title:
      'Habitación luminosa',

    description:
      'Piso tranquilo',

    price:
      900,

    kind:
      'room',

    available_from:
      '2026-11-01',

    duration:
      '6–12 meses',

    rooms:
      3,

    features:
      [
        'Terraza',
        'Ascensor'
      ],

    created_at:
      '2026-10-01T10:00:00Z'
  },

  {
    id:
      'listing-2',

    zone:
      'Centro',

    title:
      'Piso completo',

    description:
      'Cerca de Sol',

    price:
      1500,

    kind:
      'apartment',

    available_from:
      '2026-12-01',

    duration:
      '3–6 meses',

    rooms:
      2,

    features:
      [
        'Ascensor'
      ],

    created_at:
      '2026-10-07T10:00:00Z'
  }
];

const state = {
  listings:
    new Map(
      listings.map(
        listing => [
          listing.id,
          listing
        ]
      )
    )
};

let renderCalls =
  0;

let hideCalls =
  0;

const notifications =
  [];

let sortCalls =
  0;

const feature =
  window
    .ROOMS_EXPLORE_FILTERS_FEATURE
    .create({
      state,

      sortExploreListings(items) {
        sortCalls += 1;

        return [...items].sort(
          (a, b) =>
            String(a.id).localeCompare(
              String(b.id)
            )
        );
      },

      renderFilteredExplore() {
        renderCalls += 1;
      },

      hideAllModals() {
        hideCalls += 1;
      },

      notify(message) {
        notifications.push(
          message
        );
      }
    });

assert(
  feature?.exploreFiltersState,
  'Falta exploreFiltersState'
);

assert(
  feature?.normalizeExploreValue,
  'Falta normalizeExploreValue'
);

assert(
  feature?.getExploreResults,
  'Falta getExploreResults'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== EXPLORE FILTERS · NORMALIZE ==='
);

assert(
  feature.normalizeExploreValue(
    '  CHAMBERÍ  '
  ) ===
    'chamberi',
  'normalizeExploreValue incorrecto'
);

ok(
  'Normalización correcta'
);


console.log(
  '\n=== EXPLORE FILTERS · MATCH ==='
);

const filters = {
  zones:
    [
      'Chamberí'
    ],

  features:
    [
      'Terraza'
    ],

  minPrice:
    800,

  maxPrice:
    1000,

  kind:
    'room',

  date:
    '2026-11-15',

  duration:
    '6–12 meses',

  rooms:
    2
};

assert(
  feature.listingMatchesExploreFilters(
    listings[0],
    filters
  ),
  'Listing 1 debería cumplir filtros'
);

assert(
  !feature.listingMatchesExploreFilters(
    listings[1],
    filters
  ),
  'Listing 2 no debería cumplir filtros'
);

ok(
  'Matching de filtros correcto'
);


console.log(
  '\n=== EXPLORE FILTERS · RESULTS ==='
);

window.document
  .querySelector(
    '#exploreSearch'
  )
  .value =
    'luminosa';

const results =
  feature.getExploreResults(
    {
      zones:
        [],

      features:
        [],

      minPrice:
        null,

      maxPrice:
        null,

      kind:
        '',

      date:
        '',

      duration:
        '',

      rooms:
        null
    }
  );

assert(
  results.length ===
    1,
  'Search debería devolver un resultado'
);

assert(
  results[0].id ===
    'listing-1',
  'Search devuelve listing incorrecto'
);

assert(
  sortCalls ===
    1,
  'getExploreResults debe delegar ordenación'
);

ok(
  'Resultados y búsqueda correctos'
);


console.log(
  '\n=== EXPLORE FILTERS · READ MODAL ==='
);

window.document
  .querySelector(
    '[data-explore-zone="Chamberí"]'
  )
  .setAttribute(
    'aria-pressed',
    'true'
  );

window.document
  .querySelector(
    '[data-explore-feature="Terraza"]'
  )
  .setAttribute(
    'aria-pressed',
    'true'
  );

window.document
  .querySelector(
    '#exploreBudgetMin'
  )
  .value =
    '800';

window.document
  .querySelector(
    '#exploreBudgetMax'
  )
  .value =
    '1000';

window.document
  .querySelector(
    '#exploreTypeFilter'
  )
  .value =
    'room';

window.document
  .querySelector(
    '#exploreDateFilter'
  )
  .value =
    '2026-11-15';

window.document
  .querySelector(
    '#exploreDurationFilter'
  )
  .value =
    '6–12 meses';

window.document
  .querySelector(
    '#exploreRoomsFilter'
  )
  .value =
    '2';

const read =
  feature.readExploreFiltersFromModal();

assert(
  read.zones.length ===
    1 &&
  read.zones[0] ===
    'Chamberí',
  'Zona no leída correctamente'
);

assert(
  read.features.length ===
    1 &&
  read.features[0] ===
    'Terraza',
  'Feature no leída correctamente'
);

assert(
  read.minPrice ===
    800 &&
  read.maxPrice ===
    1000,
  'Presupuesto no leído correctamente'
);

assert(
  read.kind ===
    'room',
  'Tipo no leído correctamente'
);

assert(
  read.rooms ===
    2,
  'Habitaciones no leídas correctamente'
);

ok(
  'Modal leído correctamente'
);


console.log(
  '\n=== EXPLORE FILTERS · PREVIEW ==='
);

window.document
  .querySelector(
    '#exploreSearch'
  )
  .value =
    '';

feature.updateExploreFilterPreview();

const applyButton =
  window.document.querySelector(
    '#applyExploreFilters'
  );

assert(
  applyButton.textContent.includes(
    'Ver 1 resultado'
  ),
  'Preview debe mostrar un resultado'
);

ok(
  'Preview correcto'
);


console.log(
  '\n=== EXPLORE FILTERS · APPLY ==='
);

const renderBeforeApply =
  renderCalls;

window.document
  .querySelector(
    '[data-apply-explore-filters]'
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

assert(
  feature.exploreFiltersState.zones[0] ===
    'Chamberí',
  'Apply no actualiza exploreFiltersState'
);

assert(
  renderCalls ===
    renderBeforeApply + 1,
  'Apply debe rerenderizar Explore'
);

assert(
  hideCalls ===
    1,
  'Apply debe cerrar modales'
);

assert(
  notifications.at(-1) ===
    'Filtros aplicados',
  'Apply debe notificar'
);

ok(
  'Aplicación de filtros correcta'
);


console.log(
  '\n=== EXPLORE FILTERS · CLEAR ==='
);

const renderBeforeClear =
  renderCalls;

window.document
  .querySelector(
    '[data-clear-explore-filters]'
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

assert(
  feature.exploreFiltersState.zones.length ===
    0,
  'Clear no limpia zonas'
);

assert(
  feature.exploreFiltersState.features.length ===
    0,
  'Clear no limpia features'
);

assert(
  feature.exploreFiltersState.minPrice ===
    null,
  'Clear no limpia minPrice'
);

assert(
  renderCalls ===
    renderBeforeClear + 1,
  'Clear debe rerenderizar Explore'
);

assert(
  notifications.at(-1) ===
    'Filtros eliminados',
  'Clear debe notificar'
);

ok(
  'Reset correcto'
);


console.log(
  '\n=== EXPLORE FILTERS · ZONE TOGGLE ==='
);

const chamberi =
  window.document.querySelector(
    '[data-explore-zone="Chamberí"]'
  );

chamberi.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles:
        true
    }
  )
);

assert(
  chamberi.getAttribute(
    'aria-pressed'
  ) ===
    'true',
  'Click de zona debe activar chip'
);

ok(
  'Toggle de zona correcto'
);


console.log(
  '\n=== EXPLORE FILTERS · FEATURE TOGGLE ==='
);

const terraza =
  window.document.querySelector(
    '[data-explore-feature="Terraza"]'
  );

terraza.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles:
        true
    }
  )
);

assert(
  terraza.getAttribute(
    'aria-pressed'
  ) ===
    'true',
  'Click de feature debe activar chip'
);

ok(
  'Toggle de feature correcto'
);


console.log(
  '\n=== EXPLORE FILTERS · SEARCH DEBOUNCE ==='
);

const renderBeforeSearch =
  renderCalls;

const search =
  window.document.querySelector(
    '#exploreSearch'
  );

search.value =
  'centro';

search.dispatchEvent(
  new window.Event(
    'input',
    {
      bubbles:
        true
    }
  )
);

await new Promise(
  resolve =>
    setTimeout(
      resolve,
      260
    )
);

assert(
  renderCalls ===
    renderBeforeSearch + 1,
  'Search debounce debe rerenderizar Explore'
);

ok(
  'Debounce de búsqueda correcto'
);


console.log(
  '\nROOMS EXPLORE FILTERS FEATURE OK'
);
