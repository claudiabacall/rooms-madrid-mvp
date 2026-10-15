(function () {
  'use strict';

  function createExploreLeafletMapFeature({
    escapeHtml,
    renderRealMapCard
  }) {
  let exploreLeafletMap = null;
  let exploreLeafletMarkers = new Map();
  let pendingMapResize = null;

  function destroyExploreLeafletMap() {
    if (pendingMapResize !== null) {
      window.clearTimeout(pendingMapResize);
      pendingMapResize = null;
    }

    if (exploreLeafletMap) {
      exploreLeafletMap.remove();
      exploreLeafletMap = null;
    }

    exploreLeafletMarkers.clear();
  }

  function initExploreLeafletMap(listings) {
    const container = document.querySelector('#realExploreMap');

    if (!container || !window.L) return;

    destroyExploreLeafletMap();

    const madridCenter = [40.4168, -3.7038];

    exploreLeafletMap = window.L.map(container, {
      zoomControl: true,
      attributionControl: true
    }).setView(madridCenter, 12);

    window.L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }
    ).addTo(exploreLeafletMap);

    const validListings = listings.filter(item => {
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);

      return (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      );
    });

    const bounds = [];

    validListings.forEach((item, index) => {
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);
      const price =
        item.price != null
          ? `${Number(item.price).toLocaleString('es-ES')} €`
          : 'Sin precio';

      const icon = window.L.divIcon({
        className:
          `rooms-map-price-marker${index === 0 ? ' active' : ''}`,
        html: `<span>${escapeHtml(price)}</span>`,
        iconSize: null,
        iconAnchor: [0, 0]
      });

      const marker = window.L.marker(
        [latitude, longitude],
        {
          icon,
          title: item.title || item.zone || 'Vivienda'
        }
      ).addTo(exploreLeafletMap);

      marker.on('click', () => {
        const card = document.querySelector('#realMapCard');

        if (card) {
          card.innerHTML = renderRealMapCard(item);
          card.dataset.mapSelected = item.id;
        }

        document
          .querySelectorAll('.rooms-map-price-marker')
          .forEach(element => {
            element.classList.remove('active');
          });

        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.classList.add('active');
        }
      });

      exploreLeafletMarkers.set(item.id, marker);
      bounds.push([latitude, longitude]);
    });

    if (bounds.length > 1) {
      exploreLeafletMap.fitBounds(bounds, {
        padding: [55, 55],
        maxZoom: 14
      });
    } else if (bounds.length === 1) {
      exploreLeafletMap.setView(bounds[0], 14);
    }

    function updateVisibleMapListings() {
      if (!exploreLeafletMap) return;

      const mapBounds = exploreLeafletMap.getBounds();

      const visibleListings = validListings.filter(item => {
        return mapBounds.contains([
          Number(item.latitude),
          Number(item.longitude)
        ]);
      });

      const count = document.querySelector('#mapVisibleCount');

      if (count) {
        count.textContent =
          `${visibleListings.length} ${
            visibleListings.length === 1
              ? 'vivienda en esta zona'
              : 'viviendas en esta zona'
          }`;

        count.hidden = false;
      }

      const card = document.querySelector('#realMapCard');

      if (!visibleListings.length) {
        if (card) {
          card.hidden = true;
          card.dataset.mapSelected = '';
        }

        document
          .querySelectorAll('.rooms-map-price-marker')
          .forEach(element => {
            element.classList.remove('active');
          });

        return;
      }

      if (card) {
        const selectedId = card.dataset.mapSelected;

        const selectedStillVisible = visibleListings.some(
          item => item.id === selectedId
        );

        if (!selectedStillVisible) {
          const next = visibleListings[0];

          card.hidden = false;
          card.dataset.mapSelected = next.id;
          card.innerHTML = renderRealMapCard(next);

          document
            .querySelectorAll('.rooms-map-price-marker')
            .forEach(element => {
              element.classList.remove('active');
            });

          const marker = exploreLeafletMarkers.get(next.id);
          const markerElement = marker?.getElement();

          if (markerElement) {
            markerElement.classList.add('active');
          }
        } else {
          card.hidden = false;
        }
      }
    }

    exploreLeafletMap.on('moveend zoomend', updateVisibleMapListings);

    const initializedMap = exploreLeafletMap;

    pendingMapResize = window.setTimeout(() => {
      pendingMapResize = null;

      if (exploreLeafletMap !== initializedMap) return;

      initializedMap.invalidateSize();
      updateVisibleMapListings();
    }, 80);
  }

    return {
      destroyExploreLeafletMap,
      initExploreLeafletMap
    };
  }

  window.ROOMS_EXPLORE_LEAFLET_MAP_FEATURE = {
    create: createExploreLeafletMapFeature
  };
})();
