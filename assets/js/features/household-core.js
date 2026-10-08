(function () {
  'use strict';

  function createHouseholdCoreFeature({
    db,
    state,
    escapeHtml,
    initials,
    loadHouseholdCandidates
  }) {
    function renderEmptyHousehold() {
      const view = document.querySelector('#householdView');
      if (!view) return;

      view.innerHTML = `
        <section class="household-empty-real">
          <div class="household-empty-mark">⌂</div>

          <small>TU HOGAR</small>

          <h1>Busca y decidid juntos.</h1>

          <p>
            Crea un Hogar para organizar compañeros, viviendas candidatas
            y decisiones compartidas.
          </p>

          <button type="button" id="createHouseholdButton">
            Crear grupo
          </button>

          <span>
            También podrás unirte a uno mediante una invitación.
          </span>
        </section>
      `;
    }


    function renderSearchGroupsHome() {
      const grid =
        document.querySelector('#searchGroupsGrid');

      if (!grid) return;

      const households =
        state.households || [];

      if (!households.length) {
        grid.innerHTML = `
          <div class="communities-empty-card">
            <span>⌂</span>

            <h3>Todavía no tienes ningún grupo</h3>

            <p>
              Crea un grupo cuando quieras empezar a buscar
              vivienda con otras personas.
            </p>

            <button
              type="button"
              data-open-search-group-empty
            >
              Crear grupo
            </button>
          </div>
        `;

        return;
      }

      grid.innerHTML = households
        .map(household => {
          const active =
            household.id === state.household?.id;

          return `
            <button
              type="button"
              class="search-group-card ${active ? 'featured' : ''}"
              data-open-search-group="${escapeHtml(household.id)}"
            >
              <div class="search-group-card-top">
                <span class="search-group-icon">⌂</span>

                <small>
                  GRUPO DE BÚSQUEDA
                </small>
              </div>

              <div class="search-group-card-copy">
                <h3>
                  ${escapeHtml(household.name)}
                </h3>

                <p>
                  Espacio privado para buscar y decidir juntos.
                </p>
              </div>

              <div class="search-group-card-footer">
                <span>
                  ${active ? 'Grupo actual' : 'Búsqueda compartida'}
                </span>

                <b>Entrar →</b>
              </div>
            </button>
          `;
        })
        .join('');
    }


    function renderRealHousehold(household, members = []) {
      const view = document.querySelector('#householdView');
      if (!view || !household) return;

      const visibleMembers = Array.isArray(members)
        ? members
        : [];

      const membersUnavailable =
        state.householdMembersError === true;

      const isOwner =
        household.owner_id === state.user?.id;

      const memberCount = visibleMembers.length;

      const memberAvatars = visibleMembers
        .slice(0, 5)
        .map(member => {
          const isMe =
            member.user_id === state.user?.id;

          const name =
            member.alias ||
            member.name ||
            (isMe ? 'Tú' : 'Usuario de Rooms');

          return member.avatar_url
            ? `
              <img
                class="member-you"
                src="${escapeHtml(member.avatar_url)}"
                alt="${escapeHtml(name)}"
              >
            `
            : `
              <span class="member-you">
                ${escapeHtml(initials(name))}
              </span>
            `;
        })
        .join('');

      const memberCards = visibleMembers
        .map(member => {
          const isMe =
            member.user_id === state.user?.id;

          const name =
            member.alias ||
            member.name ||
            (isMe ? 'Tú' : 'Usuario de Rooms');

          const roleLabel =
            member.role === 'owner'
              ? 'Propietario'
              : member.role === 'admin'
                ? 'Admin'
                : 'Miembro';

          return `
            <article class="real-household-person">

              <div class="real-household-person-avatar">
                ${
                  member.avatar_url
                    ? `
                      <img
                        src="${escapeHtml(member.avatar_url)}"
                        alt="${escapeHtml(name)}"
                      >
                    `
                    : escapeHtml(initials(name))
                }
              </div>

              <div>
                <b>${escapeHtml(name)}</b>
                <span>${escapeHtml(roleLabel)}</span>
              </div>

              ${
                isMe
                  ? '<small>Tú</small>'
                  : ''
              }

            </article>
          `;
        })
        .join('');

      view.innerHTML = `
        <header class="real-household-hero">
          <div class="real-household-kicker">
            GRUPO DE BÚSQUEDA
          </div>

          <div class="real-household-title">
            <div>
              <h1>
                ${escapeHtml(household.name)}
              </h1>

              <p>
                ${
                  membersUnavailable
                    ? 'No se pudieron cargar los miembros'
                    : `Grupo privado · ${memberCount} ${
                        memberCount === 1 ? 'miembro' : 'miembros'
                      }`
                }
              </p>
            </div>

            ${
              isOwner
                ? `
                  <button
                    type="button"
                    id="inviteRealHousehold"
                  >
                    Invitar +
                  </button>
                `
                : ''
            }
          </div>

          <div class="real-household-members">
            ${memberAvatars}

            ${
              isOwner
                ? `
                  <button
                    type="button"
                    id="inviteRealHouseholdSmall"
                  >
                    ＋
                  </button>
                `
                : ''
            }
          </div>
        </header>

        <nav class="real-household-tabs">

          <button
            class="active"
            type="button"
            data-real-household-tab="candidates"
          >
            Candidatos
          </button>

          <button
            type="button"
            data-real-household-tab="members"
          >
            Miembros
            <i>${membersUnavailable ? '—' : memberCount}</i>
          </button>

          <button
            type="button"
            data-real-household-tab="chat"
            disabled
          >
            Chat
            <small>Próximamente</small>
          </button>

        </nav>

        <section
          class="real-household-panel active"
          data-real-household-panel="candidates"
        >

          <div class="real-household-section-heading">
            <div>
              <small>VIVIENDAS Y PERSONAS</small>
              <h2>Vuestros candidatos</h2>
            </div>
          </div>

          <div class="real-household-empty-section">
            <span>⌂</span>

            <h3>
              Todavía no habéis añadido viviendas ni personas
            </h3>

            <p>
              Añade viviendas desde Explore o Guardados para valorarlas juntos.
            </p>

            <button
              type="button"
              data-household-go-explore
            >
              Explorar viviendas y personas →
            </button>
          </div>

        </section>

        <section
          class="real-household-panel"
          data-real-household-panel="members"
          hidden
        >

          <div class="real-household-section-heading">
            <div>
              <small>PERSONAS</small>
              <h2>Miembros del Hogar</h2>
            </div>

            ${
              isOwner
                ? `
                  <button
                    type="button"
                    id="inviteRealHouseholdMembers"
                  >
                    Invitar persona
                  </button>
                `
                : ''
            }
          </div>

          ${
            membersUnavailable
              ? `
                <div class="real-household-empty-section">
                  <p>
                    No hemos podido cargar los miembros de este grupo.
                  </p>
                </div>
              `
              : memberCards
          }

        </section>
      `;
    }

    async function loadHousehold(preferredHouseholdId = null) {
      if (!state.user) return;

      const { data: memberships, error: membershipError } = await db
        .from('household_members')
        .select('household_id, role, status, joined_at')
        .eq('user_id', state.user.id)
        .eq('status', 'accepted')
        .order('joined_at', { ascending: true });

      if (membershipError) {
        console.error(
          'Rooms: error cargando grupos del usuario',
          membershipError
        );
      }

      const memberIds =
        [...new Set(
          (memberships || [])
            .map(item => item.household_id)
            .filter(Boolean)
        )];

      let memberHouseholds = [];

      if (memberIds.length) {
        const { data, error } = await db
          .from('households')
          .select('*')
          .in('id', memberIds)
          .order('created_at', { ascending: true });

        if (error) {
          console.error(
            'Rooms: error cargando grupos compartidos',
            error
          );
        } else {
          memberHouseholds = data || [];
        }
      }

      const { data: ownedHouseholds, error: ownedError } = await db
        .from('households')
        .select('*')
        .eq('owner_id', state.user.id)
        .order('created_at', { ascending: true });

      if (ownedError) {
        console.error(
          'Rooms: error cargando grupos propios',
          ownedError
        );
      }

      const householdMap = new Map();

      [
        ...(memberHouseholds || []),
        ...(ownedHouseholds || [])
      ].forEach(household => {
        if (household?.id) {
          householdMap.set(household.id, household);
        }
      });

      state.households =
        [...householdMap.values()]
          .sort((a, b) =>
            new Date(a.created_at || 0) -
            new Date(b.created_at || 0)
          );

      renderSearchGroupsHome();

      if (!state.households.length) {
        state.household = null;
        state.householdMembers = [];
        state.householdMembersError = false;
        state.householdCandidates = [];
        state.householdPersonCandidates = [];
        state.householdCandidateVotes = [];

        renderEmptyHousehold();
        return;
      }

      const currentId =
        preferredHouseholdId ||
        state.household?.id;

      const household =
        state.households.find(
          item => item.id === currentId
        ) ||
        state.households[0];

      state.household = household;

      const { data: members, error: membersError } = await db
        .rpc(
          'get_household_members',
          { _household_id: household.id }
        );

      if (membersError) {
        console.error(
          'Rooms: error cargando miembros del grupo',
          membersError
        );
      }

      state.householdMembersError =
        Boolean(membersError);

      state.householdMembers =
        membersError ? [] : (members || []);

      renderRealHousehold(
        state.household,
        state.householdMembers
      );

      await loadHouseholdCandidates();

      renderSearchGroupsHome();
    }

    return {
      renderEmptyHousehold,
      renderSearchGroupsHome,
      renderRealHousehold,
      loadHousehold
    };
  }

  window.ROOMS_HOUSEHOLD_CORE_FEATURE = {
    create: createHouseholdCoreFeature
  };
})();
