import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
  'assets/js/features/publish-submit.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== PUBLISH SUBMIT ===');

assert(
  html.includes('assets/js/features/publish-submit.js')
);
assert(
  html.indexOf('assets/js/features/publish-submit.js') <
  html.indexOf('assets/js/supabase-app.js')
);
assert(
  app.includes('ROOMS_PUBLISH_SUBMIT_FEATURE?.create')
);
assert(
  /async function publishRealContent\s*\(/.test(source)
);
assert(
  !/async function publishRealContent\s*\(/.test(app)
);
assert(
  app.includes('publishRealContent(snapshot.type)')
);
assert(
  app.indexOf('const publishSubmitFeature') >
  app.indexOf('} = publishMediaFeature;')
);

console.log('OK  Extraccion, listener y orden');

const context = { window: {}, console, Number, String, Set };
vm.runInNewContext(source, context);

const factory =
  context.window.ROOMS_PUBLISH_SUBMIT_FEATURE.create;

function setup({
  steps = {},
  files = [],
  communityId = null,
  errorAt = null
} = {}) {
  const calls = [];
  const notices = [];

  const state = {
    user: { id: 'user-1' },
    profile: {},
    publishDraft: { steps, files },
    communityPublishTarget: communityId
  };

  const db = {
    from(table) {
      return {
        insert(payload) {
          calls.push(['insert', table, payload]);
          return {
            select() {
              return {
                async single() {
                  return {
                    data: errorAt === table + '-insert'
                      ? null
                      : {
                          id: table === 'posts'
                            ? 'post-1'
                            : 'listing-1'
                        },
                    error: errorAt === table + '-insert'
                      ? { message: 'insert failed' }
                      : null
                  };
                }
              };
            }
          };
        },
        update(payload) {
          calls.push(['update', table, payload]);
          return {
            async eq(key, value) {
              calls.push(['update-filter', table, key, value]);
              return {
                error: errorAt === table + '-update'
                  ? { message: 'update failed' }
                  : null
              };
            }
          };
        },
        delete() {
          calls.push(['delete', table]);
          return {
            eq(key, value) {
              calls.push(['delete-filter', key, value]);
              return {
                async eq(secondKey, secondValue) {
                  calls.push([
                    'delete-filter',
                    secondKey,
                    secondValue
                  ]);
                  return {
                    error: errorAt === 'rollback'
                      ? { message: 'rollback failed' }
                      : null
                  };
                }
              };
            }
          };
        }
      };
    },
    async rpc(name, payload) {
      calls.push(['rpc', name, payload]);
      return {
        error: errorAt === 'rpc'
          ? { message: 'rpc failed' }
          : null
      };
    }
  };

  const feature = factory({
    db,
    state,
    publishTotals: {
      room: 3,
      apartment: 3,
      mate: 2,
      external: 3,
      post: 2
    },
    notify: message => notices.push(message),
    geocodeListingAddress: async address => {
      calls.push(['geocode', address]);
      if (errorAt === 'geocode') {
        throw new Error('Direccion no localizada');
      }
      return {
        latitude: 40.42,
        longitude: -3.69,
        formattedAddress: 'Calle Serrano 55, Madrid',
        district: 'Salamanca'
      };
    },
    uploadCommunityPostMedia: async (id, chosen) => {
      calls.push(['post-media', id, chosen.length]);
      return ['https://example.com/post.jpg'];
    },
    uploadListingPhotos: async (id, chosen) => {
      calls.push(['listing-media', id, chosen.length]);
      return ['https://example.com/listing.jpg'];
    },
    hideAllModals: () => calls.push(['hide']),
    loadRealContent: async () => calls.push(['reload']),
    loadSavedItems: async () => calls.push(['saved']),
    openRealCommunity: async id =>
      calls.push(['community', id])
  });

  return {
    feature,
    state,
    calls,
    notices,
    find: name => calls.filter(item => item[0] === name)
  };
}

{
  const t = setup();
  await t.feature.publishRealContent('external');

  assert.equal(t.find('insert').length, 0);
  assert.equal(t.find('hide').length, 0);
  assert.equal(t.notices.length, 1);

  console.log('OK  Importacion externa desactivada');
}

{
  const t = setup();
  await t.feature.publishRealContent('post');

  assert.equal(t.find('insert').length, 0);
  assert(
    t.notices.includes('Escribe el contenido de la publicación')
  );

  console.log('OK  Contenido obligatorio');
}

{
  const t = setup({
    steps: {
      0: {
        values: ['Mi barrio'],
        selected: ['Barrio'],
        meta: {
          communityPostType: 'Barrio',
          zone: null
        }
      }
    }
  });

  await t.feature.publishRealContent('post');

  assert.equal(t.find('insert').length, 0);
  assert(t.notices.includes('Indica el barrio o zona'));

  console.log('OK  Validacion de barrio');
}

{
  const t = setup({
    communityId: 'community-1',
    files: [{ name: 'foto.jpg' }],
    steps: {
      0: {
        values: ['Mi experiencia'],
        selected: ['Experiencia'],
        meta: {
          communityPostType: 'Experiencia',
          zone: 'Centro'
        }
      }
    }
  });

  await t.feature.publishRealContent('post');

  const payload = t.find('insert')[0][2];

  assert.equal(payload.post_type, 'experience');
  assert.equal(payload.community_id, 'community-1');
  assert.equal(payload.author_id, 'user-1');
  assert.equal(t.find('post-media').length, 1);
  assert.equal(t.find('update').length, 1);
  assert.equal(t.find('reload').length, 1);
  assert.equal(t.find('saved').length, 1);
  assert.equal(t.find('community')[0][1], 'community-1');
  assert.equal(t.state.communityPublishTarget, null);
  assert.equal(
    Object.keys(t.state.publishDraft.steps).length,
    0
  );

  console.log('OK  Post comunitario, imagenes y recarga');
}

{
  const t = setup({
    errorAt: 'posts-insert',
    steps: {
      0: {
        values: ['Pregunta'],
        selected: ['Pregunta']
      }
    }
  });

  await t.feature.publishRealContent('post');

  assert.equal(t.find('hide').length, 0);
  assert.equal(t.find('reload').length, 0);
  assert(
    t.notices.includes('No se pudo crear la publicación')
  );

  console.log('OK  Error de insercion de post');
}

{
  const t = setup({
    steps: {
      0: {
        values: [
          'Centro, Chamberi',
          '800 - 1100',
          '2026-11-01'
        ]
      }
    }
  });

  await t.feature.publishRealContent('mate');

  const payload = t.find('update')[0][2];

  assert.equal(payload.budget_min, 800);
  assert.equal(payload.budget_max, 1100);
  assert.equal(payload.zones.length, 2);
  assert(payload.seeking.includes('mates'));
  assert.equal(t.find('reload').length, 1);

  console.log('OK  Busqueda de companeros');
}

{
  const t = setup({
    steps: {
      0: {
        values: ['950'],
        meta: {}
      }
    }
  });

  await t.feature.publishRealContent('room');

  assert.equal(t.find('insert').length, 0);
  assert.equal(t.find('geocode').length, 0);
  assert(
    t.notices.includes(
      'Añade la dirección exacta de la vivienda'
    )
  );

  console.log('OK  Direccion obligatoria');
}

{
  const t = setup({
    steps: {
      0: {
        values: [''],
        meta: { exactAddress: 'Calle Mayor 1' }
      }
    }
  });

  await t.feature.publishRealContent('room');

  assert.equal(t.find('insert').length, 0);
  assert(
    t.notices.includes('Añade el precio de la vivienda')
  );

  console.log('OK  Precio obligatorio');
}

{
  const t = setup({
    errorAt: 'geocode',
    steps: {
      0: {
        values: ['950'],
        meta: { exactAddress: 'Calle Falsa 123' }
      }
    }
  });

  await t.feature.publishRealContent('room');

  assert.equal(t.find('insert').length, 0);
  assert(t.notices.includes('Direccion no localizada'));

  console.log('OK  Error de geocodificacion');
}

{
  const t = setup({
    files: [{ name: 'habitacion.jpg' }],
    steps: {
      0: {
        values: ['950', '2026-11-01', '12 meses'],
        meta: { exactAddress: 'Calle Serrano 55' }
      },
      1: {
        values: ['2', '1', '85'],
        selected: ['Amueblado', 'Terraza']
      },
      2: {
        values: ['Habitacion luminosa']
      }
    }
  });

  await t.feature.publishRealContent('room');

  const payload = t.find('insert')[0][2];

  assert.equal(payload.kind, 'room');
  assert.equal(payload.price, 950);
  assert.equal(payload.zone, 'Salamanca');
  assert.equal(payload.location_precision, 'approximate');
  assert.equal(payload.furnished, true);
  assert.equal(payload.photos.length, 0);

  const rpc = t.find('rpc')[0];

  assert.equal(
    rpc[1],
    'set_listing_private_location'
  );
  assert.equal(rpc[2].target_listing_id, 'listing-1');
  assert.equal(rpc[2].target_exact_latitude, 40.42);
  assert.equal(t.find('listing-media').length, 1);
  assert.equal(t.find('reload').length, 1);
  assert(t.notices.includes('Vivienda publicada'));

  console.log('OK  Vivienda, privacidad y fotografias');
}

{
  const t = setup({
    errorAt: 'listings-insert',
    steps: {
      0: {
        values: ['1200'],
        meta: { exactAddress: 'Calle Mayor 1' }
      }
    }
  });

  await t.feature.publishRealContent('apartment');

  assert.equal(t.find('rpc').length, 0);
  assert.equal(t.find('reload').length, 0);
  assert(
    t.notices.includes('No se pudo publicar la vivienda')
  );

  console.log('OK  Error creando vivienda');
}

{
  const t = setup({
    errorAt: 'rpc',
    steps: {
      0: {
        values: ['1200'],
        meta: { exactAddress: 'Calle Mayor 1' }
      }
    }
  });

  await t.feature.publishRealContent('apartment');

  assert.equal(t.find('insert').length, 1);
  assert.equal(t.find('rpc').length, 1);
  assert.equal(t.find('delete').length, 1);

  const filters = t.find('delete-filter');

  assert.equal(filters.length, 2);
  assert(
    filters.some(item =>
      item[1] === 'id' && item[2] === 'listing-1'
    )
  );
  assert(
    filters.some(item =>
      item[1] === 'owner_id' && item[2] === 'user-1'
    )
  );

  assert.equal(t.find('reload').length, 0);
  assert(
    t.notices.includes(
      'No se pudo guardar la ubicación de la vivienda'
    )
  );

  console.log('OK  Rollback de vivienda');
}

console.log('\nROOMS PUBLISH SUBMIT FEATURE OK');
