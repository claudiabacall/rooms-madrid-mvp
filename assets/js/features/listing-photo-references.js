(function () {
  'use strict';

  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const PUBLIC_PREFIX =
    '/storage/v1/object/public/listing-images/';

  function create({ supabaseUrl }) {
    if (!supabaseUrl) {
      throw new Error('Rooms: falta URL de Supabase');
    }

    const origin = new URL(supabaseUrl).origin;

    function parse(reference, { ownerId, listingId } = {}) {
      if (typeof reference !== 'string' || !reference) {
        return null;
      }

      let path;

      if (/^https?:\/\//i.test(reference)) {
        let url;

        try {
          url = new URL(reference);
        } catch {
          return null;
        }

        if (
          url.origin !== origin ||
          !url.pathname.startsWith(PUBLIC_PREFIX) ||
          url.username ||
          url.password
        ) {
          return null;
        }

        path = url.pathname.slice(PUBLIC_PREFIX.length);
      } else {
        path = reference;
      }

      try {
        path = decodeURIComponent(path);
      } catch {
        return null;
      }

      const segments = path.split('/');

      if (segments.length !== 3) return null;

      const [folderOwner, folderListing, filename] = segments;

      if (
        !UUID.test(folderOwner) ||
        !UUID.test(folderListing) ||
        !filename ||
        filename === '.' ||
        filename === '..' ||
        /[\\/\x00-\x1f\x7f]/.test(filename)
      ) {
        return null;
      }

      if (
        ownerId &&
        folderOwner.toLowerCase() !== String(ownerId).toLowerCase()
      ) {
        return null;
      }

      if (
        listingId &&
        folderListing.toLowerCase() !== String(listingId).toLowerCase()
      ) {
        return null;
      }

      return {
        bucket: 'listing-images',
        path,
        ownerId: folderOwner,
        listingId: folderListing
      };
    }

    function fromListing(listing) {
      if (!listing || !Array.isArray(listing.photos)) {
        return [];
      }

      return listing.photos.map(reference =>
        parse(reference, {
          ownerId: listing.owner_id,
          listingId: listing.id
        })
      );
    }

    return {
      parse,
      fromListing
    };
  }

  window.ROOMS_LISTING_PHOTO_REFERENCES = { create };
})();
