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
    'assets/js/features/explore-controller.js',
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
  '\n=== EXPLORE CONTROLLER · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/explore-controller.js'
  ),
  'index no carga Controller'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/explore-controller.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'Controller debe cargar antes del monolito'
);

assert(
  appSource.includes(
    'let renderFilteredExploreImpl ='
  ),
  'Falta bridge de Controller'
);

assert(
  appSource.indexOf(
    'let renderFilteredExploreImpl ='
  ) <
    appSource.indexOf(
      'window.ROOMS_EXPLORE_VIEW_FEATURE?.create'
    ),
  'Bridge debe existir antes de crear View'
);

assert(
  appSource.includes(
    'window.ROOMS_EXPLORE_CONTROLLER_FEATURE?.create'
  ),
  'Monolito no inicializa Controller'
);

assert(
  !appSource.includes(
    'const modeButton ='
  ),
  'Mode sigue en monolito'
);

assert(
  featureSource.includes(
    'const modeButton ='
  ),
  'Mode no vive en Controller'
);

assert(
  appSource.includes(
    'const openPerson ='
  ),
  'Person no debe moverse todavía'
);

assert(
  appSource.includes(
    'await getProfileVisibility(profile.id)'
  ),
  'Privacidad Person no debe moverse'
);

assert(
  appSource.includes(
    'applyTargetPrivacy('
  ),
  'applyTargetPrivacy debe permanecer'
);

ok(
  'Controller separado con bridge y privacidad intacta'
);

console.log(
  '\n=== EXPLORE CONTROLLER · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>

        <button
          class="active"
          data-explore-mode="homes">
          Homes
        </button>

        <button
          data-explore-mode="people">
          People
        </button>

        <button
          data-explore-mode="communities">
          Communities
        </button>

        <input id="exploreSearch">

        <button id="exploreFilters">
          Filtros
        </button>

        <main id="exploreView">
          <div class="explore-controls"></div>
        </main>

        <div id="exploreList"></div>
        <div id="exploreMap"></div>
        <div id="exploreEmpty"></div>

        <i
          id="exploreFilterCount"
          hidden>
          0
        </i>

        <button
          class="active"
          data-explore-view="list">
          Lista
        </button>

        <button
          data-explore-view="map">
          Mapa
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
  window.ROOMS_EXPLORE_CONTROLLER_FEATURE?.create,
  'Controller no expone factory'
);

ok(
  'Factory disponible'
);

console.log(
  '\n=== EXPLORE CONTROLLER · FIXTURES ==='
);

const people = [
  {
    id: 'person-1'
  }
];

const communities = [
  {
    id: 'community-1'
  }
];

const homes = [
  {
    id: 'listing-1'
  },
  {
    id: 'listing-2'
  }
];

let peopleGets = 0;
let peopleRenders = 0;
let connections = 0;

let communityGets = 0;
let communityRenders = 0;

let homeGets = 0;
let homeRenders = 0;

const exploreFiltersState = {
  zones: [
    'Chamberí'
  ],

  features: [
    'Terraza'
  ],

  minPrice:
    700,

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
};

const feature =
  window
    .ROOMS_EXPLORE_CONTROLLER_FEATURE
    .create({
      getExplorePeople() {
        peopleGets += 1;
        return people;
      },

      renderExplorePeople(items) {
        assert(
          items === people,
          'People incorrectos'
        );

        peopleRenders += 1;
      },

      updateConnectButtons() {
        connections += 1;
      },

      getExploreCommunities() {
        communityGets += 1;
        return communities;
      },

      renderExploreCommunities(items) {
        assert(
          items === communities,
          'Communities incorrectas'
        );

        communityRenders += 1;
      },

      getExploreResults() {
        homeGets += 1;
        return homes;
      },

      renderRealExplore(items) {
        assert(
          items === homes,
          'Homes incorrectos'
        );

        homeRenders += 1;
      },

      exploreFiltersState
    });

assert(
  feature?.renderFilteredExplore,
  'Falta renderFilteredExplore'
);

ok(
  'Feature creada'
);

console.log(
  '\n=== EXPLORE CONTROLLER · HOMES ==='
);

feature.renderFilteredExplore();

assert(
  homeGets === 1,
  'Homes no solicita resultados'
);

assert(
  homeRenders === 1,
  'Homes no renderiza'
);

const count =
  window.document.querySelector(
    '#exploreFilterCount'
  );

assert(
  count.textContent === '3',
  'Contador de filtros incorrecto'
);

assert(
  count.hidden === false,
  'Contador activo debe mostrarse'
);

ok(
  'Homes correcto'
);

console.log(
  '\n=== EXPLORE CONTROLLER · PEOPLE ==='
);

const peopleButton =
  window.document.querySelector(
    '[data-explore-mode="people"]'
  );

peopleButton.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles: true
    }
  )
);

assert(
  peopleButton.classList.contains(
    'active'
  ),
  'People no queda activo'
);

assert(
  peopleGets === 1,
  'People no solicita perfiles'
);

assert(
  peopleRenders === 1,
  'People no renderiza'
);

assert(
  connections === 1,
  'People no actualiza conexiones'
);

assert(
  window.document
    .querySelector(
      '#exploreSearch'
    )
    .placeholder ===
      'Busca personas, zonas o perfiles',
  'Placeholder People incorrecto'
);

assert(
  window.document
    .querySelector(
      '#exploreFilters'
    )
    .hidden === true,
  'People debe ocultar filtros'
);

ok(
  'People correcto'
);

console.log(
  '\n=== EXPLORE CONTROLLER · COMMUNITIES ==='
);

const communitiesButton =
  window.document.querySelector(
    '[data-explore-mode="communities"]'
  );

communitiesButton.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles: true
    }
  )
);

assert(
  communityGets === 1,
  'Communities no solicita resultados'
);

assert(
  communityRenders === 1,
  'Communities no renderiza'
);

assert(
  window.document
    .querySelector(
      '#exploreSearch'
    )
    .placeholder ===
      'Busca comunidades',
  'Placeholder Communities incorrecto'
);

ok(
  'Communities correcto'
);

console.log(
  '\n=== EXPLORE CONTROLLER · BACK HOME ==='
);

const homesButton =
  window.document.querySelector(
    '[data-explore-mode="homes"]'
  );

homesButton.dispatchEvent(
  new window.MouseEvent(
    'click',
    {
      bubbles: true
    }
  )
);

assert(
  homesButton.classList.contains(
    'active'
  ),
  'Homes no vuelve a quedar activo'
);

assert(
  window.document
    .querySelector(
      '#exploreSearch'
    )
    .placeholder ===
      '¿Dónde quieres vivir?',
  'Placeholder Homes incorrecto'
);

assert(
  window.document
    .querySelector(
      '#exploreFilters'
    )
    .hidden === false,
  'Homes debe mostrar filtros'
);

assert(
  homeGets === 2,
  'Volver a Homes debe renderizar'
);

ok(
  'Cambio de modos correcto'
);

console.log(
  '\nROOMS EXPLORE CONTROLLER FEATURE OK'
);
