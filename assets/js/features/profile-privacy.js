(function () {
  'use strict';

  function createProfilePrivacyFeature({
    db,
    state,
    notify
  }) {
function renderProfilePrivacySettings() {
      const privacy = state.preferences?.answers?.privacy || {};
      const level = privacy.level || 'balanced';
      const controls = privacy.controls || {};

      document.querySelectorAll('[data-profile-privacy-level]').forEach(button => {
        const active = button.dataset.profilePrivacyLevel === level;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      document.querySelectorAll('[data-profile-privacy-row]').forEach(row => {
        const key = row.dataset.profilePrivacyRow;
        const value = controls[key] || (key === 'living' ? 'private' : 'public');

        row.querySelectorAll('[data-privacy-value]').forEach(button => {
          const active = button.dataset.privacyValue === value;
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      });
    }

    const profilePrivacyPresets = {
      open: {
        living: 'public',
        search: 'public',
        budget: 'public',
        activity: 'public'
      },
      balanced: {
        living: 'private',
        search: 'public',
        budget: 'connections',
        activity: 'public'
      },
      private: {
        living: 'private',
        search: 'private',
        budget: 'private',
        activity: 'private'
      }
    };

    function applyProfilePrivacyControls(controls) {
      document.querySelectorAll('[data-profile-privacy-row]').forEach(row => {
        const key = row.dataset.profilePrivacyRow;
        const value = controls[key] || (key === 'living' ? 'private' : 'public');

        row.querySelectorAll('[data-privacy-value]').forEach(button => {
          const active = button.dataset.privacyValue === value;
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      });
    }

    function detectProfilePrivacyLevel() {
      const current = {};

      document.querySelectorAll('[data-profile-privacy-row]').forEach(row => {
        current[row.dataset.profilePrivacyRow] =
          row.querySelector('[data-privacy-value].active')
            ?.dataset.privacyValue || (key === 'living' ? 'private' : 'public');
      });

      return Object.entries(profilePrivacyPresets).find(([, preset]) =>
        Object.keys(preset).every(key => preset[key] === current[key])
      )?.[0] || 'custom';
    }

    function renderProfilePrivacyLevel(level) {
      document.querySelectorAll('[data-profile-privacy-level]').forEach(button => {
        const active = button.dataset.profilePrivacyLevel === level;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    document.addEventListener('click', event => {
      const levelButton = event.target.closest('[data-profile-privacy-level]');

      if (levelButton) {
        const level = levelButton.dataset.profilePrivacyLevel;
        const preset = profilePrivacyPresets[level];

        renderProfilePrivacyLevel(level);

        if (preset) {
          applyProfilePrivacyControls(preset);
        }

        return;
      }

      const privacyButton = event.target.closest(
        '[data-profile-privacy-row] [data-privacy-value]'
      );

      if (privacyButton) {
        const row = privacyButton.closest('[data-profile-privacy-row]');

        row.querySelectorAll('[data-privacy-value]').forEach(button => {
          button.classList.toggle('active', button === privacyButton);
          button.setAttribute(
            'aria-pressed',
            button === privacyButton ? 'true' : 'false'
          );
        });

        renderProfilePrivacyLevel(
          detectProfilePrivacyLevel()
        );

        return;
      }

      if (event.target.closest('#saveProfilePrivacy')) {
        const level =
          detectProfilePrivacyLevel();

        const controls = {};

        document.querySelectorAll('[data-profile-privacy-row]').forEach(row => {
          const key = row.dataset.profilePrivacyRow;
          const value =
            row.querySelector('[data-privacy-value].active')
              ?.dataset.privacyValue || (key === 'living' ? 'private' : 'public');

          controls[key] = value;
        });

        const answers = {
          ...(state.preferences?.answers || {}),
          privacy: {
            ...(state.preferences?.answers?.privacy || {}),
            level,
            controls
          }
        };

        db.from('onboarding_preferences')
          .upsert({
            user_id: state.user.id,
            answers
          })
          .then(({ error }) => {
            if (error) {
              console.error('Rooms: error guardando privacidad', error);
              notify('No se pudo guardar tu privacidad');
              return;
            }

            state.preferences = {
              ...(state.preferences || {}),
              answers
            };

            notify('Privacidad actualizada');
          });
      }
    });

    const originalOpenSettings = window.openSettings;
    if (typeof originalOpenSettings === 'function') {
      window.openSettings = (...args) => {
        const result = originalOpenSettings(...args);
        setTimeout(renderProfilePrivacySettings, 0);
        return result;
      };
    }

    setTimeout(renderProfilePrivacySettings, 0);

    return {
      renderProfilePrivacySettings,
      applyProfilePrivacyControls,
      detectProfilePrivacyLevel,
      renderProfilePrivacyLevel
    };
  }

  window.ROOMS_PROFILE_PRIVACY_FEATURE = {
    create: createProfilePrivacyFeature
  };
})();
