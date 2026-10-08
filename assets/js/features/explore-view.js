(function () {
  'use strict';

  function createExploreViewFeature({
    state,
    renderFilteredExplore,
    renderRealMapCard
  }) {
function sortExploreListings(listings) {
      const mode = document.querySelector('#exploreSort')?.value || 'recent';
      const result = [...listings];

      if (mode === 'price') {
        result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      } else {
        result.sort((a, b) => {
          const aDate = new Date(a.created_at || 0).getTime();
          const bDate = new Date(b.created_at || 0).getTime();
          return bDate - aDate;
        });
      }

      return result;
    }

    document.addEventListener('change', event => {
      if (event.target?.id !== 'exploreSort') return;
      renderFilteredExplore();
    });


    document.addEventListener('click', event => {
      const viewToggle =
        event.target.closest('[data-explore-view]');

      if (viewToggle) {
        event.preventDefault();

        document
          .querySelectorAll('[data-explore-view]')
          .forEach(button => {
            button.classList.toggle(
              'active',
              button === viewToggle
            );
          });

        renderFilteredExplore();
        return;
      }

      const pin = event.target.closest('[data-real-map-pin]');

      if (pin) {
        event.preventDefault();

        document.querySelectorAll('[data-real-map-pin]').forEach(item => {
          item.classList.toggle('active', item === pin);
        });

        const listing = state.listings.get(pin.dataset.realMapPin);

        if (!listing) return;

        const card = document.querySelector('#realMapCard');
        if (card) {
          card.innerHTML = renderRealMapCard(listing);
        }

        return;
      }

      const openButton = event.target.closest('[data-real-map-open]');

      if (openButton) {
        event.preventDefault();

        const listing = state.listings.get(openButton.dataset.realMapOpen);

        if (!listing) return;

        const matchingCard = document.querySelector(
          `[data-real-listing="${listing.id}"]`
        );

        if (matchingCard) {
          matchingCard.click();
        }
      }
    });

    return {
      sortExploreListings
    };
  }

  window.ROOMS_EXPLORE_VIEW_FEATURE = {
    create: createExploreViewFeature
  };
})();
