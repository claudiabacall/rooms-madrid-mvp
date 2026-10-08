(function () {
  'use strict';

  function createListingsFeature({
    state,
    escapeHtml,
    showModal
  }) {
function openRealListingDetail(listing) {
      const detail = document.querySelector('#detailContent');
      if (!detail) return;

      const kind =
        listing.kind === 'apartment'
          ? 'Piso entero'
          : listing.kind === 'external'
            ? 'Fuente externa'
            : 'Habitación';

      const zone = listing.zone || null;

      const title =
        listing.title ||
        (zone
          ? `${kind} en ${zone}`
          : kind);

      const price =
        listing.price != null
          ? Number(listing.price).toLocaleString('es-ES')
          : null;

      const date =
        listing.available_from
          ? new Intl.DateTimeFormat('es-ES', {
              day: 'numeric',
              month: 'short'
            }).format(
              new Date(`${listing.available_from}T00:00:00`)
            )
          : null;

      const photos =
        Array.isArray(listing.photos)
          ? listing.photos
          : [];

      const features =
        Array.isArray(listing.features)
          ? listing.features
          : [];

      const facts = [
        listing.rooms
          ? { value: listing.rooms, label: listing.rooms === 1 ? 'habitación' : 'habitaciones' }
          : null,

        listing.baths
          ? { value: listing.baths, label: listing.baths === 1 ? 'baño' : 'baños' }
          : null,

        listing.area
          ? { value: `${listing.area}`, label: 'm²' }
          : null
      ].filter(Boolean);

      detail.innerHTML = `
        <article class="rooms-property-sheet">

          <section
            class="rooms-property-gallery"
            ${photos.length ? 'data-carousel data-index="0"' : ''}
          >

            ${
              photos.length
                ? `
                  <div class="rooms-property-gallery-track">
                    ${photos.map((photo, index) => `
                      <img
                        ${index === 0 ? 'class="active"' : ''}
                        data-carousel-slide
                        src="${escapeHtml(photo)}"
                        alt="${escapeHtml(title)} · foto ${index + 1}"
                      >
                    `).join('')}
                  </div>

                  ${
                    photos.length > 1
                      ? `
                        <button
                          type="button"
                          class="rooms-gallery-arrow rooms-gallery-prev"
                          data-carousel-prev
                          aria-label="Foto anterior"
                        >←</button>

                        <button
                          type="button"
                          class="rooms-gallery-arrow rooms-gallery-next"
                          data-carousel-next
                          aria-label="Foto siguiente"
                        >→</button>
                      `
                      : ''
                  }

                  <div class="carousel-dots rooms-gallery-dots">
                    ${photos.map((_, index) => `
                      <i class="${index === 0 ? 'active' : ''}"></i>
                    `).join('')}
                  </div>

                  <span class="rooms-gallery-count">
                    1 / ${photos.length}
                  </span>
                `
                : `
                  <div class="rooms-property-no-photo">
                    <b>rooms.</b>
                    <span>Fotos pendientes</span>
                  </div>
                `
            }

            <div class="rooms-gallery-top">
              <span class="rooms-property-type">
                ${escapeHtml(kind)}
              </span>

              <button
                type="button"
                class="rooms-property-heart"
                data-detail-save
                data-save-kind="${listing.kind === 'apartment' ? 'apartment' : 'room'}"
                data-save-id="${listing.id}"
                aria-label="Guardar vivienda"
              >
                ♡
              </button>
            </div>

          </section>


          <section class="rooms-property-info">

            <div class="rooms-property-heading">

              <div class="rooms-property-location">
                <span>${escapeHtml(zone)}</span>
                <i></i>
                <span>${escapeHtml(kind)}</span>
              </div>

              <h1>${escapeHtml(title)}</h1>

              <div class="rooms-property-price">
                <b>${price} €</b>
                <span>/ mes</span>
              </div>

            </div>


            <div class="rooms-property-availability">
              <span>Disponibilidad</span>
              <b>${date ? escapeHtml(date) : 'Sin definir'}</b>
            </div>


            ${
              facts.length
                ? `
                  <div class="rooms-property-facts">
                    ${facts.map(fact => `
                      <div>
                        <b>${escapeHtml(String(fact.value))}</b>
                        <span>${escapeHtml(fact.label)}</span>
                      </div>
                    `).join('')}
                  </div>
                `
                : ''
            }


            ${
              features.length
                ? `
                  <div class="rooms-property-features">
                    ${features.map(feature => `
                      <span>${escapeHtml(feature)}</span>
                    `).join('')}
                  </div>
                `
                : ''
            }


            <div class="real-report-row">
              <button
                type="button"
                class="real-report-button"
                data-real-report
                data-report-type="listing"
                data-report-id="${escapeHtml(String(listing.id))}"
                data-report-user="${escapeHtml(String(
                  listing.user_id ||
                  listing.owner_id ||
                  listing.author_id ||
                  ''
                ))}"
              >
                Reportar anuncio
              </button>
            </div>

            <div class="rooms-property-copy">
              <small>SOBRE ESTA VIVIENDA</small>

              <p>
                ${escapeHtml(
                  listing.description ||
                  'El anunciante todavía no ha añadido una descripción.'
                )}
              </p>
            </div>


            <div class="rooms-property-actions">

              <button
                type="button"
                class="rooms-property-action-primary"
                data-detail-save
                data-save-kind="${listing.kind === 'apartment' ? 'apartment' : 'room'}"
                data-save-id="${listing.id}"
              >
                ♡ Guardar
              </button>

              ${
                state.household
                  ? `
                    <button
                      type="button"
                      class="rooms-property-action-group"
                      data-send-home-id="${listing.id}"
                    >
                      ＋ Añadir al grupo
                    </button>
                  `
                  : ''
              }

              <button
                type="button"
                class="rooms-property-action-light"
                data-share-real-listing="${listing.id}"
              >
                Compartir ↗
              </button>

            </div>

            ${
              listing.owner_id === state.user.id
                ? `
                  <button
                    type="button"
                    class="rooms-property-edit"
                    data-edit-listing="${listing.id}"
                  >
                    Editar mi anuncio
                  </button>
                `
                : ''
            }

          </section>

        </article>
      `;

      showModal(document.querySelector('#detailModal'));
    }

    return {
      openRealListingDetail
    };
  }

  window.ROOMS_LISTINGS_FEATURE = {
    create: createListingsFeature
  };
})();
