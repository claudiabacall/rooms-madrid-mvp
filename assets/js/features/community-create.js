(function () {
  'use strict';

  function createCommunityCreateFeature({
    db,
    state,
    notify,
    loadMemberCommunities,
    renderFilteredExplore
  }) {
    function ensureCreateCommunityModal() {
      let modal =
        document.querySelector('#createCommunityModal');

      if (modal) return modal;

      modal = document.createElement('div');

      modal.className = 'modal';
      modal.id = 'createCommunityModal';
      modal.setAttribute('aria-hidden', 'true');

      modal.innerHTML = `
        <div
          class="backdrop"
          data-close-create-community
        ></div>

        <article class="create-community-sheet">

          <header class="create-community-header">
            <div>
              <small>NUEVA COMUNIDAD</small>
              <h2>Crea una comunidad</h2>
              <p>
                Crea un espacio para personas que comparten
                zona, universidad, intereses o una misma etapa.
              </p>
            </div>

            <button
              type="button"
              data-close-create-community
              aria-label="Cerrar"
            >
              ×
            </button>
          </header>

          <form id="createCommunityForm">

            <label class="create-community-field">
              <span>Nombre de la comunidad</span>

              <input
                id="createCommunityName"
                type="text"
                maxlength="60"
                placeholder="Ej. Vivir en Chamberí"
                required
              >
            </label>

            <label class="create-community-field">
              <span>Descripción</span>

              <textarea
                id="createCommunityDescription"
                maxlength="280"
                placeholder="¿Qué une a las personas de esta comunidad?"
                rows="4"
              ></textarea>
            </label>

            <fieldset class="create-community-visibility">
              <legend>Visibilidad</legend>

              <label>
                <input
                  type="radio"
                  name="communityVisibility"
                  value="public"
                  checked
                >

                <span>
                  <b>Pública</b>
                  <small>
                    Cualquiera puede encontrarla y unirse.
                  </small>
                </span>
              </label>

              <label>
                <input
                  type="radio"
                  name="communityVisibility"
                  value="private"
                  disabled
                  aria-disabled="true"
                >

                <span>
                  <b>Privada · Próximamente</b>
                  <small>
                    Disponible cuando activemos invitaciones y acceso privado.
                  </small>
                </span>
              </label>
            </fieldset>

            <button
              type="submit"
              class="create-community-submit"
            >
              Crear comunidad
            </button>

          </form>

        </article>
      `;

      document.body.appendChild(modal);

      modal
        .querySelector('#createCommunityForm')
        ?.addEventListener('submit', createCommunity);

      return modal;
    }


    function openCreateCommunityModal() {
      const modal =
        ensureCreateCommunityModal();

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');

      document.body.style.overflow = 'hidden';

      setTimeout(() => {
        modal
          .querySelector('#createCommunityName')
          ?.focus();
      }, 50);
    }


    function closeCreateCommunityModal() {
      const modal =
        document.querySelector('#createCommunityModal');

      if (!modal) return;

      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');

      document.body.style.overflow = '';
    }


    async function createCommunity(event) {
      event.preventDefault();

      if (!state.user) {
        notify('Necesitas iniciar sesión');
        return;
      }

      const modal =
        ensureCreateCommunityModal();

      const name =
        modal
          .querySelector('#createCommunityName')
          ?.value
          .trim();

      const description =
        modal
          .querySelector('#createCommunityDescription')
          ?.value
          .trim();

      const visibility =
        modal
          .querySelector(
            'input[name="communityVisibility"]:checked'
          )
          ?.value || 'public';

      if (!name) {
        notify('Pon un nombre a la comunidad');
        return;
      }

      const submit =
        modal.querySelector('.create-community-submit');

      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Creando...';
      }

      const { data: community, error } = await db
        .rpc('create_community', {
          _name: name,
          _description: description || null,
          _visibility: visibility
        });

      if (error) {
        console.error(
          'Rooms: error creando comunidad',
          error
        );

        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Crear comunidad';
        }

        notify('No hemos podido crear la comunidad');
        return;
      }

      state.communities.set(
        community.id,
        community
      );

      modal
        .querySelector('#createCommunityForm')
        ?.reset();

      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Crear comunidad';
      }

      closeCreateCommunityModal();

      await loadMemberCommunities();

      renderFilteredExplore();

      notify('Comunidad creada');
    }


    let communityMembershipFeature = null;

    return {
      ensureCreateCommunityModal,
      openCreateCommunityModal,
      closeCreateCommunityModal,
      createCommunity
    };
  }

  window.ROOMS_COMMUNITY_CREATE_FEATURE = {
    create: createCommunityCreateFeature
  };
})();
