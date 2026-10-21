(function () {
  'use strict';

  function createAccountSettingsFeature({
    db,
    state,
    notify
  }) {
function renderAccountSettings() {
      const email = state.user?.email || 'Sin email';
      const emailNode = document.querySelector('#settingsAccountEmail');

      if (emailNode) {
        emailNode.textContent = email;
      }
    }

    async function requestPasswordChange() {
      const email = state.user?.email;

      if (!email) {
        notify('No encontramos el email de tu cuenta');
        return;
      }

      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });

      if (error) {
        console.error('Rooms: error enviando cambio de contraseña', error);
        notify('No se pudo enviar el email');
        return;
      }

      notify('Te hemos enviado un email para cambiar tu contraseña');
    }

    async function logoutFromRooms() {
      const { error } = await db.auth.signOut();

      if (error) {
        console.error('Rooms: error cerrando sesión', error);
        notify('No se pudo cerrar la sesión');
        return;
      }

      notify('Sesión cerrada');
    }

    let requestingDeletion = false;

    async function requestAccountDeletion() {
      const userId = state.user?.id;
      if (!userId || requestingDeletion) return;

      const confirmed = window.confirm(
        '¿Quieres solicitar la eliminación de tu cuenta de ROOMS? ' +
        'Esta acción registra una solicitud, pero no elimina ' +
        'tu cuenta inmediatamente.'
      );

      if (!confirmed) return;

      requestingDeletion = true;
      const button = document.querySelector('#requestAccountDeletion');
      const status = document.querySelector('#accountDeletionStatus');

      if (button) button.disabled = true;

      try {
        const { error } = await db
          .from('account_deletion_requests')
          .insert({ user_id: userId });

        if (error && error.code !== '23505') {
          throw error;
        }

        if (state.user?.id !== userId) return;

        const message = error?.code === '23505'
          ? 'Ya existe una solicitud de eliminación para esta cuenta.'
          : 'Solicitud de eliminación registrada correctamente.';

        if (status) status.textContent = message;
        notify(message);
      } catch (error) {
        console.error('Rooms: error solicitando baja de cuenta', error);
        if (status) {
          status.textContent = 'No se pudo registrar la solicitud.';
        }
        notify('No se pudo registrar la solicitud. Inténtalo de nuevo.');
      } finally {
        requestingDeletion = false;
        if (button) button.disabled = false;
      }
    }

    document.addEventListener('click', event => {
      if (event.target.closest('#requestAccountDeletion')) {
        requestAccountDeletion();
        return;
      }

      if (event.target.closest('#changePassword')) {
        requestPasswordChange();
        return;
      }

      if (event.target.closest('#realLogoutButton')) {
        logoutFromRooms();
      }
    });

    renderAccountSettings();

    return {
      renderAccountSettings,
      requestPasswordChange,
      logoutFromRooms
    };
  }

  window.ROOMS_ACCOUNT_SETTINGS_FEATURE = {
    create: createAccountSettingsFeature
  };
})();
