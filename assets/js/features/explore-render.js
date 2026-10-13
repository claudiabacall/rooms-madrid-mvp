(function () {
  'use strict';

  function createExploreRenderFeature({
    escapeHtml,
    renderRealMapCard,
    destroyExploreLeafletMap,
    initExploreLeafletMap
  }) {
  function renderRealExplore(listings) {
    const list = document.querySelector('#exploreList');
    const map = document.querySelector('#exploreMap');

    if (list) {
      if (!listings.length) {
        list.innerHTML = `
          <section class="real-feed-empty explore-real-empty">
            <span>⌕</span>
            <h2>Todavía no hay viviendas publicadas</h2>
            <p>Cuando aparezcan nuevas habitaciones o pisos, los encontrarás aquí.</p>
          </section>
        `;
      } else {
        list.innerHTML = `
          <div class="explore-results-heading">
            <p>
              <strong>${listings.length}</strong>
              ${listings.length === 1 ? 'resultado' : 'resultados'}
            </p>
          </div>

          <div class="explore-real-grid">
            ${listings.map(item => {
              const kind = item.kind === 'apartment'
                ? 'Piso entero'
                : 'Habitación';

              const photo = item.photos?.[0] || '';
              const title = item.title || `${item.zone} · ${kind}`;
              const description = item.description || '';
              const saveKind = item.kind === 'apartment'
                ? 'apartment'
                : 'room';

              return `
                <article
                  class="explore-property-card"
                  data-real-listing="${item.id}"
                  tabindex="0"
                >
                  <div class="explore-property-media">
                    ${
                      photo
                        ? `<img
                            src="${escapeHtml(photo)}"
                            alt="${escapeHtml(title)}"
                          >`
                        : `<div class="explore-property-placeholder">
                            <span>rooms.</span>
                          </div>`
                    }

                    <button
                      type="button"
                      class="explore-property-save"
                      data-save-kind="${saveKind}"
                      data-save-id="${item.id}"
                      aria-label="Guardar vivienda"
                    >♡</button>

                    <span class="explore-property-type">
                      ${escapeHtml(kind)}
                    </span>
                  </div>

                  <div class="explore-property-body">
                    <div class="explore-property-top">
                      <div>
                        <small>${escapeHtml(item.zone || 'Zona sin definir')}</small>
                        <h2>${escapeHtml(title)}</h2>
                      </div>

                      <p class="explore-property-price">
                        ${
                          item.price != null
                            ? `
                              <b>${Number(item.price).toLocaleString('es-ES')} €</b>
                              <span>/ mes</span>
                            `
                            : '<b>Precio sin definir</b>'
                        }
                      </p>
                    </div>

                    ${
                      description
                        ? `<p class="explore-property-description">
                            ${escapeHtml(description)}
                          </p>`
                        : ''
                    }

                    <div class="explore-property-footer">
                      <span>Publicado en Rooms</span>

                      <div class="explore-property-actions">
                        <button
                          type="button"
                          class="explore-send-home"
                          data-send-home-id="${item.id}"
                        >
                          ＋ Grupo
                        </button>

                        <button
                          type="button"
                          class="explore-property-open"
                          data-real-listing="${item.id}"
                        >
                          Ver vivienda →
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    if (map) {
      destroyExploreLeafletMap();

      if (!listings.length) {
        map.innerHTML = `
          <section class="real-feed-empty compact explore-map-pending">
            <span>⌖</span>
            <h2>Sin viviendas en el mapa</h2>
            <p>Cuando haya anuncios publicados aparecerán aquí.</p>
          </section>
        `;
      } else {
        const mappedListings = listings.filter(item => {
          const latitude = Number(item.latitude);
          const longitude = Number(item.longitude);

          return (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
          );
        });

        const first = mappedListings[0] || listings[0];

        map.innerHTML = `
          <div class="real-map-layout">
            <div
              class="rooms-leaflet-map"
              id="realExploreMap"
              aria-label="Mapa de viviendas en Madrid"
            ></div>

            <div class="rooms-map-results-count" id="mapVisibleCount"></div>

            <article
              class="real-map-card"
              id="realMapCard"
              data-map-selected="${first?.id || ''}"
            >
              ${renderRealMapCard(first)}
            </article>
          </div>
        `;

        window.setTimeout(() => {
          initExploreLeafletMap(listings);
        }, 0);
      }
    }
  }

    return {
      renderRealExplore
    };
  }

  window.ROOMS_EXPLORE_RENDER_FEATURE = {
    create: createExploreRenderFeature
  };
})();
