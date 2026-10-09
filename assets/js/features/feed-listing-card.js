(function () {
  'use strict';

  function createFeedListingCardFeature({
    state,
    escapeHtml
  }) {
    function renderListingCard(listing) {
      if (
        !listing ||
        (
          listing.owner_id &&
          state.blockedUsers?.has(listing.owner_id)
        )
      ) {
        return '';
      }

      const photos =
        Array.isArray(listing.photos)
          ? listing.photos
          : [];

      const photoCount = photos.length;

      const kind =
        listing.kind === 'apartment'
          ? 'Piso entero'
          : listing.kind === 'external'
            ? 'Fuente externa'
            : 'Habitación';

      const zone =
        listing.zone || null;

      const title =
        listing.title ||
        (zone
          ? `${kind} en ${zone}`
          : kind);

      const price =
        listing.price != null
          ? Number(listing.price).toLocaleString('es-ES')
          : null;

      const available =
        listing.available_from
          ? new Intl.DateTimeFormat('es-ES', {
              day: 'numeric',
              month: 'short'
            }).format(
              new Date(`${listing.available_from}T00:00:00`)
            )
          : null;

      const facts = [
        listing.rooms
          ? `${listing.rooms} ${listing.rooms === 1 ? 'hab' : 'hab'}`
          : null,
        listing.baths
          ? `${listing.baths} ${listing.baths === 1 ? 'baño' : 'baños'}`
          : null,
        listing.area
          ? `${listing.area} m²`
          : null
      ].filter(Boolean);

      const features =
        Array.isArray(listing.features)
          ? listing.features.slice(0, 4)
          : [];

      return `
        <article
          class="feed-card rooms-home-property-card"
          data-feed-type="${listing.kind === 'apartment' ? 'flat' : 'home'}"
          data-real-listing="${listing.id}"
          tabindex="0"
        >

          <div
            class="rooms-home-property-media"
            ${photoCount ? 'data-carousel data-index="0"' : ''}
          >

            ${
              photoCount
                ? `
                  <div class="rooms-home-gallery-track">
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
                    photoCount > 1
                      ? `
                        <button
                          type="button"
                          class="rooms-home-gallery-arrow previous"
                          data-carousel-prev
                          aria-label="Foto anterior"
                        >←</button>

                        <button
                          type="button"
                          class="rooms-home-gallery-arrow next"
                          data-carousel-next
                          aria-label="Foto siguiente"
                        >→</button>
                      `
                      : ''
                  }

                  <div class="carousel-dots rooms-home-gallery-dots">
                    ${photos.map((_, index) => `
                      <i class="${index === 0 ? 'active' : ''}"></i>
                    `).join('')}
                  </div>

                  <span class="rooms-home-photo-count">
                    1 / ${photoCount}
                  </span>
                `
                : `
                  <div class="rooms-home-property-placeholder">
                    <b>rooms.</b>
                    <span>Fotos pendientes</span>
                  </div>
                `
            }

            <div class="rooms-home-property-overlay">
              <span class="rooms-home-property-type">
                ${escapeHtml(kind)}
              </span>

              <button
                type="button"
                class="rooms-home-property-save"
                data-save-kind="${listing.kind === 'apartment' ? 'apartment' : 'room'}"
                data-save-id="${listing.id}"
                aria-label="Guardar vivienda"
              >
                ♡
              </button>
            </div>

          </div>


          <div class="rooms-home-property-body">

            <div class="rooms-home-property-heading">
              <div>
                <small>${escapeHtml(zone)}</small>
                <h2>${escapeHtml(title)}</h2>
              </div>

              <div class="rooms-home-property-price">
                ${
                  price
                    ? `
                      <b>${price} €</b>
                      <span>/ mes</span>
                    `
                    : '<b>Precio sin definir</b>'
                }
              </div>
            </div>

            <div class="rooms-home-property-availability">
              ${
                available
                  ? `Disponible ${escapeHtml(available)}`
                  : 'Disponibilidad sin definir'
              }
            </div>

            ${
              facts.length
                ? `
                  <div class="rooms-home-property-facts">
                    ${facts.map(fact => `
                      <span>${escapeHtml(fact)}</span>
                    `).join('')}
                  </div>
                `
                : ''
            }

            ${
              features.length
                ? `
                  <div class="rooms-home-property-features">
                    ${features.map(feature => `
                      <span>${escapeHtml(feature)}</span>
                    `).join('')}
                  </div>
                `
                : ''
            }

            ${
              listing.description
                ? `
                  <p class="rooms-home-property-description">
                    ${escapeHtml(listing.description)}
                  </p>
                `
                : ''
            }

            <div class="rooms-home-property-footer">
              <span>Publicado en Rooms</span>

              <button
                type="button"
                class="rooms-home-property-open"
                data-real-listing="${listing.id}"
              >
                Ver vivienda →
              </button>
            </div>

          </div>

        </article>
      `;
    }

    return {
      renderListingCard
    };
  }

  window.ROOMS_FEED_LISTING_CARD_FEATURE = {
    create: createFeedListingCardFeature
  };
})();
