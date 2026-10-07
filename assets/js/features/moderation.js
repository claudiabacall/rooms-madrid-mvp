(function () {
  'use strict';

  function createModerationFeature({
    db,
    state,
    notify,
    showModal,
    hideAllModals,
    escapeHtml,
    initials,
    updateConnectButtons,
    loadSavedItems,
    loadHouseholdCandidates,
    loadRealInbox,
    loadRealNotifications,
    openRealUser
  }) {

  function openRealReport(target) {
    if (!target || !state.user) return;

    state.reportTarget = {
      type: target.dataset.reportType || 'user',
      id: target.dataset.reportId || null,
      userId: target.dataset.reportUser || null
    };

    const modal = document.querySelector('#reportModal');
    const label = document.querySelector('#reportTarget');
    const details = document.querySelector('#reportDetails');
    const submit = document.querySelector('#submitReport');

    if (!modal) return;

    document
      .querySelectorAll('#reportModal .report-reasons button')
      .forEach(button => {
        button.setAttribute('aria-checked', 'false');
      });

    if (details) details.value = '';
    if (submit) submit.disabled = true;

    const labels = {
      profile: 'Este perfil',
      listing: 'Este anuncio',
      post: 'Esta publicación',
      community: 'Esta comunidad',
      message: 'Este mensaje',
      user: 'Este usuario'
    };

    if (label) {
      label.textContent =
        `Sobre: ${labels[state.reportTarget.type] || 'Este contenido'}`;
    }

    showModal(modal);
  }

  async function submitRealReport() {
    if (!state.user || !state.reportTarget) return;

    const modal = document.querySelector('#reportModal');

    const selected =
      modal?.querySelector(
        '.report-reasons button[aria-checked="true"]'
      );

    const details =
      document.querySelector('#reportDetails')?.value.trim() || null;

    const submit =
      document.querySelector('#submitReport');

    if (!selected) {
      notify('Selecciona un motivo para continuar.');
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Enviando…';
    }

    const payload = {
      reporter_id: state.user.id,
      reported_user_id:
        state.reportTarget.userId || null,
      target_type:
        state.reportTarget.type,
      target_id:
        state.reportTarget.id || null,
      reason:
        selected.textContent.trim(),
      details,
      status: 'pending'
    };

    const { error } =
      await db
        .from('reports')
        .insert(payload);

    if (submit) {
      submit.textContent = 'Enviar reporte';
    }

    if (error) {
      console.error('Error creando reporte:', error);

      if (submit) {
        submit.disabled = false;
      }

      notify(
        'No hemos podido enviar el reporte. Inténtalo de nuevo.'
      );

      return;
    }

    state.reportTarget = null;

    hideAllModals();

    notify(
      'Reporte enviado. Gracias por ayudarnos a cuidar Rooms.'
    );
  }

  async function showMyRealReports() {
    if (!state.user) return;

    const { data, error } =
      await db
        .from('reports')
        .select('id,status,reason,target_type,created_at')
        .eq('reporter_id', state.user.id)
        .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando reportes:', error);
      notify('No hemos podido cargar tus reportes.');
      return;
    }

    const reports = data || [];

    if (!reports.length) {
      notify('No tienes reportes activos.');
      return;
    }

    const pending =
      reports.filter(item =>
        item.status === 'pending' ||
        item.status === 'reviewing'
      ).length;

    notify(
      pending
        ? `${pending} ${pending === 1 ? 'reporte activo' : 'reportes activos'}`
        : `${reports.length} ${reports.length === 1 ? 'reporte enviado' : 'reportes enviados'}`
    );
  }

  async function loadUserBlocks() {
    if (!state.user) return;

    const { data, error } =
      await db
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', state.user.id);

    if (error) {
      console.error('Rooms: error cargando bloqueos', error);
      state.blockedUsers = new Set();
      return;
    }

    state.blockedUsers =
      new Set(
        (data || []).map(item => item.blocked_id)
      );

    updateBlockedUsersCount();
  }

  function updateBlockedUsersCount() {
    const count =
      state.blockedUsers?.size || 0;

    const label =
      document.querySelector(
        '#blockedUsersCount'
      );

    if (!label) return;

    label.textContent =
      `${count} ${
        count === 1
          ? 'persona'
          : 'personas'
      }`;
  }

  function ensureBlockedUsersModal() {
    let modal =
      document.querySelector(
        '#blockedUsersModal'
      );

    if (modal) return modal;

    modal =
      document.createElement('div');

    modal.className = 'modal';
    modal.id = 'blockedUsersModal';
    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-blocked-users
      ></div>

      <article class="blocked-users-shell">

        <button
          type="button"
          class="blocked-users-close"
          data-close-blocked-users
          aria-label="Cerrar"
        >
          ×
        </button>

        <header class="blocked-users-header">
          <small>SEGURIDAD</small>
          <h2>Usuarios bloqueados</h2>
          <p>
            Estas personas no pueden conectar
            ni enviarte mensajes mientras estén
            bloqueadas.
          </p>
        </header>

        <div
          id="blockedUsersList"
          class="blocked-users-list"
        ></div>

      </article>
    `;

    document.body.appendChild(modal);

    return modal;
  }

  async function openBlockedUsersManager() {
    if (!state.user) return;

    const modal =
      ensureBlockedUsersModal();

    const list =
      modal.querySelector(
        '#blockedUsersList'
      );

    list.innerHTML = `
      <div class="blocked-users-loading">
        Cargando...
      </div>
    `;

    showModal(modal);

    const { data, error } =
      await db.rpc(
        'get_blocked_profiles'
      );

    if (error) {
      console.error(
        'Rooms: error cargando usuarios bloqueados',
        error
      );

      list.innerHTML = `
        <div class="real-empty-state">
          <b>No hemos podido cargar esta lista</b>
          <p>Inténtalo de nuevo.</p>
        </div>
      `;

      return;
    }

    const users = data || [];

    if (!users.length) {
      list.innerHTML = `
        <div class="real-empty-state">
          <b>No tienes usuarios bloqueados</b>
          <p>
            Las personas que bloquees
            aparecerán aquí.
          </p>
        </div>
      `;

      return;
    }

    list.innerHTML =
      users.map(user => {
        const name =
          user.alias ||
          user.name ||
          'Usuario de Rooms';

        return `
          <article class="blocked-user-row">

            <div class="blocked-user-avatar">
              ${
                user.avatar_url
                  ? `
                    <img
                      src="${escapeHtml(user.avatar_url)}"
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

            <div class="blocked-user-info">
              <b>${escapeHtml(name)}</b>
              <small>Usuario bloqueado</small>
            </div>

            <button
              type="button"
              class="blocked-user-unblock"
              data-unblock-user="${user.id}"
              data-unblock-name="${escapeHtml(name)}"
            >
              Desbloquear
            </button>

          </article>
        `;
      }).join('');
  }

  function openRealBlock(target) {
    if (!state.user || !target) return;

    const userId =
      target.dataset.realBlockUser;

    const name =
      target.dataset.realBlockName ||
      'este usuario';

    if (!userId || userId === state.user.id) return;

    /*
     * Si ya está bloqueado, desbloqueamos directamente
     * desde la misma acción.
     */
    if (state.blockedUsers?.has(userId)) {
      unblockRealUser(userId, name);
      return;
    }

    state.blockTarget = {
      id: userId,
      name
    };

    const modal =
      document.querySelector('#blockModal');

    if (!modal) return;

    const title =
      modal.querySelector('h2');

    if (title) {
      title.textContent =
        `¿Bloquear a ${name}?`;
    }

    showModal(modal);
  }

  async function removeConnectionWithUser(userId) {
    if (!state.user || !userId) {
      return { ok: false };
    }

    const { error } =
      await db
        .from('connections')
        .delete()
        .or(
          `and(requester_id.eq.${state.user.id},recipient_id.eq.${userId}),and(requester_id.eq.${userId},recipient_id.eq.${state.user.id})`
        );

    if (error) {
      console.error(
        'Rooms: error eliminando conexión al bloquear',
        error
      );

      return {
        ok: false,
        error
      };
    }

    state.connectionsByUser.delete(
      String(userId)
    );

    if (
      state.targetProfile?.id === userId
    ) {
      state.connection = null;
    }

    for (
      const [requestId, entry]
      of state.incomingRequests
    ) {
      const requesterId =
        entry?.request?.requester_id;

      if (requesterId === userId) {
        state.incomingRequests.delete(
          requestId
        );
      }
    }

    updateConnectButtons();

    return {
      ok: true
    };
  }

  async function removeBlockedUserFromSavedAndGroups(userId) {
    if (!state.user || !userId) {
      return { ok: false };
    }

    const [
      savedResult,
      groupResult
    ] = await Promise.all([
      db
        .from('saved_items')
        .delete()
        .match({
          user_id: state.user.id,
          item_type: 'person',
          item_id: userId
        }),

      db
        .from('household_person_candidates')
        .delete()
        .eq('user_id', userId)
        .eq('added_by', state.user.id)
    ]);

    if (savedResult.error) {
      console.error(
        'Rooms: error eliminando perfil bloqueado de Guardados',
        savedResult.error
      );

      return {
        ok: false,
        error: savedResult.error
      };
    }

    if (groupResult.error) {
      console.error(
        'Rooms: error eliminando perfil bloqueado de grupos',
        groupResult.error
      );

      return {
        ok: false,
        error: groupResult.error
      };
    }

    state.savedItems?.delete(
      `person:${userId}`
    );

    await loadSavedItems();

    if (state.household) {
      await loadHouseholdCandidates();
    }

    return {
      ok: true
    };
  }

  async function confirmRealBlock() {
    if (!state.user || !state.blockTarget?.id) return;

    const target =
      state.blockTarget;

    const button =
      document.querySelector('#confirmBlock');

    if (button) {
      button.disabled = true;
      button.textContent = 'Bloqueando…';
    }

    const { error } =
      await db
        .from('user_blocks')
        .insert({
          blocker_id: state.user.id,
          blocked_id: target.id
        });

    if (button) {
      button.disabled = false;
      button.textContent = 'Bloquear usuario';
    }

    if (error) {
      console.error(
        'Rooms: error bloqueando usuario',
        error
      );

      notify(
        'No hemos podido bloquear al usuario.'
      );

      return;
    }

    const connectionResult =
      await removeConnectionWithUser(
        target.id
      );

    if (!connectionResult.ok) {
      /*
       * Si no podemos cortar la relación existente,
       * revertimos el bloqueo para no dejar un estado
       * inconsistente.
       */
      await db
        .from('user_blocks')
        .delete()
        .eq('blocker_id', state.user.id)
        .eq('blocked_id', target.id);

      if (button) {
        button.disabled = false;
      }

      notify(
        'No hemos podido completar el bloqueo.'
      );

      return;
    }

    const cleanupResult =
      await removeBlockedUserFromSavedAndGroups(
        target.id
      );

    if (!cleanupResult.ok) {
      await db
        .from('user_blocks')
        .delete()
        .eq('blocker_id', state.user.id)
        .eq('blocked_id', target.id);

      notify(
        'No hemos podido completar el bloqueo.'
      );

      return;
    }

    state.blockedUsers.add(target.id);
    state.blockTarget = null;

    updateBlockedUsersCount();
    updateConnectButtons();

    await loadRealInbox();
    await loadRealNotifications();

    hideAllModals();

    notify(
      'Usuario bloqueado.'
    );
  }

  async function unblockRealUser(userId, name) {
    if (!state.user || !userId) return;

    const confirmed =
      window.confirm(
        `¿Desbloquear a ${name || 'este usuario'}?`
      );

    if (!confirmed) return;

    const { error } =
      await db
        .from('user_blocks')
        .delete()
        .eq('blocker_id', state.user.id)
        .eq('blocked_id', userId);

    if (error) {
      console.error(
        'Rooms: error desbloqueando usuario',
        error
      );

      notify(
        'No hemos podido desbloquear al usuario.'
      );

      return;
    }

    state.blockedUsers.delete(userId);

    updateBlockedUsersCount();

    if (
      document.querySelector(
        '#blockedUsersModal'
      )?.getAttribute('aria-hidden') === 'false'
    ) {
      await openBlockedUsersManager();
    }

    notify(
      'Usuario desbloqueado.'
    );

    if (
      state.targetProfile?.id === userId
    ) {
      openRealUser(state.targetProfile);
    }
  }

    return {
      openRealReport,
      submitRealReport,
      showMyRealReports,
      loadUserBlocks,
      updateBlockedUsersCount,
      ensureBlockedUsersModal,
      openBlockedUsersManager,
      openRealBlock,
      removeConnectionWithUser,
      removeBlockedUserFromSavedAndGroups,
      confirmRealBlock,
      unblockRealUser
    };
  }

  window.ROOMS_MODERATION_FEATURE = {
    create:
      createModerationFeature
  };
})();
