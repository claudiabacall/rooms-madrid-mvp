(function () {
  'use strict';

  function createProfilesFeature({
    state,
    escapeHtml,
    initials,
    labelSeeking,
    formatBudget,
    loadConnection,
    connectionButtonLabel,
    updateConnectButtons,
    showModal
  }) {
async function openRealUser(profile) {
      if (!profile) return;

      state.targetProfile = profile;

      await loadConnection(profile.id);

      const modal =
        document.querySelector('#userProfileModal');

      if (!modal) return;

      const name =
        profile.alias ||
        profile.name ||
        'Usuario de Rooms';

      const saved =
        state.savedItems?.has(
          `person:${profile.id}`
        );

      const traitLabels = {
        tidy: 'Ordenado',
        social: 'Sociable',
        calm: 'Tranquilo',
        independent: 'Independiente',
        cook: 'Cocinillas',
        early: 'Madrugador',
        night: 'Nocturno'
      };

      const seeking =
        profile.seeking?.length
          ? profile.seeking
              .map(labelSeeking)
              .join(' · ')
          : 'Sin definir';

      const zones =
        profile.zones?.length
          ? profile.zones.join(' · ')
          : 'Sin definir';

      const interestLabels = {
        sport: 'Deporte', music: 'Música', food: 'Food', travel: 'Viajes',
        nightlife: 'Salir', cinema: 'Cine', gaming: 'Gaming', art: 'Arte',
        reading: 'Leer', nature: 'Naturaleza', fashion: 'Fashion', pets: 'Animales',
        cooking: 'Cocina', gym: 'Gym', 'going-out': 'Salir',
        'quiet-plans': 'Planes tranquilos'
      };
      const interests = Array.isArray(profile.interests)
        ? profile.interests.map(id => interestLabels[id]).filter(Boolean)
        : [];

      const traits =
        Array.isArray(profile.traits)
          ? profile.traits
          : [];

      const moveDate =
        profile.move_in_date
          ? new Intl.DateTimeFormat(
              'es-ES',
              {
                day: 'numeric',
                month: 'long'
              }
            ).format(
              new Date(
                `${profile.move_in_date}T00:00:00`
              )
            )
          : 'Sin definir';

      const imageBox =
        modal.querySelector('.profile-hero');

      if (imageBox) {
        imageBox.innerHTML =
          profile.avatar_url
            ? `
              <img
                src="${escapeHtml(profile.avatar_url)}"
                alt="${escapeHtml(name)}"
              >
            `
            : `
              <div class="real-person-placeholder profile-person-placeholder">
                ${escapeHtml(initials(name))}
              </div>
            `;
      }

      const content =
        modal.querySelector('.user-profile-content');

      if (content) {
        content.innerHTML = `
          <section class="real-user-profile-intro">

            <div class="real-report-row">
              <button
                type="button"
                class="real-report-button"
                data-real-report
                data-report-type="profile"
                data-report-id="${escapeHtml(profile.id)}"
                data-report-user="${escapeHtml(profile.id)}"
              >
                Reportar perfil
              </button>

              <button
                type="button"
                class="real-report-button real-block-button"
                data-real-block-user="${escapeHtml(profile.id)}"
                data-real-block-name="${escapeHtml(name)}"
              >
                ${
                  state.blockedUsers?.has(profile.id)
                    ? 'Desbloquear usuario'
                    : 'Bloquear usuario'
                }
              </button>
            </div>

            <div class="real-user-profile-eyebrow">
              <span>PERFIL</span>
              <i></i>
              <span>ROOMS</span>
            </div>

            <div class="real-user-profile-title">
              <div>
                <h1>
                  ${escapeHtml(name)}
                  ${profile.age ? `<small>, ${profile.age}</small>` : ''}
                </h1>

                <p>
                  ${escapeHtml(
                    profile.bio ||
                    'Todavía no ha añadido una descripción.'
                  )}
                </p>
              </div>
            </div>


            <div class="real-user-profile-facts">

              <div>
                <small>BUSCA</small>
                <b>${escapeHtml(seeking)}</b>
              </div>

              <div>
                <small>ZONAS</small>
                <b>${escapeHtml(zones)}</b>
              </div>

              <div>
                <small>PRESUPUESTO</small>
                <b>${escapeHtml(formatBudget(profile))}</b>
              </div>

              <div>
                <small>ENTRADA</small>
                <b>${escapeHtml(moveDate)}</b>
              </div>

              <div>
                <small>DURACIÓN</small>
                <b>${escapeHtml(profile.duration || 'Sin definir')}</b>
              </div>

            </div>


            ${
              traits.length
                ? `
                  <div class="real-user-profile-block">
                    <small>CONVIVENCIA</small>

                    <div class="real-user-profile-chips">
                      ${traits.map(item => `
                        <span>
                          ${escapeHtml(
                            traitLabels[item] || item
                          )}
                        </span>
                      `).join('')}
                    </div>
                  </div>
                `
                : ''
            }


            ${
              interests.length
                ? `
                  <div class="real-user-profile-block">
                    <small>INTERESES</small>

                    <div class="real-user-profile-chips interests">
                      ${interests.map(item => `
                        <span>
                          ${escapeHtml(item)}
                        </span>
                      `).join('')}
                    </div>
                  </div>
                `
                : ''
            }


            <div class="real-user-profile-actions">

              ${
                !state.blockedUsers?.has(profile.id)
                  ? `
                    <button
                      type="button"
                      class="real-user-match"
                      data-open-real-match="${profile.id}"
                    >
                      Ver compatibilidad
                    </button>
                  `
                  : ''
              }

              <button
                type="button"
                class="real-user-connect ${
                  state.blockedUsers?.has(profile.id)
                    ? 'connection-blocked'
                    : ''
                }"
                data-connect
                data-user-id="${profile.id}"
                ${
                  state.blockedUsers?.has(profile.id)
                    ? 'disabled'
                    : ''
                }
              >
                ${
                  state.blockedUsers?.has(profile.id)
                    ? 'Bloqueado'
                    : escapeHtml(
                        connectionButtonLabel(profile.id)
                      )
                }
              </button>

              ${
                !state.blockedUsers?.has(profile.id)
                  ? `
                    <button
                      type="button"
                      class="real-user-group"
                      data-send-person-home="${profile.id}"
                    >
                      + Añadir a grupo
                    </button>

                    <button
                      type="button"
                      class="real-user-save ${saved ? 'saved' : ''}"
                      data-person-save
                      data-save-kind="person"
                      data-save-id="${profile.id}"
                    >
                      ${saved ? '♥ Guardado' : '♡ Guardar'}
                    </button>
                  `
                  : ''
              }

            </div>

          </section>
        `;
      }

      /*
        Eliminamos el CTA duplicado inferior.
        Todo el perfil consume ahora la misma acción real.
      */
      const fixedActions =
        modal.querySelector('.profile-fixed-actions');

      if (fixedActions) {
        fixedActions.innerHTML = '';
        fixedActions.hidden = true;
      }

      updateConnectButtons();

      showModal(modal);
    }

    return {
      openRealUser
    };
  }

  window.ROOMS_PROFILES_FEATURE = {
    create: createProfilesFeature
  };
})();
