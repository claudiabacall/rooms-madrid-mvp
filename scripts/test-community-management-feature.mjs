import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/community-management.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== COMMUNITY MANAGEMENT ===');

assert(
  html.includes(
    'assets/js/features/community-management.js'
  ),
  'Falta el script Community Management'
);

assert(
  html.indexOf(
    'assets/js/features/community-management.js'
  ) < html.indexOf('assets/js/supabase-app.js'),
  'Orden de carga incorrecto'
);

assert(
  app.includes(
    'ROOMS_COMMUNITY_MANAGEMENT_FEATURE?.create'
  ),
  'Falta inicializacion de Community Management'
);

for (const name of [
  'ensureManageCommunityModal',
  'renderManageCommunityMembers',
  'openManageCommunityModal',
  'closeManageCommunityModal',
  'saveCommunityManagement'
]) {
  const regex = new RegExp(
    `(?:async\\s+)?function\\s+${name}\\s*\\(`
  );

  assert(
    regex.test(source),
    `${name} no existe en la feature`
  );

  assert(
    !regex.test(app),
    `${name} sigue duplicada en el monolito`
  );
}

console.log('OK  Integracion y extraccion correctas');

function setup({
  owner = true,
  updateError = false,
  uploadError = false
} = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body></body></html>',
    {
      runScripts: 'outside-only',
      url: 'http://127.0.0.1/'
    }
  );

  const { window } = dom;
  const { document } = window;

  window.eval(source);

  const notifications = [];
  const calls = [];
  const updates = [];

  const community = {
    id: 'community-1',
    owner_id: owner ? 'user-1' : 'other-user',
    name: 'Comunidad Original',
    description: 'Descripcion original',
    visibility: 'public',
    image_url: null
  };

  const state = {
    user: { id: 'user-1' },
    activeCommunity: community,
    activeCommunityMembers: [
      {
        user_id: 'user-1',
        role: 'owner',
        joined_at: '2026-10-01'
      }
    ],
    communities: new Map([
      [community.id, community]
    ]),
    profiles: new Map([
      ['user-1', {
        id: 'user-1',
        name: 'Usuario Test'
      }]
    ]),
    listings: new Map(),
    posts: new Map()
  };

  let pendingChanges = null;

  const db = {
    from(table) {
      assert.equal(table, 'communities');

      return {
        update(changes) {
          pendingChanges = changes;
          updates.push(changes);

          return {
            eq(field, value) {
              calls.push(['filter', field, value]);
              return this;
            },
            select() {
              return this;
            },
            async single() {
              if (updateError) {
                return {
                  data: null,
                  error: { message: 'update error' }
                };
              }

              return {
                data: {
                  ...state.activeCommunity,
                  ...pendingChanges
                },
                error: null
              };
            }
          };
        }
      };
    },

    storage: {
      from(bucket) {
        assert.equal(bucket, 'community-images');

        return {
          async upload(path, file, options) {
            calls.push(['upload', path, options]);

            return {
              error: uploadError
                ? { message: 'upload error' }
                : null
            };
          },

          getPublicUrl(path) {
            return {
              data: {
                publicUrl:
                  `https://example.com/${path}`
              }
            };
          }
        };
      }
    }
  };

  const track = name => (...args) => {
    calls.push([name, ...args]);
  };

  const feature =
    window.ROOMS_COMMUNITY_MANAGEMENT_FEATURE.create({
      db,
      state,
      notify: message => notifications.push(message),

      escapeHtml: value =>
        String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;'),

      initials: name =>
        String(name).slice(0, 1).toUpperCase(),

      renderRealCommunityDetail:
        track('detail'),

      loadMemberCommunities:
        async () => track('members')(),

      renderFilteredExplore:
        track('explore'),

      renderRealFeed:
        track('feed')
    });

  assert(feature, 'No se pudo crear la feature');

  return {
    window,
    document,
    state,
    feature,
    calls,
    updates,
    notifications,
    close() {
      dom.window.close();
    }
  };
}

async function run() {
  {
    const t = setup();

    t.feature.openManageCommunityModal();

    const modal =
      t.document.querySelector('#manageCommunityModal');

    assert(modal, 'No se ha creado el modal');
    assert(modal.classList.contains('open'));

    assert.equal(
      modal.querySelector('#manageCommunityName').value,
      'Comunidad Original'
    );

    assert.equal(
      modal.getAttribute('aria-hidden'),
      'false'
    );

    console.log('OK  Apertura del gestor');

    assert(
      modal.querySelector('#manageCommunityMembersList')
        .textContent.includes('Usuario Test')
    );

    assert(
      modal.querySelector('#manageCommunityMemberCount')
        .textContent.includes('1 miembro')
    );

    console.log('OK  Renderizado de miembros');

    const membersTab = modal.querySelector(
      '[data-manage-community-tab="members"]'
    );

    membersTab.click();

    assert(
      membersTab.classList.contains('active')
    );

    assert.equal(
      modal.querySelector(
        '[data-manage-community-panel="members"]'
      ).hidden,
      false
    );

    console.log('OK  Cambio de pestanas');

    t.feature.closeManageCommunityModal();

    assert(!modal.classList.contains('open'));

    assert.equal(
      modal.getAttribute('aria-hidden'),
      'true'
    );

    console.log('OK  Cierre del gestor');
    t.close();
  }

  {
    const t = setup({ owner: false });

    t.feature.openManageCommunityModal();

    assert(
      !t.document.querySelector(
        '#manageCommunityModal'
      )
    );

    assert(
      t.notifications.some(
        message => message.includes(
          'Solo el propietario'
        )
      )
    );

    await t.feature.saveCommunityManagement({
      preventDefault() {}
    });

    assert.equal(t.updates.length, 0);

    console.log('OK  Permisos de propietario');
    t.close();
  }

  {
    const t = setup();

    t.feature.openManageCommunityModal();

    const modal = t.document.querySelector(
      '#manageCommunityModal'
    );

    modal.querySelector(
      '#manageCommunityName'
    ).value = '   ';

    await t.feature.saveCommunityManagement({
      preventDefault() {}
    });

    assert.equal(t.updates.length, 0);

    assert(
      t.notifications.includes(
        'La comunidad necesita un nombre'
      )
    );

    console.log('OK  Validacion de nombre vacio');
    t.close();
  }

  {
    const t = setup();

    t.feature.openManageCommunityModal();

    const modal = t.document.querySelector(
      '#manageCommunityModal'
    );

    modal.querySelector(
      '#manageCommunityName'
    ).value = 'Comunidad Actualizada';

    modal.querySelector(
      '#manageCommunityDescription'
    ).value = 'Nueva descripcion';

    await t.feature.saveCommunityManagement({
      preventDefault() {}
    });

    assert.equal(t.updates.length, 1);

    assert.equal(
      t.updates[0].name,
      'Comunidad Actualizada'
    );

    assert(
      t.calls.some(
        call =>
          call[0] === 'filter' &&
          call[1] === 'owner_id' &&
          call[2] === 'user-1'
      ),
      'Falta filtro de propietario en Supabase'
    );

    assert.equal(
      t.state.activeCommunity.name,
      'Comunidad Actualizada'
    );

    for (const name of [
      'detail',
      'members',
      'explore',
      'feed'
    ]) {
      assert(
        t.calls.some(call => call[0] === name),
        `Falta refrescar ${name}`
      );
    }

    assert(
      t.notifications.includes(
        'Comunidad actualizada'
      )
    );

    console.log('OK  Guardado de cambios');
    console.log('OK  Filtro owner_id conservado');
    console.log('OK  Estado y vistas actualizados');
    t.close();
  }

  {
    const t = setup({ updateError: true });

    t.feature.openManageCommunityModal();

    await t.feature.saveCommunityManagement({
      preventDefault() {}
    });

    assert(
      t.notifications.includes(
        'No hemos podido guardar los cambios'
      )
    );

    assert.equal(
      t.state.activeCommunity.name,
      'Comunidad Original'
    );

    console.log('OK  Error Supabase controlado');
    t.close();
  }

  {
    const t = setup();

    t.feature.openManageCommunityModal();

    const modal = t.document.querySelector(
      '#manageCommunityModal'
    );

    modal.dataset.removeCover = 'true';

    await t.feature.saveCommunityManagement({
      preventDefault() {}
    });

    assert.equal(t.updates[0].image_url, null);

    console.log('OK  Eliminacion de portada');
    t.close();
  }

  {
    const t = setup({ uploadError: true });

    t.feature.openManageCommunityModal();

    const input = t.document.querySelector(
      '#manageCommunityCoverInput'
    );

    const file = new t.window.File(
      ['imagen de prueba'],
      'portada.jpg',
      { type: 'image/jpeg' }
    );

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file]
    });

    await t.feature.saveCommunityManagement({
      preventDefault() {}
    });

    assert(
      t.notifications.includes(
        'No hemos podido subir la portada'
      )
    );

    assert.equal(t.updates.length, 0);

    console.log('OK  Error de subida controlado');
    t.close();
  }

  console.log(
    '\nROOMS COMMUNITY MANAGEMENT FEATURE OK'
  );
}

await run();
