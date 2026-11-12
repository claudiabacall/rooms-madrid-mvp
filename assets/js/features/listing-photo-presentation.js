(function () {
  'use strict';

  function create({ cache }) {
    if (typeof cache?.resolve !== 'function') {
      throw new Error('Rooms: falta Listing Photo Cache');
    }

    const display = new Map();
    let generation = 0;

    function signature(listing) {
      return JSON.stringify([
        listing.owner_id,
        listing.status,
        listing.photos
      ]);
    }

    function get(listing) {
      if (!listing || typeof listing !== 'object') {
        return null;
      }

      const stored = display.get(String(listing.id));

      const photos =
        stored && stored.signature === signature(listing)
          ? [...stored.photos]
          : [];

      // Siempre devolver una copia: los datos originales
      // se siguen usando para editar y eliminar.
      return { ...listing, photos };
    }

    function invalidate(listingId) {
      // Cancelar la publicacion de cargas anteriores.
      generation++;

      if (listingId == null) {
        display.clear();
      } else {
        display.delete(String(listingId));
      }
    }

    async function prepare(listings) {
      const items = Array.isArray(listings) ? listings : [];
      const currentGeneration = ++generation;
      const results = new Array(items.length);
      let next = 0;

      const workers = Array.from({
        length: Math.min(4, items.length)
      }, async () => {
        while (next < items.length) {
          if (generation !== currentGeneration) return;

          const index = next++;
          const listing = items[index];

          try {
            const projected = await cache.resolve(listing);

            results[index] = {
              listing,
              photos: Array.isArray(projected?.photos)
                ? projected.photos.filter(url =>
                    typeof url === 'string' &&
                    url.length > 0
                  )
                : []
            };
          } catch {
            results[index] = { listing, photos: [] };
          }
        }
      });

      await Promise.all(workers);

      if (generation !== currentGeneration) {
        return false;
      }

      display.clear();

      for (const result of results) {
        if (!result?.listing?.id) continue;

        display.set(String(result.listing.id), {
          signature: signature(result.listing),
          photos: [...result.photos]
        });
      }

      return true;
    }

    return {
      get,
      prepare,
      invalidate
    };
  }

  window.ROOMS_LISTING_PHOTO_PRESENTATION = { create };
})();
