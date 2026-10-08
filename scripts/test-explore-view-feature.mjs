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
    'assets/js/features/explore-view.js',
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

const exploreFiltersSource =
  fs.readFileSync(
    'assets/js/features/explore-filters.js',
    'utf8'
  );


console.log(
  '\n=== EXPLORE VIEW · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/explore-view.js'
  ),
  'index.html no carga explore-view.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/explore-view.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'explore-view.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_EXPLORE_VIEW_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Explore View'
);

assert(
  !/function\s+sortExploreListings\s*\(/.test(
    appSource
  ),
  'sortExploreListings sigue duplicada en supabase-app.js'
);

assert(
  !/const\s+exploreFiltersState\s*=/.test(
    appSource
  ),
  'exploreFiltersState no debe seguir en supabase-app.js'
);

assert(
  /const\s+exploreFiltersState\s*=/.test(
    exploreFiltersSource
  ),
  'exploreFiltersState debe vivir en explore-filters.js'
);

assert(
  /function\s+renderFilteredExplore\s*\(/.test(
    appSource
  ),
  'Explore Controller no debe moverse'
);

ok(
  'Explore View, Filters y Controller están separados'
);


console.log(
  '\n=== EXPLORE VIEW · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>

        <select id="exploreSort">
          <option value="recent">Más recientes</option>
          <option value="price">Precio</option>
        </select>

        <button
          type="button"
          data-explore-view="list"
          class="active">
          Lista
        </button>

        <button
          type="button"
          data-explore-view="map">
          Mapa
        </button>

        <button
          type="button"
          data-real-map-pin="listing-2">
          Pin 2
        </button>

        <button
          type="button"
          data-real-map-pin="listing-1">
          Pin 1
        </button>

        <article id="realMapCard"></article>

        <button
          type="button"
          data-real-listing="listing-2">
          Listing 2
        </button>

        <button
          type="button"
          data-real-map-open="listing-2">
          Abrir Listing 2
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
  window.ROOMS_EXPLORE_VIEW_FEATURE?.create,
  'Explore View no expone factory'
);

ok(
  'Factory disponible'
);


console.log(
  '\n=== EXPLORE VIEW · FIXTURES ==='
);

const listing1 = {
  id:
    'listing-1',

  title:
    'Primero',

  price:
    1200,

  created_at:
    '2026-10-01T10:00:00Z'
};

const listing2 = {
  id:
    'listing-2',

  title:
    'Segundo',

  price:
    800,

  created_at:
    '2026-10-07T10:00:00Z'
};

const state = {
  listings:
    new Map([
      [
        listing1.id,
        listing1
      ],
      [
        listing2.id,
        listing2
      ]
    ])
};

let renderFilteredCalls =
  0;

const renderedMapCards =
  [];

const feature =
  window
    .ROOMS_EXPLORE_VIEW_FEATURE
    .create({
      state,

      renderFilteredExplore() {
        renderFilteredCalls += 1;
      },

      renderRealMapCard(listing) {
        renderedMapCards.push(
          listing.id
        );

        return `
          <strong>
            ${listing.title}
          </strong>
        `;
      }
    });

assert(
  feature?.sortExploreListings,
  'Falta sortExploreListings'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== EXPLORE VIEW · SORT RECENT ==='
);

const recent =
  feature.sortExploreListings([
    listing1,
    listing2
  ]);

assert(
  recent[0].id ===
    'listing-2',
  'Recent debe ordenar más nuevo primero'
);

assert(
  recent[1].id ===
    'listing-1',
  'Orden recent incorrecto'
);

ok(
  'Orden recent correcto'
);


console.log(
  '\n=== EXPLORE VIEW · SORT PRICE ==='
);

const sort =
  window.document.querySelector(
    '#exploreSort'
  );

sort.value =
  'price';

const byPrice =
  feature.sortExploreListings([
    listing1,
    listing2
  ]);

assert(
  byPrice[0].id ===
    'listing-2',
  'Price debe ordenar menor precio primero'
);

assert(
  byPrice[1].id ===
    'listing-1',
  'Orden price incorrecto'
);

ok(
  'Orden price correcto'
);


console.log(
  '\n=== EXPLORE VIEW · CHANGE SORT ==='
);

const renderBeforeSort =
  renderFilteredCalls;

sort.dispatchEvent(
  new window.Event(
    'change',
    {
      bubbles:
        true
    }
  )
);

assert(
  renderFilteredCalls ===
    renderBeforeSort + 1,
  'Cambiar exploreSort debe rerenderizar Explore'
);

ok(
  'Hook exploreSort conectado'
);


console.log(
  '\n=== EXPLORE VIEW · VIEW TOGGLE ==='
);

const mapButton =
  window.document.querySelector(
    '[data-explore-view="map"]'
  );

const listButton =
  window.document.querySelector(
    '[data-explore-view="list"]'
  );

const renderBeforeView =
  renderFilteredCalls;

mapButton.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles:
        true
    }
  )
);

assert(
  mapButton.classList.contains(
    'active'
  ),
  'Mapa debe quedar activo'
);

assert(
  !listButton.classList.contains(
    'active'
  ),
  'Lista debe desactivarse'
);

assert(
  renderFilteredCalls ===
    renderBeforeView + 1,
  'Cambio de vista debe rerenderizar Explore'
);

ok(
  'Toggle Lista/Mapa correcto'
);


console.log(
  '\n=== EXPLORE VIEW · MAP PIN ==='
);

const pin2 =
  window.document.querySelector(
    '[data-real-map-pin="listing-2"]'
  );

pin2.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles:
        true
    }
  )
);

assert(
  pin2.classList.contains(
    'active'
  ),
  'Pin seleccionado debe quedar activo'
);

assert(
  renderedMapCards.at(-1) ===
    'listing-2',
  'Pin debe renderizar listing correcto'
);

assert(
  window.document
    .querySelector(
      '#realMapCard'
    )
    .textContent
    .includes(
      'Segundo'
    ),
  'realMapCard no se actualiza'
);

ok(
  'Selección de pin correcta'
);


console.log(
  '\n=== EXPLORE VIEW · MAP OPEN ==='
);

let listingClicks =
  0;

window.document
  .querySelector(
    '[data-real-listing="listing-2"]'
  )
  .addEventListener(
    'click',
    () => {
      listingClicks += 1;
    }
  );

window.document
  .querySelector(
    '[data-real-map-open="listing-2"]'
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
  listingClicks ===
    1,
  'Abrir desde mapa debe delegar en la card del listing'
);

ok(
  'Apertura desde mapa correcta'
);


console.log(
  '\n=== EXPLORE VIEW · LISTING INEXISTENTE ==='
);

const ghostPin =
  window.document.createElement(
    'button'
  );

ghostPin.type =
  'button';

ghostPin.dataset.realMapPin =
  'ghost';

window.document.body.appendChild(
  ghostPin
);

const cardsBeforeGhost =
  renderedMapCards.length;

ghostPin.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles:
        true
    }
  )
);

assert(
  renderedMapCards.length ===
    cardsBeforeGhost,
  'Listing inexistente no debe renderizar card'
);

ok(
  'Listing inexistente se ignora'
);


console.log(
  '\nROOMS EXPLORE VIEW FEATURE OK'
);
