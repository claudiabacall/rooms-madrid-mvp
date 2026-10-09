(function () {
  'use strict';

  function createFeedCoreFeature({
    state,
    renderListingCard,
    renderPersonCard,
    renderPostCard,
    renderCommunityCard
  }) {
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

      const activeFeedFilter =
        document.querySelector('[data-feed-filter].active');

      const activeFeedType =
        activeFeedFilter?.dataset.feedFilter || 'all';

      document
        .querySelectorAll('#personalFeed [data-feed-type]')
        .forEach(card => {
          card.hidden =
            activeFeedType !== 'all' &&
            card.dataset.feedType !== activeFeedType;
        });
    }

    return { renderRealFeed };
  }

  window.ROOMS_FEED_CORE_FEATURE = {
    create: createFeedCoreFeature
  };
})();
