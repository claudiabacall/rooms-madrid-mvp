(function () {
  'use strict';

  function createPublishMediaFeature({ db, state }) {
    async function uploadCommunityPostMedia(
      postId,
      files
    ) {
      const urls = [];

      for (
        const [index, file]
        of files.entries()
      ) {
        const extension =
          (
            file.name.split('.').pop() ||
            'jpg'
          )
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        const storagePath =
          `${state.user.id}/${postId}/${Date.now()}-${index}.${extension}`;

        const { error } =
          await db.storage
            .from('community-post-media')
            .upload(
              storagePath,
              file,
              {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
              }
            );

        if (error) {
          console.error(
            'Rooms: error subiendo imagen de publicación',
            error
          );
          continue;
        }

        const { data } =
          db.storage
            .from('community-post-media')
            .getPublicUrl(storagePath);

        if (data?.publicUrl) {
          urls.push(data.publicUrl);
        }
      }

      return urls;
    }


    async function uploadListingPhotos(listingId, files) {
      const urls = [];
      for (const [index, file] of files.entries()) {
        const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `${state.user.id}/${listingId}/${Date.now()}-${index}.${extension}`;
        const { error } = await db.storage.from('listing-images').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });
        if (error) {
          console.error('Rooms: error al subir imagen', error);
          continue;
        }
        const { data } = db.storage.from('listing-images').getPublicUrl(path);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }
      return urls;
    }

    return {
      uploadCommunityPostMedia,
      uploadListingPhotos
    };
  }

  window.ROOMS_PUBLISH_MEDIA_FEATURE = {
    create: createPublishMediaFeature
  };
})();
