(function () {
  'use strict';

  function createSearchPreferencesEditorFeature({
    state,
    db,
    notify,
    seekingFromIntents,
    updateOwnProfile,
    openProfileEditor
  }) {
  function ensureSearchPreferencesModal() {
    let modal =
      document.querySelector(
        '#searchPreferencesModal'
      );

    if (modal) return modal;

    modal =
      document.createElement('div');

    modal.className = 'modal';
    modal.id =
      'searchPreferencesModal';

    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-search-preferences>
      </div>

      <article class="detail search-preferences-shell">
        <header>
          <div>
            <small>TU BÚSQUEDA</small>
            <h2>Qué busco</h2>
            <p>
              Puedes cambiar lo que necesitas ahora
              sin modificar tu Rooms DNA.
            </p>
          </div>

          <button
            type="button"
            data-close-search-preferences
            aria-label="Cerrar">×</button>
        </header>

        <form id="searchPreferencesForm">

          <section class="search-editor-section">
            <small>¿QUÉ QUIERES HACER?</small>

            <div class="search-editor-options">
              <button
                type="button"
                data-search-intent="find_room">
                Encontrar una habitación
              </button>

              <button
                type="button"
                data-search-intent="find_apartment">
                Encontrar un piso
              </button>

              <button
                type="button"
                data-search-intent="find_mates_for_home">
                Compañeros para mi casa
              </button>

              <button
                type="button"
                data-search-intent="find_mates_to_search">
                Compañeros para buscar juntos
              </button>
            </div>
          </section>

          <section class="search-editor-section">
            <label>
              Zonas
              <input
                id="searchZones"
                type="text"
                placeholder="Chamberí, Moncloa, Retiro">
              <small>
                Separa varias zonas con comas.
              </small>
            </label>
          </section>

          <section class="search-editor-section">
            <small>PRESUPUESTO MENSUAL</small>

            <div class="search-budget-grid">
              <label>
                Mínimo
                <input
                  id="searchBudgetMin"
                  type="number"
                  min="0"
                  step="50"
                  placeholder="600">
              </label>

              <label>
                Máximo
                <input
                  id="searchBudgetMax"
                  type="number"
                  min="0"
                  step="50"
                  placeholder="1000">
              </label>
            </div>

            <label class="search-over-budget">
              <input
                id="searchBudgetOpen"
                type="checkbox">
              Estoy abierto/a a más de 4.000 €
            </label>
          </section>

          <section class="search-editor-section">
            <small>ENTRADA</small>

            <div class="search-date-grid">
              <label>
                Fecha
                <input
                  id="searchMoveDate"
                  type="date">
              </label>

              <label class="search-flexible">
                <input
                  id="searchMoveFlexible"
                  type="checkbox">
                Soy flexible
              </label>
            </div>
          </section>

          <section class="search-editor-section">
            <small>DURACIÓN</small>

            <div class="search-editor-options search-duration-options">
              <button type="button" data-search-duration="1-3">1–3 meses</button>
              <button type="button" data-search-duration="3-6">3–6 meses</button>
              <button type="button" data-search-duration="6-12">6–12 meses</button>
              <button type="button" data-search-duration="12+">Más de 1 año</button>
              <button type="button" data-search-duration="unknown">No lo sé</button>
            </div>
          </section>

          <button
            class="cta"
            type="submit">
            Guardar búsqueda
          </button>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    modal
      .querySelectorAll(
        '[data-search-intent]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            const active =
              !button.classList.contains(
                'active'
              );

            button.classList.toggle(
              'active',
              active
            );

            button.setAttribute(
              'aria-pressed',
              active ? 'true' : 'false'
            );
          }
        );
      });

    modal
      .querySelectorAll(
        '[data-search-duration]'
      )
      .forEach(button => {
        button.addEventListener(
          'click',
          () => {
            modal
              .querySelectorAll(
                '[data-search-duration]'
              )
              .forEach(item => {
                const active =
                  item === button;

                item.classList.toggle(
                  'active',
                  active
                );

                item.setAttribute(
                  'aria-pressed',
                  active
                    ? 'true'
                    : 'false'
                );
              });
          }
        );
      });

    modal
      .querySelector(
        '#searchPreferencesForm'
      )
      .addEventListener(
        'submit',
        async event => {
          event.preventDefault();

          const intents = [
            ...modal.querySelectorAll(
              '[data-search-intent].active'
            )
          ].map(
            button =>
              button.dataset.searchIntent
          );

          if (!intents.length) {
            notify(
              'Selecciona al menos qué estás buscando'
            );
            return;
          }

          const seeking =
            seekingFromIntents(intents);

          const zones =
            modal
              .querySelector('#searchZones')
              .value
              .split(',')
              .map(value => value.trim())
              .filter(Boolean);

          const minValue =
            modal.querySelector(
              '#searchBudgetMin'
            ).value;

          const maxValue =
            modal.querySelector(
              '#searchBudgetMax'
            ).value;

          const over4000 =
            modal.querySelector(
              '#searchBudgetOpen'
            ).checked;

          const budgetMin =
            minValue
              ? Number(minValue)
              : null;

          const budgetMax =
            over4000
              ? null
              : maxValue
                ? Number(maxValue)
                : null;

          if (
            budgetMin &&
            budgetMax &&
            budgetMin > budgetMax
          ) {
            notify(
              'El presupuesto mínimo no puede superar el máximo'
            );
            return;
          }

          const moveDate =
            modal.querySelector(
              '#searchMoveDate'
            ).value || null;

          const flexible =
            modal.querySelector(
              '#searchMoveFlexible'
            ).checked;

          const duration =
            modal.querySelector(
              '[data-search-duration].active'
            )?.dataset.searchDuration ||
            null;

          const answers = {
            ...(state.preferences?.answers || {}),

            seeking,
            zones,

            budget: {
              ...(
                state.preferences
                  ?.answers
                  ?.budget || {}
              ),

              min: budgetMin,
              max: budgetMax,
              over4000
            },

            move: {
              ...(
                state.preferences
                  ?.answers
                  ?.move || {}
              ),

              date: moveDate,
              flexible,
              duration
            }
          };

          const deleteResult =
            await db
              .from('user_intents')
              .delete()
              .eq(
                'user_id',
                state.user.id
              );

          if (deleteResult.error) {
            console.error(
              'Rooms: error limpiando intenciones',
              deleteResult.error
            );

            notify(
              'No se pudo actualizar tu búsqueda'
            );

            return;
          }

          const insertResult =
            await db
              .from('user_intents')
              .insert(
                intents.map(intent => ({
                  user_id:
                    state.user.id,
                  intent
                }))
              );

          if (insertResult.error) {
            console.error(
              'Rooms: error guardando intenciones',
              insertResult.error
            );

            notify(
              'No se pudo actualizar tu búsqueda'
            );

            return;
          }

          const [
            profileResult,
            preferencesResult
          ] =
            await Promise.all([
              db
                .from('profiles')
                .update({
                  seeking,
                  zones,
                  budget_min:
                    budgetMin,
                  budget_max:
                    budgetMax,
                  move_in_date:
                    moveDate,
                  duration
                })
                .eq(
                  'id',
                  state.user.id
                )
                .select()
                .single(),

              db
                .from(
                  'onboarding_preferences'
                )
                .upsert({
                  user_id:
                    state.user.id,
                  answers
                })
            ]);

          if (
            profileResult.error ||
            preferencesResult.error
          ) {
            console.error(
              'Rooms: error actualizando búsqueda',
              profileResult.error,
              preferencesResult.error
            );

            notify(
              'No se pudo actualizar tu búsqueda'
            );

            return;
          }

          state.profile =
            profileResult.data;

          state.preferences = {
            answers
          };

          state.userIntents =
            [...new Set(intents)];

          state.profiles.set(
            state.profile.id,
            state.profile
          );

          updateOwnProfile(
            state.profile,
            state.preferences
          );

          modal.classList.remove('open');
          modal.setAttribute(
            'aria-hidden',
            'true'
          );

          document.body.style.overflow =
            '';

          notify(
            'Tu búsqueda se ha actualizado'
          );
        }
      );

    return modal;
  }

  function openSearchPreferencesEditor() {
    if (!state.profile) return;

    const modal =
      ensureSearchPreferencesModal();

    const intents =
      new Set(
        state.userIntents || []
      );

    modal
      .querySelectorAll(
        '[data-search-intent]'
      )
      .forEach(button => {
        const active =
          intents.has(
            button.dataset.searchIntent
          );

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal.querySelector(
      '#searchZones'
    ).value =
      (state.profile.zones || [])
        .join(', ');

    modal.querySelector(
      '#searchBudgetMin'
    ).value =
      state.profile.budget_min ?? '';

    modal.querySelector(
      '#searchBudgetMax'
    ).value =
      state.profile.budget_max ?? '';

    modal.querySelector(
      '#searchBudgetOpen'
    ).checked =
      Boolean(
        state.preferences
          ?.answers
          ?.budget
          ?.over4000
      );

    modal.querySelector(
      '#searchMoveDate'
    ).value =
      state.profile.move_in_date ||
      '';

    modal.querySelector(
      '#searchMoveFlexible'
    ).checked =
      Boolean(
        state.preferences
          ?.answers
          ?.move
          ?.flexible
      );

    modal
      .querySelectorAll(
        '[data-search-duration]'
      )
      .forEach(button => {
        const active =
          button.dataset
            .searchDuration ===
          state.profile.duration;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal.classList.add('open');

    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';
  }

  document.addEventListener('click', event => {
    if (
      event.target.closest(
        '[data-open-search-preferences]'
      )
    ) {
      event.preventDefault();
      openSearchPreferencesEditor();
      return;
    }

    const completionAction =
      event.target.closest(
        '[data-profile-completion-action]'
      );

    if (completionAction) {
      event.preventDefault();

      if (
        completionAction.dataset
          .profileCompletionAction === 'search'
      ) {
        openSearchPreferencesEditor();
      } else {
        openProfileEditor();
      }
    }
  });


  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-search-preferences]')) {
      const modal = document.querySelector('#searchPreferencesModal');

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';
    }
  });

    return {
      ensureSearchPreferencesModal,
      openSearchPreferencesEditor
    };
  }

  window.ROOMS_SEARCH_PREFERENCES_EDITOR_FEATURE = {
    create: createSearchPreferencesEditorFeature
  };
})();
