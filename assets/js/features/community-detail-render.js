(function () {
  'use strict';

  function createCommunityDetailRenderFeature({
    state,
    escapeHtml,
    initials,
    renderCommunityPost
  }) {
    function getActiveCommunityPosts() {
      const communityId =
        state.activeCommunity?.id;

      if (!communityId) return [];

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      return [...state.posts.values()]
        .filter(post =>
          post.community_id === communityId &&
          post.status === 'published' &&
          !(
            post.post_type === 'warning' &&
            post.expires_at &&
            post.expires_at < today
          )
        )
        .sort(
          (a, b) =>
            new Date(b.created_at) -
            new Date(a.created_at)
        );
    }


    function renderRealCommunityDetail() {
      const view =
        document.querySelector('#communityView');

      const community =
        state.activeCommunity;

      if (!view || !community) return;

      const members =
        state.activeCommunityMembers || [];

      const membership =
        state.activeCommunityMembership;

      const isOwner =
        community.owner_id === state.user?.id ||
        membership?.role === 'owner';

      const isMember =
        Boolean(membership);

      const memberLabel =
        members.length === 1
          ? '1 miembro'
          : `${members.length} miembros`;

      const visibility =
        community.visibility === 'private'
          ? 'PRIVADA'
          : 'PÚBLICA';

      view.innerHTML = `
        <button
          class="community-back"
          type="button"
          data-back-real-community
        >
          ← Volver
        </button>

        <header class="community-hero real-community-hero">

          <div class="community-hero-image">
            ${
              community.image_url
                ? `
                  <img
                    src="${escapeHtml(community.image_url)}"
                    alt="${escapeHtml(community.name)}"
                  >
                `
                : `
                  <div class="real-community-image-placeholder">
                    #
                  </div>
                `
            }

            <span>${visibility}</span>
          </div>

          <div class="community-hero-copy">

            <small>
              COMUNIDAD · ROOMS
            </small>

            <div class="real-community-title-row">

              <h1>
                ${escapeHtml(community.name)}
              </h1>

              ${
                isOwner
                  ? `
                    <span class="real-community-owner-badge">
                      ADMIN
                    </span>
                  `
                  : community.visibility === 'private' && !isMember
                    ? `
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                      >
                        Acceso privado
                      </button>
                    `
                    : `
                      <button
                        type="button"
                        class="${isMember ? 'joined' : ''}"
                        data-toggle-community-membership="${escapeHtml(community.id)}"
                      >
                        ${isMember ? 'Salir de la comunidad' : 'Unirme'}
                      </button>
                    `
              }

            </div>

            <p>
              ${escapeHtml(
                community.description ||
                'Comunidad de Rooms'
              )}
            </p>

            <div class="community-meta">

              <span>
                <b>${memberLabel}</b>
              </span>

              <span>
                <b>
                  ${
                    community.visibility === 'private'
                      ? 'Acceso privado'
                      : 'Comunidad abierta'
                  }
                </b>
              </span>

              ${
                isOwner
                  ? `
                    <span>
                      <b>Administras esta comunidad</b>
                    </span>
                  `
                  : ''
              }

            </div>

          </div>
        </header>


        <nav
          class="community-tabs"
          role="tablist"
        >

          <button
            class="active"
            type="button"
            data-real-community-tab="feed"
          >
            Feed
          </button>

          <button
            type="button"
            data-real-community-tab="members"
          >
            Miembros
          </button>

          ${
            isMember
              ? `
                <button
                  class="community-publish"
                  type="button"
                  data-community-publish
                >
                  ＋ Publicar
                </button>
              `
              : ''
          }

        </nav>


        <section
          class="community-panel"
          data-real-community-panel="feed"
        >

          <div class="community-feed-layout">

            <div class="community-stream">

              ${
                getActiveCommunityPosts().length
                  ? getActiveCommunityPosts()
                      .map(renderCommunityPost)
                      .join('')
                  : `
                    <article class="real-community-empty-feed">
                      <span>✦</span>

                      <h2>
                        ${
                          isMember
                            ? 'Todavía no hay publicaciones'
                            : 'Únete para participar'
                        }
                      </h2>

                      <p>
                        ${
                          isMember
                            ? 'Sé la primera persona en publicar algo en esta comunidad.'
                            : 'Forma parte de la comunidad para publicar, comentar y participar.'
                        }
                      </p>
                    </article>
                  `
              }

            </div>

            <aside class="community-about">

              <small>
                SOBRE ESTA COMUNIDAD
              </small>

              <p>
                ${escapeHtml(
                  community.description ||
                  'Espacio compartido dentro de Rooms.'
                )}
              </p>

              <hr>

              <b>Visibilidad</b>

              <span>
                ${
                  community.visibility === 'private'
                    ? 'Privada'
                    : 'Pública'
                }
              </span>

              <hr>

              <b>Miembros</b>
              <span>${members.length}</span>

              ${
                isOwner
                  ? `
                    <button
                      type="button"
                      data-manage-community
                    >
                      Gestionar comunidad
                    </button>
                  `
                  : ''
              }

            </aside>

          </div>

        </section>


        <section
          class="community-panel"
          data-real-community-panel="members"
          hidden
        >

          <div class="members-header">

            <div>
              <small>
                ${memberLabel.toUpperCase()}
              </small>

              <h2>Miembros</h2>
            </div>

          </div>

          <div class="community-members real-community-members">

            ${
              members.length
                ? members.map(member => {
                    const profile =
                      state.profiles.get(member.user_id);

                    const name =
                      profile?.alias ||
                      profile?.name ||
                      (
                        member.user_id === state.user?.id
                          ? 'Tú'
                          : 'Usuario de Rooms'
                      );

                    const avatar =
                      profile?.avatar_url;

                    const role =
                      member.role === 'owner'
                        ? 'ADMIN'
                        : member.role === 'admin'
                          ? 'ADMIN'
                          : 'MIEMBRO';

                    return `
                      <article>

                        ${
                          avatar
                            ? `
                              <img
                                src="${escapeHtml(avatar)}"
                                alt="${escapeHtml(name)}"
                              >
                            `
                            : `
                              <span class="member-photo">
                                ${escapeHtml(initials(name))}
                              </span>
                            `
                        }

                        <div>

                          <small>
                            ${role}
                          </small>

                          <b>
                            ${escapeHtml(name)}
                          </b>

                          <p>
                            ${
                              member.user_id === state.user?.id
                                ? 'Tu perfil'
                                : 'Miembro de Rooms'
                            }
                          </p>

                        </div>

                      </article>
                    `;
                  }).join('')
                : `
                  <div class="communities-empty-card">
                    <span>◯</span>
                    <h3>No hay miembros todavía</h3>
                  </div>
                `
            }

          </div>

        </section>
      `;
    }

    return {
      getActiveCommunityPosts,
      renderRealCommunityDetail
    };
  }

  window.ROOMS_COMMUNITY_DETAIL_RENDER_FEATURE = {
    create: createCommunityDetailRenderFeature
  };
})();
