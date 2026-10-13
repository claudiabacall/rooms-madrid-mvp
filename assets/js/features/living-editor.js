(function () {
  'use strict';

  function createLivingEditorFeature({
    state,
    db,
    notify,
    updateOwnProfile
  }) {
    let saving = false;
    let openedLivingDna = null;

    function getLivingQuestions() {
      return (
        window.ROOMS_DNA_V2?.interactions || []
      ).filter(question =>
        question.act === 'living'
      );
    }

    function escapeText(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    }

    function hasValidDna() {
      const config = window.ROOMS_DNA_V2;
      const dna = state.roomsDna;

      return Boolean(
        state.user &&
        dna &&
        config &&
        Number(dna.model_version) === config.version &&
        dna.answers &&
        typeof dna.answers === 'object' &&
        !Array.isArray(dna.answers)
      );
    }

    function ensureLivingEditorModal() {
      let modal =
        document.querySelector('#livingEditorModal');

      if (modal) return modal;

      modal = document.createElement('div');
      modal.id = 'livingEditorModal';
      modal.className = 'modal';
      modal.setAttribute('aria-hidden', 'true');

      const questions = getLivingQuestions();

      modal.innerHTML = `
        <div class="backdrop"
          data-close-living-editor></div>

        <article class="detail living-editor-shell">
          <header>
            <div>
              <small>ROOMS DNA V2</small>
              <h2>Cómo vivo</h2>
              <p>
                Actualiza cómo convives.
                Tu ROOMS DNA se recalculará
                al guardar los cambios.
              </p>
            </div>

            <button type="button"
              data-close-living-editor
              aria-label="Cerrar">×</button>
          </header>

          <form id="livingEditorForm">
            <div class="living-editor-groups">
              ${questions.map(question => `
                <section class="living-editor-group">
                  <small>${escapeText(question.prompt)}</small>

                  <div>
                    ${(question.options || []).map(option => `
                      <button
                        type="button"
                        data-living-v2-question="${escapeText(question.id)}"
                        data-living-v2-option="${escapeText(option.id)}"
                        aria-pressed="false">
                        ${escapeText(option.label)}
                      </button>
                    `).join('')}
                  </div>
                </section>
              `).join('')}
            </div>

            <button class="cta" type="submit">
              Guardar convivencia
            </button>
          </form>
        </article>
      `;

      document.body.appendChild(modal);

      modal.addEventListener('click', event => {
        const button = event.target.closest(
          '[data-living-v2-question]'
        );

        if (!button || saving) return;

        const questionId =
          button.dataset.livingV2Question;

        modal.querySelectorAll(
          '[data-living-v2-question]'
        ).forEach(item => {
          if (
            item.dataset.livingV2Question !==
            questionId
          ) {
            return;
          }

          const active = item === button;

          item.classList.toggle('active', active);
          item.setAttribute(
            'aria-pressed',
            active ? 'true' : 'false'
          );
        });
      });

      modal.querySelector('#livingEditorForm')
        .addEventListener('submit', async event => {
          event.preventDefault();

          if (saving) return;

          if (!hasValidDna()) {
            notify(
              'Completa primero tu ROOMS DNA V2'
            );
            return;
          }

          const config = window.ROOMS_DNA_V2;
          const engine = window.ROOMS_DNA_ENGINE;
          const archetypes =
            window.ROOMS_DNA_ARCHETYPES;

          if (!engine || !archetypes) {
            notify(
              'No se pudo preparar tu ROOMS DNA'
            );
            return;
          }

          if (
            !openedLivingDna ||
            openedLivingDna.userId !== state.user?.id ||
            !Number.isSafeInteger(openedLivingDna.revision) ||
            openedLivingDna.revision < 0 ||
            openedLivingDna.revision !== state.roomsDna?.revision
          ) {
            notify('Tu DNA ha cambiado. Reabre el editor.');
            return;
          }

          const answers = {
            ...openedLivingDna.answers
          };

          const questions = getLivingQuestions();

          for (const question of questions) {
            const selected = [
              ...modal.querySelectorAll(
                '[data-living-v2-question].active'
              )
            ].find(button =>
              button.dataset.livingV2Question ===
              question.id
            );

            const optionId =
              selected?.dataset.livingV2Option;

            if (
              !question.options?.some(option =>
                option.id === optionId
              )
            ) {
              notify(
                'Responde todas las preguntas de convivencia'
              );
              return;
            }

            answers[question.id] = optionId;
          }

          let payload;

          try {
            const dna =
              engine.calculate(answers, config);

            if (
              dna.version !== config.version ||
              dna.ignoredAnswers?.length
            ) {
              throw new Error(
                'Respuestas DNA V2 incompatibles'
              );
            }

            const classification =
              archetypes.classify(dna);

            if (!classification?.primary) {
              throw new Error(
                'Clasificación DNA no disponible'
              );
            }

            const compact = archetype =>
              archetype
                ? {
                    id: archetype.id,
                    name: archetype.name,
                    tagline: archetype.tagline,
                    fit: archetype.fit
                  }
                : null;

            const evidence = [];

            for (
              const [dimension, layers] of
              Object.entries(dna.dimensions || {})
            ) {
              for (const layer of [
                'self',
                'preferred',
                'importance'
              ]) {
                for (
                  const item of
                  layers?.[layer]?.evidence || []
                ) {
                  evidence.push({
                    dimension,
                    layer,
                    ...item
                  });
                }
              }
            }

            payload = {
              answers,
              dimensions: dna.dimensions || {},
              categories: dna.categorical || {},
              classification: {
                primary:
                  compact(classification.primary),
                secondary:
                  compact(classification.secondary),
                ranked:
                  (classification.ranked || [])
                    .map(compact)
              },
              evidence,
              calculated_at:
                new Date().toISOString(),
              updated_at:
                new Date().toISOString()
            };
          } catch (error) {
            console.error(
              'Rooms: error calculando DNA V2',
              error
            );

            notify(
              'No se pudo recalcular tu ROOMS DNA'
            );
            return;
          }

          saving = true;

          const submitButton = modal.querySelector(
            '#livingEditorForm [type="submit"]'
          );

          if (submitButton) {
            submitButton.disabled = true;
          }

          try {
            const userId = state.user.id;

            const { data, error } = await db
              .from('rooms_dna')
              .update(payload)
              .eq('user_id', userId)
              .eq('model_version', config.version)
              .eq('revision', openedLivingDna.revision)
              .select()
              .single();

            if (error || !data) {
              throw error ||
                new Error('DNA V2 no encontrado');
            }

            // No modificar estado hasta confirmar Supabase.
            if (state.user?.id !== userId) {
              return;
            }

            state.roomsDna = data;

            updateOwnProfile(
              state.profile,
              state.preferences
            );

            modal.classList.remove('open');
            modal.setAttribute(
              'aria-hidden',
              'true'
            );

            document.body.style.overflow = '';

            notify('Rooms DNA actualizado');
          } catch (error) {
            console.error(
              'Rooms: error guardando DNA V2',
              error
            );

            notify(
              'No se pudieron guardar tus hábitos'
            );
          } finally {
            saving = false;

            if (submitButton) {
              submitButton.disabled = false;
            }
          }
        });

      return modal;
    }

    function openLivingEditor() {
      if (!state.user) return;

      if (!hasValidDna()) {
        notify(
          'Completa primero tu ROOMS DNA V2'
        );
        return;
      }

      const modal = ensureLivingEditorModal();

      openedLivingDna = {
        userId: state.user.id,
        revision: state.roomsDna.revision,
        answers: JSON.parse(
          JSON.stringify(state.roomsDna.answers)
        )
      };

      const answers = openedLivingDna.answers;

      modal.querySelectorAll(
        '[data-living-v2-question]'
      ).forEach(button => {
        const active =
          answers[
            button.dataset.livingV2Question
          ] === button.dataset.livingV2Option;

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

      document.body.style.overflow = 'hidden';
    }

    document.addEventListener('click', event => {
      if (
        event.target.closest(
          '[data-open-living-editor]'
        )
      ) {
        event.preventDefault();
        openLivingEditor();
        return;
      }

      if (
        event.target.closest(
          '[data-close-living-editor]'
        )
      ) {
        const modal =
          document.querySelector('#livingEditorModal');

        modal?.classList.remove('open');
        modal?.setAttribute(
          'aria-hidden',
          'true'
        );

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
