(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function normalized(value) {
    return String(value ?? '').trim().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function pickItems(items, ownZones, getZones, limit = 2) {
    const zoneSet = new Set(ownZones.map(normalized).filter(Boolean));
    const ranked = items.map((item, order) => {
      const shared = getZones(item).find(zone => zoneSet.has(normalized(zone)));
      return { item, order, shared };
    });
    ranked.sort((a, b) => Number(Boolean(b.shared)) - Number(Boolean(a.shared)) || a.order - b.order);
    return ranked.slice(0, limit);
  }

  function render({ state, container = document.querySelector('#roomsHomeRecommendations') }) {
    if (!container || !state?.user) return;
    const ownZones = Array.isArray(state.profile?.zones) ? state.profile.zones : [];
    const blocked = state.blockedUsers || new Set();
    const listings = [...(state.listings?.values() || [])].filter(item =>
      item?.id && (!item.owner_id || !blocked.has(item.owner_id))
    );
    const profiles = [...(state.profiles?.values() || [])].filter(profile =>
      profile?.id && profile.id !== state.user.id && !blocked.has(profile.id)
    );
    const homes = pickItems(listings, ownZones, item => item.zone ? [item.zone] : []);
    const people = pickItems(profiles, ownZones, item => Array.isArray(item.zones) ? item.zones : []);

    function homeCard({ item, shared }) {
      const title = item.title || item.zone || 'Vivienda en Rooms';
      const price = Number(item.price);
      const priceText = item.price !== null && item.price !== undefined && Number.isFinite(price)
        ? `${price.toLocaleString('es-ES')} €/mes` : 'Precio por consultar';
      // ROOMS HOME 04: CONTEXTO PUBLICO
      const category = item.kind === 'apartment' ? 'Piso completo' : 'Habitación';
      const zone = typeof item.zone === 'string' ? item.zone.trim() : '';
      const reason = shared ? `Está en una de tus zonas: ${shared}` : 'Anuncio disponible para explorar';
      return `<article class="rooms-home-rec-card"><span class="rooms-home-rec-kicker">${escapeHtml(category)}</span><h3>${escapeHtml(title)}</h3>${zone ? `<span class="rooms-home-rec-sub">Zona: ${escapeHtml(zone)}</span>` : ''}<strong class="rooms-home-rec-price">${escapeHtml(priceText)}</strong><p>${escapeHtml(reason)}</p><button type="button" data-home-discover="homes">Explorar viviendas →</button></article>`;
    }
    function personCard({ item, shared }) {
      const name = item.alias || item.name || 'Persona en Rooms';
      const seekingLabels = { room: 'Busca habitación', home: 'Busca piso', mates: 'Busca compañeros' };
      const seeking = [...new Set((Array.isArray(item.seeking) ? item.seeking : [])
        .map(value => seekingLabels[value]).filter(Boolean))].join(' · ');
      const zones = (Array.isArray(item.zones) ? item.zones : [])
        .filter(value => typeof value === 'string' && value.trim())
        .slice(0, 2);
      const reason = shared ? `Buscáis en la misma zona: ${shared}` : 'Perfil disponible para explorar';
      return `<article class="rooms-home-rec-card"><span class="rooms-home-rec-kicker">PERSONA</span><h3>${escapeHtml(name)}</h3><span class="rooms-home-rec-sub">${escapeHtml(seeking || 'Búsqueda no especificada')}</span>${zones.length ? `<span class="rooms-home-rec-sub">Zonas: ${escapeHtml(zones.join(' · '))}</span>` : ''}<p>${escapeHtml(reason)}</p><button type="button" data-home-discover="people">Explorar personas →</button></article>`;
    }

    container.hidden = false;
    container.innerHTML = `<div class="rooms-home-rec-heading"><span>PARA EXPLORAR</span><h2>Un buen punto de partida.</h2><p>Selección de contenidos publicados. Las coincidencias de zona no representan una puntuación de compatibilidad.</p></div><div class="rooms-home-rec-columns"><section aria-label="Viviendas para explorar"><h3>Viviendas</h3>${homes.length ? homes.map(homeCard).join('') : '<p class="rooms-home-rec-empty">Todavía no hay viviendas disponibles.</p>'}</section><section aria-label="Personas para explorar"><h3>Personas</h3>${people.length ? people.map(personCard).join('') : '<p class="rooms-home-rec-empty">Todavía no hay perfiles disponibles.</p>'}</section></div>`;
    container.querySelectorAll('[data-home-discover]').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelector(`.rooms-home-next-actions [data-home-discover="${button.dataset.homeDiscover}"]`)?.click();
      });
    });
  }

  window.ROOMS_HOME_RECOMMENDATIONS = { render, pickItems };
})();
