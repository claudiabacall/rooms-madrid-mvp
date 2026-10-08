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

    document.addEventListener('click', event => {
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
