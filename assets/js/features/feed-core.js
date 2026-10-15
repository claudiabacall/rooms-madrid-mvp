(function () {
  'use strict';

  function createFeedCoreFeature({
    state,
    renderListingCard,
    renderPersonCard,
    renderPostCard,
    renderCommunityCard
  }) {
    // ROOMS HOME FEED PAGING 03
    const PAGE_SIZE = 12;
    let shown = PAGE_SIZE;
    let currentType = 'all';
    let moreButton = null;

    function applyFilter(type = 'all', reset = false) {
      const feed = document.querySelector('#personalFeed');
      if (!feed) return;
      if (reset || currentType !== type) shown = PAGE_SIZE;
      currentType = type;
      const cards = [...feed.querySelectorAll('[data-feed-type]')];
      const matches = cards.filter(card => type === 'all' || card.dataset.feedType === type);
      cards.forEach(card => { card.hidden = true; });
      matches.slice(0, shown).forEach(card => { card.hidden = false; });
      if (moreButton) {
        const remaining = Math.max(0, matches.length - shown);
        moreButton.hidden = remaining === 0;
        moreButton.textContent = `Ver más publicaciones (${remaining} restantes)`;
      }
    }

    function ensureButton(feed) {
      if (!moreButton || !moreButton.isConnected) {
        moreButton = document.createElement('button');
        moreButton.type = 'button';
        moreButton.className = 'rooms-home-more';
        moreButton.setAttribute('aria-controls', 'personalFeed');
        moreButton.addEventListener('click', () => {
          shown += PAGE_SIZE;
          applyFilter(currentType);
        });
      }
      feed.insertAdjacentElement('afterend', moreButton);
    }
    window.ROOMS_HOME_FEED_PAGING = { applyFilter };

    function renderRealFeed(listings, profiles, posts, communities) {
      const feed = document.querySelector('#personalFeed');
      if (!feed) return;

      const visibleProfiles =
        (profiles || []).filter(profile =>
          profile?.id &&
          !state.blockedUsers?.has(profile.id)
        );

      const items = [
        ...listings.map(item => ({
          type: 'listing',
          created_at: item.created_at,
          html: renderListingCard(item)
        })),
        ...visibleProfiles.map(item => ({
          type: 'profile',
          created_at: item.created_at,
          html: renderPersonCard(item)
        })),
        ...communities.map(item => ({
          type: 'community',
          created_at: item.created_at,
          html: renderCommunityCard(item)
        })),
        ...posts.map(item => ({
          type: 'post',
          created_at: item.created_at,
          html: renderPostCard(item)
        }))
      ]
        .filter(item => item.html)
        .sort((a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
        );

      const cards = items.map(item => item.html);

      feed.innerHTML = cards.length ? cards.join('') : `
        <section class="real-feed-empty">
          <span>✦</span><h2>Todavía no hay contenido en Rooms</h2>
          <p>Los perfiles, viviendas y publicaciones aparecerán aquí cuando la comunidad los cree.</p>
          <button type="button" data-open-real-publish>Crear lo primero</button>
        </section>`;

      ensureButton(feed);
      const type = document.querySelector('[data-feed-filter].active')?.dataset.feedFilter || 'all';
      applyFilter(type, true);
    }

    return { renderRealFeed };
  }

  window.ROOMS_FEED_CORE_FEATURE = {
    create: createFeedCoreFeature
  };
})();
