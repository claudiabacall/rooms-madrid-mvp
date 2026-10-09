(function () {
  'use strict';

  function createListingDeleteFeature({
    db,
    state,
    notify,
    hideAllModals,
    loadRealContent,
    loadSavedItems
  }) {
    async function deleteOwnListing(listingId) {
      const listing = state.listings.get(listingId);
      if (!listing || listing.owner_id !== state.user.id) return notify('Solo puedes eliminar tus propios anuncios');
      const confirmed = window.confirm('¿Quieres eliminar este anuncio? Esta acción no se puede deshacer.');
      if (!confirmed) return;
      const button = document.querySelector('#editListingModal [data-delete-listing]');
      const message = document.querySelector('#editListingMessage');
      if (button) {
        button.disabled = true;
        button.textContent = 'Eliminando…';
      }
      if (message) message.textContent = '';
      const { data, error } = await db.from('listings').delete().eq('id', listingId).eq('owner_id', state.user.id).select('id');
      if (error || !data?.length) {
        console.error('Rooms: error al eliminar anuncio', error);
        if (button) {
          button.disabled = false;
          button.textContent = 'Eliminar anuncio';
        }
        if (message) message.textContent = 'No se pudo eliminar el anuncio. Inténtalo de nuevo.';
        return;
      }
      await db.from('saved_items').delete().eq('user_id', state.user.id).eq('item_id', listingId);
      const marker = '/storage/v1/object/public/listing-images/';
      const storagePaths = (listing.photos || []).map(url => {
        const index = String(url).indexOf(marker);
        return index >= 0 ? decodeURIComponent(String(url).slice(index + marker.length)) : null;
      }).filter(Boolean);
      if (storagePaths.length) db.storage.from('listing-images').remove(storagePaths);
      hideAllModals();
      await loadRealContent();
      await loadSavedItems();
      notify('Anuncio eliminado');
    }

    return {
      deleteOwnListing
    };
  }

  window.ROOMS_LISTING_DELETE_FEATURE = {
    create: createListingDeleteFeature
  };
})();
