(function () {
  'use strict';

  function createFeedPersonCardFeature({
    state,
    escapeHtml,
    initials,
    labelSeeking,
    connectionButtonLabel
  }) {
    function renderPersonCard(profile) {
      if (
        !profile ||
        state.blockedUsers?.has(profile.id)
      ) {
        return '';
      }

      const name = profile.alias || profile.name || 'Usuario de Rooms';
      const zone = profile.zones?.[0] || null;
      const seeking = labelSeeking(profile.seeking?.[0]);
      const traits = (profile.traits || []).slice(0, 3);
      const traitLabels = { tidy: 'Ordenado', social: 'Sociable', calm: 'Tranquilo', independent: 'Independiente', cook: 'Cocinillas', early: 'Madrugador', night: 'Nocturno' };
      return `<article class="feed-card person-feed-card" data-feed-type="person" data-real-user="${profile.id}" tabindex="0">
        <div class="person-card-photo real-person-photo">
          ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">` : `<div class="real-person-placeholder">${escapeHtml(initials(name))}</div>`}
          <div class="person-card-tools"><button type="button" class="${state.savedItems?.has(`person:${profile.id}`) ? 'saved' : ''}" data-person-save data-save-kind="person" data-save-id="${profile.id}" aria-label="${state.savedItems?.has(`person:${profile.id}`) ? 'Eliminar perfil de Guardados' : 'Guardar perfil'}">${state.savedItems?.has(`person:${profile.id}`) ? '♥' : '♡'}</button></div>
        </div>
        <div class="person-card-body"><h2>${escapeHtml(name)}${profile.age ? `, ${profile.age}` : ''}</h2><p class="person-searching">${escapeHtml(seeking)} · ${escapeHtml(zone || 'Zona sin definir')}</p>
          <div class="person-traits">${traits.length ? traits.map(value => `<span>${escapeHtml(traitLabels[value] || value)}</span>`).join('') : '<span>Sin preferencias de convivencia</span>'}</div>
          <p>${escapeHtml(profile.bio || 'Bio sin completar')}</p>
          <div class="person-actions"><button type="button" data-connect data-user-id="${profile.id}">${escapeHtml(connectionButtonLabel(profile.id))}</button></div>
        </div>
      </article>`;
    }

    return { renderPersonCard };
  }

  window.ROOMS_FEED_PERSON_CARD_FEATURE = {
    create: createFeedPersonCardFeature
  };
})();
