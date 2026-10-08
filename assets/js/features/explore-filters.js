(function () {
  'use strict';

  function createExploreFiltersFeature({
    state,
    sortExploreListings,
    renderFilteredExplore,
    hideAllModals,
    notify
  }) {
    const exploreFiltersState = {
      zones: [],
      features: [],
      minPrice: null,
      maxPrice: null,
      kind: '',
      date: '',
      duration: '',
      rooms: null
    };

    function normalizeExploreValue(value) {
      return String(value || '')
        .trim()
        .toLocaleLowerCase('es')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    }

    function readExploreFiltersFromModal() {
      return {
        zones: [...document.querySelectorAll('[data-explore-zone][aria-pressed="true"]')]
          .map(button => button.dataset.exploreZone),

        features: [...document.querySelectorAll('[data-explore-feature][aria-pressed="true"]')]
          .map(button => button.dataset.exploreFeature),

        minPrice: Number(document.querySelector('#exploreBudgetMin')?.value) || null,
        maxPrice: Number(document.querySelector('#exploreBudgetMax')?.value) || null,

        kind: document.querySelector('#exploreTypeFilter')?.value || '',
        date: document.querySelector('#exploreDateFilter')?.value || '',
        duration: document.querySelector('#exploreDurationFilter')?.value || '',

        rooms: Number(document.querySelector('#exploreRoomsFilter')?.value) || null
      };
    }

    function listingMatchesExploreFilters(listing, filters) {
      const listingZone = normalizeExploreValue(listing.zone);

      if (filters.zones.length) {
        const matchesZone = filters.zones.some(zone =>
          listingZone.includes(normalizeExploreValue(zone))
        );

        if (!matchesZone) return false;
      }

      const price = Number(listing.price || 0);

      if (filters.minPrice !== null && price < filters.minPrice) {
        return false;
      }

      if (filters.maxPrice !== null && price > filters.maxPrice) {
        return false;
      }

      if (filters.kind && listing.kind !== filters.kind) {
        return false;
      }

      if (filters.date) {
        if (!listing.available_from) return false;

        const available = new Date(`${listing.available_from}T00:00:00`);
        const wanted = new Date(`${filters.date}T00:00:00`);

        if (available > wanted) return false;
      }

      if (filters.duration) {
        if (
          normalizeExploreValue(listing.duration) !==
          normalizeExploreValue(filters.duration)
        ) {
          return false;
        }
      }

      if (
        filters.rooms !== null &&
        Number(listing.rooms || 0) < filters.rooms
      ) {
        return false;
      }

      if (filters.features.length) {
        const listingFeatures = (listing.features || [])
          .map(normalizeExploreValue);

        const matchesAllFeatures = filters.features.every(feature =>
          listingFeatures.includes(normalizeExploreValue(feature))
        );

        if (!matchesAllFeatures) return false;
      }

      return true;
    }

    function getExploreResults(filters = exploreFiltersState) {
      let listings = [...state.listings.values()];

      listings = listings.filter(listing =>
        listingMatchesExploreFilters(listing, filters)
      );

      const query = normalizeExploreValue(
        document.querySelector('#exploreSearch')?.value
      );

      if (query) {
        listings = listings.filter(listing => {
          const haystack = normalizeExploreValue([
            listing.zone,
            listing.title,
            listing.description,
            ...(listing.features || [])
          ].join(' '));

          return haystack.includes(query);
        });
      }

      return sortExploreListings(listings);
    }

    function updateExploreFilterPreview() {
      const preview = readExploreFiltersFromModal();
      const listings = [...state.listings.values()]
        .filter(listing => listingMatchesExploreFilters(listing, preview));

      const button = document.querySelector('#applyExploreFilters');

      if (button) {
        button.textContent =
          `Ver ${listings.length} ${listings.length === 1 ? 'resultado' : 'resultados'}`;
      }
    }

    function resetExploreFilters() {
      exploreFiltersState.zones = [];
      exploreFiltersState.features = [];
      exploreFiltersState.minPrice = null;
      exploreFiltersState.maxPrice = null;
      exploreFiltersState.kind = '';
      exploreFiltersState.date = '';
      exploreFiltersState.duration = '';
      exploreFiltersState.rooms = null;

      document.querySelectorAll(
        '#exploreFilterModal [aria-pressed]'
      ).forEach(button => {
        button.setAttribute('aria-pressed', 'false');
      });

      [
        '#exploreBudgetMin',
        '#exploreBudgetMax',
        '#exploreDateFilter'
      ].forEach(selector => {
        const field = document.querySelector(selector);
        if (field) field.value = '';
      });

      [
        '#exploreTypeFilter',
        '#exploreDurationFilter',
        '#exploreRoomsFilter'
      ].forEach(selector => {
        const field = document.querySelector(selector);
        if (field) field.value = '';
      });

      renderFilteredExplore();
      updateExploreFilterPreview();
    }

    let realExploreSearchTimer;

    document.addEventListener('input', event => {
      if (event.target?.id === 'exploreSearch') {
        clearTimeout(realExploreSearchTimer);

        realExploreSearchTimer = setTimeout(() => {
          renderFilteredExplore();
        }, 220);

        return;
      }

      if (event.target.closest('#exploreFilterModal')) {
        updateExploreFilterPreview();
      }
    });

    document.addEventListener('change', event => {
      if (event.target.closest('#exploreFilterModal')) {
        updateExploreFilterPreview();
      }
    });

    document.addEventListener('click', event => {
      const zone = event.target.closest('[data-explore-zone]');

      if (zone) {
        const active = zone.getAttribute('aria-pressed') === 'true';
        zone.setAttribute('aria-pressed', String(!active));
        updateExploreFilterPreview();
        return;
      }

      const feature = event.target.closest('[data-explore-feature]');

      if (feature) {
        const active = feature.getAttribute('aria-pressed') === 'true';
        feature.setAttribute('aria-pressed', String(!active));
        updateExploreFilterPreview();
        return;
      }

      if (event.target.closest('#addExploreZone')) {
        const value = window.prompt('¿Qué zona quieres añadir?');

        if (!value?.trim()) return;

        const clean = value.trim();

        const exists = [...document.querySelectorAll('[data-explore-zone]')]
          .some(button =>
            normalizeExploreValue(button.dataset.exploreZone) ===
            normalizeExploreValue(clean)
          );

        if (!exists) {
          const button = document.createElement('button');

          button.type = 'button';
          button.dataset.exploreZone = clean;
          button.setAttribute('aria-pressed', 'true');
          button.textContent = clean;

          document.querySelector('#addExploreZone')
            ?.insertAdjacentElement('beforebegin', button);
        }

        updateExploreFilterPreview();
        return;
      }

      if (event.target.closest('[data-apply-explore-filters]')) {
        Object.assign(
          exploreFiltersState,
          readExploreFiltersFromModal()
        );

        renderFilteredExplore();
        hideAllModals();

        notify('Filtros aplicados');
        return;
      }

      if (event.target.closest('[data-clear-explore-filters]')) {
        resetExploreFilters();
        notify('Filtros eliminados');
      }
    });

    return {
      exploreFiltersState,
      normalizeExploreValue,
      readExploreFiltersFromModal,
      listingMatchesExploreFilters,
      getExploreResults,
      updateExploreFilterPreview,
      resetExploreFilters
    };
  }

  window.ROOMS_EXPLORE_FILTERS_FEATURE = {
    create: createExploreFiltersFeature
  };
})();
