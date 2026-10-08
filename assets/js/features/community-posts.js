(function () {
  'use strict';

  function createCommunityPostsFeature({
    state,
    escapeHtml,
    initials,
    relativeTime
  }) {
    function renderCommunityPost(post) {
      const profile =
        state.profiles.get(post.author_id);

      const name =
        profile?.alias ||
        profile?.name ||
        (
          post.author_id === state.user?.id
            ? 'Tú'
            : 'Usuario de Rooms'
        );

      const avatar =
        profile?.avatar_url;

      const linkedListing =
        post.listing_id
          ? state.listings.get(post.listing_id)
          : null;

      const media =
        Array.isArray(post.media_urls)
          ? post.media_urls
          : [];

      const typeLabels = {
        question: 'Pregunta',
        recommendation: 'Recomendación',
        neighborhood: 'Barrio',
        warning: 'Aviso',
        experience: 'Experiencia',
        housing: 'Vivienda'
      };

      return `
        <article
          class="community-post real-community-post"
          data-community-post="${escapeHtml(post.id)}"
        >

          <header>

            ${
              avatar
                ? `
                  <img
                    class="real-community-post-avatar"
                    src="${escapeHtml(avatar)}"
                    alt="${escapeHtml(name)}"
                  >
                `
                : `
                  <div class="social-avatar">
                    ${escapeHtml(initials(name))}
                  </div>
                `
            }

            <div>
              <b>${escapeHtml(name)}</b>

              <span>
                ${escapeHtml(relativeTime(post.created_at))}
                ·
                ${escapeHtml(
                  typeLabels[post.post_type] ||
                  'Publicación'
                )}
              </span>
            </div>

          </header>

          ${
            post.zone
              ? `
                <div class="community-post-zone">
                  ◎ ${escapeHtml(post.zone)}
                </div>
              `
              : ''
          }

          <p>
            ${escapeHtml(post.body)}
          </p>

          ${
            media.length
              ? `
                <div class="community-post-media">
                  <img
                    src="${escapeHtml(media[0])}"
                    alt=""
                  >
                </div>
              `
              : ''
          }

          ${
            linkedListing
              ? `
                <button
                  type="button"
                  class="community-post-linked-listing"
                  data-real-listing="${escapeHtml(linkedListing.id)}"
                >

                  ${
                    Array.isArray(linkedListing.photos) &&
                    linkedListing.photos[0]
                      ? `
                        <img
                          src="${escapeHtml(linkedListing.photos[0])}"
                          alt=""
                        >
                      `
                      : `
                        <span>⌂</span>
                      `
                  }

                  <div>
                    <small>VIVIENDA EN ROOMS</small>

                    <b>
                      ${escapeHtml(
                        linkedListing.title ||
                        linkedListing.zone ||
                        'Vivienda'
                      )}
                    </b>

                    <p>
                      ${
                        linkedListing.price != null
                          ? `${Number(
                              linkedListing.price
                            ).toLocaleString('es-ES')} € / mes`
                          : 'Precio sin definir'
                      }
                    </p>
                  </div>

                  <strong>→</strong>

                </button>
              `
              : ''
          }

          ${
            post.post_type === 'warning' &&
            post.expires_at
              ? `
                <div class="community-warning-expiry">
                  AVISO VIGENTE HASTA
                  <b>
                    ${escapeHtml(
                      new Intl.DateTimeFormat(
                        'es-ES',
                        {
                          day: 'numeric',
                          month: 'short'
                        }
                      ).format(
                        new Date(
                          `${post.expires_at}T00:00:00`
                        )
                      )
                    )}
                  </b>
                </div>
              `
              : ''
          }

          <div class="real-report-row">
            <button
              type="button"
              class="real-report-button"
              data-real-report
              data-report-type="post"
              data-report-id="${escapeHtml(post.id)}"
              data-report-user="${escapeHtml(post.author_id || '')}"
            >
              Reportar publicación
            </button>
          </div>

          <div class="community-post-actions">

            <button
              type="button"
              class="${
                state.userPostLikes?.has(post.id)
                  ? 'active'
                  : ''
              }"
              data-community-post-like="${escapeHtml(post.id)}"
            >
              ${
                state.userPostLikes?.has(post.id)
                  ? '♥'
                  : '♡'
              }
              Me gusta
              <span>
                ${state.postLikes?.get(post.id) || 0}
              </span>
            </button>

            <button
              type="button"
              data-community-post-comments="${escapeHtml(post.id)}"
            >
              ${
                post.post_type === 'question'
                  ? '○ Responder'
                  : '○ Comentar'
              }
              <span>
                ${
                  state.postComments?.get(post.id)?.length || 0
                }
              </span>
            </button>

            <button
              type="button"
              class="${
                state.savedItems?.has(`post:${post.id}`)
                  ? 'saved'
                  : ''
              }"
              data-save-kind="post"
              data-save-id="${escapeHtml(post.id)}"
            >
              ${
                state.savedItems?.has(`post:${post.id}`)
                  ? '♥ Guardado'
                  : '♡ Guardar'
              }
            </button>

          </div>

          <div
            class="community-post-comments-panel"
            data-community-comments-panel="${escapeHtml(post.id)}"
            hidden
          ></div>

        </article>
      `;
    }

    return {
      renderCommunityPost
    };
  }

  window.ROOMS_COMMUNITY_POSTS_FEATURE = {
    create: createCommunityPostsFeature
  };
})();
