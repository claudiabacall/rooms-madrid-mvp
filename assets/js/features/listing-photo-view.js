(function () {
  'use strict';

  function create({ resolver }) {
    if (
      !resolver ||
      typeof resolver.resolveListing !== 'function'
    ) {
      throw new Error('Rooms: falta resolvedor de fotos');
    }

    async function projectListing(listing) {
      if (!listing || typeof listing !== 'object') {
        return null;
      }

      // No modificar los datos originales.
      const display = { ...listing };

      if (
        !Array.isArray(listing.photos) ||
        listing.photos.length === 0
      ) {
        display.photos = [];
        return display;
      }

      try {
        const urls = await resolver.resolveListing(listing);

        // Solo URLs autorizadas.
        // Nunca utilizar la URL publica como fallback.
        display.photos = Array.isArray(urls)
          ? urls.filter(url =>
              typeof url === 'string' && url.length > 0
            )
          : [];
      } catch {
        display.photos = [];
      }

      return display;
    }

    async function projectListings(listings) {
      if (!Array.isArray(listings)) return [];

      const results = new Array(listings.length);
      let nextIndex = 0;

      // Limitar solicitudes simultaneas.
      const workerCount = Math.min(4, listings.length);

      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (nextIndex < listings.length) {
            const index = nextIndex++;
            results[index] = await projectListing(
              listings[index]
            );
          }
        })
      );

      return results;
    }

    return {
      projectListing,
      projectListings
    };
  }

  window.ROOMS_LISTING_PHOTO_VIEW = { create };
})();
