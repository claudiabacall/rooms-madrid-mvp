import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/listing-delete.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== LISTING DELETE ===');

const script = 'assets/js/features/listing-delete.js';

assert(html.includes(`src="${script}"`));
assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);
assert(app.includes('ROOMS_LISTING_DELETE_FEATURE?.create'));
assert(
  !/async function deleteOwnListing\s*\(/.test(app)
);
assert(
  /async function deleteOwnListing\s*\(/.test(source)
);
assert(
  app.includes('deleteOwnListing(listingId)')
);

console.log('OK  Extraccion y listener conectados');

const marker = '/storage/v1/object/public/listing-images/';

function photoUrl(path) {
  return `https://example.supabase.co${marker}${path}`;
}

function setup({
  ownerId = 'user-1',
  confirmed = true,
  deleteError = false,
  deletedRows = [{ id: 'listing-1' }],
  photos = [photoUrl('folder/foto-1.jpg')]
} = {}) {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div id="editListingModal" class="modal open">
          <button data-delete-listing>Eliminar anuncio</button>
          <p id="editListingMessage"></p>
        </div>
      </body>
    </html>
  `, {
    runScripts: 'outside-only',
    url: 'http://127.0.0.1/'
  });

  const { window } = dom;
  window.eval(source);

  const calls = [];
  const notifications = [];

  window.confirm = () => {
    calls.push(['confirm']);
    return confirmed;
  };

  const state = {
    user: { id: 'user-1' },
    listings: new Map([
      ['listing-1', {
        id: 'listing-1',
        owner_id: ownerId,
        photos
      }]
    ])
  };

  const db = {
    from(table) {
      if (table === 'listings') {
        return {
          delete() {
            calls.push(['deleteListing']);
            return {
              eq(field, value) {
                calls.push(['listingFilter', field, value]);
                return {
                  eq(field2, value2) {
                    calls.push(['listingFilter', field2, value2]);
                    return {
                      async select(column) {
                        calls.push(['select', column]);
                        return {
                          data: deleteError ? null : deletedRows,
                          error: deleteError
                            ? { message: 'delete error' }
                            : null
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'saved_items') {
        return {
          delete() {
            calls.push(['deleteSaved']);
            return {
              eq(field, value) {
                calls.push(['savedFilter', field, value]);
                return {
                  async eq(field2, value2) {
                    calls.push(['savedFilter', field2, value2]);
                    return { error: null };
                  }
                };
              }
            };
          }
        };
      }

      throw new Error(`Tabla inesperada: ${table}`);
    },

    storage: {
      from(bucket) {
        assert.equal(bucket, 'listing-images');
        return {
          async remove(paths) {
            calls.push(['removePhotos', paths]);
            return { error: null };
          }
        };
      }
    }
  };

  const feature =
    window.ROOMS_LISTING_DELETE_FEATURE.create({
      db,
      state,
      notify: message => notifications.push(message),
      hideAllModals: () => {
        calls.push(['hideModals']);
      },
      loadRealContent: async () => {
        calls.push(['loadContent']);
      },
      loadSavedItems: async () => {
        calls.push(['loadSaved']);
      }
    });

  return {
    window,
    feature,
    calls,
    notifications,
    button: window.document.querySelector(
      '[data-delete-listing]'
    ),
    message: window.document.querySelector(
      '#editListingMessage'
    ),
    close: () => window.close()
  };
}

async function run() {
  {
    const t = setup({ ownerId: 'other-user' });

    await t.feature.deleteOwnListing('listing-1');

    assert(
      t.notifications.includes(
        'Solo puedes eliminar tus propios anuncios'
      )
    );

    assert.equal(t.calls.length, 0);

    console.log('OK  Propiedad protegida');
    t.close();
  }

  {
    const t = setup({ confirmed: false });

    await t.feature.deleteOwnListing('listing-1');

    assert.deepEqual(
      t.calls.map(call => call[0]),
      ['confirm']
    );

    console.log('OK  Cancelacion sin eliminar');
    t.close();
  }

  {
    const t = setup({ deleteError: true });

    await t.feature.deleteOwnListing('listing-1');

    assert.equal(t.button.disabled, false);
    assert.equal(
      t.button.textContent,
      'Eliminar anuncio'
    );

    assert(
      t.message.textContent.includes(
        'No se pudo eliminar el anuncio'
      )
    );

    assert(
      !t.calls.some(call => call[0] === 'deleteSaved')
    );

    assert(
      !t.calls.some(call => call[0] === 'hideModals')
    );

    console.log('OK  Error de Supabase controlado');
    t.close();
  }

  {
    const t = setup({ deletedRows: [] });

    await t.feature.deleteOwnListing('listing-1');

    assert(
      t.message.textContent.includes(
        'No se pudo eliminar el anuncio'
      )
    );

    assert(
      !t.calls.some(call => call[0] === 'deleteSaved')
    );

    console.log('OK  Eliminacion sin filas controlada');
    t.close();
  }

  {
    const t = setup();

    await t.feature.deleteOwnListing('listing-1');

    assert(
      t.calls.some(call =>
        call[0] === 'listingFilter' &&
        call[1] === 'owner_id' &&
        call[2] === 'user-1'
      )
    );

    assert(
      t.calls.some(call => call[0] === 'deleteSaved')
    );

    assert(
      t.calls.some(call =>
        call[0] === 'savedFilter' &&
        call[1] === 'item_id' &&
        call[2] === 'listing-1'
      )
    );

    assert(
      t.calls.some(call => call[0] === 'hideModals')
    );

    assert(
      t.calls.some(call => call[0] === 'loadContent')
    );

    assert(
      t.calls.some(call => call[0] === 'loadSaved')
    );

    assert(
      t.notifications.includes('Anuncio eliminado')
    );

    console.log('OK  Eliminacion y filtros de propiedad');
    console.log('OK  Limpieza de guardados y actualizacion');

    t.close();
  }

  {
    const t = setup({
      photos: [
        photoUrl('folder/foto-1.jpg'),
        photoUrl('folder/foto%202.jpg'),
        'https://example.com/external.jpg'
      ]
    });

    await t.feature.deleteOwnListing('listing-1');

    const removal = t.calls.find(
      call => call[0] === 'removePhotos'
    );

    assert(removal);

    assert.deepEqual(
      Array.from(removal[1]),
      ['folder/foto-1.jpg', 'folder/foto 2.jpg']
    );

    console.log('OK  Rutas de fotografias identificadas');

    t.close();
  }

  console.log('\nROOMS LISTING DELETE FEATURE OK');
}

await run();
