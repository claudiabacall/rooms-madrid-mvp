(function () {
  'use strict';

  function createHouseholdCreateFeature({
    db,
    state,
    notify,
    renderRealHousehold
  }) {
    async function createHousehold(event) {
      event.preventDefault();

      if (!state.user) return;

      const input =
        document.querySelector('#createHouseholdName');

      const name = input?.value.trim();

      if (!name) {
        notify('Pon un nombre a vuestro Hogar');
        return;
      }

      const submit =
        event.currentTarget.querySelector('[type="submit"]');

      submit.disabled = true;
      submit.textContent = 'Creando…';

      const householdId = crypto.randomUUID();

      const { error } = await db
        .from('households')
        .insert({
          id: householdId,
          name,
          owner_id: state.user.id
        });

      if (error) {
        console.error('Rooms: error creando Hogar', error);
        submit.disabled = false;
        submit.textContent = 'Crear grupo';
        notify('No se pudo crear el Hogar');
        return;
      }

      const household = {
        id: householdId,
        name,
        owner_id: state.user.id
      };

      const { error: memberError } = await db
        .from('household_members')
        .insert({
          household_id: householdId,
          user_id: state.user.id,
          role: 'owner',
          status: 'accepted'
        });

      if (memberError) {
        console.error(
          'Rooms: error creando miembro propietario',
          memberError
        );

        const { error: rollbackError } = await db
          .from('households')
          .delete()
          .eq('id', householdId)
          .eq('owner_id', state.user.id);

        if (rollbackError) {
          console.error(
            'Rooms: error revirtiendo Hogar incompleto',
            rollbackError
          );
        }

        submit.disabled = false;
        submit.textContent = 'Crear grupo';

        notify(
          rollbackError
            ? 'No se pudo completar la creación del Hogar'
            : 'No se pudo crear el Hogar'
        );

        return;
      }

      state.household = household;
      state.householdMembers = [{
        household_id: householdId,
        user_id: state.user.id,
        role: 'owner',
        status: 'accepted'
      }];

      const modal =
        document.querySelector('#createHouseholdModal');

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';

      renderRealHousehold(
        state.household,
        state.householdMembers
      );

      notify('Hogar creado');
    }

    return {
      createHousehold
    };
  }

  window.ROOMS_HOUSEHOLD_CREATE_FEATURE = {
    create: createHouseholdCreateFeature
  };
})();
