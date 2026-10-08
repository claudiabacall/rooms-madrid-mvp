(function () {
  'use strict';

  function createHouseholdCandidatesFeature({
    db,
    state,
    notify,
    escapeHtml,
    initials,
    labelSeeking,
    renderSearchGroupsHome
  }) {
    async function addPersonToHousehold(userId) {
      if (!state.user) return;

      if (!state.household) {
        notify('Primero crea o únete a un Hogar');
        return;
      }

      if (!userId || userId === state.user.id) {
        notify('No puedes añadirte a ti misma');
        return;
      }

      const { error } = await db
        .from('household_person_candidates')
        .insert({
          household_id: state.household.id,
          user_id: userId,
          added_by: state.user.id
        });

      if (error) {
        if (error.code === '23505') {
          notify('Esta persona ya está en vuestro Hogar');
          return;
        }

        console.error(
          'Rooms: error añadiendo persona candidata',
          error
        );

        notify('No se pudo añadir la persona');
        return;
      }

      notify('Persona añadida a vuestro Hogar');
    }


    async function loadHouseholdCandidates() {
      if (!state.household) {
        state.householdCandidates = [];
        state.householdPersonCandidates = [];
        return;
      }

      const [
        { data: homes, error: homesError },
        { data: people, error: peopleError }
      ] = await Promise.all([
        db
          .from('household_candidates')
          .select(`
            household_id,
            listing_id,
            added_by,
            created_at,
            listing:listings(*)
          `)
          .eq('household_id', state.household.id)
          .order('created_at', { ascending: false }),

        db
          .from('household_person_candidates')
          .select(`
            household_id,
            user_id,
            added_by,
            created_at
          `)
          .eq('household_id', state.household.id)
          .order('created_at', { ascending: false })
      ]);

      if (homesError) {
        console.error(
          'Rooms: error cargando viviendas candidatas',
          homesError
        );
      }

      if (peopleError) {
        console.error(
          'Rooms: error cargando personas candidatas',
          peopleError
        );
      }

      state.householdCandidates = homes || [];
      state.householdPersonCandidates = people || [];

      const { data: votes, error: votesError } = await db
        .from('household_candidate_votes')
        .select('*')
        .eq('household_id', state.household.id);

      if (votesError) {
        console.error(
          'Rooms: error cargando votos del Hogar',
          votesError
        );
      }

      state.householdCandidateVotes = votes || [];

      renderHouseholdCandidates();
      renderSearchGroupsHome();
    }

    function renderHouseholdCandidates() {
      const panel =
        document.querySelector(
          '[data-real-household-panel="candidates"]'
        );

      if (!panel) return;

      const homes =
        state.householdCandidates || [];

      const people =
        state.householdPersonCandidates || [];

      const total =
        homes.length + people.length;

      const heading = `
        <div class="real-household-section-heading">
          <div>
            <small>VIVIENDAS Y PERSONAS</small>
            <h2>Vuestros candidatos</h2>
          </div>

          ${
            total
              ? `<span class="household-candidate-count">
                  ${total}
                  ${total === 1 ? 'candidato' : 'candidatos'}
                </span>`
              : ''
          }
        </div>
      `;

      if (!total) {
        panel.innerHTML = `
          ${heading}

          <div class="real-household-empty-section">
            <span>⌂</span>
            <h3>
              Todavía no habéis añadido viviendas ni personas
            </h3>

            <p>
              Añade viviendas o personas desde Explore
              para organizarlas aquí.
            </p>

            <button type="button" data-household-go-explore>
              Explorar viviendas y personas →
            </button>
          </div>
        `;

        return;
      }

      const homeCards = homes.map(item => {
        const listing = item.listing || {};

        const photos =
          Array.isArray(listing.photos)
            ? listing.photos
            : [];

        const image = photos[0] || '';

        const kindLabel =
          listing.kind === 'room'
            ? 'Habitación'
            : listing.kind === 'apartment'
              ? 'Piso entero'
              : 'Vivienda';

        const available =
          listing.available_from
            ? new Date(listing.available_from)
                .toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short'
                })
            : null;

        return `
          <article class="real-household-candidate">
            <div class="real-household-candidate-media">
              ${
                image
                  ? `<img
                      src="${escapeHtml(image)}"
                      alt="${escapeHtml(
                        listing.title || kindLabel
                      )}"
                    >`
                  : `<div class="real-household-candidate-placeholder">
                      ⌂
                    </div>`
              }

              <span class="household-candidate-kind">
                VIVIENDA
              </span>
            </div>

            <div class="real-household-candidate-copy">
              <small>${escapeHtml(kindLabel)}</small>

              <h3>
                ${escapeHtml(
                  listing.title ||
                  listing.zone
                    ? `${listing.zone} · ${kindLabel}`
                    : kindLabel
                )}
              </h3>

              <p>
                ${
                  listing.price != null
                    ? `
                      <b>
                        ${Number(listing.price)
                          .toLocaleString('es-ES')} €
                      </b>
                      / mes
                    `
                    : '<b>Precio sin definir</b>'
                }
              </p>

              <span>
                ${escapeHtml(listing.zone || 'Zona sin definir')}
                · ${
                  available
                    ? `Disponible ${escapeHtml(available)}`
                    : 'Disponibilidad sin definir'
                }
              </span>

              <div class="real-household-candidate-meta">
                ${
                  listing.rooms
                    ? `<span>${escapeHtml(
                        String(listing.rooms)
                      )} hab</span>`
                    : ''
                }

                ${
                  listing.baths
                    ? `<span>${escapeHtml(
                        String(listing.baths)
                      )} baños</span>`
                    : ''
                }

                ${
                  listing.area
                    ? `<span>${escapeHtml(
                        String(listing.area)
                      )} m²</span>`
                    : ''
                }
              </div>

              ${renderHouseholdVoteControls(
                'listing',
                listing.id
              )}

              <div class="real-household-candidate-actions">
                <button
                  type="button"
                  data-real-listing="${escapeHtml(
                    listing.id || ''
                  )}"
                >
                  Ver vivienda
                </button>

                <button
                  type="button"
                  data-remove-household-candidate="${escapeHtml(
                    listing.id || ''
                  )}"
                >
                  Quitar
                </button>
              </div>
            </div>
          </article>
        `;
      }).join('');

      const personCards = people.map(item => {
        const profile =
          state.profiles?.get(item.user_id);

        if (!profile) {
          return `
            <article class="real-household-person-candidate">
              <div class="real-household-person-candidate-avatar">
                ?
              </div>

              <div class="real-household-person-candidate-copy">
                <small>PERSONA</small>
                <h3>Perfil no disponible</h3>
                <p>
                  Esta persona ya no está disponible públicamente.
                </p>

                <button
                  type="button"
                  data-remove-household-person="${escapeHtml(
                    item.user_id
                  )}"
                >
                  Quitar
                </button>
              </div>
            </article>
          `;
        }

        const name =
          profile.alias ||
          profile.name ||
          'Usuario de Rooms';

        const zone =
          profile.zones?.[0] || '';

        const seeking =
          profile.seeking?.length
            ? profile.seeking
                .map(labelSeeking)
                .join(' · ')
            : '';

        return `
          <article class="real-household-person-candidate">
            <div class="real-household-person-candidate-avatar">
              ${
                profile.avatar_url
                  ? `<img
                      src="${escapeHtml(profile.avatar_url)}"
                      alt="${escapeHtml(name)}"
                    >`
                  : escapeHtml(initials(name))
              }

              <span class="household-candidate-kind">
                PERSONA
              </span>
            </div>

            <div class="real-household-person-candidate-copy">
              <small>PERSONA</small>

              <h3>
                ${escapeHtml(name)}
                ${profile.age ? `, ${profile.age}` : ''}
              </h3>

              <p>
                ${
                  escapeHtml(
                    [seeking, zone]
                      .filter(Boolean)
                      .join(' · ')
                  ) || 'Perfil en Rooms'
                }
              </p>

              ${
                profile.bio
                  ? `<span>
                      ${escapeHtml(profile.bio)}
                    </span>`
                  : ''
              }

              ${renderHouseholdVoteControls(
                'person',
                profile.id
              )}

              <div class="real-household-candidate-actions">
                <button
                  type="button"
                  data-open-explore-person="${escapeHtml(
                    profile.id
                  )}"
                >
                  Ver perfil
                </button>

                <button
                  type="button"
                  data-remove-household-person="${escapeHtml(
                    profile.id
                  )}"
                >
                  Quitar
                </button>
              </div>
            </div>
          </article>
        `;
      }).join('');

      panel.innerHTML = `
        ${heading}

        ${
          homes.length
            ? `
              <section class="household-candidate-group">
                <div class="household-candidate-group-title">
                  <span>VIVIENDAS</span>
                  <b>${homes.length}</b>
                </div>

                <div class="real-household-candidates-grid">
                  ${homeCards}
                </div>
              </section>
            `
            : ''
        }

        ${
          people.length
            ? `
              <section class="household-candidate-group">
                <div class="household-candidate-group-title">
                  <span>PERSONAS</span>
                  <b>${people.length}</b>
                </div>

                <div class="real-household-people-grid">
                  ${personCards}
                </div>
              </section>
            `
            : ''
        }
      `;
    }




    function getHouseholdVoteSummary(type, candidateId) {
      const votes =
        (state.householdCandidateVotes || [])
          .filter(vote =>
            vote.candidate_type === type &&
            vote.candidate_id === candidateId
          );

      return {
        like: votes.filter(vote => vote.vote === 'like').length,
        maybe: votes.filter(vote => vote.vote === 'maybe').length,
        dislike: votes.filter(vote => vote.vote === 'dislike').length,
        mine:
          votes.find(vote => vote.user_id === state.user?.id)?.vote ||
          ''
      };
    }

    function renderHouseholdVoteControls(type, candidateId) {
      const summary =
        getHouseholdVoteSummary(type, candidateId);

      const options = [
        ['like', '👍', 'Me gusta'],
        ['maybe', '🤔', 'Dudas'],
        ['dislike', '👎', 'No encaja']
      ];

      return `
        <div
          class="household-vote-controls"
        >
          ${options.map(([value, emoji, label]) => `
            <button
              type="button"
              class="${summary.mine === value ? 'active' : ''}"
              data-household-vote="${value}"
              data-candidate-type="${type}"
              data-candidate-id="${escapeHtml(candidateId)}"
              aria-pressed="${summary.mine === value}"
            >
              <span>${emoji}</span>
              <b>${label}</b>
              ${
                summary[value]
                  ? `<i>${summary[value]}</i>`
                  : ''
              }
            </button>
          `).join('')}
        </div>
      `;
    }

    async function voteHouseholdCandidate(
      type,
      candidateId,
      voteValue
    ) {
      if (!state.user || !state.household) return;

      const current =
        (state.householdCandidateVotes || [])
          .find(vote =>
            vote.candidate_type === type &&
            vote.candidate_id === candidateId &&
            vote.user_id === state.user.id
          );

      if (current?.vote === voteValue) {
        const { error } = await db
          .from('household_candidate_votes')
          .delete()
          .eq('household_id', state.household.id)
          .eq('candidate_type', type)
          .eq('candidate_id', candidateId)
          .eq('user_id', state.user.id);

        if (error) {
          console.error(
            'Rooms: error eliminando voto',
            error
          );
          notify('No se pudo actualizar tu voto');
          return;
        }
      } else {
        const { error } = await db
          .from('household_candidate_votes')
          .upsert({
            household_id: state.household.id,
            candidate_type: type,
            candidate_id: candidateId,
            user_id: state.user.id,
            vote: voteValue,
            updated_at: new Date().toISOString()
          }, {
            onConflict:
              'household_id,candidate_type,candidate_id,user_id'
          });

        if (error) {
          console.error(
            'Rooms: error guardando voto',
            error
          );
          notify('No se pudo guardar tu voto');
          return;
        }
      }

      await loadHouseholdCandidates();
    }

    async function removeHouseholdPersonCandidate(userId) {
      if (
        !state.household ||
        !state.user ||
        !userId
      ) {
        return false;
      }

      const profile =
        state.profiles?.get(userId);

      const name =
        profile?.alias ||
        profile?.name ||
        'esta persona';

      const confirmed =
        window.confirm(
          `¿Quieres quitar a ${name} de este grupo de búsqueda?`
        );

      if (!confirmed) {
        return false;
      }

      const {
        data: deletedRows,
        error
      } = await db
        .from('household_person_candidates')
        .delete()
        .eq(
          'household_id',
          state.household.id
        )
        .eq(
          'user_id',
          userId
        )
        .select('user_id');

      if (error) {
        console.error(
          'Rooms: error eliminando persona candidata',
          error
        );

        notify(
          'No se pudo quitar la persona'
        );

        return false;
      }

      if (!deletedRows?.length) {
        notify(
          'Esta persona ya no estaba en el grupo'
        );

        await loadHouseholdCandidates();

        return false;
      }

      /*
        Limpiamos también sus votos dentro de este grupo.
      */
      const { error: voteError } = await db
        .from('household_candidate_votes')
        .delete()
        .eq(
          'household_id',
          state.household.id
        )
        .eq(
          'candidate_type',
          'person'
        )
        .eq(
          'candidate_id',
          userId
        );

      if (voteError) {
        console.error(
          'Rooms: error limpiando votos de persona',
          voteError
        );
      }

      await loadHouseholdCandidates();

      renderSearchGroupsHome();

      notify(
        `${name} eliminada del grupo`
      );

      return true;
    }


    async function removeHouseholdCandidate(listingId) {
      if (!state.household) return;

      const { error } = await db
        .from('household_candidates')
        .delete()
        .eq('household_id', state.household.id)
        .eq('listing_id', listingId);

      if (error) {
        console.error(
          'Rooms: error eliminando candidato',
          error
        );

        notify('No se pudo quitar la vivienda');
        return;
      }

      await loadHouseholdCandidates();
      notify('Vivienda eliminada del Hogar');
    }

    return {
      addPersonToHousehold,
      loadHouseholdCandidates,
      renderHouseholdCandidates,
      getHouseholdVoteSummary,
      renderHouseholdVoteControls,
      voteHouseholdCandidate,
      removeHouseholdPersonCandidate,
      removeHouseholdCandidate
    };
  }

  window.ROOMS_HOUSEHOLD_CANDIDATES_FEATURE = {
    create: createHouseholdCandidatesFeature
  };
})();
