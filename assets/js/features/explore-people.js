(function () {
  'use strict';

  function createExplorePeopleFeature({
    state,
    escapeHtml,
    initials,
    labelSeeking,
    connectionButtonLabel,
    normalizeExploreValue
  }) {
    function renderExplorePeople(profiles) {
      const list = document.querySelector('#exploreList');
      const map = document.querySelector('#exploreMap');

      if (!list) return;

      if (map) map.hidden = true;

      if (!profiles.length) {
        list.innerHTML = `
          <section class="real-feed-empty explore-real-empty">
            <span>◯</span>
            <h2>No encontramos personas con esa búsqueda</h2>
            <p>Prueba con otra zona, nombre o tipo de búsqueda.</p>
          </section>
        `;
        return;
      }

      const traitLabels = {
        tidy: 'Ordenado',
        social: 'Sociable',
        calm: 'Tranquilo',
        independent: 'Independiente',
        cook: 'Cocinillas',
        early: 'Madrugador',
        night: 'Nocturno'
      };

      list.innerHTML = `
        <div class="explore-results-heading">
          <p>
            <strong>${profiles.length}</strong>
            ${profiles.length === 1 ? 'persona' : 'personas'}
          </p>
        </div>

        <div class="explore-people-grid">
          ${profiles.map(profile => {
            const name =
              profile.alias ||
              profile.name ||
              'Usuario de Rooms';

            const zone =
              profile.zones?.[0] ||
              '';

            const seeking =
              profile.seeking?.length
                ? profile.seeking.map(labelSeeking).join(' · ')
                : '';

            const traits =
              (profile.traits || [])
                .slice(0, 3)
                .map(value => traitLabels[value] || value);

            return `
              <article
                class="explore-person-card"
                data-real-user="${profile.id}"
                tabindex="0"
              >
                <div class="explore-person-photo">
                  ${
                    profile.avatar_url
                      ? `<img
                          src="${escapeHtml(profile.avatar_url)}"
                          alt="${escapeHtml(name)}"
                        >`
                      : `<div class="explore-person-placeholder">
                          ${escapeHtml(initials(name))}
                        </div>`
                  }

                  <button
                    type="button"
                    class="explore-person-save"
                    data-save-kind="person"
                    data-save-id="${profile.id}"
                    aria-label="Guardar perfil"
                  >♡</button>
                </div>

                <div class="explore-person-body">
                  <small>PERSONA</small>

                  <h2>
                    ${escapeHtml(name)}
                    ${profile.age ? `, ${profile.age}` : ''}
                  </h2>

                  ${
                    seeking || zone
                      ? `<div class="explore-person-search explore-person-match-meta">
                          ${seeking ? `<p><span>Busca</span><strong>${escapeHtml(seeking)}</strong></p>` : ''}
                          ${zone ? `<p><span>Zona</span><strong>${escapeHtml(zone)}</strong></p>` : ''}
                        </div>`
                      : `<p class="explore-person-search">
                          Perfil en Rooms
                        </p>`
                  }

                  ${
                    traits.length
                      ? `<div class="explore-person-traits">
                          ${traits
                            .map(trait => `<span>${escapeHtml(trait)}</span>`)
                            .join('')}
                        </div>`
                      : ''
                  }

                  <p class="explore-person-bio">
                    ${escapeHtml(
                      profile.bio ||
                      'Todavía no ha añadido una descripción.'
                    )}
                  </p>

                  <div class="explore-person-actions">
                    <button
                      type="button"
                      class="explore-person-send-home"
                      data-send-person-home="${profile.id}"
                    >
                      ＋ Grupo
                    </button>

                    <button
                      type="button"
                      data-connect
                      data-user-id="${profile.id}"
                    >
                      ${escapeHtml(connectionButtonLabel(profile.id))}
                    </button>

                    <button
                      type="button"
                      data-open-explore-person="${profile.id}"
                    >
                      Ver perfil →
                    </button>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      `;
    }

    function getExplorePeople() {
      const query = normalizeExploreValue(
        document.querySelector('#exploreSearch')?.value
      );

      let profiles = [...state.profiles.values()]
        .filter(profile =>
          profile.id &&
          profile.id !== state.user?.id &&
          !state.blockedUsers?.has(profile.id)
        );

      if (query) {
        profiles = profiles.filter(profile => {
          const seeking = (profile.seeking || [])
            .map(labelSeeking);

          const haystack = normalizeExploreValue([
            profile.name,
            profile.alias,
            profile.bio,
            ...(profile.zones || []),
            ...(profile.traits || []),
            ...seeking
          ].join(' '));

          return haystack.includes(query);
        });
      }

      return profiles;
    }

    return {
      renderExplorePeople,
      getExplorePeople
    };
  }

  window.ROOMS_EXPLORE_PEOPLE_FEATURE = {
    create: createExplorePeopleFeature
  };
})();
