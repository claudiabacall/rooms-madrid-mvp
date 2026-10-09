(function () {
  'use strict';

  function createFeedPostCardFeature({
    state,
    escapeHtml,
    initials,
    relativeTime
  }) {
    function renderPostCard(post) {
      if (
        !post ||
        (
          post.author_id &&
          state.blockedUsers?.has(post.author_id)
        )
      ) {
        return '';
      }

      const author =
        state.profiles.get(post.author_id);

      const name =
        author?.alias ||
        author?.name ||
        'Usuario de Rooms';

      const avatar =
        author?.avatar_url;

      const community =
        post.community_id
          ? state.communities?.get(post.community_id)
          : null;

      const linkedListing =
        post.listing_id
          ? state.listings.get(post.listing_id)
          : null;

      const media =
        Array.isArray(post.media_urls)
          ? post.media_urls
          : [];

      const saved =
        state.savedItems?.has(`post:${post.id}`);

      const liked =
        state.userPostLikes?.has(post.id);

      const likeCount =
        state.postLikes?.get(post.id) || 0;

      const commentCount =
        state.postComments?.get(post.id)?.length || 0;

      const typeConfig = {
        question: {
          label: 'PREGUNTA',
          symbol: '?',
          className: 'question',
          action: 'Responder'
        },
        recommendation: {
          label: 'RECOMENDACIÓN',
          symbol: '✦',
          className: 'recommendation',
          action: 'Comentar'
        },
        neighborhood: {
          label: 'BARRIO',
          symbol: '◎',
          className: 'neighborhood',
          action: 'Comentar'
        },
        warning: {
          label: 'AVISO',
          symbol: '!',
          className: 'warning',
          action: 'Comentar'
        },
        experience: {
          label: 'EXPERIENCIA',
          symbol: '↗',
          className: 'experience',
          action: 'Comentar'
        },
        housing: {
          label: 'VIVIENDA',
          symbol: '⌂',
          className: 'housing',
          action: 'Comentar'
        }
      };

      const config =
        typeConfig[post.post_type] ||
        typeConfig.question;

      if (
        post.post_type === 'warning' &&
        post.expires_at &&
        post.expires_at <
          new Date().toISOString().slice(0, 10)
      ) {
        return '';
      }

      return `
        <article
          class="feed-card home-editorial-post home-editorial-post--${config.className}"
          data-feed-type="post"
        >

          <div class="home-post-accent">
            <span>${config.symbol}</span>
            <small>${config.label}</small>
          </div>


          <div class="home-post-content">

            <header class="home-post-header">

              <div class="home-post-author">

                ${
                  avatar
                    ? `
                      <img
                        src="${escapeHtml(avatar)}"
                        alt="${escapeHtml(name)}"
                      >
                    `
                    : `
                      <span>
                        ${escapeHtml(initials(name))}
                      </span>
                    `
                }

                <div>
                  <b>${escapeHtml(name)}</b>

                  <small>
                    ${escapeHtml(relativeTime(post.created_at))}
                    ${
                      community
                        ? ` · ${escapeHtml(community.name)}`
                        : ''
                    }
                  </small>
                </div>

              </div>

              ${
                community
                  ? `
                    <button
                      type="button"
                      class="home-post-community-link"
                      data-real-community-open="${escapeHtml(community.id)}"
                    >
                      Ver comunidad ↗
                    </button>
                  `
                  : ''
              }

            </header>


            <div class="home-post-main">

              ${
                post.zone
                  ? `
                    <div class="home-post-zone">
                      ◎ ${escapeHtml(post.zone)}
                    </div>
                  `
                  : ''
              }

              <p class="home-post-body">
                ${escapeHtml(post.body)}
              </p>


              ${
                media.length
                  ? `
                    <div class="home-post-media">
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
                      class="home-post-listing"
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
                            <span class="home-post-listing-placeholder">
                              ⌂
                            </span>
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
                    <div class="home-post-warning-date">
                      <span>VIGENTE HASTA</span>
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

            </div>


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

            <footer class="home-post-actions">

              <button
                type="button"
                class="${liked ? 'active' : ''}"
                data-community-post-like="${escapeHtml(post.id)}"
              >
                ${liked ? '♥' : '♡'}
                Me gusta
                <span>${likeCount}</span>
              </button>

              <button
                type="button"
                data-community-post-comments="${escapeHtml(post.id)}"
              >
                ○ ${config.action}
                <span>${commentCount}</span>
              </button>

              <button
                type="button"
                class="${saved ? 'saved' : ''}"
                data-save-kind="post"
                data-save-id="${escapeHtml(post.id)}"
              >
                ${saved ? '♥ Guardado' : '♡ Guardar'}
              </button>

            </footer>


            <div
              class="community-post-comments-panel"
              data-community-comments-panel="${escapeHtml(post.id)}"
              hidden
            ></div>

          </div>

        </article>
      `;
    }

    return { renderPostCard };
  }

  window.ROOMS_FEED_POST_CARD_FEATURE = {
    create: createFeedPostCardFeature
  };
})();
