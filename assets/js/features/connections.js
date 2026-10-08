(function () {
  'use strict';

  function createConnectionsFeature({
    db,
    state,
    notify,
    showModal,
    escapeHtml,
    initials,
    labelSeeking,
    updateTrustView,
    openRealConversation,
    loadRealNotifications,
    loadRealInbox
  }) {

  function getConnectionForUser(userId) {
    if (!userId) return null;

    return (
      state.connectionsByUser?.get(String(userId)) ||
      null
    );
  }

  function connectionButtonLabel(userId) {
    const connection =
      getConnectionForUser(userId);

    if (!connection) {
      return 'Conectar';
    }

    if (connection.status === 'accepted') {
      return 'Enviar mensaje';
    }

    if (connection.status === 'declined') {
      return 'Conectar';
    }

    if (
      connection.status === 'pending' &&
      connection.requester_id === state.user.id
    ) {
      return 'Cancelar solicitud';
    }

    if (
      connection.status === 'pending' &&
      connection.recipient_id === state.user.id
    ) {
      return 'Responder solicitud';
    }

    return 'Conectar';
  }

  async function loadAllConnections() {
    if (!state.user) return;

    const { data, error } = await db
      .from('connections')
      .select('*')
      .or(
        `requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`
      );

    if (error) {
      console.error(
        'Rooms: error cargando conexiones',
        error
      );
      return;
    }

    state.connectionsByUser = new Map();

    (data || []).forEach(connection => {
      const otherUserId =
        connection.requester_id === state.user.id
          ? connection.recipient_id
          : connection.requester_id;

      state.connectionsByUser.set(
        String(otherUserId),
        connection
      );
    });

    if (state.targetProfile) {
      state.connection =
        getConnectionForUser(
          state.targetProfile.id
        );
    } else {
      state.connection = null;
    }

    updateConnectButtons();
    updateTrustView();
  }

  async function loadConnection(
    userId = state.targetProfile?.id
  ) {
    if (!userId || !state.user) {
      return null;
    }

    const { data, error } = await db
      .from('connections')
      .select('*')
      .or(
        `and(requester_id.eq.${state.user.id},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${state.user.id})`
      )
      .order('created_at', {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        'Rooms: error cargando conexión',
        error
      );
      return null;
    }

    if (data) {
      state.connectionsByUser.set(
        String(userId),
        data
      );
    } else {
      state.connectionsByUser.delete(
        String(userId)
      );
    }

    if (
      state.targetProfile?.id === userId
    ) {
      state.connection = data || null;
    }

    updateConnectButtons();

    return data || null;
  }

  function updateConnectButtons() {
    document
      .querySelectorAll('[data-connect]')
      .forEach(button => {
        const userId =
          button.dataset.userId ||
          state.targetProfile?.id;

        if (!userId) {
          button.textContent = 'Conectar';
          return;
        }

        if (
          state.blockedUsers?.has(userId)
        ) {
          button.textContent = 'Bloqueado';
          button.disabled = true;
          button.classList.add(
            'connection-blocked'
          );
          return;
        }

        button.disabled = false;
        button.classList.remove(
          'connection-blocked'
        );

        const connection =
          getConnectionForUser(userId);

        button.textContent =
          connectionButtonLabel(userId);

        button.classList.toggle(
          'connection-pending',
          connection?.status === 'pending' &&
          connection.requester_id === state.user.id
        );

        button.classList.toggle(
          'connection-accepted',
          connection?.status === 'accepted'
        );

        button.classList.toggle(
          'connection-incoming',
          connection?.status === 'pending' &&
          connection.recipient_id === state.user.id
        );
      });
  }

  async function handleConnect(userId) {
    if (!userId || !state.user) return;

    if (
      state.blockedUsers?.has(userId)
    ) {
      notify(
        'Desbloquea a este usuario para poder conectar.'
      );
      return;
    }

    const profile =
      state.profiles.get(userId) ||
      (
        state.targetProfile?.id === userId
          ? state.targetProfile
          : null
      );

    if (!profile) {
      notify('No encuentro este perfil');
      return;
    }

    let connection =
      getConnectionForUser(userId);

    if (!connection) {
      connection =
        await loadConnection(userId);
    }


    // =====================================================
    // CONEXIÓN YA ACEPTADA → ABRIR CONVERSACIÓN
    // =====================================================

    if (
      connection?.status === 'accepted'
    ) {
      openRealConversation(profile);
      return;
    }


    // =====================================================
    // SOLICITUD ENVIADA POR MÍ → CANCELAR
    // =====================================================

    if (
      connection?.status === 'pending' &&
      connection.requester_id === state.user.id
    ) {
      const {
        data: deletedRows,
        error
      } = await db
        .from('connections')
        .delete()
        .eq('id', connection.id)
        .select('id');

      if (error) {
        console.error(
          'Rooms: error cancelando solicitud',
          error
        );

        notify(
          'No se pudo cancelar la solicitud'
        );
        return;
      }

      if (!deletedRows?.length) {
        console.error(
          'Rooms: la solicitud no se eliminó',
          {
            connectionId: connection.id,
            userId,
            connection
          }
        );

        await loadConnection(userId);

        notify(
          'No se pudo cancelar la solicitud'
        );
        return;
      }

      state.connectionsByUser.delete(
        String(userId)
      );

      if (
        state.targetProfile?.id === userId
      ) {
        state.connection = null;
      }

      updateConnectButtons();

      document
        .querySelectorAll(
          `[data-connect][data-user-id="${userId}"]`
        )
        .forEach(button => {
          button.textContent =
            connectionButtonLabel(userId);
        });

      notify(
        'Solicitud cancelada'
      );

      return;
    }


    // =====================================================
    // SOLICITUD RECIBIDA
    // =====================================================

    if (
      connection?.status === 'pending' &&
      connection.recipient_id === state.user.id
    ) {
      await openIncomingConnectionRequest(
        userId
      );

      return;
    }


    // =====================================================
    // SOLICITUD RECHAZADA ANTERIORMENTE → REABRIR
    // =====================================================

    if (
      connection?.status === 'declined'
    ) {
      const {
        data,
        error
      } = await db
        .from('connections')
        .update({
          requester_id: state.user.id,
          recipient_id: userId,
          status: 'pending'
        })
        .eq('id', connection.id)
        .select()
        .single();

      if (error) {
        console.error(
          'Rooms: error reabriendo conexión',
          error
        );

        notify(
          'No se pudo enviar la solicitud'
        );
        return;
      }

      state.connectionsByUser.set(
        String(userId),
        data
      );

      if (
        state.targetProfile?.id === userId
      ) {
        state.connection = data;
      }

      updateConnectButtons();

      notify(
        'Solicitud de conexión enviada'
      );

      return;
    }


    // =====================================================
    // SIN RELACIÓN → CREAR SOLICITUD
    // =====================================================

    const {
      data,
      error
    } = await db
      .from('connections')
      .insert({
        requester_id: state.user.id,
        recipient_id: userId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error(
        'Rooms: error enviando conexión',
        error
      );

      notify(
        'No se pudo enviar la solicitud'
      );
      return;
    }

    state.connectionsByUser.set(
      String(userId),
      data
    );

    if (
      state.targetProfile?.id === userId
    ) {
      state.connection = data;
    }

    updateConnectButtons();

    document
      .querySelectorAll(
        `[data-connect][data-user-id="${userId}"]`
      )
      .forEach(button => {
        button.textContent =
          connectionButtonLabel(userId);
      });

    notify(
      'Solicitud de conexión enviada'
    );
  }

  async function connectToUser(userId) {
    if (!userId) return;

    if (
      state.blockedUsers?.has(userId)
    ) {
      notify(
        'Desbloquea a este usuario para poder conectar.'
      );
      return;
    }

    const profile =
      state.profiles.get(userId);

    if (!profile) {
      notify('No encuentro este perfil');
      return;
    }

    await loadConnection(userId);
    await handleConnect(userId);
  }

  async function loadIncomingConnections() {
    if (!state.user) return;

    const { data, error } = await db
      .from('connections')
      .select('*')
      .eq('recipient_id', state.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(
        'Rooms: error cargando solicitudes recibidas',
        error
      );
      return;
    }

    state.incomingRequests =
      new Map();

    (data || []).forEach(request => {
      if (
        state.blockedUsers?.has(
          request.requester_id
        )
      ) {
        return;
      }

      state.incomingRequests.set(
        request.id,
        { request }
      );

      state.connectionsByUser.set(
        String(request.requester_id),
        request
      );
    });

    updateConnectButtons();
  }


  function ensureConnectionResponseModal() {
    let modal =
      document.querySelector('#connectionResponseModal');

    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'connectionResponseModal';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-connection-response
      ></div>

      <article class="connection-response-shell">

        <button
          type="button"
          class="connection-response-close"
          data-close-connection-response
          aria-label="Cerrar"
        >
          ×
        </button>

        <div id="connectionResponseContent"></div>

      </article>
    `;

    document.body.appendChild(modal);

    return modal;
  }


  async function openIncomingConnectionRequest(userId) {
    if (!userId || !state.user) return;

    let connection =
      getConnectionForUser(userId);

    if (!connection) {
      connection =
        await loadConnection(userId);
    }

    if (
      !connection ||
      connection.status !== 'pending' ||
      connection.recipient_id !== state.user.id
    ) {
      notify(
        'Esta solicitud ya no está pendiente'
      );

      await loadAllConnections();
      return;
    }

    const profile =
      state.profiles.get(userId);

    if (!profile) {
      notify(
        'No encuentro el perfil de esta persona'
      );
      return;
    }

    const modal =
      ensureConnectionResponseModal();

    const content =
      modal.querySelector(
        '#connectionResponseContent'
      );

    const name =
      profile.alias ||
      profile.name ||
      'Usuario de Rooms';

    const zone =
      profile.zones?.length
        ? profile.zones.join(' · ')
        : 'Zona sin definir';

    const seeking =
      profile.seeking?.length
        ? profile.seeking
            .map(labelSeeking)
            .join(' · ')
        : 'Busca vivienda';

    content.innerHTML = `
      <section class="connection-response-profile">

        <div class="connection-response-avatar">
          ${
            profile.avatar_url
              ? `
                <img
                  src="${escapeHtml(profile.avatar_url)}"
                  alt="${escapeHtml(name)}"
                >
              `
              : `
                <span>
                  ${escapeHtml(initials(name))}
                </span>
              `
          }
        </div>

        <div class="connection-response-copy">

          <small>SOLICITUD DE CONEXIÓN</small>

          <h2>
            ${escapeHtml(name)}
            ${profile.age ? `, ${profile.age}` : ''}
          </h2>

          <p class="connection-response-meta">
            ${escapeHtml(seeking)}
            ·
            ${escapeHtml(zone)}
          </p>

          <p class="connection-response-bio">
            ${escapeHtml(
              profile.bio ||
              'Quiere conectar contigo en Rooms.'
            )}
          </p>

        </div>

      </section>


      <div class="connection-response-question">
        <small>CONEXIÓN</small>

        <h3>
          ${escapeHtml(name)} quiere conectar contigo
        </h3>

        <p>
          Si aceptas, podréis escribiros directamente
          en Rooms.
        </p>
      </div>


      <div class="connection-response-actions">

        <button
          type="button"
          class="connection-response-accept"
          data-connection-answer="accepted"
          data-connection-id="${connection.id}"
          data-connection-user="${profile.id}"
        >
          Aceptar
        </button>

        <button
          type="button"
          class="connection-response-decline"
          data-connection-answer="declined"
          data-connection-id="${connection.id}"
          data-connection-user="${profile.id}"
        >
          Ahora no
        </button>

      </div>
    `;

    showModal(modal);
  }


  async function answerIncomingConnection(
    connectionId,
    userId,
    status
  ) {
    if (
      !connectionId ||
      !userId ||
      !['accepted', 'declined'].includes(status)
    ) {
      return;
    }

    const { data, error } = await db
      .from('connections')
      .update({
        status
      })
      .eq('id', connectionId)
      .eq('recipient_id', state.user.id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      console.error(
        'Rooms: error respondiendo solicitud',
        error
      );

      notify(
        'No se pudo responder la solicitud'
      );
      return;
    }

    state.connectionsByUser.set(
      String(userId),
      data
    );

    state.incomingRequests?.delete(
      connectionId
    );

    if (
      state.targetProfile?.id === userId
    ) {
      state.connection = data;
    }

    updateConnectButtons();

    const modal =
      document.querySelector(
        '#connectionResponseModal'
      );

    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }

    document.body.style.overflow = '';

    await Promise.all([
      loadRealNotifications(),
      loadRealInbox()
    ]);

    notify(
      status === 'accepted'
        ? 'Conexión aceptada'
        : 'Solicitud rechazada'
    );
  }

    return {
      getConnectionForUser,
      connectionButtonLabel,
      loadAllConnections,
      loadConnection,
      updateConnectButtons,
      handleConnect,
      connectToUser,
      loadIncomingConnections,
      ensureConnectionResponseModal,
      openIncomingConnectionRequest,
      answerIncomingConnection
    };
  }

  window.ROOMS_CONNECTIONS_FEATURE = {
    create: createConnectionsFeature
  };
})();
