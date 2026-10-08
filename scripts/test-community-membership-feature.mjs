import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/community-membership.js', 'utf8'
);
const app = fs.readFileSync(
  'assets/js/supabase-app.js', 'utf8'
);
const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== COMMUNITY MEMBERSHIP ===');

assert(
  html.includes('assets/js/features/community-membership.js')
);
assert(
  html.indexOf('assets/js/features/community-membership.js') <
  html.indexOf('assets/js/supabase-app.js')
);
assert(
  app.includes('ROOMS_COMMUNITY_MEMBERSHIP_FEATURE?.create')
);

for (const fn of [
  'loadMemberCommunities',
  'renderMemberCommunities',
  'toggleRealCommunityMembership'
]) {
  assert(
    new RegExp(`(?:async\\s+)?function\\s+${fn}\\s*\\(`)
      .test(source),
    `Falta ${fn} en la feature`
  );
}

assert(
  /async function loadMemberCommunities\(\.\.\.args\)/.test(app)
);
assert(
  /function renderMemberCommunities\(\.\.\.args\)/.test(app)
);
assert(
  !/function toggleRealCommunityMembership\s*\(/.test(app)
);

console.log('OK  Integracion y bridges correctos');

function setup({
  authenticated = true,
  membership = null,
  loadError = false,
  mutationError = false
} = {}) {
  const dom = new JSDOM(`
    <!doctype html>
    <html><body>
      <div id="memberCommunitiesGrid"></div>
    </body></html>
  `, {
    runScripts: 'outside-only',
    url: 'http://127.0.0.1/'
  });

  const { window } = dom;
  window.eval(source);

  const notifications = [];
  const operations = [];
  const opened = [];

  const community = {
    id: 'community-1',
    owner_id: 'owner-1',
    name: 'Comunidad Test',
    description: 'Descripcion de prueba',
    visibility: 'public'
  };

  const state = {
    user: authenticated ? { id: 'user-1' } : null,
    communities: new Map([[community.id, community]]),
    communityMemberships: [],
    activeCommunityMembership: membership
  };

  const db = {
    from(table) {
      assert.equal(table, 'community_members');

      return {
        select() {
          return {
            eq() {
              return {
                order: async () => ({
                  data: membership
                    ? [{
                        community_id: 'community-1',
                        role: membership.role,
                        status: 'active',
                        joined_at: '2026-10-01'
                      }]
                    : [],
                  error: loadError
                    ? { message: 'load error' }
                    : null
                })
              };
            }
          };
        },

        insert(payload) {
          operations.push(['insert', payload]);

          return Promise.resolve({
            error: mutationError
              ? { message: 'insert error' }
              : null
          });
        },

        delete() {
          return {
            eq() {
              return {
                eq: async () => {
                  operations.push(['delete']);
                  return {
                    error: mutationError
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

  const feature =
    window.ROOMS_COMMUNITY_MEMBERSHIP_FEATURE.create({
      db,
      state,
      notify: message => notifications.push(message),
      escapeHtml: value =>
        String(value ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;'),
      openRealCommunity: async id => opened.push(id)
    });

  return {
    window,
    feature,
    state,
    operations,
    notifications,
    opened,
    close: () => dom.window.close()
  };
}

async function run() {
  {
    const t = setup();
    await t.feature.loadMemberCommunities();

    assert.equal(t.state.communityMemberships.length, 0);
    assert(
      t.window.document.querySelector(
        '#memberCommunitiesGrid'
      ).textContent.includes(
        'Todavía no perteneces'
      )
    );

    console.log('OK  Estado sin comunidades');
    t.close();
  }

  {
    const t = setup({
      membership: { role: 'member' }
    });

    await t.feature.loadMemberCommunities();

    assert.equal(t.state.communityMemberships.length, 1);

    assert(
      t.window.document.querySelector(
        '[data-member-community-open="community-1"]'
      )
    );

    console.log('OK  Carga y render de comunidades');
    t.close();
  }

  {
    const t = setup({ loadError: true });

    await t.feature.loadMemberCommunities();

    assert(
      t.window.document.querySelector(
        '#memberCommunitiesGrid'
      ).textContent.includes(
        'No hemos podido cargar'
      )
    );

    console.log('OK  Error de carga controlado');
    t.close();
  }

  {
    const t = setup();

    await t.feature.toggleRealCommunityMembership(
      'community-1'
    );

    assert.equal(t.operations[0][0], 'insert');
    assert.equal(
      t.operations[0][1].user_id,
      'user-1'
    );

    assert(
      t.notifications.includes(
        'Te has unido a la comunidad'
      )
    );

    assert.deepEqual(t.opened, ['community-1']);

    console.log('OK  Unirse a una comunidad');
    t.close();
  }

  {
    const t = setup({
      membership: { role: 'member' }
    });

    await t.feature.toggleRealCommunityMembership(
      'community-1'
    );

    assert.equal(t.operations[0][0], 'delete');

    assert(
      t.notifications.includes(
        'Has salido de la comunidad'
      )
    );

    console.log('OK  Salir de una comunidad');
    t.close();
  }

  {
    const t = setup({
      membership: { role: 'owner' }
    });

    await t.feature.toggleRealCommunityMembership(
      'community-1'
    );

    assert.equal(t.operations.length, 0);

    assert(
      t.notifications.some(message =>
        message.includes(
          'El propietario no puede salir'
        )
      )
    );

    console.log('OK  Propietario protegido');
    t.close();
  }

  {
    const t = setup({ authenticated: false });

    await t.feature.toggleRealCommunityMembership(
      'community-1'
    );

    assert.equal(t.operations.length, 0);

    assert(
      t.notifications.includes(
        'Necesitas iniciar sesión'
      )
    );

    console.log('OK  Usuario sin sesion controlado');
    t.close();
  }

  {
    const t = setup({ mutationError: true });

    await t.feature.toggleRealCommunityMembership(
      'community-1'
    );

    assert.equal(t.opened.length, 0);

    assert(
      t.notifications.includes(
        'No hemos podido unirte a la comunidad'
      )
    );

    console.log('OK  Error de insercion controlado');
    t.close();
  }

  console.log(
    '\nROOMS COMMUNITY MEMBERSHIP FEATURE OK'
  );
}

await run();
