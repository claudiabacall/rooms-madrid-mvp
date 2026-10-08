(function () {
  'use strict';

  function createCommunityInteractionsFeature({
    db,
    state,
    notify,
    escapeHtml,
    initials,
    relativeTime,
    renderRealCommunityDetail
  }) {
    async function loadCommunityPostInteractions() {
      const postIds =
        [...state.posts.values()]
          .filter(post => post.community_id)
          .map(post => post.id);

      state.postLikes = new Map();
      state.postComments = new Map();
      state.userPostLikes = new Set();

      if (!postIds.length) return;

      const [
        { data: likes, error: likesError },
        { data: comments, error: commentsError }
      ] = await Promise.all([
        db
          .from('post_likes')
          .select('post_id,user_id,created_at')
          .in('post_id', postIds),

        db
          .from('post_comments')
          .select('id,post_id,author_id,body,status,created_at,updated_at')
          .in('post_id', postIds)
          .eq('status', 'published')
          .order('created_at', { ascending: true })
      ]);

      if (likesError) {
        console.error(
          'Rooms: error cargando likes de posts',
          likesError
        );
      }

      if (commentsError) {
        console.error(
          'Rooms: error cargando comentarios de posts',
          commentsError
        );
      }

      (likes || []).forEach(like => {
        const current =
          state.postLikes.get(like.post_id) || 0;

        state.postLikes.set(
          like.post_id,
          current + 1
        );

        if (like.user_id === state.user?.id) {
          state.userPostLikes.add(like.post_id);
        }
      });

      (comments || []).forEach(comment => {
        const current =
          state.postComments.get(comment.post_id) || [];

        current.push(comment);

        state.postComments.set(
          comment.post_id,
          current
        );
      });
    }

    async function toggleCommunityPostLike(postId) {
      if (!state.user) return;

      const liked =
        state.userPostLikes?.has(postId);

      if (liked) {
        const { error } = await db
          .from('post_likes')
          .delete()
          .match({
            post_id: postId,
            user_id: state.user.id
          });

        if (error) {
          console.error(
            'Rooms: error quitando like',
            error
          );
          notify('No hemos podido actualizar el Me gusta');
          return;
        }
      } else {
        const { error } = await db
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: state.user.id
          });

        if (error) {
          console.error(
            'Rooms: error añadiendo like',
            error
          );
          notify('No hemos podido actualizar el Me gusta');
          return;
        }
      }

      await loadCommunityPostInteractions();
      renderRealCommunityDetail();
    }


    function renderCommunityCommentsPanel(postId) {
      const panel =
        document.querySelector(
          `[data-community-comments-panel="${postId}"]`
        );

      if (!panel) return;

      const comments =
        state.postComments?.get(postId) || [];

      panel.innerHTML = `
        <div class="community-comments-list">

          ${
            comments.length
              ? comments.map(comment => {
                  const profile =
                    state.profiles.get(comment.author_id);

                  const name =
                    profile?.alias ||
                    profile?.name ||
                    (
                      comment.author_id === state.user?.id
                        ? 'Tú'
                        : 'Usuario de Rooms'
                    );

                  const avatar =
                    profile?.avatar_url;

                  return `
                    <article class="community-comment">

                      ${
                        avatar
                          ? `
                            <img
                              class="community-comment-avatar"
                              src="${escapeHtml(avatar)}"
                              alt="${escapeHtml(name)}"
                            >
                          `
                          : `
                            <span class="community-comment-avatar">
                              ${escapeHtml(initials(name))}
                            </span>
                          `
                      }

                      <div>
                        <header>
                          <b>${escapeHtml(name)}</b>
                          <small>
                            ${escapeHtml(relativeTime(comment.created_at))}
                          </small>
                        </header>

                        <p>
                          ${escapeHtml(comment.body)}
                        </p>
                      </div>

                    </article>
                  `;
                }).join('')
              : `
                <div class="community-comments-empty">
                  Sé la primera persona en comentar.
                </div>
              `
          }

        </div>

        <form
          class="community-comment-form"
          data-community-comment-form="${escapeHtml(postId)}"
        >
          <input
            type="text"
            maxlength="500"
            placeholder="Escribe un comentario..."
            required
          >

          <button type="submit">
            Enviar
          </button>
        </form>
      `;
    }


    async function createCommunityPostComment(
      postId,
      body
    ) {
      const cleanBody =
        body.trim();

      if (!cleanBody || !state.user) return;

      const { error } = await db
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: state.user.id,
          body: cleanBody,
          status: 'published'
        });

      if (error) {
        console.error(
          'Rooms: error creando comentario',
          error
        );

        notify(
          'No hemos podido publicar el comentario'
        );

        return;
      }

      await loadCommunityPostInteractions();

      renderRealCommunityDetail();

      setTimeout(() => {
        const panel =
          document.querySelector(
            `[data-community-comments-panel="${postId}"]`
          );

        if (panel) {
          panel.hidden = false;
          renderCommunityCommentsPanel(postId);
        }
      }, 0);
    }

    return {
      loadCommunityPostInteractions,
      toggleCommunityPostLike,
      renderCommunityCommentsPanel,
      createCommunityPostComment
    };
  }

  window.ROOMS_COMMUNITY_INTERACTIONS_FEATURE = {
    create: createCommunityInteractionsFeature
  };
})();
