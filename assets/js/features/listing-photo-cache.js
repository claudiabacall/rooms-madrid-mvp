(function () {
  'use strict';

  function create({ view, now = () => Date.now() }) {
    if (typeof view?.projectListing !== 'function') {
      throw new Error('Rooms: falta Listing Photo View');
    }

    const cache = new Map();
    const pending = new Map();
    const versions = new Map();
    let generation = 0;

    const MAX_AGE_MS = 45000;

    function keyFor(listing) {
      return JSON.stringify([
        listing.owner_id,
        listing.status,
        listing.photos
      ]);
    }

    function invalidate(listingId) {
      generation++;
      if (listingId == null) {
        cache.clear();
        pending.clear();
        versions.clear();
        return;
      }

      const id = String(listingId);
      versions.set(id, (versions.get(id) || 0) + 1);
      cache.delete(id);
      pending.delete(id);
    }

    async function resolve(listing) {
      if (!listing || listing.id == null) return null;

      const id = String(listing.id);
      const key = keyFor(listing);
      const version = versions.get(id) || 0;
      const currentGeneration = generation;
      const existing = cache.get(id);

      if (
        existing &&
        existing.key === key &&
        existing.version === version &&
        now() < existing.expires
      ) {
        return {
          ...listing,
          photos: [...existing.photos]
        };
      }

      const running = pending.get(id);

      if (
        running &&
        running.key === key &&
        running.version === version
      ) {
        return running.promise.then(photos => ({
          ...listing,
          photos: [...photos]
        }));
      }

      const startedAt = now();

      const task = (async () => {
        const projected = await view.projectListing(listing);
        const photos = Array.isArray(projected?.photos)
          ? projected.photos.filter(url =>
              typeof url === 'string' && url.length > 0
            )
          : [];

        // No almacenar fallos ni autorizaciones parciales.
        if (
          photos.length === (listing.photos || []).length &&
          photos.length > 0 &&
          (versions.get(id) || 0) === version &&
          generation === currentGeneration &&
          pending.get(id)?.promise === task
        ) {
          cache.set(id, {
            key,
            version,
            photos: [...photos],
            expires: startedAt + MAX_AGE_MS
          });
        }

        // No entregar respuestas emitidas antes de una invalidacion.
        if (
          generation !== currentGeneration ||
          (versions.get(id) || 0) !== version ||
          pending.get(id)?.promise !== task
        ) {
          return [];
        }
        return photos;
      })();

      pending.set(id, { key, version, promise: task });

      try {
        const photos = await task;
        return { ...listing, photos: [...photos] };
      } finally {
        if (pending.get(id)?.promise === task) {
          pending.delete(id);
        }
      }
    }

    return { resolve, invalidate };
  }

  window.ROOMS_LISTING_PHOTO_CACHE = { create };
})();
