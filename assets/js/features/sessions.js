(function () {
  'use strict';

  function createSessionsFeature({
    db,
    state,
    showModal,
    notify
  }) {

  function ensureSessionsModal() {
    let modal =
      document.querySelector(
        '#sessionsModal'
      );

    if (modal) return modal;

    modal =
      document.createElement('div');

    modal.className = 'modal';
    modal.id = 'sessionsModal';
    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    modal.innerHTML = `
      <div
        class="backdrop"
        data-close-sessions
      ></div>

      <article class="sessions-shell">

        <button
          type="button"
          class="sessions-close"
          data-close-sessions
          aria-label="Cerrar"
        >
          ×
        </button>

        <small class="sessions-eyebrow">
          SEGURIDAD
        </small>

        <h2>Gestionar sesiones</h2>

        <p>
          Tu sesión actual permanecerá abierta.
          Puedes cerrar las demás sesiones de
          Rooms iniciadas en otros navegadores
          o dispositivos.
        </p>

        <div class="sessions-current">
          <span>✓</span>
          <div>
            <b>Sesión actual</b>
            <small>Este navegador</small>
          </div>
        </div>

        <button
          type="button"
          class="sessions-signout-others"
          id="signOutOtherSessions"
        >
          Cerrar las demás sesiones
        </button>

      </article>
    `;

    document.body.appendChild(modal);

    return modal;
  }


  function openSessionsManager() {
    if (!state.user) return;

    const modal =
      ensureSessionsModal();

    showModal(modal);
  }


  async function signOutOtherSessions() {
    if (!state.user) return;

    const confirmed =
      window.confirm(
        '¿Cerrar las demás sesiones de Rooms? Tu sesión actual seguirá abierta.'
      );

    if (!confirmed) return;

    const button =
      document.querySelector(
        '#signOutOtherSessions'
      );

    if (button) {
      button.disabled = true;
      button.textContent =
        'Cerrando sesiones…';
    }

    const { error } =
      await db.auth.signOut({
        scope: 'others'
      });

    if (button) {
      button.disabled = false;
      button.textContent =
        'Cerrar las demás sesiones';
    }

    if (error) {
      console.error(
        'Rooms: error cerrando otras sesiones',
        error
      );

      notify(
        'No hemos podido cerrar las demás sesiones.'
      );

      return;
    }

    notify(
      'Las demás sesiones se han cerrado.'
    );
  }






    return {
      ensureSessionsModal,
      openSessionsManager,
      signOutOtherSessions
    };
  }

  window.ROOMS_SESSIONS_FEATURE = {
    create: createSessionsFeature
  };
})();
