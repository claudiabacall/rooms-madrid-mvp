import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(
  'assets/js/features/community-interactions.js',
  'utf8'
);

const app = fs.readFileSync(
  'assets/js/supabase-app.js',
  'utf8'
);

const html = fs.readFileSync('index.html', 'utf8');

console.log('\n=== COMMUNITY INTERACTIONS ===');

assert(
  html.includes('assets/js/features/community-interactions.js')
);

assert(
  html.indexOf('assets/js/features/community-interactions.js') <
  html.indexOf('assets/js/supabase-app.js')
);

assert(
  app.includes('ROOMS_COMMUNITY_INTERACTIONS_FEATURE?.create')
);

for (const name of [
  'loadCommunityPostInteractions',
  'toggleCommunityPostLike',
  'renderCommunityCommentsPanel',
  'createCommunityPostComment'
]) {
  assert(
    new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`)
      .test(source),
    `Falta ${name} en la feature`
  );
}

console.log('OK  Integracion registrada');

function setup({
  authenticated = true,
  liked = false,
  mutationError = false,
  likesError = false,
  commentsError = false
} = {}) {
  const dom = new JSDOM(`
    <!doctype html>
    <html>
      <body>
        <div data-community-comments-panel="post-1" hidden></div>
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

  const state = {
    user: authenticated ? { id: 'user-1' } : null,
    posts: new Map([
      ['post-1', {
        id: 'post-1',
        community_id: 'community-1'
      }]
    ]),
    profiles: new Map([
      ['user-2', {
        name: 'Usuario de prueba',
        avatar_url: null
      }]
    ]),
    postLikes: new Map(),
    postComments: new Map(),
    userPostLikes: new Set()
  };

  const db = {
    from(table) {
      if (table === 'post_likes') {
        return {
          select() {
            return {
              async in() {
                return {
                  data: liked
                    ? [{
                        post_id: 'post-1',
                        user_id: 'user-1'
                      }]
                    : [],
                  error: likesError
                    ? { message: 'likes error' }
                    : null
                };
              }
            };
          },

          insert(payload) {
            calls.push(['insertLike', payload]);
            return Promise.resolve({
              error: mutationError
                ? { message: 'mutation error' }
                : null
            });
          },

          delete() {
            return {
              async match(payload) {
                calls.push(['deleteLike', payload]);
                return {
                  error: mutationError
                    ? { message: 'mutation error' }
                    : null
                };
              }
            };
          }
        };
      }

      if (table === 'post_comments') {
        return {
          select() {
            return {
              in() {
                return {
                  eq() {
                    return {
                      async order() {
                        return {
                          data: [{
                            id: 'comment-1',
                            post_id: 'post-1',
                            author_id: 'user-2',
                            body: 'Comentario de prueba',
                            status: 'published',
                            created_at: '2026-10-01'
                          }],
                          error: commentsError
                            ? { message: 'comments error' }
                            : null
                        };
                      }
                    };
                  }
                };
              }
            };
          },

          insert(payload) {
            calls.push(['insertComment', payload]);
            return Promise.resolve({
              error: mutationError
                ? { message: 'mutation error' }
                : null
            });
          }
        };
      }

      throw new Error(`Tabla inesperada: ${table}`);
    }
  };

  const feature =
    window.ROOMS_COMMUNITY_INTERACTIONS_FEATURE.create({
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
        name.split(' ').map(part => part[0]).join(''),
      relativeTime: () => 'Hace poco',
      renderRealCommunityDetail: () => {
        renderCount++;
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

    await t.feature.loadCommunityPostInteractions();

    assert.equal(t.state.postLikes.size, 0);
    assert.equal(t.state.postComments.get('post-1').length, 1);

    console.log('OK  Carga de interacciones');
    t.close();
  }

  {
    const t = setup({ liked: true });

    await t.feature.loadCommunityPostInteractions();

    assert.equal(t.state.postLikes.get('post-1'), 1);
    assert(t.state.userPostLikes.has('post-1'));

    console.log('OK  Likes del usuario identificados');
    t.close();
  }

  {
    const t = setup();

    await t.feature.loadCommunityPostInteractions();
    t.feature.renderCommunityCommentsPanel('post-1');

    const panel = t.window.document.querySelector(
      '[data-community-comments-panel="post-1"]'
    );

    assert(panel.textContent.includes('Comentario de prueba'));
    assert(panel.textContent.includes('Usuario de prueba'));

    assert(
      panel.querySelector(
        '[data-community-comment-form="post-1"]'
      )
    );

    console.log('OK  Renderizado de comentarios');
    t.close();
  }

  {
    const t = setup();

    await t.feature.toggleCommunityPostLike('post-1');

    assert(
      t.calls.some(call => call[0] === 'insertLike')
    );
    assert.equal(t.getRenderCount(), 1);

    console.log('OK  Anadir like y refrescar comunidad');
    t.close();
  }

  {
    const t = setup({ liked: true });

    await t.feature.loadCommunityPostInteractions();
    await t.feature.toggleCommunityPostLike('post-1');

    assert(
      t.calls.some(call => call[0] === 'deleteLike')
    );
    assert.equal(t.getRenderCount(), 1);

    console.log('OK  Quitar like');
    t.close();
  }

  {
    const t = setup({ mutationError: true });

    await t.feature.toggleCommunityPostLike('post-1');

    assert.equal(t.getRenderCount(), 0);

    assert(
      t.notifications.includes(
        'No hemos podido actualizar el Me gusta'
      )
    );

    console.log('OK  Error de likes controlado');
    t.close();
  }

  {
    const t = setup();

    await t.feature.createCommunityPostComment(
      'post-1',
      '  Hola comunidad  '
    );

    const insertion = t.calls.find(
      call => call[0] === 'insertComment'
    );

    assert(insertion);
    assert.equal(insertion[1].body, 'Hola comunidad');
    assert.equal(insertion[1].status, 'published');
    assert.equal(t.getRenderCount(), 1);

    console.log('OK  Publicacion de comentario');
    t.close();
  }

  {
    const t = setup({ mutationError: true });

    await t.feature.createCommunityPostComment(
      'post-1',
      'Comentario con error'
    );

    assert.equal(t.getRenderCount(), 0);

    assert(
      t.notifications.includes(
        'No hemos podido publicar el comentario'
      )
    );

    console.log('OK  Error de comentario controlado');
    t.close();
  }

  {
    const t = setup({ authenticated: false });

    await t.feature.toggleCommunityPostLike('post-1');

    await t.feature.createCommunityPostComment(
      'post-1',
      'Hola'
    );

    assert.equal(t.calls.length, 0);
    assert.equal(t.getRenderCount(), 0);

    console.log('OK  Usuario sin sesion protegido');
    t.close();
  }

  console.log('\nROOMS COMMUNITY INTERACTIONS FEATURE OK');
}

await run();
