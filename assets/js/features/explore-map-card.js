(function () {
  'use strict';

  function createExploreMapCardFeature({
    escapeHtml
  }) {
    function renderRealMapCard(item) {
      if (!item) return '';

      const kind = item.kind === 'apartment'
        ? 'Piso entero'
        : 'Habitación';

      const photo = item.photos?.[0] || '';
      const title =
        item.title ||
        (item.zone
          ? `${item.zone} · ${kind}`
          : kind);

      const specs = [
        item.rooms ? `${item.rooms} hab` : null,
        item.baths ? `${item.baths} baño${Number(item.baths) === 1 ? '' : 's'}` : null,
        item.area ? `${item.area} m²` : null
      ].filter(Boolean);

      const featureChips = Array.isArray(item.features)
        ? item.features.filter(Boolean).slice(0, 3)
        : [];

      let availableLabel = '';

      if (item.available_from) {
        const date = new Date(`${item.available_from}T12:00:00`);

        if (!Number.isNaN(date.getTime())) {
          availableLabel = date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short'
          });
        }
      }

      return `
        <div class="real-map-card-media">
          ${
            photo
              ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}">`
              : `<div class="real-map-card-placeholder">rooms.</div>`
          }
        </div>

        <div class="real-map-card-copy">
          <small>${escapeHtml(kind)}</small>

          <h2>${escapeHtml(item.zone || 'Zona sin definir')}</h2>

          <p class="real-map-card-price">
            ${
              item.price != null
                ? `
                  <b>${Number(item.price).toLocaleString('es-ES')} €</b>
                  <span>/ mes</span>
                `
                : '<b>Precio sin definir</b>'
            }
          </p>

          ${
            specs.length
              ? `<p class="real-map-card-specs">
                  ${specs.map(escapeHtml).join(' · ')}
                </p>`
              : ''
          }

          ${
            featureChips.length
              ? `<div class="real-map-card-features">
                  ${featureChips.map(feature => `
                    <span>${escapeHtml(feature)}</span>
                  `).join('')}
                </div>`
              : ''
          }

          ${
            availableLabel
              ? `<p class="real-map-card-availability">
                  Disponible ${escapeHtml(availableLabel)}
                </p>`
              : ''
          }

          <button
            type="button"
            data-real-map-open="${item.id}"
          >
            Ver vivienda →
          </button>
        </div>
      `;
    }

    return { renderRealMapCard };
  }

  window.ROOMS_EXPLORE_MAP_CARD_FEATURE = {
    create: createExploreMapCardFeature
  };
})();
