import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/community-detail-core.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync(
  'index.html',
  'utf8'
);

console.log('\n=== COMMUNITY DETAIL CORE ===');

const script = 'assets/js/features/community-detail-core.js';

assert(html.includes(`src="${script}"`));

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_COMMUNITY_DETAIL_CORE_FEATURE?.create')
);

assert(
  !/\bfunction openRealCommunity\s*\(/.test(app),
  'openRealCommunity sigue declarada en el monolito'
);

console.log('OK  Integracion y extraccion correctas');

function setup({
  communityExists = true,
  authenticated = true,
  membersError = false,
  members = null
} = {}) {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <main class="feed-main"></main>
        <section id="exploreView"></section>
        <section id="communitiesView"></section>
        <section id="householdView"></section>
        <section id="ownProfileView"></section>
        <section id="savedView"></section>
        <section id="settingsView"></section>
        <section id="trustView"></section>
        <section id="communityView" hidden></section>

        <button data-bottom-nav="feed"></button>
        <button data-bottom-nav="communities"></button>
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
  let renderCount = 0;

  window.scrollTo = options => {
    calls.push(['scroll', options]);
  };

  const community = {
    id: 'community-1',
    name: 'Comunidad Test',
    owner_id: 'owner-1',
    visibility: 'public'
  };

  const state = {
    user: authenticated ? { id: 'user-1' } : null,
    communities: new Map(
      communityExists ? [[community.id, community]] : []
    ),
    activeCommunity: null,
    activeCommunityMembers: [],
    activeCommunityMembership: null
  };

  const resultMembers = members ?? [
    {
      community_id: 'community-1',
      user_id: 'owner-1',
      role: 'owner',
      status: 'active',
      joined_at: '2026-10-01'
    },
    {
      community_id: 'community-1',
      user_id: 'user-1',
      role: 'member',
      status: 'active',
      joined_at: '2026-10-02'
    }
  ];

  const db = {
    from(table) {
      assert.equal(table, 'community_members');

      return {
        select(columns) {
          calls.push(['select', columns]);

          return {
            eq(field, value) {
              calls.push(['eq', field, value]);

              return {
                eq(field2, value2) {
                  calls.push(['eq', field2, value2]);

                  return {
                    async order(column, options) {
                      calls.push(['order', column, options]);

                      return {
                        data: membersError ? null : resultMembers,
                        error: membersError
                          ? { message: 'members error' }
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
  };

  const feature =
    window.ROOMS_COMMUNITY_DETAIL_CORE_FEATURE.create({
      db,
      state,
      notify: message => notifications.push(message),
      renderRealCommunityDetail: () => {
        renderCount++;
        calls.push(['render']);
      }
    });

  return {
    window,
    feature,
    state,
    calls,
    notifications,
    getRenderCount: () => renderCount,
    close: () => window.close()
  };
}

async function run() {
  {
    const t = setup();

    await t.feature.openRealCommunity('community-1');

    assert.equal(
      t.state.activeCommunity.id,
      'community-1'
    );

    assert.equal(t.state.activeCommunityMembers.length, 2);

    assert.equal(
      t.state.activeCommunityMembership.user_id,
      'user-1'
    );

    assert.equal(
      t.state.activeCommunityMembership.role,
      'member'
    );

    assert.equal(t.getRenderCount(), 1);

    console.log('OK  Carga de comunidad y miembros');
    console.log('OK  Membership del usuario identificado');

    const hiddenViews = [
      '.feed-main',
      '#exploreView',
      '#communitiesView',
      '#householdView',
      '#ownProfileView',
      '#savedView',
      '#settingsView',
      '#trustView'
    ];

    for (const selector of hiddenViews) {
      assert.equal(
        t.window.document.querySelector(selector).hidden,
        true,
        `No se ha ocultado ${selector}`
      );
    }

    assert.equal(
      t.window.document.querySelector(
        '#communityView'
      ).hidden,
      false
    );

    assert(
      t.window.document.querySelector(
        '[data-bottom-nav="communities"]'
      ).classList.contains('active')
    );

    assert(
      !t.window.document.querySelector(
        '[data-bottom-nav="feed"]'
      ).classList.contains('active')
    );

    assert(
      t.calls.some(call => call[0] === 'scroll')
    );

    console.log('OK  Pantallas y navegacion actualizadas');
    t.close();
  }

  {
    const t = setup({
      members: [{
        community_id: 'community-1',
        user_id: 'user-1',
        role: 'owner',
        status: 'active',
        joined_at: '2026-10-01'
      }]
    });

    await t.feature.openRealCommunity('community-1');

    assert.equal(
      t.state.activeCommunityMembership.role,
      'owner'
    );

    console.log('OK  Rol propietario identificado');
    t.close();
  }

  {
    const t = setup({
      members: [{
        community_id: 'community-1',
        user_id: 'owner-1',
        role: 'owner',
        status: 'active',
        joined_at: '2026-10-01'
      }]
    });

    await t.feature.openRealCommunity('community-1');

    assert.equal(
      t.state.activeCommunityMembership,
      null
    );

    console.log('OK  Usuario no miembro identificado');
    t.close();
  }

  {
    const t = setup({ authenticated: false });

    await t.feature.openRealCommunity('community-1');

    assert.equal(
      t.state.activeCommunityMembership,
      null
    );

    assert.equal(t.getRenderCount(), 1);

    console.log('OK  Apertura sin sesion');
    t.close();
  }

  {
    const t = setup({ membersError: true });

    await t.feature.openRealCommunity('community-1');

    assert.deepEqual(
      Array.from(t.state.activeCommunityMembers),
      []
    );

    assert.equal(
      t.state.activeCommunityMembership,
      null
    );

    assert.equal(t.getRenderCount(), 1);

    console.log('OK  Error de carga controlado');
    t.close();
  }

  {
    const t = setup({ communityExists: false });

    await t.feature.openRealCommunity('no-existe');

    assert.equal(t.state.activeCommunity, null);
    assert.equal(t.getRenderCount(), 0);

    assert(
      t.notifications.includes(
        'No encuentro esta comunidad'
      )
    );

    assert.equal(
      t.window.document.querySelector(
        '#communityView'
      ).hidden,
      true
    );

    console.log('OK  Comunidad inexistente controlada');
    t.close();
  }

  console.log('\nROOMS COMMUNITY DETAIL CORE FEATURE OK');
}

await run();
