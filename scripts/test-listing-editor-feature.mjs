import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/listing-editor.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== LISTING EDITOR ===');

const script = 'assets/js/features/listing-editor.js';

assert(html.includes(`src="${script}"`));
assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_LISTING_EDITOR_FEATURE?.create')
);

for (const name of [
  'ensureEditListingModal',
  'openEditListing',
  'saveListingEdits'
]) {
  assert(
    new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`)
      .test(source),
    `Falta ${name} en Listing Editor`
  );

  assert(
    !new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`)
      .test(app),
    `${name} sigue declarado en el monolito`
  );
}

assert(
  /async function deleteOwnListing\(/.test(app),
  'La eliminacion debe permanecer en el monolito'
);

console.log('OK  Extraccion e integracion correctas');

const marker =
  '/storage/v1/object/public/listing-images/';

const photoUrl = path =>
  'https://example.supabase.co' + marker + path;

function setup({
  ownerId = 'user-1',
  saveError = false,
  storageError = false,
  uploaded = [],
  originalPhotos = [photoUrl('old.jpg')]
} = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body></body></html>',
    {
      runScripts: 'outside-only',
      url: 'http://127.0.0.1/'
    }
  );

  const { window } = dom;
  window.eval(source);

  const calls = [];
  const notifications = [];

  const listing = {
    id: 'listing-1',
    owner_id: ownerId,
    title: 'Habitacion original',
    zone: 'Chamberi',
    price: 750,
    available_from: null,
    duration: '12 meses',
    rooms: 3,
    baths: 2,
    area: 100,
    features: ['Amueblado'],
    description: 'Descripcion original',
    photos: [...originalPhotos]
  };

  const state = {
    user: { id: 'user-1' },
    listings: new Map([[listing.id, listing]]),
    editListingPhotos: [],
    editListingOriginalPhotos: []
  };

  const db = {
    from(table) {
      assert.equal(table, 'listings');

      return {
        update(changes) {
          calls.push(['update', changes]);

          return {
            eq(field, value) {
              calls.push(['filter', field, value]);

              return {
                async eq(field2, value2) {
                  calls.push(['filter', field2, value2]);

                  return {
                    error: saveError
                      ? { message: 'save error' }
                      : null
                  };
                }
              };
            }
          };
        }
      };
    },

    storage: {
      from(bucket) {
        assert.equal(bucket, 'listing-images');

        return {
          async remove(paths) {
            calls.push(['remove', paths]);

            return {
              error: storageError
                ? { message: 'storage error' }
                : null
            };
          }
        };
      }
    }
  };

  const feature =
    window.ROOMS_LISTING_EDITOR_FEATURE.create({
      db,
      state,
      notify: message => notifications.push(message),

      showModal: modal => {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
      },

      renderEditListingPhotos: () => {
        calls.push(['renderPhotos']);
      },

      uploadListingPhotos: async (id, files) => {
        calls.push(['uploadPhotos', id, files.length]);
        return uploaded;
      },

      loadRealContent: async () => {
        calls.push(['loadContent']);
      },

      loadSavedItems: async () => {
        calls.push(['loadSaved']);
      },

      refreshOwnActivity: type => {
        calls.push(['refreshActivity', type]);
      }
    });

  const modal = () =>
    window.document.querySelector('#editListingModal');

  const form = () =>
    window.document.querySelector('#editListingForm');

  const submit = async () => {
    await feature.saveListingEdits({
      preventDefault() {},
      currentTarget: form()
    });
  };

  return {
    window,
    feature,
    state,
    listing,
    calls,
    notifications,
    modal,
    form,
    submit,
    close: () => window.close()
  };
}

async function run() {
  {
    const t = setup();

    const modal = t.feature.ensureEditListingModal();

    assert(modal);
    assert(modal.querySelector('#editListingForm'));

    assert.strictEqual(
      t.feature.ensureEditListingModal(),
      modal
    );

    assert(
      modal.querySelector('#editListingPhotos')
    );

    console.log('OK  Formulario creado y reutilizado');

    t.close();
  }

  {
    const t = setup();

    t.feature.openEditListing('listing-1');

    assert.equal(
      t.modal().querySelector('#editListingTitle').value,
      'Habitacion original'
    );

    assert.equal(
      t.modal().querySelector('#editListingPrice').value,
      '750'
    );

    assert.deepEqual(
      Array.from(t.state.editListingPhotos),
      [photoUrl('old.jpg')]
    );

    assert.deepEqual(
      Array.from(t.state.editListingOriginalPhotos),
      [photoUrl('old.jpg')]
    );

    assert(t.modal().classList.contains('open'));

    assert(
      t.calls.some(call => call[0] === 'renderPhotos')
    );

    console.log('OK  Apertura y datos precargados');

    t.close();
  }

  {
    const t = setup({ ownerId: 'other-user' });

    t.feature.openEditListing('listing-1');

    assert.equal(t.modal(), null);

    assert(
      t.notifications.includes(
        'Solo puedes editar tus propios anuncios'
      )
    );

    t.feature.ensureEditListingModal();

    await t.submit();

    assert(
      !t.calls.some(call => call[0] === 'update')
    );

    console.log('OK  Permisos del propietario');

    t.close();
  }

  {
    const t = setup();

    t.feature.openEditListing('listing-1');

    t.form().querySelector('#editListingTitle').value =
      '  Habitacion reformada  ';

    t.form().querySelector('#editListingZone').value =
      '  Retiro  ';

    t.form().querySelector('#editListingPrice').value =
      '925';

    t.form().querySelector('#editListingFeatures').value =
      'Amueblado, Terraza, Mascotas';

    t.form().querySelector('#editListingDescription').value =
      '  Descripcion nueva  ';

    await t.submit();

    const update = t.calls.find(
      call => call[0] === 'update'
    );

    assert(update);

    const changes = update[1];

    assert.equal(changes.title, 'Habitacion reformada');
    assert.equal(changes.zone, 'Retiro');
    assert.equal(changes.price, 925);
    assert.equal(changes.description, 'Descripcion nueva');

    assert.deepEqual(
      Array.from(changes.features),
      ['Amueblado', 'Terraza', 'Mascotas']
    );

    assert.equal(changes.furnished, true);

    assert(
      t.calls.some(call =>
        call[0] === 'filter' &&
        call[1] === 'owner_id' &&
        call[2] === 'user-1'
      )
    );

    assert(
      t.calls.some(call => call[0] === 'loadContent')
    );

    assert(
      t.calls.some(call => call[0] === 'loadSaved')
    );

    assert(
      t.calls.some(call =>
        call[0] === 'refreshActivity' &&
        call[1] === 'listings'
      )
    );

    assert(
      t.notifications.includes('Anuncio actualizado')
    );

    assert(!t.modal().classList.contains('open'));

    console.log('OK  Guardado de datos y caracteristicas');
    console.log('OK  Actualizacion del feed y guardados');

    t.close();
  }

  {
    const t = setup({
      uploaded: [photoUrl('new.jpg')]
    });

    t.feature.openEditListing('listing-1');

    const file = new t.window.File(
      ['imagen'],
      'nueva.jpg',
      { type: 'image/jpeg' }
    );

    Object.defineProperty(
      t.form().querySelector('#editListingPhotos'),
      'files',
      {
        configurable: true,
        value: [file]
      }
    );

    await t.submit();

    assert(
      t.calls.some(call =>
        call[0] === 'uploadPhotos' &&
        call[1] === 'listing-1' &&
        call[2] === 1
      )
    );

    const changes = t.calls.find(
      call => call[0] === 'update'
    )[1];

    assert.deepEqual(
      Array.from(changes.photos),
      [photoUrl('old.jpg'), photoUrl('new.jpg')]
    );

    console.log('OK  Incorporacion de fotografias nuevas');

    t.close();
  }

  {
    const t = setup({
      originalPhotos: [
        photoUrl('old.jpg'),
        photoUrl('keep.jpg')
      ]
    });

    t.feature.openEditListing('listing-1');

    t.state.editListingPhotos = [
      photoUrl('keep.jpg')
    ];

    await t.submit();

    const removal = t.calls.find(
      call => call[0] === 'remove'
    );

    assert(removal);

    assert.deepEqual(
      Array.from(removal[1]),
      ['old.jpg']
    );

    console.log('OK  Limpieza de fotografias eliminadas');

    t.close();
  }

  {
    const t = setup({ saveError: true });

    t.feature.openEditListing('listing-1');

    await t.submit();

    assert(
      t.modal().querySelector(
        '#editListingMessage'
      ).textContent.includes(
        'No se pudieron guardar'
      )
    );

    assert(
      !t.calls.some(call => call[0] === 'loadContent')
    );

    assert(
      !t.notifications.includes('Anuncio actualizado')
    );

    console.log('OK  Error de guardado controlado');

    t.close();
  }

  {
    const t = setup();

    t.feature.openEditListing('listing-1');

    const largeFile = {
      name: 'gigante.jpg',
      size: 11 * 1024 * 1024
    };

    Object.defineProperty(
      t.form().querySelector('#editListingPhotos'),
      'files',
      {
        configurable: true,
        value: [largeFile]
      }
    );

    await t.submit();

    assert(
      t.modal().querySelector(
        '#editListingMessage'
      ).textContent.includes('supera el límite de 10 MB')
    );

    assert(
      !t.calls.some(call => call[0] === 'update')
    );

    console.log('OK  Limite de tamano de fotografias');

    t.close();
  }

  console.log('\nROOMS LISTING EDITOR FEATURE OK');
}

await run();
