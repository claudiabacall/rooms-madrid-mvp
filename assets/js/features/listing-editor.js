(function () {
  'use strict';

  function createListingEditorFeature({
    db,
    state,
    notify,
    showModal,
    renderEditListingPhotos,
    uploadListingPhotos,
    loadRealContent,
    loadSavedItems,
    refreshOwnActivity
  }) {
    function ensureEditListingModal() {
      let modal = document.querySelector('#editListingModal');
      if (modal) return modal;
      modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'editListingModal';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `<div class="backdrop" data-close></div>
        <article class="detail edit-listing-shell">
          <header><div><small>MI ANUNCIO</small><h2>Editar anuncio</h2></div><button type="button" data-close aria-label="Cerrar">×</button></header>
          <form id="editListingForm">
            <input id="editListingId" type="hidden">
            <label>Título<input id="editListingTitle" type="text" maxlength="100" required></label>
            <div class="edit-listing-grid">
              <label>Zona<input id="editListingZone" type="text" maxlength="80" required></label>
              <label>Precio mensual<input id="editListingPrice" type="number" min="1" step="1" required></label>
              <label>Fecha disponible<input id="editListingDate" type="date"></label>
              <label>Duración<input id="editListingDuration" type="text" maxlength="60" placeholder="Ej. Más de 1 año"></label>
              <label>Habitaciones<input id="editListingRooms" type="number" min="0" step="1"></label>
              <label>Baños<input id="editListingBaths" type="number" min="0" step="1"></label>
              <label>Superficie (m²)<input id="editListingArea" type="number" min="0" step="1"></label>
            </div>
            <label>Características<input id="editListingFeatures" type="text" placeholder="Amueblado, Terraza, Mascotas"></label>
            <label>Descripción<textarea id="editListingDescription" rows="5" maxlength="1500"></textarea></label>

            <section class="edit-listing-photo-manager">
              <div class="edit-listing-photo-heading">
                <div>
                  <small>FOTOGRAFÍAS</small>
                  <h3>Gestiona las fotos del anuncio</h3>
                </div>
                <span>La primera será la portada</span>
              </div>

              <div
                class="edit-listing-photo-grid"
                id="editListingPhotoGrid"
              ></div>

              <label class="edit-listing-add-photos">
                <span>＋ Añadir fotografías</span>
                <small>JPG, PNG, WEBP o HEIC</small>
                <input
                  id="editListingPhotos"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  multiple
                  hidden
                >
              </label>

              <p
                class="edit-listing-new-photo-count"
                id="editListingNewPhotoCount"
              ></p>
            </section>

            <p class="edit-listing-message" id="editListingMessage" role="status"></p>
            <div class="edit-listing-actions"><button class="delete-listing-button" type="button" data-delete-listing>Eliminar anuncio</button><button class="edit-listing-save" type="submit">Guardar cambios</button></div>
          </form>
        </article>`;
      document.body.appendChild(modal);
      modal.querySelector('#editListingForm').addEventListener('submit', saveListingEdits);
      return modal;
    }

    function openEditListing(listingId) {
      const listing = state.listings.get(listingId);
      if (!listing || listing.owner_id !== state.user.id) return notify('Solo puedes editar tus propios anuncios');
      const modal = ensureEditListingModal();
      modal.querySelector('#editListingId').value = listing.id;
      modal.querySelector('#editListingTitle').value = listing.title || '';
      modal.querySelector('#editListingZone').value = listing.zone || '';
      modal.querySelector('#editListingPrice').value = listing.price || '';
      modal.querySelector('#editListingDate').value = listing.available_from || '';
      modal.querySelector('#editListingDuration').value = listing.duration || '';
      modal.querySelector('#editListingRooms').value = listing.rooms ?? '';
      modal.querySelector('#editListingBaths').value = listing.baths ?? '';
      modal.querySelector('#editListingArea').value = listing.area ?? '';
      modal.querySelector('#editListingFeatures').value = (listing.features || []).join(', ');
      modal.querySelector('#editListingDescription').value = listing.description || '';
      state.editListingOriginalPhotos =
        [...(listing.photos || [])];

      state.editListingPhotos =
        [...(listing.photos || [])];

      modal.querySelector('#editListingPhotos').value = '';
      modal.querySelector('#editListingMessage').textContent = '';

      const newPhotoCount =
        modal.querySelector('#editListingNewPhotoCount');

      if (newPhotoCount) {
        newPhotoCount.textContent = '';
      }

      renderEditListingPhotos();
      showModal(modal);
    }

    async function saveListingEdits(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const listingId = form.querySelector('#editListingId').value;
      const listing = state.listings.get(listingId);
      if (!listing || listing.owner_id !== state.user.id) return;
      const submit = form.querySelector('.edit-listing-save');
      const message = form.querySelector('#editListingMessage');
      const files = [...form.querySelector('#editListingPhotos').files];
      const tooLarge = files.find(file => file.size > 10 * 1024 * 1024);
      if (tooLarge) {
        message.textContent = `${tooLarge.name} supera el límite de 10 MB.`;
        return;
      }
      submit.disabled = true;
      submit.textContent = 'Guardando…';
      message.textContent = '';
      let photos =
        [...(state.editListingPhotos || listing.photos || [])];

      if (files.length) {
        const uploaded =
          await uploadListingPhotos(listingId, files);

        photos = [...photos, ...uploaded];

        if (!uploaded.length) {
          message.textContent =
            'No se pudieron añadir las fotos, pero guardaremos el resto.';
        }
      }
      const numberOrNull = selector => {
        const value = form.querySelector(selector).value;
        return value === '' ? null : Number(value);
      };
      const features = form.querySelector('#editListingFeatures').value.split(',').map(item => item.trim()).filter(Boolean);
      const changes = {
        title: form.querySelector('#editListingTitle').value.trim(),
        zone: form.querySelector('#editListingZone').value.trim(),
        price: numberOrNull('#editListingPrice'),
        available_from: form.querySelector('#editListingDate').value || null,
        duration: form.querySelector('#editListingDuration').value.trim() || null,
        rooms: numberOrNull('#editListingRooms'),
        baths: numberOrNull('#editListingBaths'),
        area: numberOrNull('#editListingArea'),
        features,
        furnished: features.some(item => item.toLowerCase() === 'amueblado'),
        description: form.querySelector('#editListingDescription').value.trim() || null,
        photos
      };
      const { error } = await db.from('listings').update(changes).eq('id', listingId).eq('owner_id', state.user.id);
      submit.disabled = false;
      submit.textContent = 'Guardar cambios';
      if (error) {
        console.error('Rooms: error al editar anuncio', error);
        message.textContent = 'No se pudieron guardar los cambios. Inténtalo de nuevo.';
        return;
      }

      const originalPhotos =
        state.editListingOriginalPhotos || [];

      const removedPhotos =
        originalPhotos.filter(photo => !photos.includes(photo));

      if (removedPhotos.length) {
        const marker =
          '/storage/v1/object/public/listing-images/';

        const storagePaths =
          removedPhotos
            .map(url => {
              const index = url.indexOf(marker);
              if (index === -1) return null;

              return decodeURIComponent(
                url.slice(index + marker.length)
              );
            })
            .filter(Boolean);

        if (storagePaths.length) {
          const { error: storageError } =
            await db.storage
              .from('listing-images')
              .remove(storagePaths);

          if (storageError) {
            console.warn(
              'Rooms: no se pudieron limpiar algunas fotos eliminadas',
              storageError
            );
          }
        }
      }

      const editModal =
        document.querySelector('#editListingModal');

      if (editModal) {
        editModal.classList.remove('open');
        editModal.setAttribute('aria-hidden', 'true');
      }

      document.body.style.overflow = '';

      await loadRealContent();
      await loadSavedItems();

      refreshOwnActivity('listings');

      notify('Anuncio actualizado');
    }

    return {
      ensureEditListingModal,
      openEditListing,
      saveListingEdits
    };
  }

  window.ROOMS_LISTING_EDITOR_FEATURE = {
    create: createListingEditorFeature
  };
})();
