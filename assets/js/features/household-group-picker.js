(function () {
  'use strict';

  function createHouseholdGroupPickerFeature({
    db,
    state,
    notify,
    escapeHtml,
    loadHouseholdCandidates,
    renderSearchGroupsHome
  }) {
    function ensureGroupPickerModal() {
      let modal =
        document.querySelector('#groupPickerModal');

      if (modal) return modal;

      modal = document.createElement('div');

      modal.className = 'modal';
      modal.id = 'groupPickerModal';
      modal.setAttribute('aria-hidden', 'true');

      modal.innerHTML = `
        <div
          class="backdrop"
          data-close-group-picker
        ></div>

        <article class="group-picker-sheet">

          <div class="group-picker-handle"></div>

          <header class="group-picker-header">
            <div>
              <small>GRUPOS DE BÚSQUEDA</small>
              <h2>¿A qué grupo quieres añadirlo?</h2>
              <p>
                El grupo podrá valorar esta opción y votar juntos.
              </p>
            </div>

            <button
              type="button"
              data-close-group-picker
              aria-label="Cerrar"
            >
              ×
            </button>
          </header>

          <div
            class="group-picker-list"
            id="groupPickerList"
          ></div>

          <button
            type="button"
            class="group-picker-create"
            data-create-group-from-picker
          >
            ＋ Crear nuevo grupo
          </button>

        </article>
      `;

      document.body.appendChild(modal);

      return modal;
    }


    function openGroupPicker(candidateType, candidateId) {
      const households =
        state.households || [];

      if (!households.length) {
        notify('Crea primero un grupo de búsqueda');
        return;
      }

      state.pendingGroupCandidate = {
        type: candidateType,
        id: candidateId
      };

      const modal =
        ensureGroupPickerModal();

      const list =
        modal.querySelector('#groupPickerList');

      list.innerHTML = households
        .map(household => `
          <button
            type="button"
            class="group-picker-option"
            data-pick-group="${escapeHtml(household.id)}"
          >
            <span class="group-picker-option-icon">
              ⌂
            </span>

            <span class="group-picker-option-copy">
              <b>${escapeHtml(household.name)}</b>
              <small>Grupo de búsqueda</small>
            </span>

            <span class="group-picker-option-arrow">
              →
            </span>
          </button>
        `)
        .join('');

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');

      document.body.style.overflow = 'hidden';
    }


    function closeGroupPicker() {
      const modal =
        document.querySelector('#groupPickerModal');

      if (!modal) return;

      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');

      document.body.style.overflow = '';
    }


    async function addListingToGroup(
      listingId,
      householdId
    ) {
      if (!state.user || !householdId) return;

      const { error } = await db
        .from('household_candidates')
        .insert({
          household_id: householdId,
          listing_id: listingId,
          added_by: state.user.id
        });

      if (error) {
        if (error.code === '23505') {
          notify('Esta vivienda ya está en ese grupo');
          return;
        }

        console.error(
          'Rooms: error añadiendo vivienda al grupo',
          error
        );

        notify('No se pudo añadir la vivienda');
        return;
      }

      if (state.household?.id === householdId) {
        await loadHouseholdCandidates();
      }

      notify('Vivienda añadida al grupo');
    }


    async function addPersonToGroup(
      userId,
      householdId
    ) {
      if (
        !state.user ||
        !householdId ||
        !userId
      ) {
        return false;
      }

      if (
        state.blockedUsers?.has(userId)
      ) {
        notify(
          'No puedes añadir a un usuario bloqueado.'
        );
        return false;
      }

      if (userId === state.user.id) {
        notify('No puedes añadirte a ti misma');
        return false;
      }

      const household =
        (state.households || [])
          .find(item => item.id === householdId);

      if (!household) {
        notify('No encuentro ese grupo de búsqueda');
        return false;
      }

      const { error } = await db
        .from('household_person_candidates')
        .insert({
          household_id: householdId,
          user_id: userId,
          added_by: state.user.id
        });

      if (error) {
        if (error.code === '23505') {
          notify(
            'Esta persona ya está en ese grupo'
          );

          return false;
        }

        console.error(
          'Rooms: error añadiendo persona al grupo',
          error
        );

        notify(
          'No se pudo añadir la persona'
        );

        return false;
      }

      /*
        Si es el grupo que está actualmente abierto,
        refrescamos sus candidatos al instante.
      */
      if (
        state.household?.id === householdId
      ) {
        await loadHouseholdCandidates();
      }

      /*
        Refrescamos las tarjetas de Grupos de búsqueda
        sin cambiar el grupo activo del usuario.
      */
      renderSearchGroupsHome();

      const profile =
        state.profiles.get(userId);

      const personName =
        profile?.alias ||
        profile?.name ||
        'Persona';

      notify(
        `${personName} añadida a ${household.name}`
      );

      return true;
    }


    async function addListingToHousehold(listingId) {
      if (!state.user) return;

      if (!state.household) {
        notify('Primero crea o únete a un Hogar');
        return;
      }

      const { error } = await db
        .from('household_candidates')
        .insert({
          household_id: state.household.id,
          listing_id: listingId,
          added_by: state.user.id
        });

      if (error) {
        if (error.code === '23505') {
          notify('Esta vivienda ya está en vuestro Hogar');
          return;
        }

        console.error(
          'Rooms: error añadiendo candidato',
          error
        );

        notify('No se pudo añadir la vivienda');
        return;
      }

      await loadHouseholdCandidates();
      notify('Añadido a Candidatos de tu Hogar');
    }

    return {
      ensureGroupPickerModal,
      openGroupPicker,
      closeGroupPicker,
      addListingToGroup,
      addPersonToGroup,
      addListingToHousehold
    };
  }

  window.ROOMS_HOUSEHOLD_GROUP_PICKER_FEATURE = {
    create: createHouseholdGroupPickerFeature
  };
})();
