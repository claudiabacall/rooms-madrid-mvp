import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/listing-photos.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== LISTING PHOTOS ===');

const script = 'assets/js/features/listing-photos.js';

assert(
  html.includes(`src="${script}"`),
  'Listing Photos no esta registrado'
);

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js'),
  'Orden de carga incorrecto'
);

assert(
  app.includes('ROOMS_LISTING_PHOTOS_FEATURE?.create'),
  'Falta inicializar Listing Photos'
);

for (const name of [
  'renderEditListingPhotos',
  'moveEditListingPhoto',
  'deleteEditListingPhoto',
  'makeEditListingPhotoCover'
]) {
  assert(
    new RegExp(`function\\s+${name}\\s*\\(`).test(source),
    `Falta ${name}`
  );

  assert(
    !new RegExp(`function\\s+${name}\\s*\\(`).test(app),
    `${name} sigue declarado en el monolito`
  );
}

assert(
  app.includes('editListingDraggedPhoto'),
  'Falta el estado de arrastre'
);

assert(
  app.includes('moveEditListingPhoto('),
  'Falta conectar el movimiento de fotografias'
);

console.log('OK  Integracion y conexiones de arrastre');

function setup(photos = []) {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div id="editListingPhotoGrid"></div>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'http://127.0.0.1/'
  });

  const { window } = dom;
  window.eval(source);

  const state = {
    editListingPhotos: [...photos]
  };

  const feature =
    window.ROOMS_LISTING_PHOTOS_FEATURE.create({
      state,
      escapeHtml: value =>
        String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
    });

  const grid = window.document.querySelector(
    '#editListingPhotoGrid'
  );

  return {
    window,
    state,
    feature,
    grid,
    close: () => window.close()
  };
}

function photoNames(state) {
  return Array.from(state.editListingPhotos);
}

async function run() {
  {
    const t = setup([]);

    t.feature.renderEditListingPhotos();

    assert(
      t.grid.textContent.includes(
        'Este anuncio no tiene fotografías'
      )
    );

    console.log('OK  Estado sin fotografias');
    t.close();
  }

  {
    const t = setup([
      'foto-a.jpg',
      'foto-b.jpg',
      'foto-c.jpg'
    ]);

    t.feature.renderEditListingPhotos();

    assert.equal(
      t.grid.querySelectorAll(
        '[data-edit-photo-index]'
      ).length,
      3
    );

    assert(
      t.grid.querySelector(
        '[data-edit-photo-index="0"]'
      ).textContent.includes('PORTADA')
    );

    assert(
      t.grid.querySelector(
        '[data-edit-photo-index="1"] [data-edit-photo-cover]'
      )
    );

    console.log('OK  Renderizado y portada inicial');
    t.close();
  }

  {
    const t = setup([
      'foto-a.jpg',
      'foto-b.jpg',
      'foto-c.jpg'
    ]);

    t.feature.moveEditListingPhoto(2, 0);

    assert.deepEqual(
      photoNames(t.state),
      [
        'foto-c.jpg',
        'foto-a.jpg',
        'foto-b.jpg'
      ]
    );

    assert(
      t.grid.querySelector(
        '[data-edit-photo-index="0"] img'
      ).getAttribute('src').includes('foto-c.jpg')
    );

    console.log('OK  Reordenacion de fotografias');
    t.close();
  }

  {
    const t = setup([
      'foto-a.jpg',
      'foto-b.jpg'
    ]);

    t.feature.moveEditListingPhoto(-1, 0);
    t.feature.moveEditListingPhoto(0, 5);
    t.feature.moveEditListingPhoto(0, 0);

    assert.deepEqual(
      photoNames(t.state),
      ['foto-a.jpg', 'foto-b.jpg']
    );

    console.log('OK  Indices de movimiento protegidos');
    t.close();
  }

  {
    const t = setup([
      'foto-a.jpg',
      'foto-b.jpg',
      'foto-c.jpg'
    ]);

    t.feature.deleteEditListingPhoto(1);

    assert.deepEqual(
      photoNames(t.state),
      ['foto-a.jpg', 'foto-c.jpg']
    );

    assert.equal(
      t.grid.querySelectorAll(
        '[data-edit-photo-index]'
      ).length,
      2
    );

    console.log('OK  Eliminacion de fotografia');
    t.close();
  }

  {
    const t = setup([
      'foto-a.jpg',
      'foto-b.jpg',
      'foto-c.jpg'
    ]);

    t.feature.makeEditListingPhotoCover(2);

    assert.deepEqual(
      photoNames(t.state),
      [
        'foto-c.jpg',
        'foto-a.jpg',
        'foto-b.jpg'
      ]
    );

    assert(
      t.grid.querySelector(
        '[data-edit-photo-index="0"]'
      ).textContent.includes('PORTADA')
    );

    console.log('OK  Cambio de portada');
    t.close();
  }

  {
    const t = setup([
      'foto-a.jpg',
      'foto-b.jpg'
    ]);

    t.feature.deleteEditListingPhoto(-1);
    t.feature.deleteEditListingPhoto(8);
    t.feature.makeEditListingPhotoCover(0);
    t.feature.makeEditListingPhotoCover(9);

    assert.deepEqual(
      photoNames(t.state),
      ['foto-a.jpg', 'foto-b.jpg']
    );

    console.log('OK  Indices de eliminacion y portada protegidos');
    t.close();
  }

  {
    const t = setup([
      'https://example.com/foto.jpg" onerror="alert(1)'
    ]);

    t.feature.renderEditListingPhotos();

    const image = t.grid.querySelector('img');

    assert(image);
    assert.equal(
      image.hasAttribute('onerror'),
      false
    );

    console.log('OK  URL de fotografia escapada');
    t.close();
  }

  console.log('\nROOMS LISTING PHOTOS FEATURE OK');
}

await run();
