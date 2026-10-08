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
    'assets/js/features/listings.js',
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
  '\n=== LISTINGS FEATURE · INTEGRACION ==='
);

assert(
  htmlSource.includes(
    'assets/js/features/listings.js'
  ),
  'index.html no carga listings.js'
);

assert(
  htmlSource.indexOf(
    'assets/js/features/listings.js'
  ) <
    htmlSource.indexOf(
      'assets/js/supabase-app.js'
    ),
  'listings.js debe cargar antes de supabase-app.js'
);

assert(
  appSource.includes(
    'window.ROOMS_LISTINGS_FEATURE?.create'
  ),
  'supabase-app.js no inicializa Listings'
);

assert(
  !/(?:async\s+)?function\s+openRealListingDetail\s*\(/.test(
    appSource
  ),
  'openRealListingDetail sigue duplicada en supabase-app.js'
);

const matchingSource =
  fs.readFileSync(
    'assets/js/features/matching.js',
    'utf8'
  );

assert(
  !/function\s+calculateRealMatch\s*\(/.test(
    appSource
  ),
  'calculateRealMatch no debe seguir en supabase-app.js'
);

assert(
  /function\s+calculateRealMatch\s*\(/.test(
    matchingSource
  ),
  'calculateRealMatch debe vivir en matching.js'
);

ok(
  'Listing detail aislado y Matching separado'
);


console.log(
  '\n=== LISTINGS FEATURE · DOM ==='
);

const dom =
  new JSDOM(
    `<!doctype html>
    <html>
      <body>
        <div
          id="detailModal"
          aria-hidden="true"
        >
          <div id="detailContent"></div>
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
  window.ROOMS_LISTINGS_FEATURE?.create,
  'Listings no expone factory'
);

ok(
  'Factory Listings disponible'
);


console.log(
  '\n=== LISTINGS FEATURE · FIXTURES ==='
);

const state = {
  user: {
    id: 'user-me'
  },

  household: {
    id: 'household-1'
  }
};

let shownModal =
  null;

const feature =
  window
    .ROOMS_LISTINGS_FEATURE
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

      showModal(modal) {
        shownModal =
          modal;

        modal?.classList.add(
          'open'
        );
      }
    });

assert(
  feature?.openRealListingDetail,
  'Listings no expone openRealListingDetail'
);

ok(
  'Feature creada'
);


console.log(
  '\n=== LISTINGS FEATURE · RENDER ==='
);

const listing = {
  id:
    'listing-1',

  owner_id:
    'user-me',

  kind:
    'room',

  title:
    'Habitación luminosa',

  zone:
    'Chamberí',

  price:
    950,

  available_from:
    '2026-11-01',

  rooms:
    3,

  baths:
    2,

  area:
    110,

  photos: [
    'https://example.com/one.jpg',
    'https://example.com/two.jpg'
  ],

  features: [
    'Amueblado',
    'Exterior'
  ],

  description:
    'Habitación junto a <Quevedo>.'
};

feature.openRealListingDetail(
  listing
);

const detail =
  window.document
    .querySelector(
      '#detailContent'
    );

assert(
  detail
    ?.querySelector(
      '.rooms-property-sheet'
    ),
  'No se renderiza property sheet'
);

assert(
  detail.textContent.includes(
    'Habitación luminosa'
  ),
  'No se renderiza título'
);

assert(
  detail.textContent.includes(
    '950'
  ),
  'No se renderiza precio'
);

assert(
  detail.textContent.includes(
    'Chamberí'
  ),
  'No se renderiza zona'
);

assert(
  detail.querySelectorAll(
    '[data-carousel-slide]'
  ).length === 2,
  'No se renderizan las dos fotos'
);

assert(
  detail.querySelector(
    '[data-send-home-id="listing-1"]'
  ),
  'Con household debería aparecer Añadir al grupo'
);

assert(
  detail.querySelector(
    '[data-edit-listing="listing-1"]'
  ),
  'El propietario debería poder editar'
);

assert(
  detail.querySelector(
    '[data-share-real-listing="listing-1"]'
  ),
  'Falta acción Compartir'
);

assert(
  detail.querySelectorAll(
    '[data-detail-save]'
  ).length === 2,
  'Se esperan los dos controles Guardar'
);

assert(
  shownModal?.id ===
    'detailModal',
  'No se abre detailModal'
);

assert(
  !detail.innerHTML.includes(
    '<Quevedo>'
  ),
  'Descripción sin escapar'
);

ok(
  'Detalle listing renderiza datos y acciones'
);


console.log(
  '\n=== LISTINGS FEATURE · SIN HOUSEHOLD / NO OWNER ==='
);

state.household =
  null;

state.user = {
  id:
    'other-user'
};

feature.openRealListingDetail({
  ...listing,
  owner_id:
    'owner-1',
  photos:
    []
});

assert(
  !detail.querySelector(
    '[data-send-home-id]'
  ),
  'Sin household no debe aparecer Añadir al grupo'
);

assert(
  !detail.querySelector(
    '[data-edit-listing]'
  ),
  'Un usuario ajeno no debe poder editar'
);

assert(
  detail.querySelector(
    '.rooms-property-no-photo'
  ),
  'Sin fotos debe aparecer placeholder'
);

ok(
  'Permisos visuales y estado sin fotos correctos'
);


console.log(
  '\nROOMS LISTINGS FEATURE OK'
);
