(function () {
  'use strict';

  function create({ db, references }) {
    if (
      !db?.storage?.from ||
      typeof references?.fromListing !== 'function'
    ) {
      throw new Error('Rooms: dependencias de fotos incompletas');
    }

    const storage = db.storage.from('listing-images');

    async function resolveListing(listing) {
      const items = references.fromListing(listing);

      const urls = [];

      for (const item of items) {
        if (!item) {
          urls.push(null);
          continue;
        }

        try {
          const { data, error } =
            await storage.createSignedUrl(item.path, 60);

          if (
            error ||
            typeof data?.signedUrl !== 'string' ||
            !data.signedUrl
          ) {
            urls.push(null);
            continue;
          }

          urls.push(data.signedUrl);
        } catch {
          urls.push(null);
        }
      }

      return urls;
    }

    return { resolveListing };
  }

  window.ROOMS_LISTING_PHOTO_RESOLVER = { create };
})();
