(function () {
  'use strict';

  function createPublishGeocodingFeature() {
    async function geocodeListingAddress(address) {
      const cleanAddress =
        String(address || '').trim();

      if (cleanAddress.length < 5) {
        throw new Error(
          'Introduce la dirección exacta de la vivienda'
        );
      }

      const response = await fetch(
        '/api/geocode',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            address: cleanAddress
          })
        }
      );

      let payload = {};

      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        throw new Error(
          payload.error ||
          'No hemos podido localizar esa dirección'
        );
      }

      const latitude =
        Number(payload.latitude);

      const longitude =
        Number(payload.longitude);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        throw new Error(
          'No hemos podido localizar esa dirección'
        );
      }

      const result = {
        latitude,
        longitude,
        formattedAddress:
          payload.formattedAddress ||
          cleanAddress,
        district:
          payload.district || null
      };

      const detectedZone =
        document.querySelector('[data-detected-zone]');

      if (detectedZone) {
        detectedZone.hidden = false;
        detectedZone.textContent =
          result.district
            ? `Ubicación detectada: ${result.district}, Madrid`
            : 'Ubicación detectada: Madrid';
      }

      return result;
    }

    return { geocodeListingAddress };
  }

  window.ROOMS_PUBLISH_GEOCODING_FEATURE = {
    create: createPublishGeocodingFeature
  };
})();
