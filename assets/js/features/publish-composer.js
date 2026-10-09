(function () {
  'use strict';

  function createPublishComposerFeature({
    state,
    currentPublishType,
    currentPublishStep,
    enhanceCommunityPostComposer,
    escapeHtml,
    formatBudget,
    initials,
    notify
  }) {
    function prepareListingLocationField(
      content,
      type,
      step,
      saved
    ) {
      if (
        !content ||
        step !== 0 ||
        !['room', 'apartment'].includes(type)
      ) {
        return;
      }

      const existing =
        content.querySelector('[data-exact-address]');

      if (existing) {
        existing.value =
          saved?.meta?.exactAddress || '';
        return;
      }

      const regularFields =
        [...content.querySelectorAll(
          'input:not([type="file"]),textarea,select'
        )];

      const zoneField = regularFields[0];

      if (!zoneField) return;

      const zoneContainer =
        zoneField.closest('label') ||
        zoneField.parentElement;

      if (!zoneContainer) return;

      /*
        Para vivienda, la zona pública se obtiene automáticamente
        desde la dirección exacta geocodificada.
      */
      zoneField.value = '';
      zoneField.removeAttribute('required');
      zoneField.dataset.autoZoneInput = 'true';
      zoneContainer.hidden = true;
      zoneContainer.dataset.autoZoneField = 'true';

      const wrapper =
        document.createElement('div');

      wrapper.className =
        'publish-private-location';

      wrapper.innerHTML = `
        <label class="publish-private-location-field">
          <span>
            Dirección exacta
            <b>Obligatorio</b>
          </span>

          <input
            type="text"
            data-exact-address
            autocomplete="street-address"
            placeholder="Ej. Calle de Serrano 55, Madrid"
            value="${escapeHtml(saved?.meta?.exactAddress || '')}"
          >
        </label>

        <p class="publish-private-location-help">
          <span>⌖</span>
          <span>
            <b>Tu dirección exacta es privada.</b>
            Solo la usamos para situar la vivienda.
            En Rooms se mostrará una ubicación aproximada.
          </span>
        </p>

        <p
          class="publish-detected-zone"
          data-detected-zone
          hidden
        ></p>
      `;

      zoneContainer.insertAdjacentElement(
        'afterend',
        wrapper
      );
    }


    function preparePublishStep() {
      const type = currentPublishType();
      if (!type) return;
      if (state.publishType !== type) {
        state.publishType = type;
        state.publishDraft = { steps: {}, files: [] };
      }
      const step = currentPublishStep(type);
      const content = document.querySelector('#publishFlowContent');
      const saved = state.publishDraft.steps[step];
      const fields = [...content.querySelectorAll(
        'input:not([type="file"]):not([data-exact-address]):not([data-auto-zone-input]),textarea,select'
      )];

      fields.forEach((field, index) => {
        if (saved) field.value = saved.values[index] || '';
        else if (field.tagName !== 'SELECT') field.value = '';
      });

      prepareListingLocationField(
        content,
        type,
        step,
        saved
      );
      content.querySelectorAll('.linked-people article').forEach(item => item.remove());
      content.querySelectorAll('.completion-card strong').forEach(item => { item.textContent = '✓'; });
      content.querySelectorAll('.completion-card b').forEach(item => { item.textContent = 'Datos del anuncio'; });
      content.querySelectorAll('.completion-card span').forEach(item => { item.textContent = 'La publicación se creará únicamente con lo que hayas añadido.'; });

      if (type === 'mate' && step === 0 && !saved) {
        const inputs = content.querySelectorAll('input');
        if (inputs[0]) inputs[0].value = (state.profile?.zones || []).join(', ');
        if (inputs[1]) inputs[1].value = formatBudget(state.profile || {});
        if (inputs[2]) inputs[2].value = state.profile?.move_in_date || '';
      }
      if (type === 'post' && step === 0) {
        enhanceCommunityPostComposer(content);
      }

      preparePhotoUploader(content);
      renderPublishPreview(type, step, content);
    }

    function preparePhotoUploader(content) {
      const button = content.querySelector('.photo-drop');
      if (!button) return;
      if (button.dataset.realUploader === 'true') return;
      button.dataset.realUploader = 'true';
      const count = state.publishDraft.files?.length || 0;
      button.innerHTML = `<span>＋</span><b>${count ? `${count} ${count === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}` : 'Añadir fotos'}</b><small>Hasta 10 imágenes · JPG, PNG, WebP o HEIC</small>`;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/heic';
      input.multiple = true;
      input.hidden = true;
      button.insertAdjacentElement('afterend', input);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        input.click();
      });
      input.addEventListener('change', () => {
        const files = [...input.files].slice(0, 10);
        const tooLarge = files.find(file => file.size > 10 * 1024 * 1024);
        if (tooLarge) {
          notify(`${tooLarge.name} supera el límite de 10 MB`);
          return;
        }
        state.publishDraft.files = files;
        button.innerHTML = `<span>✓</span><b>${files.length} ${files.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}</b><small>Pulsa para cambiarlas</small>`;
      });
    }

    function renderPublishPreview(type, step, content) {
      const preview = content.querySelector('.publish-preview,.mate-preview,.post-preview,.imported-listing');
      if (!preview) return;
      if (type === 'post') {
        const body = state.publishDraft.steps[0]?.values?.[0] || '';
        const name = state.profile?.alias || state.profile?.name || 'Mi perfil';
        preview.innerHTML = `<header><span>${escapeHtml(initials(name))}</span><div><b>${escapeHtml(name)}</b><small>Vista previa</small></div></header><p>${escapeHtml(body || 'Tu publicación aparecerá aquí.')}</p>`;
        return;
      }
      if (type === 'mate') {
        const name = state.profile?.alias || state.profile?.name || 'Mi perfil';
        const values = state.publishDraft.steps[0]?.values || [];
        preview.innerHTML = `<span class="preview-avatar">${escapeHtml(initials(name))}</span><div><h3>${escapeHtml(name)} busca compañeros</h3><p>${escapeHtml(values[0] || 'Zonas sin definir')} · ${escapeHtml(values[1] || 'Presupuesto sin definir')}</p></div>`;
        return;
      }
      if (type === 'external') {
        preview.innerHTML = '<div><span>FUENTE EXTERNA</span><h3>La información se mostrará cuando podamos verificar el enlace.</h3><p>Nunca inventaremos precio, zona ni características.</p></div>';
        return;
      }
      const values = state.publishDraft.steps[0]?.values || [];
      const features = state.publishDraft.steps[1]?.selected || [];
      preview.innerHTML = `<span>VISTA PREVIA</span><h3>${escapeHtml(values[0] || '—')} €/mes</h3><p>${type === 'apartment' ? 'Piso entero' : 'Habitación'} · ${escapeHtml(values[1] || 'Sin definir')}</p><div>${features.map(item => `<i>${escapeHtml(item)}</i>`).join('')}</div>`;
    }

    return {
      prepareListingLocationField,
      preparePublishStep,
      preparePhotoUploader,
      renderPublishPreview
    };
  }

  window.ROOMS_PUBLISH_COMPOSER_FEATURE = {
    create: createPublishComposerFeature
  };
})();
