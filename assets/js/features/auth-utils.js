(function () {
  'use strict';

  function translateAuthError(message) {
    const text = String(message || '').toLowerCase();
    if (text.includes('invalid login')) return 'Email o contraseña incorrectos.';
    if (text.includes('already registered')) return 'Ya existe una cuenta con ese email.';
    if (text.includes('password')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (text.includes('email')) return 'Comprueba que el email esté bien escrito.';
    return 'No hemos podido completar el acceso. Inténtalo de nuevo.';
  }

  function readAuthUrlError() {
    const hash =
      window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : '';

    if (!hash) return null;

    const params =
      new URLSearchParams(hash);

    const error =
      params.get('error');

    const code =
      params.get('error_code');

    const description =
      params.get('error_description');

    if (!error && !code) {
      return null;
    }

    const result = {
      error,
      code,
      description
    };

    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${window.location.search}`
    );

    return result;
  }

  window.ROOMS_AUTH_UTILS = {
    translateAuthError,
    readAuthUrlError
  };
})();
