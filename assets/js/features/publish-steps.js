(function () {
  'use strict';

  function createPublishStepsFeature({
    state,
    publishTotals,
    selectedCommunityPostType
  }) {
    function currentPublishType() {
      const label = document.querySelector('#publishFlowKind')?.textContent || '';
      if (label.includes('OFRECER')) return 'room';
      if (label.includes('PUBLICAR PISO')) return 'apartment';
      if (label.includes('COMPAÑERO')) return 'mate';
      if (label.includes('EXTERNA') || label.includes('COMPARTIR')) return 'external';
      if (label.includes('PUBLICACIÓN')) return 'post';
      return null;
    }

    function currentPublishStep(type = currentPublishType()) {
      const width = parseFloat(document.querySelector('#publishProgressBar')?.style.width || '0');
      return Math.max(0, Math.round(width / (100 / (publishTotals[type] || 1))) - 1);
    }

    function capturePublishStep() {
      const type = currentPublishType();
      if (!type) return null;
      if (state.publishType !== type) {
        state.publishType = type;
        state.publishDraft = { steps: {}, files: [] };
      }
      const step = currentPublishStep(type);
      const content = document.querySelector('#publishFlowContent');
      const values = [...content.querySelectorAll(
        'input:not([type="file"]):not([data-exact-address]):not([data-auto-zone-input]),textarea,select'
      )].map(field => field.value.trim());
      const selected = [...content.querySelectorAll('[data-selectable][aria-pressed="true"]')].map(button => button.textContent.trim());
      let meta = {};

      if (type === 'post') {
        meta = {
          zone:
            content
              .querySelector('[data-post-zone]')
              ?.value
              .trim() || null,

          expiresAt:
            content
              .querySelector('[data-post-expires]')
              ?.value || null,

          listingId:
            content
              .querySelector('[data-post-listing]')
              ?.value || null,

          communityPostType:
            selectedCommunityPostType(content)
        };
      }

      if (
        (type === 'room' || type === 'apartment') &&
        step === 0
      ) {
        meta = {
          ...meta,
          exactAddress:
            content
              .querySelector('[data-exact-address]')
              ?.value
              .trim() || null
        };
      }

      state.publishDraft.steps[step] = {
        values,
        selected,
        meta
      };

      return {
        type,
        step,
        values,
        selected,
        meta
      };
    }

    return {
      currentPublishType,
      currentPublishStep,
      capturePublishStep
    };
  }

  window.ROOMS_PUBLISH_STEPS_FEATURE = {
    create: createPublishStepsFeature
  };
})();
