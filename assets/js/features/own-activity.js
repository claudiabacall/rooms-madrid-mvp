(function () {
  'use strict';

  function createOwnActivityFeature({
    state,
    escapeHtml,
    relativeTime
  }) {
  function refreshOwnActivity(type) {
    if (!state.user) return;
    const active = type || document.querySelector('[data-own-activity].active')?.dataset.ownActivity || 'posts';
    const ownListings = [...state.listings.values()].filter(item => item.owner_id === state.user.id);
    const ownPosts = [...state.posts.values()].filter(item => item.author_id === state.user.id);
    const counts = {
      posts: ownPosts.length,
      listings: ownListings.length
    };

    const tabNames = {
      posts: 'Publicaciones',
      listings: 'Anuncios'
    };

    document
      .querySelectorAll('[data-own-activity]')
      .forEach(tab => {
        const type = tab.dataset.ownActivity;

        tab.textContent =
          `${tabNames[type]} (${counts[type] || 0})`;

        tab.classList.toggle(
          'active',
          type === active
        );
      });
    renderOwnActivity(active, ownListings, ownPosts);
  }

  function renderOwnActivity(type, ownListings, ownPosts) {
    const target = document.querySelector('#ownActivityPreview');
    if (!target) return;
    if (type === 'listings' && ownListings.length) {
      target.innerHTML = `<div class="own-real-activity-list">${ownListings.map(listing => {
        const kind = listing.kind === 'apartment' ? 'Piso entero' : 'Habitación';
        const photo = listing.photos?.[0];
        return `<article class="own-real-listing" data-real-listing="${listing.id}">
          ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(listing.title)}">` : '<div class="own-listing-placeholder">rooms.</div>'}
          <div><small>${escapeHtml(kind)}</small><h3>${
            listing.price != null
              ? `${Number(listing.price).toLocaleString('es-ES')} €/mes`
              : 'Precio sin definir'
          } · ${escapeHtml(listing.zone || 'Zona sin definir')}</h3><p>${escapeHtml(listing.description || 'Sin descripción')}</p><button type="button" data-edit-listing="${listing.id}">Editar anuncio</button></div>
        </article>`;
      }).join('')}</div>`;
      return;
    }
    if (type === 'posts' && ownPosts.length) {
      target.innerHTML = `<div class="own-real-activity-list">${ownPosts.map(post => `<article class="own-real-post"><small>${relativeTime(post.created_at)}</small><p>${escapeHtml(post.body)}</p></article>`).join('')}</div>`;
      return;
    }
    const labels = {
      posts: 'publicaciones',
      listings: 'anuncios'
    };
    target.innerHTML = `<small>TODAVÍA VACÍO</small><p>Aún no tienes ${labels[type] || 'actividad'}.</p><span>Cuando empieces a usar Rooms aparecerá aquí.</span>`;
  }

    return {
      refreshOwnActivity,
      renderOwnActivity
    };
  }

  window.ROOMS_OWN_ACTIVITY_FEATURE = {
    create: createOwnActivityFeature
  };
})();
