(function () {
  'use strict';

  function createExploreCommunitiesFeature({
    state,
    escapeHtml
  }) {
    function getExploreCommunities() {
      const search =
        document.querySelector('#exploreSearch');

      const query =
        (search?.value || '')
          .trim()
          .toLowerCase();

      const communities =
        [...state.communities.values()];

      if (!query) {
        return communities;
      }

      return communities.filter(community => {
        const haystack = [
          community.name,
          community.description,
          community.visibility
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      });
    }


    function renderExploreCommunities(communities) {
      const list =
        document.querySelector('#exploreList');

      const map =
        document.querySelector('#exploreMap');

      if (!list) return;

      if (map) map.hidden = true;

      if (!communities.length) {
        list.innerHTML = `
          <section class="real-feed-empty explore-real-empty">
            <span>#</span>
            <h2>No encontramos comunidades</h2>
            <p>
              Prueba con otro nombre, barrio,
              universidad o tipo de comunidad.
            </p>
          </section>
        `;
        return;
      }

      list.innerHTML = `
        <div class="explore-community-results">

          <div class="explore-results-heading">
            <p>
              <strong>${communities.length}</strong>
              ${
                communities.length === 1
                  ? 'comunidad'
                  : 'comunidades'
              }
            </p>
          </div>

          <div class="explore-community-grid">

            ${communities.map(community => `
              <article
                class="explore-community-card"
                data-real-community="${escapeHtml(community.id)}"
              >

                <div class="explore-community-media">
                  ${
                    community.image_url
                      ? `
                        <img
                          src="${escapeHtml(community.image_url)}"
                          alt="${escapeHtml(community.name)}"
                        >
                      `
                      : `
                        <div class="explore-community-placeholder">
                          #
                        </div>
                      `
                  }

                  <span class="explore-community-type">
                    COMUNIDAD
                  </span>
                </div>

                <div class="explore-community-body">

                  <small>
                    ${
                      community.visibility === 'private'
                        ? 'PRIVADA'
                        : 'ABIERTA'
                    }
                  </small>

                  <h2>
                    ${escapeHtml(community.name)}
                  </h2>

                  <p>
                    ${escapeHtml(
                      community.description ||
                      'Comunidad de Rooms'
                    )}
                  </p>

                  <button
                    type="button"
                    data-real-community-open="${escapeHtml(community.id)}"
                  >
                    Ver comunidad
                    <span>→</span>
                  </button>

                </div>

              </article>
            `).join('')}

          </div>

        </div>
      `;
    }

    return {
      getExploreCommunities,
      renderExploreCommunities
    };
  }

  window.ROOMS_EXPLORE_COMMUNITIES_FEATURE = {
    create: createExploreCommunitiesFeature
  };
})();
