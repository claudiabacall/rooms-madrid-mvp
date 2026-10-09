(function () {
  'use strict';

  function createPublishCommunityFieldsFeature({
    state,
    escapeHtml
  }) {
    function selectedCommunityPostType(content) {
      const selected =
        [...content.querySelectorAll(
          '[data-selectable][aria-pressed="true"]'
        )]
          .map(button => button.textContent.trim())
          .find(Boolean);

      return selected || 'Pregunta';
    }


    function renderCommunityPostFields(content) {
      if (!content) return;

      const existing =
        content.querySelector('#communityPostExtraFields');

      if (existing) existing.remove();

      const textarea =
        content.querySelector('textarea');

      if (!textarea) return;

      const type =
        selectedCommunityPostType(content);

      const ownListings =
        [...state.listings.values()]
          .filter(
            listing =>
              listing.owner_id === state.user?.id &&
              listing.status === 'published'
          );

      let fields = '';


      if (type === 'Pregunta') {
        fields = `
          <label class="community-post-extra-field">
            <span>Zona <small>Opcional</small></span>
            <input
              type="text"
              data-post-zone
              placeholder="Ej. Chamberí"
            >
          </label>
        `;
      }


      if (type === 'Recomendación') {
        fields = `
          <label class="community-post-extra-field">
            <span>¿Dónde?</span>
            <input
              type="text"
              data-post-zone
              placeholder="Barrio, zona o lugar"
            >
          </label>

          <p class="community-post-extra-help">
            Puedes añadir una foto para dar contexto a tu recomendación.
          </p>
        `;
      }


      if (type === 'Barrio') {
        fields = `
          <label class="community-post-extra-field">
            <span>Barrio o zona <b>Obligatorio</b></span>
            <input
              type="text"
              data-post-zone
              placeholder="Ej. Barrio de Salamanca"
              required
            >
          </label>
        `;
      }


      if (type === 'Aviso') {
        fields = `
          <div class="community-post-extra-grid">

            <label class="community-post-extra-field">
              <span>Zona</span>
              <input
                type="text"
                data-post-zone
                placeholder="¿Dónde ocurre?"
              >
            </label>

            <label class="community-post-extra-field">
              <span>Vigente hasta</span>
              <input
                type="date"
                data-post-expires
              >
            </label>

          </div>

          <p class="community-post-extra-help">
            Cuando finalice la fecha, el aviso dejará de mostrarse
            en el feed de la comunidad.
          </p>
        `;
      }


      if (type === 'Experiencia') {
        fields = `
          <label class="community-post-extra-field">
            <span>¿Dónde ocurrió? <small>Opcional</small></span>
            <input
              type="text"
              data-post-zone
              placeholder="Zona o barrio"
            >
          </label>

          <p class="community-post-extra-help">
            Las experiencias funcionan mejor con una imagen.
          </p>
        `;
      }


      if (type === 'Vivienda') {
        fields = `
          <div class="community-housing-post-fields">

            <div class="community-post-extra-heading">
              <small>VIVIENDA</small>
              <h3>Comparte una vivienda real</h3>
              <p>
                Puedes vincular uno de tus anuncios publicados
                para que los miembros puedan abrirlo directamente.
              </p>
            </div>

            ${
              ownListings.length
                ? `
                  <label class="community-post-extra-field">
                    <span>Vivienda de ROOMS</span>

                    <select data-post-listing>
                      <option value="">
                        No vincular vivienda
                      </option>

                      ${ownListings.map(listing => `
                        <option value="${escapeHtml(listing.id)}">
                          ${escapeHtml(listing.title || listing.zone || 'Vivienda')}
                          · ${
                            listing.price != null
                              ? `${Number(listing.price).toLocaleString('es-ES')} €`
                              : 'Precio sin definir'
                          }
                        </option>
                      `).join('')}
                    </select>
                  </label>
                `
                : `
                  <div class="community-post-no-listings">
                    No tienes viviendas publicadas todavía.
                    Puedes compartir el post con una foto.
                  </div>
                `
            }

          </div>
        `;
      }


      textarea.insertAdjacentHTML(
        'afterend',
        `
          <div
            id="communityPostExtraFields"
            class="community-post-extra-fields"
          >
            ${fields}
          </div>
        `
      );
    }


    function enhanceCommunityPostComposer(content) {
      if (!content) return;

      renderCommunityPostFields(content);

      content
        .querySelectorAll('[data-selectable]')
        .forEach(button => {
          if (
            button.dataset.communityTypeListener === 'true'
          ) {
            return;
          }

          button.dataset.communityTypeListener = 'true';

          button.addEventListener('click', () => {
            setTimeout(() => {
              renderCommunityPostFields(content);
            }, 0);
          });
        });
    }

    return {
      selectedCommunityPostType,
      renderCommunityPostFields,
      enhanceCommunityPostComposer
    };
  }

  window.ROOMS_PUBLISH_COMMUNITY_FIELDS_FEATURE = {
    create: createPublishCommunityFieldsFeature
  };
})();
