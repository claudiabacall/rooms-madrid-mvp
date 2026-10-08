(function () {
  'use strict';

  function createListingPhotosFeature({
    state,
    escapeHtml
  }) {
    function renderEditListingPhotos() {
      const grid =
        document.querySelector('#editListingPhotoGrid');

      if (!grid) return;

      const photos =
        state.editListingPhotos || [];

      if (!photos.length) {
        grid.innerHTML = `
          <div class="edit-listing-no-photos">
            <span>⌂</span>
            <b>Este anuncio no tiene fotografías</b>
            <small>Añade una para mejorar el anuncio.</small>
          </div>
        `;
        return;
      }

      grid.innerHTML = `
        <div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:4px;">
          <div>
            <small style="display:block;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7a7a72;margin-bottom:4px;">Fotografías</small>
            <h3 style="margin:0;font-size:22px;line-height:1.05;letter-spacing:-.03em;color:#111;">Reordena, elige portada o elimina</h3>
          </div>
          <p style="margin:0;font-size:13px;font-weight:600;color:#7a7a72;text-align:right;">La primera imagen será la portada del anuncio</p>
        </div>
      ` + photos.map((photo, index) => `
        <article
          class="edit-listing-photo-card"
          draggable="true"
          data-edit-photo-index="${index}"
        >
          <div class="edit-listing-photo-image">
            <img
              src="${escapeHtml(photo)}"
              alt="Foto ${index + 1} del anuncio"
            >

            ${
              index === 0
                ? `<span class="edit-listing-cover-label">
                    PORTADA
                  </span>`
                : `<span class="edit-listing-photo-number">
                    ${index + 1}
                  </span>`
            }
          </div>

          <div class="edit-listing-photo-actions">
            <button
              type="button"
              data-edit-photo-left="${index}"
              aria-label="Mover foto a la izquierda"
              ${index === 0 ? 'disabled' : ''}
            >
              ←
            </button>

            <button
              type="button"
              data-edit-photo-right="${index}"
              aria-label="Mover foto a la derecha"
              ${index === photos.length - 1 ? 'disabled' : ''}
            >
              →
            </button>

            ${
              index !== 0
                ? `<button
                    type="button"
                    data-edit-photo-cover="${index}"
                  >
                    Hacer portada
                  </button>`
                : ''
            }

            <button
              type="button"
              class="edit-listing-photo-delete"
              data-edit-photo-delete="${index}"
            >
              Eliminar
            </button>
          </div>
        </article>
      `).join('');
    }

    function moveEditListingPhoto(from, to) {
      const photos =
        [...(state.editListingPhotos || [])];

      if (
        from < 0 ||
        to < 0 ||
        from >= photos.length ||
        to >= photos.length ||
        from === to
      ) return;

      const [photo] = photos.splice(from, 1);
      photos.splice(to, 0, photo);

      state.editListingPhotos = photos;
      renderEditListingPhotos();
    }

    function deleteEditListingPhoto(index) {
      const photos =
        [...(state.editListingPhotos || [])];

      if (index < 0 || index >= photos.length) return;

      photos.splice(index, 1);

      state.editListingPhotos = photos;
      renderEditListingPhotos();
    }

    function makeEditListingPhotoCover(index) {
      const photos =
        [...(state.editListingPhotos || [])];

      if (index <= 0 || index >= photos.length) return;

      const [photo] = photos.splice(index, 1);
      photos.unshift(photo);

      state.editListingPhotos = photos;
      renderEditListingPhotos();
    }

    return {
      renderEditListingPhotos,
      moveEditListingPhoto,
      deleteEditListingPhoto,
      makeEditListingPhotoCover
    };
  }

  window.ROOMS_LISTING_PHOTOS_FEATURE = {
    create: createListingPhotosFeature
  };
})();
