(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderDeletedConversation(messages) {
    if (!Array.isArray(messages)) {
      throw new Error('Historial invalido');
    }

    const rows = messages.map(message => {
      if (
        !message ||
        typeof message.body !== 'string' ||
        typeof message.mine !== 'boolean' ||
        typeof message.created_at !== 'string' ||
        !Number.isFinite(Date.parse(message.created_at))
      ) {
        throw new Error('Mensaje historico invalido');
      }

      const time = new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
      }).format(new Date(message.created_at));

      return `
        <div class="chat-message ${message.mine ? 'mine' : 'other'}">
          ${message.mine ? '' : '<b>Usuario eliminado</b>'}
          <p>${escapeHtml(message.body)}</p>
          <small>${escapeHtml(time)} UTC</small>
        </div>
      `;
    }).join('');

    return `
      <section class="rooms-deleted-chat" aria-label="Historial de conversación">
        <header>
          <b>Usuario eliminado</b>
          <p>Esta cuenta ya no está disponible.</p>
        </header>
        <div class="rooms-deleted-chat-history">
          ${rows || '<p>No hay mensajes conservados.</p>'}
        </div>
        <p class="rooms-deleted-chat-notice">
          Historial de solo lectura. No es posible enviar mensajes.
        </p>
      </section>
    `;
  }

  window.ROOMS_DELETED_CHAT_VIEW = Object.freeze({
    renderDeletedConversation
  });
})();
