(function () {
  'use strict';

  function createLivingEditorFeature({
    state,
    db,
    notify,
    updateOwnProfile
  }) {
  function ensureLivingEditorModal() {
    let modal =
      document.querySelector(
        '#livingEditorModal'
      );

    if (modal) return modal;

    const dna =
      window.ROOMS_DNA;

    modal =
      document.createElement('div');

    modal.className = 'modal';
    modal.id = 'livingEditorModal';
    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-living-editor>
      </div>

      <article class="detail living-editor-shell">
        <header>
          <div>
            <small>ROOMS DNA</small>
            <h2>Cómo vivo</h2>
            <p>
              Actualiza las respuestas que Rooms utiliza
              para calcular compatibilidad de convivencia.
            </p>
          </div>

          <button
            type="button"
            data-close-living-editor
            aria-label="Cerrar">×</button>
        </header>

        <form id="livingEditorForm">

          <div class="living-editor-groups">

            ${dna.thisOrThat
              .filter(question =>
                question.target === 'living_self'
              )
              .map(question => `
                <section class="living-editor-group">
                  <small>${question.title}</small>

                  <div>
                    <button
                      type="button"
                      data-living-dna-this="${question.id}"
                      data-living-dna-value="${question.left.id}"
                      aria-pressed="false">
                      ${question.left.label}
                    </button>

                    <button
                      type="button"
                      data-living-dna-this="${question.id}"
                      data-living-dna-value="${question.right.id}"
                      aria-pressed="false">
                      ${question.right.label}
                    </button>
                  </div>
                </section>
              `)
              .join('')}

            ${dna.scenarios
              .map(question => `
                <section class="living-editor-group">
                  <small>${question.title}</small>

                  <div>
                    ${dna.scenarioScale
                      .map(option => `
                        <button
                          type="button"
                          data-living-dna-scenario="${question.id}"
                          data-living-dna-value="${option.id}"
                          aria-pressed="false">
                          ${option.label}
                        </button>
                      `)
                      .join('')}
                  </div>
                </section>
              `)
              .join('')}

            ${dna.dynamicImportance
              .map(question => `
                <section class="living-editor-group">
                  <small>${question.prompt}</small>

                  <div>
                    ${dna.importanceScale
                      .map(option => `
                        <button
                          type="button"
                          data-living-dna-importance="${question.id}"
                          data-living-dna-value="${option.id}"
                          aria-pressed="false">
                          ${option.label}
                        </button>
                      `)
                      .join('')}
                  </div>
                </section>
              `)
              .join('')}

            ${dna.dealbreakers
              .map(question => `
                <section class="living-editor-group">
                  <small>${question.label}</small>

                  <div>
                    ${dna.dealbreakerScale
                      .map(option => `
                        <button
                          type="button"
                          data-living-dna-dealbreaker="${question.id}"
                          data-living-dna-value="${option.id}"
                          aria-pressed="false">
                          ${option.label}
                        </button>
                      `)
                      .join('')}
                  </div>
                </section>
              `)
              .join('')}

          </div>

          <button
            class="cta"
            type="submit">
            Guardar cambios
          </button>
        </form>
      </article>
    `;

    document.body.appendChild(modal);

    const selectionGroups = [
      'data-living-dna-this',
      'data-living-dna-scenario',
      'data-living-dna-importance',
      'data-living-dna-dealbreaker'
    ];

    selectionGroups.forEach(attribute => {
      modal
        .querySelectorAll(`[${attribute}]`)
        .forEach(button => {
          button.addEventListener(
            'click',
            () => {
              const value =
                button.getAttribute(attribute);

              modal
                .querySelectorAll(
                  `[${attribute}="${value}"]`
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
    });

    modal
      .querySelector('#livingEditorForm')
      .addEventListener(
        'submit',
        async event => {
          event.preventDefault();

          const current =
            state.matchPreferences || {};

          const livingSelf = {
            ...(
              current.living_self || {}
            ),

            this_or_that: {
              ...(
                current.living_self
                  ?.this_or_that || {}
              )
            },

            scenarios: {
              ...(
                current.living_self
                  ?.scenarios || {}
              )
            }
          };

          modal
            .querySelectorAll(
              '[data-living-dna-this].active'
            )
            .forEach(button => {
              livingSelf.this_or_that[
                button.dataset.livingDnaThis
              ] =
                button.dataset.livingDnaValue;
            });

          modal
            .querySelectorAll(
              '[data-living-dna-scenario].active'
            )
            .forEach(button => {
              livingSelf.scenarios[
                button.dataset.livingDnaScenario
              ] =
                button.dataset.livingDnaValue;
            });

          const livingImportance = {
            ...(
              current.living_importance ||
              {}
            )
          };

          modal
            .querySelectorAll(
              '[data-living-dna-importance].active'
            )
            .forEach(button => {
              livingImportance[
                button.dataset
                  .livingDnaImportance
              ] =
                button.dataset.livingDnaValue;
            });

          const dealbreakers = {
            ...(
              current.dealbreakers ||
              {}
            )
          };

          modal
            .querySelectorAll(
              '[data-living-dna-dealbreaker].active'
            )
            .forEach(button => {
              dealbreakers[
                button.dataset
                  .livingDnaDealbreaker
              ] =
                button.dataset.livingDnaValue ===
                'dealbreaker';
            });

          const { data, error } =
            await db
              .from('match_preferences')
              .update({
                living_self:
                  livingSelf,

                living_importance:
                  livingImportance,

                dealbreakers,

                updated_at:
                  new Date().toISOString()
              })
              .eq(
                'user_id',
                state.user.id
              )
              .select()
              .single();

          if (error) {
            console.error(
              'Rooms: error actualizando ROOMS DNA',
              error
            );

            notify(
              'No se pudieron guardar tus hábitos'
            );

            return;
          }

          state.matchPreferences =
            data;

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
            'Rooms DNA actualizado'
          );
        }
      );

    return modal;
  }

  function openLivingEditor() {
    if (!state.user) return;

    const modal =
      ensureLivingEditorModal();

    const current =
      state.matchPreferences || {};

    const livingSelf =
      current.living_self || {};

    const thisOrThat =
      livingSelf.this_or_that || {};

    const scenarios =
      livingSelf.scenarios || {};

    modal
      .querySelectorAll(
        '[data-living-dna-this]'
      )
      .forEach(button => {
        const active =
          thisOrThat[
            button.dataset.livingDnaThis
          ] ===
          button.dataset.livingDnaValue;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal
      .querySelectorAll(
        '[data-living-dna-scenario]'
      )
      .forEach(button => {
        const active =
          scenarios[
            button.dataset
              .livingDnaScenario
          ] ===
          button.dataset.livingDnaValue;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal
      .querySelectorAll(
        '[data-living-dna-importance]'
      )
      .forEach(button => {
        const active =
          current.living_importance?.[
            button.dataset
              .livingDnaImportance
          ] ===
          button.dataset.livingDnaValue;

        button.classList.toggle(
          'active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );
      });

    modal
      .querySelectorAll(
        '[data-living-dna-dealbreaker]'
      )
      .forEach(button => {
        const value =
          Boolean(
            current.dealbreakers?.[
              button.dataset
                .livingDnaDealbreaker
            ]
          )
            ? 'dealbreaker'
            : 'adapt';

        const active =
          value ===
          button.dataset.livingDnaValue;

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
    const livingEdit = event.target.closest('[data-open-living-editor]');

    if (livingEdit) {
      event.preventDefault();
      openLivingEditor();
      return;
    }

    if (event.target.closest('[data-close-living-editor]')) {
      const modal = document.querySelector('#livingEditorModal');
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
    }
  });

    return {
      ensureLivingEditorModal,
      openLivingEditor
    };
  }

  window.ROOMS_LIVING_EDITOR_FEATURE = {
    create: createLivingEditorFeature
  };
})();
