import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/community-detail-render.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== COMMUNITY DETAIL RENDER ===');

const script =
  'assets/js/features/community-detail-render.js';

assert(html.includes(`src="${script}"`));

assert(
  html.indexOf(script) <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes(
    'ROOMS_COMMUNITY_DETAIL_RENDER_FEATURE?.create'
  )
);

assert(
  source.includes('function getActiveCommunityPosts()')
);

assert(
  source.includes('function renderRealCommunityDetail()')
);

assert(
  app.includes(
    'communityDetailRenderFeature.renderRealCommunityDetail'
  ) ||
  app.includes(
    '.renderRealCommunityDetail(...args)'
  )
);

console.log('OK  Integracion y bridge correctos');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setup({
  role = 'member',
  authenticated = true,
  community = true,
  members = null,
  posts = null
} = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body><section id="communityView"></section></body></html>',
    {
      runScripts: 'outside-only',
      url: 'http://127.0.0.1/'
    }
  );

  const { window } = dom;
  window.eval(source);

  const activeCommunity = community
    ? {
        id: 'community-1',
        owner_id: 'owner-1',
        name: 'Comunidad Test',
        description: 'Una comunidad de prueba',
        visibility: 'public'
      }
    : null;

  const defaultMembers = [
    {
      user_id: 'owner-1',
      role: 'owner',
      status: 'active'
    },
    {
      user_id: 'user-1',
      role: 'member',
      status: 'active'
    }
  ];

  const defaultPosts = [
    {
      id: 'post-old',
      community_id: 'community-1',
      status: 'published',
      post_type: 'question',
      created_at: '2026-09-01T10:00:00Z'
    },
    {
      id: 'post-new',
      community_id: 'community-1',
      status: 'published',
      post_type: 'experience',
      created_at: '2026-10-01T10:00:00Z'
    },
    {
      id: 'post-other',
      community_id: 'community-2',
      status: 'published',
      post_type: 'question',
      created_at: '2026-10-02T10:00:00Z'
    },
    {
      id: 'post-draft',
      community_id: 'community-1',
      status: 'draft',
      post_type: 'question',
      created_at: '2026-10-03T10:00:00Z'
    },
    {
      id: 'post-expired',
      community_id: 'community-1',
      status: 'published',
      post_type: 'warning',
      expires_at: '2020-01-01',
      created_at: '2026-10-04T10:00:00Z'
    }
  ];

  const state = {
    user: authenticated ? { id: 'user-1' } : null,
    activeCommunity,
    activeCommunityMembers: members ?? defaultMembers,
    activeCommunityMembership:
      role === 'visitor'
        ? null
        : {
            user_id: 'user-1',
            role,
            status: 'active'
          },
    posts: new Map(
      (posts ?? defaultPosts).map(post => [post.id, post])
    ),
    profiles: new Map([
      ['owner-1', {
        name: 'Propietario Test'
      }],
      ['user-1', {
        name: 'Miembro Test'
      }]
    ])
  };

  const renderedPosts = [];

  const feature =
    window.ROOMS_COMMUNITY_DETAIL_RENDER_FEATURE.create({
      state,
      escapeHtml,
      initials: name =>
        String(name)
          .split(/\s+/)
          .map(part => part[0])
          .join('')
          .toUpperCase(),
      renderCommunityPost: post => {
        renderedPosts.push(post.id);
        return `<article data-test-post="${escapeHtml(post.id)}"></article>`;
      }
    });

  return {
    window,
    feature,
    state,
    renderedPosts,
    view: window.document.querySelector('#communityView'),
    close: () => window.close()
  };
}

async function run() {
  {
    const t = setup();

    const posts = t.feature.getActiveCommunityPosts();

    assert.deepEqual(
      Array.from(posts, post => post.id),
      ['post-new', 'post-old']
    );

    console.log(
      'OK  Filtrado, orden y avisos caducados'
    );

    t.close();
  }

  {
    const t = setup();

    t.feature.renderRealCommunityDetail();

    assert(t.view.innerHTML.includes('Comunidad Test'));

    assert(
      t.view.querySelector('[data-real-community-panel="feed"]')
    );

    assert(
      t.view.querySelector('[data-real-community-panel="members"]')
    );

    assert(
      t.view.querySelector('[data-real-community-tab="feed"]')
    );

    assert(
      t.view.querySelector('[data-real-community-tab="members"]')
    );

    assert.deepEqual(
      t.renderedPosts,
      ['post-new', 'post-old']
    );

    console.log('OK  Feed y pestañas renderizados');

    t.close();
  }

  {
    const t = setup({ role: 'owner' });

    t.feature.renderRealCommunityDetail();

    assert(
      t.view.querySelector('[data-manage-community]')
    );

    assert(
      t.view.textContent.includes('ADMIN')
    );

    console.log('OK  Permisos de propietario');

    t.close();
  }

  {
    const t = setup({ role: 'member' });

    t.feature.renderRealCommunityDetail();

    assert(
      !t.view.querySelector('[data-manage-community]')
    );

    assert(
      t.view.querySelector('[data-community-publish]')
    );

    console.log('OK  Opciones de miembro');

    t.close();
  }

  {
    const t = setup({ role: 'visitor' });

    t.feature.renderRealCommunityDetail();

    assert(
      !t.view.querySelector('[data-manage-community]')
    );

    assert(
      !t.view.querySelector('[data-community-publish]')
    );

    assert(
      t.view.querySelector('[data-toggle-community-membership]')
    );

    console.log('OK  Opciones de visitante');

    t.close();
  }

  {
    const t = setup({ posts: [] });

    t.feature.renderRealCommunityDetail();

    assert(
      t.view.textContent.includes(
        'Todavía no hay publicaciones'
      )
    );

    console.log('OK  Feed vacio');

    t.close();
  }

  {
    const t = setup({
      members: []
    });

    t.feature.renderRealCommunityDetail();

    assert(
      t.view.textContent.includes(
        'No hay miembros todavía'
      )
    );

    console.log('OK  Lista de miembros vacia');

    t.close();
  }

  {
    const t = setup({ community: false });

    t.feature.renderRealCommunityDetail();

    assert.equal(t.view.innerHTML, '');

    assert.deepEqual(
      Array.from(t.feature.getActiveCommunityPosts()),
      []
    );

    console.log('OK  Sin comunidad activa');

    t.close();
  }

  {
    const t = setup();

    t.state.activeCommunity.name =
      '<script>alert("XSS")</script>';

    t.feature.renderRealCommunityDetail();

    assert(
      t.view.innerHTML.includes('&lt;script&gt;')
    );

    assert(
      !t.view.querySelector('script')
    );

    console.log('OK  Nombre escapado correctamente');

    t.close();
  }

  console.log(
    '\nROOMS COMMUNITY DETAIL RENDER FEATURE OK'
  );
}

await run();
