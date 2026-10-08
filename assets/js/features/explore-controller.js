(function () {
  'use strict';

  function createExploreControllerFeature({
    getExplorePeople,
    renderExplorePeople,
    updateConnectButtons,
    getExploreCommunities,
    renderExploreCommunities,
    getExploreResults,
    renderRealExplore,
    exploreFiltersState
  }) {
    function renderFilteredExplore() {
      const mode =
        document.querySelector('[data-explore-mode].active')
          ?.dataset.exploreMode || 'homes';

      const list = document.querySelector('#exploreList');
      const map = document.querySelector('#exploreMap');
      const empty = document.querySelector('#exploreEmpty');

      if (mode === 'people') {
        const profiles = getExplorePeople();

        if (list) list.hidden = false;
        if (map) map.hidden = true;
        if (empty) empty.hidden = true;

        renderExplorePeople(profiles);
        updateConnectButtons();
        return;
      }

      if (mode === 'communities') {
        const communities =
          getExploreCommunities();

        if (list) list.hidden = false;
        if (map) map.hidden = true;
        if (empty) empty.hidden = true;

        renderExploreCommunities(communities);
        return;
      }

      const listings = getExploreResults();

      renderRealExplore(listings);

      const mapActive =
        document.querySelector('[data-explore-view="map"]')
          ?.classList.contains('active');

      if (list) list.hidden = Boolean(mapActive);
      if (map) map.hidden = !mapActive;

      if (empty) {
        empty.hidden = listings.length !== 0;
      }

      const filterCount =
        document.querySelector('#exploreFilterCount');

      const activeCount =
        exploreFiltersState.zones.length +
        exploreFiltersState.features.length +
        Number(exploreFiltersState.minPrice !== null) +
        Number(exploreFiltersState.maxPrice !== null) +
        Number(Boolean(exploreFiltersState.kind)) +
        Number(Boolean(exploreFiltersState.date)) +
        Number(Boolean(exploreFiltersState.duration)) +
        Number(exploreFiltersState.rooms !== null);

      if (filterCount) {
        filterCount.textContent = activeCount;
        filterCount.hidden = activeCount === 0;
      }
    }

    document.addEventListener('click', event => {
        const modeButton =
          event.target.closest('[data-explore-mode]');

        if (modeButton) {
          const mode = modeButton.dataset.exploreMode;

          document
            .querySelectorAll('[data-explore-mode]')
            .forEach(button => {
              button.classList.toggle(
                'active',
                button === modeButton
              );
            });

          const search =
            document.querySelector('#exploreSearch');

          const filters =
            document.querySelector('#exploreFilters');

          const controls =
            document.querySelector('#exploreView .explore-controls');

          if (mode === 'people') {
            if (search) {
              search.value = '';
              search.placeholder =
                'Busca personas, zonas o perfiles';
            }

            if (filters) filters.hidden = true;
            if (controls) controls.hidden = true;

          } else if (mode === 'communities') {
            if (search) {
              search.value = '';
              search.placeholder =
                'Busca comunidades';
            }

            if (filters) filters.hidden = true;
            if (controls) controls.hidden = true;

          } else {
            if (search) {
              search.value = '';
              search.placeholder =
                '¿Dónde quieres vivir?';
            }

            if (filters) filters.hidden = false;
            if (controls) controls.hidden = false;
          }

          renderFilteredExplore();
          return;
        }
    });

    return {
      renderFilteredExplore
    };
  }

  window.ROOMS_EXPLORE_CONTROLLER_FEATURE = {
    create: createExploreControllerFeature
  };
})();
