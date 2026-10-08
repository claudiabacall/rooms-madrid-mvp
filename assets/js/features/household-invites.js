(function () {
  'use strict';

  function createHouseholdInvitesFeature({
    db,
    state,
    notify,
    loadHousehold
  }) {
    function ensureHouseholdInviteModal() {
      let modal = document.querySelector('#householdInviteModal');
      if (modal) return modal;

      modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'householdInviteModal';
      modal.setAttribute('aria-hidden', 'true');

      modal.innerHTML = `
        <div class="backdrop" data-close-household-invite></div>

        <article class="detail household-invite-shell">
          <header>
            <div>
              <small>INVITAR AL HOGAR</small>
              <h2>Busca piso en compañía.</h2>
              <p>
                Comparte un enlace privado para que otra persona
                pueda unirse a vuestro Hogar.
              </p>
            </div>

            <button
              type="button"
              data-close-household-invite
              aria-label="Cerrar"
            >×</button>
          </header>

          <div class="household-invite-content">
            <div
              class="household-invite-link"
              id="householdInviteLinkBox"
              hidden
            >
              <small>ENLACE DE INVITACIÓN</small>

              <div>
                <input
                  id="householdInviteLink"
                  type="text"
                  readonly
                  aria-label="Enlace de invitación"
                >

                <button type="button" id="copyHouseholdInviteLink">
                  Copiar
                </button>
              </div>

              <p>El enlace caduca en 7 días.</p>
            </div>

            <button
              type="button"
              class="cta"
              id="generateHouseholdInvite"
            >
              Generar invitación
            </button>
          </div>
        </article>
      `;

      document.body.appendChild(modal);
      return modal;
    }

    function openHouseholdInviteModal() {
      if (!state.household) {
        notify('Primero crea un Hogar');
        return;
      }

      if (state.household.owner_id !== state.user?.id) {
        notify('Solo el propietario del Hogar puede invitar personas');
        return;
      }

      const modal = ensureHouseholdInviteModal();

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    async function generateHouseholdInvitation() {
      if (!state.user || !state.household) return;

      if (state.household.owner_id !== state.user.id) {
        notify('Solo el propietario del Hogar puede invitar personas');
        return;
      }

      const button =
        document.querySelector('#generateHouseholdInvite');

      if (button) {
        button.disabled = true;
        button.textContent = 'Generando…';
      }

      const { data, error } = await db
        .from('household_invitations')
        .insert({
          household_id: state.household.id,
          invited_by: state.user.id
        })
        .select('id, token, expires_at')
        .single();

      if (button) {
        button.disabled = false;
        button.textContent = 'Generar nueva invitación';
      }

      if (error) {
        console.error(
          'Rooms: error generando invitación',
          error
        );
        notify('No se pudo generar la invitación');
        return;
      }

      const inviteUrl =
        `${window.location.origin}${window.location.pathname}?invite=${data.token}`;

      const box =
        document.querySelector('#householdInviteLinkBox');

      const input =
        document.querySelector('#householdInviteLink');

      if (input) input.value = inviteUrl;
      if (box) box.hidden = false;

      notify('Invitación creada');
    }

    async function copyHouseholdInvitation() {
      const input =
        document.querySelector('#householdInviteLink');

      if (!input?.value) return;

      try {
        await navigator.clipboard.writeText(input.value);
        notify('Enlace copiado');
      } catch {
        input.select();
        document.execCommand('copy');
        notify('Enlace copiado');
      }
    }

    function ensureIncomingHouseholdInviteModal() {
      let modal =
        document.querySelector('#incomingHouseholdInviteModal');

      if (modal) return modal;

      modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'incomingHouseholdInviteModal';
      modal.setAttribute('aria-hidden', 'true');

      modal.innerHTML = `
        <div class="backdrop"></div>

        <article class="detail incoming-household-invite">
          <div class="incoming-household-icon">⌂</div>

          <small>INVITACIÓN A UN HOGAR</small>

          <h2 id="incomingHouseholdName">
            Te han invitado a un Hogar
          </h2>

          <p>
            Al unirte podréis organizar viviendas y tomar decisiones juntos.
          </p>

          <div class="incoming-household-actions">
            <button
              type="button"
              class="cta"
              id="acceptHouseholdInvite"
            >
              Unirme al Hogar
            </button>

            <button
              type="button"
              id="dismissHouseholdInvite"
            >
              Ahora no
            </button>
          </div>
        </article>
      `;

      document.body.appendChild(modal);
      return modal;
    }

    async function handleIncomingHouseholdInvite() {
      if (!state.user) return;

      const params =
        new URLSearchParams(window.location.search);

      const token = params.get('invite');
      if (!token) return;

      const { data, error } = await db.rpc(
        'get_household_invitation',
        { _token: token }
      );

      if (error) {
        console.error(
          'Rooms: error leyendo invitación',
          error
        );
        notify('Esta invitación no está disponible');
        return;
      }

      const invitation =
        Array.isArray(data) ? data[0] : data;

      if (!invitation) {
        notify('Esta invitación no existe');
        return;
      }

      if (invitation.invitation_status !== 'pending') {
        notify('Esta invitación ya no está disponible');
        return;
      }

      if (
        new Date(invitation.expires_at).getTime() <= Date.now()
      ) {
        notify('Esta invitación ha caducado');
        return;
      }

      state.pendingHouseholdInvite = {
        token,
        ...invitation
      };

      const modal =
        ensureIncomingHouseholdInviteModal();

      const title =
        modal.querySelector('#incomingHouseholdName');

      if (title) {
        title.textContent =
          `Te han invitado a ${invitation.household_name}`;
      }

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    async function acceptIncomingHouseholdInvite() {
      const invitation =
        state.pendingHouseholdInvite;

      if (!invitation?.token) return;

      const button =
        document.querySelector('#acceptHouseholdInvite');

      if (button) {
        button.disabled = true;
        button.textContent = 'Uniéndote…';
      }

      const { error } = await db.rpc(
        'accept_household_invitation',
        { _token: invitation.token }
      );

      if (error) {
        console.error(
          'Rooms: error aceptando invitación',
          error
        );

        if (button) {
          button.disabled = false;
          button.textContent = 'Unirme al Hogar';
        }

        notify('No se pudo aceptar la invitación');
        return;
      }

      state.pendingHouseholdInvite = null;

      const modal =
        document.querySelector('#incomingHouseholdInviteModal');

      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';

      const url = new URL(window.location.href);
      url.searchParams.delete('invite');

      window.history.replaceState(
        {},
        '',
        url.pathname + url.search + url.hash
      );

      await loadHousehold();

      notify('Ya formas parte del Hogar');

      document
        .querySelector('[data-main-view="household"]')
        ?.click();
    }

    return {
      ensureHouseholdInviteModal,
      openHouseholdInviteModal,
      generateHouseholdInvitation,
      copyHouseholdInvitation,
      ensureIncomingHouseholdInviteModal,
      handleIncomingHouseholdInvite,
      acceptIncomingHouseholdInvite
    };
  }

  window.ROOMS_HOUSEHOLD_INVITES_FEATURE = {
    create: createHouseholdInvitesFeature
  };
})();
