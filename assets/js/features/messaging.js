(function () {
  'use strict';

  function createMessagingFeature({
    db,
    state,
    notify,
    showModal,
    hideAllModals,
    escapeHtml,
    initials,
    relativeTime,
    fetchProfiles,
    getConnectionForUser,
    loadConnection
  }) {

  async function loadConversationPreferences() {
    if (!state.user) return;

    const { data, error } =
      await db
        .from('conversation_preferences')
        .select(
          'other_user_id,muted,deleted_before,updated_at'
        )
        .eq('user_id', state.user.id);

    if (error) {
      console.error(
        'Rooms: error cargando preferencias de conversación',
        error
      );

      state.conversationPreferences =
        new Map();

      return;
    }

    state.conversationPreferences =
      new Map(
        (data || []).map(item => [
          String(item.other_user_id),
          item
        ])
      );
  }


  function getConversationPreference(userId) {
    return (
      state.conversationPreferences?.get(
        String(userId)
      ) || {
        other_user_id: userId,
        muted: false,
        deleted_before: null
      }
    );
  }


  async function saveConversationPreference(
    userId,
    changes
  ) {
    if (
      !state.user ||
      !userId ||
      userId === state.user.id
    ) {
      return null;
    }

    const current =
      getConversationPreference(userId);

    const payload = {
      user_id: state.user.id,
      other_user_id: userId,
      muted:
        changes.muted ??
        current.muted ??
        false,
      deleted_before:
        changes.deleted_before !== undefined
          ? changes.deleted_before
          : current.deleted_before ?? null,
      updated_at:
        new Date().toISOString()
    };

    const { data, error } =
      await db
        .from('conversation_preferences')
        .upsert(
          payload,
          {
            onConflict:
              'user_id,other_user_id'
          }
        )
        .select(
          'other_user_id,muted,deleted_before,updated_at'
        )
        .single();

    if (error) {
      console.error(
        'Rooms: error guardando preferencias de conversación',
        error
      );

      return null;
    }

    state.conversationPreferences.set(
      String(userId),
      data
    );

    return data;
  }

  async function toggleConversationMute() {
    if (
      !state.user ||
      !state.chatTarget
    ) {
      return;
    }

    const userId =
      state.chatTarget.id;

    const current =
      getConversationPreference(
        userId
      );

    const nextMuted =
      !Boolean(current.muted);

    const saved =
      await saveConversationPreference(
        userId,
        {
          muted: nextMuted
        }
      );

    if (!saved) {
      notify(
        'No hemos podido actualizar las notificaciones.'
      );
      return;
    }

    await loadRealNotifications();

    renderConversationOptionsMenu();

    notify(
      nextMuted
        ? 'Conversación silenciada.'
        : 'Notificaciones activadas.'
    );
  }


  async function deleteConversationForMe() {
    if (
      !state.user ||
      !state.chatTarget
    ) {
      return;
    }

    const name =
      state.chatTarget.alias ||
      state.chatTarget.name ||
      'esta persona';

    const confirmed =
      window.confirm(
        `¿Eliminar la conversación con ${name}? Desaparecerá para ti. Si recibes un mensaje nuevo, volverá a aparecer.`
      );

    if (!confirmed) return;

    const deletedBefore =
      new Date().toISOString();

    const saved =
      await saveConversationPreference(
        state.chatTarget.id,
        {
          deleted_before:
            deletedBefore
        }
      );

    if (!saved) {
      notify(
        'No hemos podido eliminar la conversación.'
      );
      return;
    }

    /*
     * Los mensajes anteriores ya no deben seguir
     * apareciendo como pendientes para este usuario.
     */
    const { error: readError } =
      await db
        .from('messages')
        .update({
          read_at:
            new Date().toISOString()
        })
        .eq(
          'sender_id',
          state.chatTarget.id
        )
        .eq(
          'recipient_id',
          state.user.id
        )
        .is(
          'read_at',
          null
        )
        .lte(
          'created_at',
          deletedBefore
        );

    if (readError) {
      console.error(
        'Rooms: error cerrando notificaciones de conversación eliminada',
        readError
      );
    }

    const modal =
      document.querySelector(
        '#conversationModal'
      );

    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute(
        'aria-hidden',
        'true'
      );
    }

    document.body.style.overflow = '';

    state.chatTarget = null;

    await Promise.all([
      loadRealInbox(),
      loadRealNotifications()
    ]);

    notify(
      'Conversación eliminada para ti.'
    );
  }

  async function loadRealNotifications() {
    if (!state.user) return;
    const [{ data: connections }, { data: messages }] = await Promise.all([
      db.from('connections').select('*').or(`requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`).order('created_at', { ascending: false }),
      db.from('messages').select('*').eq('recipient_id', state.user.id).is('read_at', null).order('created_at', { ascending: false }).limit(20)
    ]);
    state.incomingRequests = new Map();

    const relevantConnections = (connections || []).filter(item => {
      const otherId =
        item.requester_id === state.user.id
          ? item.recipient_id
          : item.requester_id;

      if (state.blockedUsers?.has(otherId)) {
        return false;
      }

      return (
        (item.recipient_id === state.user.id && item.status === 'pending') ||
        (item.requester_id === state.user.id && item.status === 'accepted')
      );
    });

    const visibleMessages = (messages || []).filter(message => {
      if (
        state.blockedUsers?.has(
          message.sender_id
        )
      ) {
        return false;
      }

      const preference =
        getConversationPreference(
          message.sender_id
        );

      if (preference.muted) {
        return false;
      }

      if (preference.deleted_before) {
        const deletedBefore =
          new Date(
            preference.deleted_before
          ).getTime();

        const messageTime =
          new Date(
            message.created_at
          ).getTime();

        if (messageTime <= deletedBefore) {
          return false;
        }
      }

      return true;
    });

    const ids = [
      ...relevantConnections.map(item =>
        item.requester_id === state.user.id
          ? item.recipient_id
          : item.requester_id
      ),
      ...visibleMessages.map(item => item.sender_id)
    ];
    const profiles = await fetchProfiles(ids);
    const items = [];

    relevantConnections.forEach(connection => {
      const otherId = connection.requester_id === state.user.id ? connection.recipient_id : connection.requester_id;
      const profile = profiles.get(otherId);
      const name = profile?.alias || profile?.name || 'Una persona';
      const pending = connection.status === 'pending';
      items.push({
        kind: pending ? 'request' : 'accepted',
        id: connection.id,
        otherId,
        createdAt: connection.updated_at || connection.created_at,
        icon: pending ? initials(name) : '✓',
        category: 'SOCIAL',
        title: pending ? `${name} quiere conectar contigo` : `${name} ha aceptado tu conexión`,
        copy: pending ? 'Revisa su perfil y responde a la solicitud' : 'Ya podéis enviaros mensajes'
      });
      if (pending) state.incomingRequests.set(connection.id, { request: connection, requester: profile });
    });

    const seenSenders = new Set();
    visibleMessages.forEach(message => {
      if (seenSenders.has(message.sender_id)) return;
      seenSenders.add(message.sender_id);
      const profile = profiles.get(message.sender_id);
      const name = profile?.alias || profile?.name || 'Una persona';
      items.push({
        kind: 'message', id: message.id, otherId: message.sender_id, createdAt: message.created_at,
        icon: initials(name), category: 'MENSAJE', title: `Nuevo mensaje de ${name}`, copy: message.body
      });
    });

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const list = document.querySelector('#notificationsModal .notification-list');
    if (list) {
      list.innerHTML = items.length ? items.map(item => `
        <button type="button" data-real-notification="${item.kind}" data-notification-id="${item.id}" data-user-id="${item.otherId}">
          <span class="notification-icon">${escapeHtml(item.icon)}</span>
          <div><small>${escapeHtml(item.category)} · ${relativeTime(item.createdAt)}</small><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.copy)}</p></div><i></i>
        </button>`).join('') : '<div class="real-empty-state"><b>Estás al día</b><p>Aquí aparecerán tus conexiones y mensajes.</p></div>';
    }
    const dot = document.querySelector('#openNotifications i');
    if (dot) dot.hidden = items.length === 0;
  }

  async function loadRealInbox() {
    if (!state.user) return;
    const { data: connections } = await db.from('connections').select('*')
      .or(`requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`)
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false });
    const otherIds = (connections || [])
      .map(item =>
        item.requester_id === state.user.id
          ? item.recipient_id
          : item.requester_id
      )
      .filter(id =>
        !state.blockedUsers?.has(id)
      );

    const profiles = await fetchProfiles(otherIds);
    const { data: messages } = await db.from('messages').select('*')
      .or(`sender_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`)
      .order('created_at', { ascending: false });
    const latestByUser = new Map();

    (messages || []).forEach(message => {
      const otherId =
        message.sender_id === state.user.id
          ? message.recipient_id
          : message.sender_id;

      if (state.blockedUsers?.has(otherId)) {
        return;
      }

      const preference =
        getConversationPreference(otherId);

      const deletedBefore =
        preference.deleted_before
          ? new Date(
              preference.deleted_before
            ).getTime()
          : null;

      if (
        deletedBefore &&
        new Date(
          message.created_at
        ).getTime() <= deletedBefore
      ) {
        return;
      }

      if (!latestByUser.has(otherId)) {
        latestByUser.set(otherId, message);
      }
    });

    const visibleConversationIds =
      otherIds.filter(id => {
        const preference =
          getConversationPreference(id);

        if (!preference.deleted_before) {
          return true;
        }

        return latestByUser.has(id);
      });

    const list =
      document.querySelector(
        '#chatInboxModal .conversation-list'
      );

    if (!list) return;

    list.innerHTML =
      visibleConversationIds.length
        ? visibleConversationIds.map(id => {
      const profile = profiles.get(id);
      const name = profile?.alias || profile?.name || 'Usuario de Rooms';
      const last = latestByUser.get(id);
      return `<button type="button" data-real-chat="${id}">
        <span class="home-chat-icon">${escapeHtml(initials(name))}</span>
        <div><b>${escapeHtml(name)}</b><p>${escapeHtml(last?.body || 'Ya podéis empezar a hablar.')}</p><small>CONEXIÓN ROOMS</small></div>
        <time>${last ? relativeTime(last.created_at) : ''}</time>
      </button>`;
    }).join('')
        : '<div class="real-empty-state"><b>Todavía no tienes conversaciones</b><p>Cuando aceptéis una conexión, el chat aparecerá aquí.</p></div>';

    const inboxSearch =
      document.querySelector('#chatInboxSearch');

    const query =
      inboxSearch?.value
        .trim()
        .toLocaleLowerCase('es') || '';

    const renderedConversations =
      [...list.querySelectorAll('[data-real-chat]')];

    renderedConversations.forEach(item => {
      item.hidden =
        Boolean(query) &&
        !item.textContent
          .toLocaleLowerCase('es')
          .includes(query);
    });

    list
      .querySelector('[data-chat-search-empty]')
      ?.remove();

    if (
      query &&
      renderedConversations.length &&
      !renderedConversations.some(item => !item.hidden)
    ) {
      list.insertAdjacentHTML(
        'beforeend',
        '<div class="real-empty-state" data-chat-search-empty><b>No encontramos conversaciones</b><p>Prueba con otro nombre o palabra del último mensaje.</p></div>'
      );
    }
  }

  function ensureConversationOptionsMenu() {
    const header =
      document.querySelector(
        '#conversationModal .conversation-shell header'
      );

    if (!header) return null;

    let button =
      header.querySelector(
        '[data-real-conversation-options]'
      );

    if (!button) {
      button =
        document.createElement('button');

      button.type = 'button';
      button.className =
        'conversation-options-trigger';

      button.setAttribute(
        'data-real-conversation-options',
        ''
      );

      button.setAttribute(
        'aria-label',
        'Opciones de conversación'
      );

      button.setAttribute(
        'aria-expanded',
        'false'
      );

      button.textContent = '•••';

      header.appendChild(button);
    }

    let menu =
      document.querySelector(
        '#realConversationOptionsMenu'
      );

    if (!menu) {
      menu =
        document.createElement('div');

      menu.id =
        'realConversationOptionsMenu';

      menu.className =
        'real-conversation-options';

      menu.hidden = true;

      header.appendChild(menu);
    }

    return menu;
  }


  function renderConversationOptionsMenu() {
    if (!state.chatTarget) return;

    const menu =
      ensureConversationOptionsMenu();

    if (!menu) return;

    const preference =
      getConversationPreference(
        state.chatTarget.id
      );

    menu.innerHTML = `
      <button
        type="button"
        data-real-chat-action="profile"
      >
        Ver perfil
      </button>

      <button
        type="button"
        data-real-chat-action="mute"
      >
        ${
          preference.muted
            ? 'Activar notificaciones'
            : 'Silenciar conversación'
        }
      </button>

      <button
        type="button"
        data-real-chat-action="report"
      >
        Reportar usuario
      </button>

      <button
        type="button"
        data-real-chat-action="block"
      >
        Bloquear usuario
      </button>

      <hr>

      <button
        type="button"
        class="danger"
        data-real-chat-action="delete"
      >
        Eliminar conversación
      </button>
    `;
  }


  function closeConversationOptionsMenu() {
    const menu =
      document.querySelector(
        '#realConversationOptionsMenu'
      );

    const button =
      document.querySelector(
        '[data-real-conversation-options]'
      );

    if (menu) {
      menu.hidden = true;
    }

    if (button) {
      button.setAttribute(
        'aria-expanded',
        'false'
      );
    }
  }


  async function openRealConversation(profile) {
    if (!profile || !state.user) return;

    if (
      state.blockedUsers?.has(profile.id)
    ) {
      notify(
        'Has bloqueado a este usuario.'
      );
      return;
    }

    const connection =
      getConnectionForUser(profile.id) ||
      await loadConnection(profile.id);

    if (
      !connection ||
      connection.status !== 'accepted'
    ) {
      notify(
        'Necesitáis estar conectados para poder escribiros'
      );
      return;
    }

    state.chatTarget = profile;

    hideAllModals();

    const modal =
      document.querySelector('#conversationModal');

    if (!modal) return;

    const name =
      profile.alias ||
      profile.name ||
      'Usuario de Rooms';

    const nameNode =
      document.querySelector('#conversationName');

    const contextNode =
      document.querySelector('#conversationContext');

    const avatar =
      document.querySelector('#conversationAvatar');

    const symbol =
      document.querySelector('#conversationSymbol');

    const input =
      document.querySelector('#conversationInput');

    if (nameNode) {
      nameNode.textContent = name;
    }

    if (contextNode) {
      contextNode.textContent =
        'Conectados en Rooms';
    }

    if (profile.avatar_url && avatar) {
      avatar.src = profile.avatar_url;
      avatar.alt = name;
      avatar.hidden = false;

      if (symbol) {
        symbol.hidden = true;
      }
    } else {
      if (avatar) {
        avatar.src = '';
        avatar.alt = '';
        avatar.hidden = true;
      }

      if (symbol) {
        symbol.textContent =
          initials(name);

        symbol.hidden = false;
      }
    }

    if (input) {
      input.value = '';
      input.disabled = false;
    }

    showModal(modal);

    ensureConversationOptionsMenu();
    renderConversationOptionsMenu();
    closeConversationOptionsMenu();

    await renderMessages();

    subscribeToMessages();

    setTimeout(() => {
      input?.focus();
    }, 80);
  }


  async function renderMessages() {
    if (
      !state.chatTarget ||
      !state.user
    ) {
      return;
    }

    const body =
      document.querySelector(
        '#conversationBody'
      );

    if (!body) return;

    body.innerHTML = `
      <div class="real-chat-loading">
        Cargando conversación…
      </div>
    `;

    const { data, error } = await db
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${state.user.id},recipient_id.eq.${state.chatTarget.id}),and(sender_id.eq.${state.chatTarget.id},recipient_id.eq.${state.user.id})`
      )
      .order(
        'created_at',
        { ascending: true }
      );

    if (error) {
      console.error(
        'Rooms: error cargando mensajes',
        error
      );

      body.innerHTML = `
        <div class="real-chat-empty">
          <b>No pudimos cargar la conversación</b>
          <p>Inténtalo de nuevo.</p>
        </div>
      `;

      return;
    }

    const preference =
      getConversationPreference(
        state.chatTarget.id
      );

    const deletedBefore =
      preference.deleted_before
        ? new Date(
            preference.deleted_before
          ).getTime()
        : null;

    const messages =
      (data || []).filter(message =>
        !deletedBefore ||
        new Date(
          message.created_at
        ).getTime() > deletedBefore
      );

    if (!messages.length) {
      const name =
        state.chatTarget.alias ||
        state.chatTarget.name ||
        'esta persona';

      body.innerHTML = `
        <div class="real-chat-empty">
          <span>✦</span>

          <b>
            Empieza la conversación
          </b>

          <p>
            Tú y ${escapeHtml(name)}
            ya estáis conectados en Rooms.
          </p>
        </div>
      `;

      return;
    }

    body.innerHTML = `
      <div class="chat-day">
        CONVERSACIÓN
      </div>

      ${messages
        .map(message => messageBubble(message))
        .join('')}
    `;

    body.scrollTop =
      body.scrollHeight;
  }


  function messageBubble(message) {
    const mine =
      message.sender_id === state.user.id;

    const name =
      state.chatTarget?.alias ||
      state.chatTarget?.name ||
      'Usuario';

    const date =
      new Date(message.created_at);

    const time =
      new Intl.DateTimeFormat(
        'es-ES',
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      ).format(date);

    return `
      <div
        class="chat-message ${mine ? 'mine' : 'other'}"
      >
        ${
          mine
            ? ''
            : `<b>${escapeHtml(name)}</b>`
        }

        <p>
          ${escapeHtml(message.body)}
        </p>

        <small>
          ${escapeHtml(time)}
        </small>
      </div>
    `;
  }


  async function sendMessage(text) {
    if (
      !state.chatTarget ||
      !state.user ||
      !text
    ) {
      return;
    }

    if (
      state.blockedUsers?.has(
        state.chatTarget.id
      )
    ) {
      notify(
        'Has bloqueado a este usuario.'
      );
      return;
    }

    const connection =
      getConnectionForUser(
        state.chatTarget.id
      ) ||
      await loadConnection(
        state.chatTarget.id
      );

    if (
      !connection ||
      connection.status !== 'accepted'
    ) {
      notify(
        'Esta conexión ya no está activa'
      );

      return;
    }

    const cleanText =
      String(text)
        .trim()
        .slice(0, 2000);

    if (!cleanText) return;

    const { error } = await db
      .from('messages')
      .insert({
        sender_id: state.user.id,
        recipient_id: state.chatTarget.id,
        body: cleanText
      });

    if (error) {
      console.error(
        'Rooms: error enviando mensaje',
        error
      );

      notify(
        'No se pudo enviar el mensaje'
      );

      return;
    }

    /*
      Re-render inmediato para que el envío
      no dependa exclusivamente de Realtime.
    */
    await renderMessages();

    await Promise.all([
      loadRealNotifications(),
      loadRealInbox()
    ]);
  }


  function subscribeToMessages() {
    if (!state.user) return;

    if (state.channel) {
      db.removeChannel(state.channel);
      state.channel = null;
    }

    state.channel =
      db
        .channel(
          `messages-${state.user.id}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          payload => {
            const message =
              payload.new;

            const belongsToUser =
              message.sender_id === state.user.id ||
              message.recipient_id === state.user.id;

            if (!belongsToUser) {
              return;
            }

            const belongsToOpenChat =
              state.chatTarget &&
              (
                (
                  message.sender_id === state.user.id &&
                  message.recipient_id === state.chatTarget.id
                ) ||
                (
                  message.sender_id === state.chatTarget.id &&
                  message.recipient_id === state.user.id
                )
              );

            if (belongsToOpenChat) {
              renderMessages();
            }

            Promise.all([
              loadRealNotifications(),
              loadRealInbox()
            ]);
          }
        )
        .subscribe();
  }

    return {
      loadConversationPreferences,
      getConversationPreference,
      saveConversationPreference,
      toggleConversationMute,
      deleteConversationForMe,
      loadRealNotifications,
      loadRealInbox,
      ensureConversationOptionsMenu,
      renderConversationOptionsMenu,
      closeConversationOptionsMenu,
      openRealConversation,
      renderMessages,
      messageBubble,
      sendMessage,
      subscribeToMessages
    };
  }

  window.ROOMS_MESSAGING_FEATURE = {
    create: createMessagingFeature
  };
})();
